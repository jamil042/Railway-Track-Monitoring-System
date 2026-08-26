import type { Firestore } from 'firebase-admin/firestore'

/**
 * Minimal in-memory Firestore shim. Used as a fallback when the real
 * Firebase/Firestore is unreachable (e.g. free-tier quota exhausted) so the
 * whole system keeps running for demo/development. Data lives in RAM only —
 * it resets when the backend restarts.
 *
 * Implements exactly the API subset used by the backend services:
 * collection().doc().get/set/update/delete, where('=='), orderBy, limit,
 * batch().set/update/delete/commit, runTransaction(get/set/update).
 */

type DocData = Record<string, unknown>

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
    private store: MemoryStore,
    public colName: string,
    public id: string,
  ) {}

  async get(): Promise<Snapshot> {
    const col = this.store.cols.get(this.colName)
    return new Snapshot(this.id, col?.get(this.id), this)
  }

  async set(data: DocData): Promise<void> {
    let col = this.store.cols.get(this.colName)
    if (!col) {
      col = new Map()
      this.store.cols.set(this.colName, col)
    }
    col.set(this.id, { ...data })
  }

  async update(data: DocData): Promise<void> {
    const col = this.store.cols.get(this.colName)
    const existing = col?.get(this.id)
    if (!existing) throw new Error(`No document to update: ${this.colName}/${this.id}`)
    col!.set(this.id, { ...existing, ...data })
  }

  async delete(): Promise<void> {
    this.store.cols.get(this.colName)?.delete(this.id)
  }
}

class Query {
  constructor(
    private docs: Snapshot[],
    private apply: (docs: Snapshot[]) => Snapshot[],
  ) {}

  where(field: string, op: string, value: unknown): Query {
    if (op !== '==') throw new Error(`Memory shim supports only '==' (got '${op}')`)
    return new Query(this.docs, (d) =>
      this.apply(d).filter((s) => s._data?.[field] === value),
    )
  }

  orderBy(field: string): Query {
    return new Query(this.docs, (d) =>
      [...this.apply(d)].sort((a, b) =>
        String(a._data?.[field] ?? a.id).localeCompare(String(b._data?.[field] ?? b.id)),
      ),
    )
  }

  limit(n: number): Query {
    return new Query(this.docs, (d) => this.apply(d).slice(0, n))
  }

  async get() {
    const docs = this.apply(this.docs)
    return { docs, empty: docs.length === 0, size: docs.length }
  }
}

export interface MemoryStore {
  cols: Map<string, Map<string, DocData>>
}

export function createMemoryFirestore(): Firestore {
  const store: MemoryStore = { cols: new Map() }

  const firestore = {
    collection(name: string) {
      const all = (): Snapshot[] => {
        const col = store.cols.get(name)
        if (!col) return []
        return [...col.entries()].map(([id, data]) => new Snapshot(id, data, new DocRef(store, name, id)))
      }

      return {
        doc(id?: string) {
          const docId = id ?? `m${Math.random().toString(36).slice(2, 10)}`
          return new DocRef(store, name, docId)
        },
        where(field: string, op: string, value: unknown) {
          return new Query(all(), (d) => d).where(field, op, value)
        },
        orderBy(field: string) {
          return new Query(all(), (d) => d).orderBy(field)
        },
        limit(n: number) {
          return new Query(all(), (d) => d).limit(n)
        },
        count() {
          return {
            get: async () => ({ data: () => ({ count: all().length }) }),
          }
        },
        async get() {
          return new Query(all(), (d) => d).get()
        },
      }
    },
    batch() {
      const ops: Array<() => Promise<void>> = []
      return {
        set(ref: DocRef, data: DocData) {
          ops.push(() => ref.set(data))
          return this
        },
        update(ref: DocRef, data: DocData) {
          ops.push(() => ref.update(data))
          return this
        },
        delete(ref: DocRef) {
          ops.push(() => ref.delete())
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
      // Sequential execution approximates transactional behaviour well enough
      // for this single-process backend.
      return fn(tx)
    },
  }

  return firestore as unknown as Firestore
}
