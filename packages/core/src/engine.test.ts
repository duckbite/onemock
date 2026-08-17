import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { loadSpec, type LoadedSpec } from './spec-loader'

const fixturesDir = fileURLToPath(new URL('./__fixtures__/', import.meta.url))

async function loadPetStore(): Promise<LoadedSpec> {
  return loadSpec(`${fixturesDir}pet-store.json`)
}

describe('Engine', () => {
  it('round-trips a created resource through GET', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const created = await engine.handle({
      method: 'post',
      path: '/pets',
      body: { name: 'Rex', tag: 'dog' },
    })
    expect(created.status).toBe(201)
    const petId = (created.body as { id: string }).id

    const fetched = await engine.handle({ method: 'get', path: `/pets/${petId}` })
    expect(fetched.status).toBe(200)
    expect(fetched.body).toEqual(created.body)
  })

  it('rejects a request body missing a required field with a 400', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const response = await engine.handle({
      method: 'post',
      path: '/pets',
      body: { tag: 'no-name' },
    })

    expect(response.status).toBe(400)
    expect((response.body as { error: string }).error).toBe('validation_failed')
  })

  it('generates a fresh fake resource for an unseeded GET by id', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const response = await engine.handle({ method: 'get', path: '/pets/unseen-id' })

    expect(response.status).toBe(200)
    const body = response.body as Record<string, unknown>
    expect(body.id).toBe('unseen-id')
    expect(typeof body.name).toBe('string')
  })

  it('updates a resource by merging fields', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({
      method: 'post',
      path: '/pets',
      body: { name: 'Rex', tag: 'dog' },
    })
    const petId = (created.body as { id: string }).id

    const updated = await engine.handle({
      method: 'put',
      path: `/pets/${petId}`,
      body: { name: 'Rex Updated' },
    })

    expect(updated.status).toBe(200)
    expect(updated.body).toEqual({ id: petId, name: 'Rex Updated', tag: 'dog' })
  })

  it('deletes a resource', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id

    const deleted = await engine.handle({ method: 'delete', path: `/pets/${petId}` })

    expect(deleted.status).toBe(204)
  })

  it('returns 404 for a route with no matching path', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const response = await engine.handle({ method: 'get', path: '/nonexistent' })

    expect(response.status).toBe(404)
  })

  it('an override takes precedence over stored state', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id

    engine.override('get', '/pets/{petId}', {
      status: 200,
      body: { id: petId, name: 'Overridden' },
    })
    const response = await engine.handle({ method: 'get', path: `/pets/${petId}` })

    expect(response.body).toEqual({ id: petId, name: 'Overridden' })
  })

  it('reset() clears state and overrides', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id
    engine.override('get', '/pets/{petId}', { status: 200, body: { forced: true } })

    engine.reset()
    const response = await engine.handle({ method: 'get', path: `/pets/${petId}` })

    expect(response.body).not.toEqual({ forced: true })
  })

  it('seed() pre-populates the store', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    engine.seed('/pets', { id: 'seeded-1', name: 'Seeded Pet' })
    const response = await engine.handle({ method: 'get', path: '/pets/seeded-1' })

    expect(response.body).toEqual({ id: 'seeded-1', name: 'Seeded Pet' })
  })

  it('paginates list results by offset and limit', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    for (let i = 0; i < 5; i++) {
      await engine.handle({ method: 'post', path: '/pets', body: { name: `Pet ${i}` } })
    }

    const response = await engine.handle({
      method: 'get',
      path: '/pets',
      query: { offset: '1', limit: '2' },
    })

    const body = response.body as { data: unknown[]; total: number }
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(5)
  })

  it('enforces a configured rate limit', async () => {
    const engine = new Engine(await loadPetStore(), { rateLimit: { limit: 2, windowMs: 60000 } })

    expect((await engine.handle({ method: 'get', path: '/pets' })).status).toBe(200)
    expect((await engine.handle({ method: 'get', path: '/pets' })).status).toBe(200)
    const limited = await engine.handle({ method: 'get', path: '/pets' })

    expect(limited.status).toBe(429)
    expect(limited.headers['Retry-After']).toBeDefined()
  })

  it('applies configured latency and can simulate a forced failure', async () => {
    const engine = new Engine(await loadPetStore(), { latency: { delayMs: 5, failureRate: 1 } })

    const start = Date.now()
    const response = await engine.handle({ method: 'get', path: '/pets' })

    expect(Date.now() - start).toBeGreaterThanOrEqual(5)
    expect(response.status).toBe(503)
  })
})
