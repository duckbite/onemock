import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { loadSpec } from './spec-loader'
import { createServerAdapter, type ServerHandle } from './server-adapter'

const fixturesDir = fileURLToPath(new URL('./__fixtures__/', import.meta.url))

async function startServer(): Promise<{ handle: ServerHandle; port: number }> {
  const spec = await loadSpec(`${fixturesDir}pet-store.json`)
  const engine = new Engine(spec, { seed: 1 })
  const handle = createServerAdapter(engine)
  const { port } = await handle.listen(0)
  return { handle, port }
}

describe('server adapter', () => {
  let activeHandle: ServerHandle | undefined

  afterEach(async () => {
    await activeHandle?.close()
    activeHandle = undefined
  })

  it('serves a POST then GET round trip over real HTTP', async () => {
    const { handle, port } = await startServer()
    activeHandle = handle

    const created = await fetch(`http://localhost:${port}/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rex' }),
    })
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as { id: string }

    const fetched = await fetch(`http://localhost:${port}/pets/${createdBody.id}`)
    expect(fetched.status).toBe(200)
    expect(await fetched.json()).toEqual(createdBody)
  })

  it('serves query parameters correctly', async () => {
    const { handle, port } = await startServer()
    activeHandle = handle

    for (let i = 0; i < 3; i++) {
      await fetch(`http://localhost:${port}/pets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Pet ${i}` }),
      })
    }

    const response = await fetch(`http://localhost:${port}/pets?limit=2`)
    const body = (await response.json()) as { data: unknown[]; total: number }

    expect(body.data.length).toBeLessThanOrEqual(2)
    expect(body.total).toBe(3)
  })

  it('returns a body-less response for a 204', async () => {
    const { handle, port } = await startServer()
    activeHandle = handle

    const created = await fetch(`http://localhost:${port}/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rex' }),
    })
    const createdBody = (await created.json()) as { id: string }

    const deleted = await fetch(`http://localhost:${port}/pets/${createdBody.id}`, {
      method: 'DELETE',
    })

    expect(deleted.status).toBe(204)
    expect(await deleted.text()).toBe('')
  })

  it('returns a 404 for an unmatched route', async () => {
    const { handle, port } = await startServer()
    activeHandle = handle

    const response = await fetch(`http://localhost:${port}/nonexistent`)

    expect(response.status).toBe(404)
  })

  it('close() stops the server so subsequent requests fail to connect', async () => {
    const { handle, port } = await startServer()

    await handle.close()

    await expect(fetch(`http://localhost:${port}/pets`)).rejects.toThrow()
  })

  it('listen() resolves with the actual bound port when given port 0', async () => {
    const { handle, port } = await startServer()
    activeHandle = handle

    expect(port).toBeGreaterThan(0)
  })
})
