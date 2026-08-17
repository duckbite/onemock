import { loadSpec, type SpecInput } from './spec-loader'
import { Engine, type EngineOptions, type EngineRequest, type EngineResponse } from './engine'
import type { OverrideHandler } from './overrides'
import type { HttpMethod } from './route-table'

export type CreateMockOptions = EngineOptions

export interface MockInstance {
  seed(pathTemplate: string, data: Record<string, unknown> | Record<string, unknown>[]): void
  override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, times?: number): void
  reset(): void
  handle(request: EngineRequest): Promise<EngineResponse>
}

export async function createMock(
  spec: SpecInput,
  options: CreateMockOptions = {},
): Promise<MockInstance> {
  const loaded = await loadSpec(spec)
  const engine = new Engine(loaded, options)

  return {
    seed: (pathTemplate, data) => engine.seed(pathTemplate, data),
    override: (method, pathTemplate, handler, times) =>
      engine.override(method, pathTemplate, handler, times),
    reset: () => engine.reset(),
    handle: (request) => engine.handle(request),
  }
}
