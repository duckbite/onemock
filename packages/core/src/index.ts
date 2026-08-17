import { loadSpec, type SpecInput } from './spec-loader'
import { Engine, type EngineOptions, type EngineRequest, type EngineResponse } from './engine'
import type { OverrideHandler } from './overrides'
import type { HttpMethod } from './route-table'
import { createServerAdapter, type ServerHandle } from './server-adapter'

export type CreateMockOptions = EngineOptions

export interface MockInstance {
  seed(pathTemplate: string, data: Record<string, unknown> | Record<string, unknown>[]): void
  override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, times?: number): void
  reset(): void
  handle(request: EngineRequest): Promise<EngineResponse>
  listen(port?: number): Promise<{ port: number }>
  close(): Promise<void>
}

export async function createMock(
  spec: SpecInput,
  options: CreateMockOptions = {},
): Promise<MockInstance> {
  const loaded = await loadSpec(spec)
  const engine = new Engine(loaded, options)
  let server: ServerHandle | undefined

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
    async close() {
      await server?.close()
      server = undefined
    },
  }
}
