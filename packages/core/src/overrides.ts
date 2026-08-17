import { matchPath, type HttpMethod } from './route-table'

export interface OverrideRequest {
  method: HttpMethod
  path: string
  params: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
}

export interface OverrideResponse {
  status: number
  headers?: Record<string, string>
  body?: unknown
}

export type OverrideHandler = OverrideResponse | ((request: OverrideRequest) => OverrideResponse)

export interface OverrideOptions {
  times?: number
}

interface RegisteredOverride {
  method: HttpMethod
  pathTemplate: string
  handler: OverrideHandler
  remaining: number | undefined
}

export class OverrideRegistry {
  private overrides: RegisteredOverride[] = []

  override(
    method: HttpMethod,
    pathTemplate: string,
    handler: OverrideHandler,
    options: OverrideOptions = {},
  ): void {
    this.overrides.push({ method, pathTemplate, handler, remaining: options.times })
  }

  resolve(
    method: HttpMethod,
    path: string,
    context: Omit<OverrideRequest, 'method' | 'path' | 'params'>,
  ): OverrideResponse | undefined {
    for (let i = this.overrides.length - 1; i >= 0; i--) {
      const entry = this.overrides[i]
      if (entry.method !== method) continue
      if (entry.remaining !== undefined && entry.remaining <= 0) continue

      const params = matchPath(entry.pathTemplate, path)
      if (params === null) continue

      if (entry.remaining !== undefined) entry.remaining -= 1

      const request: OverrideRequest = { method, path, params, ...context }
      return typeof entry.handler === 'function' ? entry.handler(request) : entry.handler
    }
    return undefined
  }

  reset(): void {
    this.overrides = []
  }
}
