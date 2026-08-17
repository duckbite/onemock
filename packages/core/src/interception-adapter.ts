import type { JsonBodyType } from 'msw'
import type { Engine } from './engine'
import type { LoadedSpec } from './spec-loader'

export interface InterceptionOptions {
  passthrough?: boolean
  baseUrls?: string[]
}

export interface InterceptionHandle {
  close(): Promise<void>
}

export function getBaseUrls(document: Record<string, unknown>): string[] {
  const servers = document.servers as { url: string }[] | undefined
  if (Array.isArray(servers) && servers.length > 0) {
    return servers.map((server) => server.url)
  }

  const host = document.host as string | undefined
  if (typeof host === 'string') {
    const schemes = (document.schemes as string[] | undefined) ?? ['https']
    const basePath = (document.basePath as string | undefined) ?? ''
    return schemes.map((scheme) => `${scheme}://${host}${basePath}`)
  }

  return []
}

export async function createInterceptionAdapter(
  engine: Engine,
  spec: LoadedSpec,
  options: InterceptionOptions = {},
): Promise<InterceptionHandle> {
  const baseUrls = options.baseUrls ?? getBaseUrls(spec.document as Record<string, unknown>)

  if (baseUrls.length === 0) {
    throw new Error(
      'onemock: cannot start interception — the spec has no servers (OpenAPI) or host/basePath (Swagger 2.0), and no baseUrls option was provided',
    )
  }

  const { setupServer } = await import('msw/node')
  const { http, HttpResponse } = await import('msw')

  const resolve = async ({ request }: { request: Request }): Promise<Response> => {
    const url = new URL(request.url)
    const query: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })

    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    let body: unknown
    const text = await request.text()
    if (text.length > 0) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    const response = await engine.handle({
      method: request.method,
      path: url.pathname,
      query,
      headers,
      body,
    })

    return HttpResponse.json(response.body as JsonBodyType, {
      status: response.status,
      headers: response.headers,
    })
  }

  const handlers = baseUrls.map((baseUrl) => http.all(`${baseUrl}/*`, resolve))
  const server = setupServer(...handlers)
  server.listen({ onUnhandledRequest: options.passthrough ? 'bypass' : 'error' })

  return {
    async close() {
      server.close()
    },
  }
}
