import { loadSpec, type SpecInput } from './spec-loader'
import { Engine, type EngineOptions, type EngineRequest, type EngineResponse } from './engine'
import type { OverrideHandler } from './overrides'
import type { HttpMethod } from './route-table'
import { createServerAdapter, type ServerHandle } from './server-adapter'
import {
  createInterceptionAdapter,
  type InterceptionHandle,
  type InterceptionOptions,
} from './interception-adapter'

export type CreateMockOptions = EngineOptions
export type {
  HandlerContext,
  HandlerResponse,
  MockService,
  MockStore,
  OperationHandler,
} from './handlers'

export interface MockInstance {
  seed(pathTemplate: string, data: Record<string, unknown> | Record<string, unknown>[]): void
  override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, times?: number): void
  reset(): void
  handle(request: EngineRequest): Promise<EngineResponse>
  listen(port?: number): Promise<{ port: number }>
  intercept(options?: InterceptionOptions): Promise<void>
  close(): Promise<void>
}

export async function createMock(
  spec: SpecInput,
  options: CreateMockOptions = {},
): Promise<MockInstance> {
  const loaded = await loadSpec(spec)
  const engine = new Engine(loaded, options)
  let server: ServerHandle | undefined
  let interception: InterceptionHandle | undefined

  return {
    seed: (pathTemplate, data) => engine.seed(pathTemplate, data),
    override: (method, pathTemplate, handler, times) =>
      engine.override(method, pathTemplate, handler, times),
    reset: () => engine.reset(),
    handle: (request) => engine.handle(request),
    async listen(port) {
      server = createServerAdapter(engine)
      return server.listen(port)
    },
    async intercept(interceptOptions) {
      interception = await createInterceptionAdapter(engine, loaded, interceptOptions)
    },
    async close() {
      await server?.close()
      await interception?.close()
      server = undefined
      interception = undefined
    },
  }
}
