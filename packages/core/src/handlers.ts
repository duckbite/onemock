export interface MockStore {
  list(collection: string): Record<string, unknown>[]
  get(collection: string, id: string): Record<string, unknown> | undefined
  create(collection: string, data: Record<string, unknown>, id?: string): Record<string, unknown>
  update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> | undefined
  delete(collection: string, id: string): boolean
  reset(): void
}

export interface HandlerContext {
  params: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
  collection: string
  store: MockStore
}

export interface HandlerResponse {
  status: number
  headers?: Record<string, string>
  body?: unknown
}

export type OperationHandler = (ctx: HandlerContext) => HandlerResponse | Promise<HandlerResponse>

export type MockService = Record<string, OperationHandler>
