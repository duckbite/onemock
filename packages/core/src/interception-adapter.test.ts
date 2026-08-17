import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { loadSpec } from './spec-loader'
import {
  createInterceptionAdapter,
  getBaseUrls,
  type InterceptionHandle,
} from './interception-adapter'

const fixturesDir = fileURLToPath(new URL('./__fixtures__/', import.meta.url))

describe('getBaseUrls', () => {
  it('reads OpenAPI 3.x servers[]', () => {
    expect(getBaseUrls({ servers: [{ url: 'https://api.example.com' }] })).toEqual([
      'https://api.example.com',
    ])
  })

  it('reads Swagger 2.0 host/basePath/schemes', () => {
    expect(
      getBaseUrls({ host: 'api.example.com', basePath: '/v2', schemes: ['https'] }),
    ).toEqual(['https://api.example.com/v2'])
  })

  it('returns an empty array when neither is present', () => {
    expect(getBaseUrls({})).toEqual([])
  })
})

describe('createInterceptionAdapter', () => {
  let activeHandle: InterceptionHandle | undefined

  afterEach(async () => {
    await activeHandle?.close()
    activeHandle = undefined
  })

  it('intercepts a matching request and routes it through the engine', async () => {
    const spec = await loadSpec(`${fixturesDir}pet-store.json`)
    const engine = new Engine(spec, { seed: 1 })
    activeHandle = await createInterceptionAdapter(engine, spec)

    const created = await fetch('https://api.pet-store.test/pets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rex' }),
    })

    expect(created.status).toBe(201)
    expect(((await created.json()) as { name: string }).name).toBe('Rex')
  })

  it('throws for a request to an unmocked host by default (no passthrough)', async () => {
    const spec = await loadSpec(`${fixturesDir}pet-store.json`)
    const engine = new Engine(spec, { seed: 1 })
    activeHandle = await createInterceptionAdapter(engine, spec)

    await expect(fetch('https://totally-unmocked-host.test/whatever')).rejects.toThrow()
  })

  it('throws immediately if the spec has no discoverable base URL and none is provided', async () => {
    const spec = await loadSpec({
      openapi: '3.0.0',
      info: { title: 'No Server', version: '1.0.0' },
      paths: {},
    })
    const engine = new Engine(spec, { seed: 1 })

    await expect(createInterceptionAdapter(engine, spec)).rejects.toThrow(/no servers/)
  })

  it('accepts an explicit baseUrls override', async () => {
    const spec = await loadSpec({
      openapi: '3.0.0',
      info: { title: 'No Server', version: '1.0.0' },
      paths: {},
    })
    const engine = new Engine(spec, { seed: 1 })
    activeHandle = await createInterceptionAdapter(engine, spec, {
      baseUrls: ['https://override.test'],
    })

    const response = await fetch('https://override.test/pets/some-id')

    expect(response.status).toBe(404)
  })
})
