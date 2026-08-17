import type { LoadedSpec } from './spec-loader'
import { buildRouteTable, matchPath, type RouteTableEntry, type HttpMethod } from './route-table'
import { SchemaGenerator } from './generator'
import { StateStore } from './state-store'
import { OverrideRegistry, type OverrideHandler } from './overrides'
import { validateRequest } from './validator'
import { RateLimiter, applyLatency, type RateLimitConfig, type LatencyConfig } from './simulators'
import { paginate } from './pagination'
import { createLogger, type LogLevel } from './logger'

export interface EngineRequest {
  method: string
  path: string
  query?: Record<string, string>
  headers?: Record<string, string>
  body?: unknown
}

export interface EngineResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

export interface EngineOptions {
  seed?: number
  rateLimit?: RateLimitConfig
  latency?: LatencyConfig
  logLevel?: LogLevel
}

export class Engine {
  readonly routeTable: RouteTableEntry[]
  private readonly overrides = new OverrideRegistry()
  private readonly store: StateStore
  private readonly generator: SchemaGenerator
  private readonly rateLimiter?: RateLimiter
  private readonly latencyConfig?: LatencyConfig
  private readonly logger: ReturnType<typeof createLogger>

  constructor(spec: LoadedSpec, options: EngineOptions = {}) {
    this.routeTable = buildRouteTable(spec.document)
    this.store = new StateStore()
    this.generator = new SchemaGenerator({ seed: options.seed })
    this.rateLimiter = options.rateLimit ? new RateLimiter(options.rateLimit) : undefined
    this.latencyConfig = options.latency
    this.logger = createLogger(options.logLevel ?? 'off')
  }

  seed(pathTemplate: string, data: Record<string, unknown> | Record<string, unknown>[]): void {
    const collection = collectionKeyFor(pathTemplate)
    const items = Array.isArray(data) ? data : [data]
    for (const item of items) {
      const id = String(item.id ?? this.store.list(collection).length + 1)
      this.store.create(collection, item, id)
    }
  }

  override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, times?: number): void {
    this.overrides.override(method, pathTemplate, handler, { times })
  }

  reset(): void {
    this.store.reset()
    this.overrides.reset()
    this.rateLimiter?.reset()
  }

  async handle(request: EngineRequest): Promise<EngineResponse> {
    const method = request.method.toLowerCase() as HttpMethod
    const query = request.query ?? {}
    const headers = request.headers ?? {}

    const matched = this.matchRoute(method, request.path)
    if (matched === undefined) {
      return this.finish(method, request, this.notFound(request.path))
    }
    const { route, params } = matched

    const overrideResponse = this.overrides.resolve(method, request.path, {
      query,
      headers,
      body: request.body,
    })
    if (overrideResponse !== undefined) {
      return this.finish(method, request, {
        status: overrideResponse.status,
        headers: overrideResponse.headers ?? {},
        body: overrideResponse.body,
      })
    }

    if (this.rateLimiter !== undefined) {
      const status = this.rateLimiter.check()
      if (status.limited) {
        return this.finish(method, request, {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(status.retryAfterMs / 1000)) },
          body: { error: 'rate_limited', message: 'Too many requests' },
        })
      }
    }

    if (this.latencyConfig !== undefined) {
      const latencyResult = await applyLatency(this.latencyConfig)
      if (latencyResult.failed) {
        return this.finish(method, request, {
          status: 503,
          headers: {},
          body: { error: 'simulated_network_failure', message: 'Simulated network failure' },
        })
      }
    }

    const validation = validateRequest(route.operation, { params, query, body: request.body })
    if (!validation.valid) {
      return this.finish(method, request, {
        status: 400,
        headers: {},
        body: { error: 'validation_failed', issues: validation.issues },
      })
    }

    const response = this.resolveFromStore(method, route, params, query, request.body)
    return this.finish(method, request, response)
  }

  private finish(
    method: HttpMethod,
    request: EngineRequest,
    response: EngineResponse,
  ): EngineResponse {
    this.logger.log({
      method,
      path: request.path,
      status: response.status,
      query: request.query,
      body: request.body,
      responseBody: response.body,
    })
    return response
  }

  private matchRoute(
    method: HttpMethod,
    path: string,
  ): { route: RouteTableEntry; params: Record<string, string> } | undefined {
    for (const route of this.routeTable) {
      if (route.method !== method) continue
      const params = matchPath(route.path, path)
      if (params !== null) return { route, params }
    }
    return undefined
  }

  private notFound(path: string): EngineResponse {
    return {
      status: 404,
      headers: {},
      body: { error: 'not_found', message: `onemock: no route matches ${path}` },
    }
  }

  private resolveFromStore(
    method: HttpMethod,
    route: RouteTableEntry,
    params: Record<string, string>,
    query: Record<string, string>,
    body: unknown,
  ): EngineResponse {
    const collection = collectionKeyFor(route.path)
    const idParamName = lastParamName(route.path)
    const id = idParamName !== undefined ? params[idParamName] : undefined

    if (method === 'post') {
      const created = this.store.create(collection, (body as Record<string, unknown>) ?? {})
      return { status: 201, headers: {}, body: created }
    }

    if (method === 'put' || method === 'patch') {
      if (id === undefined) return this.notFound(route.path)
      const updated = this.store.update(collection, id, (body as Record<string, unknown>) ?? {})
      if (updated === undefined) return this.notFound(route.path)
      return { status: 200, headers: {}, body: updated }
    }

    if (method === 'delete') {
      if (id === undefined) return this.notFound(route.path)
      const deleted = this.store.delete(collection, id)
      return deleted
        ? { status: 204, headers: {}, body: undefined }
        : this.notFound(route.path)
    }

    if (id !== undefined) {
      let resource = this.store.get(collection, id)
      if (resource === undefined) {
        const schema = responseSchemaFor(route.operation)
        const generated = this.generator.generate(schema) as Record<string, unknown> | undefined
        resource = this.store.create(collection, { ...(generated ?? {}), id }, id)
      }
      return { status: 200, headers: {}, body: resource }
    }

    let items = this.store.list(collection)
    if (items.length === 0) {
      const schema = responseSchemaFor(route.operation)
      const itemSchema = (
        schema?.type === 'array' ? (schema.items as Record<string, unknown> | undefined) : schema
      ) as Record<string, unknown> | undefined
      const generated = this.generator.generate(itemSchema) as Record<string, unknown> | undefined
      if (generated !== undefined) {
        this.store.create(collection, generated)
        items = this.store.list(collection)
      }
    }

    const { items: pageItems, meta } = paginate(items, { query })
    return { status: 200, headers: {}, body: { data: pageItems, ...meta } }
  }
}

function collectionKeyFor(pathTemplate: string): string {
  return pathTemplate
    .split('/')
    .filter((segment) => segment.length > 0 && !segment.startsWith('{'))
    .join('/')
}

function lastParamName(pathTemplate: string): string | undefined {
  const segments = pathTemplate.split('/').filter((segment) => segment.length > 0)
  const last = segments[segments.length - 1]
  if (last !== undefined && last.startsWith('{') && last.endsWith('}')) {
    return last.slice(1, -1)
  }
  return undefined
}

function responseSchemaFor(operation: Record<string, unknown>): Record<string, unknown> | undefined {
  const responses = operation.responses as
    | Record<string, { content?: Record<string, { schema?: Record<string, unknown> }> }>
    | undefined
  if (responses === undefined) return undefined

  const successKey = Object.keys(responses).find((key) => key.startsWith('2'))
  if (successKey === undefined) return undefined

  return responses[successKey]?.content?.['application/json']?.schema
}
