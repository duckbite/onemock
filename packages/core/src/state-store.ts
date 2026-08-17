export interface StateStoreOptions {
  generateId?: () => string
}

export class StateStore {
  private readonly collections = new Map<string, Map<string, Record<string, unknown>>>()
  private readonly generateId: () => string
  private counter = 0

  constructor(options: StateStoreOptions = {}) {
    this.generateId = options.generateId ?? (() => String(++this.counter))
  }

  list(collection: string): Record<string, unknown>[] {
    return Array.from(this.getCollection(collection).values())
  }

  get(collection: string, id: string): Record<string, unknown> | undefined {
    return this.getCollection(collection).get(id)
  }

  create(
    collection: string,
    data: Record<string, unknown>,
    id?: string,
  ): Record<string, unknown> {
    const resourceId = id ?? this.generateId()
    const resource = { ...data, id: data.id ?? resourceId }
    this.getCollection(collection).set(resourceId, resource)
    return resource
  }

  update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const existing = this.getCollection(collection).get(id)
    if (existing === undefined) return undefined
    const updated = { ...existing, ...data }
    this.getCollection(collection).set(id, updated)
    return updated
  }

  delete(collection: string, id: string): boolean {
    return this.getCollection(collection).delete(id)
  }

  reset(): void {
    this.collections.clear()
    this.counter = 0
  }

  private getCollection(collection: string): Map<string, Record<string, unknown>> {
    let map = this.collections.get(collection)
    if (map === undefined) {
      map = new Map()
      this.collections.set(collection, map)
    }
    return map
  }
}
