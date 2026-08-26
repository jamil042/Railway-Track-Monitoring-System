/**
 * Minimal in-memory Realtime Database shim (fallback when RTDB is
 * unavailable). Supports only the subset used by the telemetry pipeline:
 * ref().child().get/set/update/remove/push/limitToLast.
 */

export interface MemoryRtdb {
  ref(path?: string): MemoryRtdbRef
}

export interface MemoryRtdbRef {
  child(p: string): MemoryRtdbRef
  get(): Promise<{ val(): unknown; exists(): boolean; forEach(cb: (c: { key: string; val: () => unknown }) => boolean | void): boolean }>
  set(v: unknown): Promise<void>
  update(v: Record<string, unknown>): Promise<void>
  remove(): Promise<void>
  push(v?: unknown): { key: string }
  limitToLast(n: number): { get(): Promise<{ val(): unknown; exists(): boolean; forEach(cb: (c: { key: string; val: () => unknown }) => boolean | void): boolean }> }
}

interface RtdbSnapshot {
  val(): unknown
  exists(): boolean
  forEach(cb: (c: { key: string; val: () => unknown }) => boolean | void): boolean
}

const data = new Map<string, unknown>() // flat "path" -> value

function resolve(path: string): unknown {
  if (data.has(path)) return data.get(path)
  // Assemble a nested object from stored descendant paths.
  const prefix = path ? path + '/' : ''
  const children: Record<string, unknown> = {}
  for (const key of [...data.keys()].sort()) {
    if (key.startsWith(prefix)) {
      const rest = key.slice(prefix.length)
      const [head, ...tail] = rest.split('/')
      if (!(head in children)) children[head] = tail.length > 0 ? {} : data.get(key)
      else if (tail.length > 0) {
        Object.assign(children[head] as object, resolve(`${prefix}${head}`) as object)
      }
    }
  }
  return Object.keys(children).length > 0 ? children : undefined
}

function writePath(path: string, value: unknown): void {
  if (value === null || value === undefined) {
    // Delete this path and all children.
    for (const key of [...data.keys()]) {
      if (key === path || key.startsWith(path + '/')) data.delete(key)
    }
    return
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length > 0 && keys.every((k) => !k.includes('/'))) {
      // Merge object write: clear node then set leaf values per child.
      for (const key of [...data.keys()]) {
        if (key === path || key.startsWith(path + '/')) data.delete(key)
      }
      for (const [k, v] of Object.entries(obj)) writePath(`${path}/${k}`, v)
      return
    }
  }
  data.set(path, value)
}

function snapshot(path: string): RtdbSnapshot {
  const val = resolve(path)
  return {
    val: () => val ?? null,
    exists: () => val !== undefined,
    forEach: (cb) => {
      if (val && typeof val === 'object') {
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          if (cb({ key: k, val: () => v }) === true) return true
        }
      }
      return false
    },
  }
}

export function createMemoryRtdb(): MemoryRtdb {
  function ref(at = ''): MemoryRtdbRef {
    return {
      child(p: string) {
        return ref(at ? `${at}/${p}` : p)
      },
      async get() {
        return snapshot(at)
      },
      async set(v: unknown) {
        writePath(at, v)
      },
      async update(v: Record<string, unknown>) {
        for (const [k, val] of Object.entries(v)) writePath(`${at}/${k}`, val)
      },
      async remove() {
        writePath(at, null)
      },
      push(v?: unknown) {
        const key = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
        writePath(`${at}/${key}`, v ?? null)
        return { key }
      },
      limitToLast(_n: number) {
        return { get: async () => snapshot(at) }
      },
    }
  }

  return { ref: (p = '') => ref(p) } as unknown as MemoryRtdb
}
