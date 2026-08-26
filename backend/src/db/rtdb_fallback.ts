import type { Firestore } from 'firebase-admin/firestore'
import { rtdb } from './rtdb.js'

/**
 * Persistent fallback for Firestore: same minimal API surface used by the
 * services, but data lives in the Realtime Database under `firestore_mirror/`.
 *
 * Why: Firestore free tier counts every read/write (quota exhausts fast),
 * while RTDB has NO per-operation limits. With this mirror the whole backend
 * keeps working across restarts without burning any quota.
 *
 * All reads are served from an in-memory cache hydrated once at startup;
 * every write goes through to RTDB (write-through). Dataset here is small
 * (60 tracks, ~dozens of faults/tasks), so memory queries are instant.
 */

const MIRROR = 'firestore_mirror'

type DocData = Record<string, unknown>
type ColMap = Map<string, DocData>

class Snapshot {
  constructor(
    public id: string,
    public _data: DocData | undefined,
    public ref: DocRef,
  ) {}
  get exists(): boolean {
    return this._data !== undefined
  }
  data(): DocData {
    return this._data ?? {}
  }
}

class DocRef {
  constructor(
    private cols: Map<string, ColMap>,
    private persist: (col: string, id: string, data: DocData | null) => void,
    public colName: string,
    public id: string,
  ) {}

  async get(): Promise<Snapshot> {
    return new Snapshot(this.id, this.cols.get(this.colName)?.get(this.id), this)
  }

  async set(data: DocData): Promise<void> {
    let col = this.cols.get(this.colName)
    if (!col) {
      col = new Map()
      this.cols.set(this.colName, col)
    }
    col.set(this.id, { ...data })
    this.persist(this.colName, this.id, data)
  }

  async update(data: DocData): Promise<void> {
    const existing = this.cols.get(this.colName)?.get(this.id)
    if (!existing) throw new Error(`No document to update: ${this.colName}/${this.id}`)
    const merged = { ...existing, ...data }
    this.cols.get(this.colName)!.set(this.id, merged)
    this.persist(this.colName, this.id, merged)
  }

  async delete(): Promise<void> {
    this.cols.get(this.colName)?.delete(this.id)
    this.persist(this.colName, this.id, null)
  }
}

class Query {
  constructor(
    private apply: (docs: Snapshot[]) => Snapshot[],
    private docsFactory: () => Snapshot[],
  ) {}

  where(field: string, op: string, value: unknown): Query {
    if (op !== '==') throw new Error(`RTDB mirror supports only '==' (got '${op}')`)
    return new Query((d) => this.apply(d).filter((s) => s._data?.[field] === value), this.docsFactory)
  }

  orderBy(field: string): Query {
    return new Query((d) =>
      [...this.apply(d)].sort((a, b) => {
        const av = a._data?.[field] ?? a.id
        const bv = b._data?.[field] ?? b.id
        return String(av).localeCompare(String(bv))
      }),
      this.docsFactory,
    )
  }

  limit(n: number): Query {
    return new Query((d) => this.apply(d).slice(0, n), this.docsFactory)
  }

  async get() {
    const docs = this.apply(this.docsFactory())
    return { docs, empty: docs.length === 0, size: docs.length }
  }
}

export async function createRtdbMirrorFirestore(): Promise<Firestore> {
  const cols = new Map<string, ColMap>()

  // ---- Hydrate once from RTDB ----
  const root = await rtdb.ref(MIRROR).get()
  const raw = (root.val() ?? {}) as Record<string, Record<string, DocData>>
  for (const [colName, docs] of Object.entries(raw)) {
    const col: ColMap = new Map()
    for (const [id, data] of Object.entries(docs ?? {})) {
      if (data && typeof data === 'object') col.set(id, data)
    }
    cols.set(colName, col)
  }

  const snapshotAll = (name: string): Snapshot[] => {
    const col = cols.get(name)
    if (!col) return []
    return [...col.entries()].map(([id, data]) => new Snapshot(id, data, new DocRef(cols, persist, name, id)))
  }

  // ---- Write-through persistence (queued, best-effort) ----
  const pending = new Map<string, DocData | null>()
  let timer: ReturnType<typeof setTimeout> | null = null
  function persist(colName: string, id: string, data: DocData | null): void {
    pending.set(`${colName}/${id}`, data)
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      const updates: Record<string, unknown> = {}
      for (const [path, value] of pending) updates[path] = value
      pending.clear()
      // Fire-and-forget multi-path update — failures logged, never crash API
      rtdb.ref(MIRROR).update(updates).catch((e) => console.error('[MIRROR] persist failed:', String(e).slice(0, 120)))
    }, 300)
  }

  const firestore = {
    collection(name: string) {
      const q = () => new Query((d) => d, () => snapshotAll(name))
      return {
        doc(id?: string) {
          const docId = id ?? `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
          return new DocRef(cols, persist, name, docId)
        },
        where(field: string, op: string, value: unknown) {
          return q().where(field, op, value)
        },
        orderBy(field: string) {
          return q().orderBy(field)
        },
        limit(n: number) {
          return q().limit(n)
        },
        count() {
          return { get: async () => ({ data: () => ({ count: snapshotAll(name).length }) }) }
        },
        async get() {
          return q().get()
        },
      }
    },
    batch() {
      const ops: Array<() => void> = []
      return {
        set(ref: DocRef, data: DocData) {
          ops.push(() => void ref.set(data))
          return this
        },
        update(ref: DocRef, data: DocData) {
          ops.push(() => void ref.update(data))
          return this
        },
        delete(ref: DocRef) {
          ops.push(() => void ref.delete())
          return this
        },
        async commit() {
          for (const op of ops) await op()
        },
      }
    },
    async runTransaction<T>(fn: (tx: {
      get(ref: DocRef): Promise<Snapshot>
      set(ref: DocRef, data: DocData): void
      update(ref: DocRef, data: DocData): void
      delete(ref: DocRef): void
    }) => Promise<T>): Promise<T> {
      const tx = {
        get: (ref: DocRef) => ref.get(),
        set: (ref: DocRef, data: DocData) => void ref.set(data),
        update: (ref: DocRef, data: DocData) => void ref.update(data),
        delete: (ref: DocRef) => void ref.delete(),
      }
      // Single-process backend — sequential execution is safe here.
      return fn(tx)
    },
  }

  console.log(`[DB] RTDB mirror ready (${cols.size} collections hydrated)`)
  return firestore as unknown as Firestore
}
