import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Engine } from './engine'

export interface ServerHandle {
  listen(port?: number): Promise<{ port: number }>
  close(): Promise<void>
}

export function createServerAdapter(engine: Engine): ServerHandle {
  let server: Server | undefined

  return {
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        server = createServer((req, res) => {
          void handleRequest(engine, req, res)
        })
        server.once('error', reject)
        server.listen(port, () => {
          const address = server?.address()
          const actualPort = typeof address === 'object' && address !== null ? address.port : port
          resolve({ port: actualPort })
        })
      })
    },
    close() {
      return new Promise((resolve, reject) => {
        if (server === undefined) {
          resolve()
          return
        }
        server.close((err) => {
          server = undefined
          if (err) reject(err)
          else resolve()
        })
      })
    },
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (raw.length === 0) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

async function handleRequest(
  engine: Engine,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readBody(req)
  const url = new URL(req.url ?? '/', 'http://localhost')
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })

  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers[key] = value
    else if (Array.isArray(value)) headers[key] = value.join(', ')
  }

  const response = await engine.handle({
    method: req.method ?? 'GET',
    path: url.pathname,
    query,
    headers,
    body,
  })

  res.writeHead(response.status, { 'Content-Type': 'application/json', ...response.headers })
  res.end(response.body === undefined ? undefined : JSON.stringify(response.body))
}
