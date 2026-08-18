import { describe, expect, it } from 'vitest'
import { createMock } from './index'

const petStoreSpec = {
  openapi: '3.0.0',
  info: { title: 'Pet Store', version: '1.0.0' },
  paths: {
    '/pets': {
      get: { operationId: 'listPets', responses: { '200': { description: 'ok' } } },
      post: { operationId: 'createPet', responses: { '201': { description: 'created' } } },
    },
    '/pets/{petId}': {
      parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
      get: { operationId: 'getPet', responses: { '200': { description: 'ok' } } },
    },
  },
}

describe('createMock', () => {
  it('loads a spec and returns a mock instance with seed/override/reset/handle', async () => {
    const mock = await createMock(petStoreSpec)

    expect(typeof mock.seed).toBe('function')
    expect(typeof mock.override).toBe('function')
    expect(typeof mock.reset).toBe('function')
    expect(typeof mock.handle).toBe('function')
  })

  it('round-trips a created resource end to end through createMock', async () => {
    const mock = await createMock(petStoreSpec)

    const created = await mock.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id

    const fetched = await mock.handle({ method: 'get', path: `/pets/${petId}` })

    expect(fetched.body).toEqual(created.body)
  })

  it('dispatches createMock handlers keyed by operationId', async () => {
    const mock = await createMock(petStoreSpec, {
      handlers: {
        listPets: () => ({ status: 200, body: { fromHandler: true } }),
      },
    })

    const response = await mock.handle({ method: 'get', path: '/pets' })

    expect(response.body).toEqual({ fromHandler: true })
  })

  it('rejects an invalid spec', async () => {
    await expect(createMock({ openapi: '3.0.0', info: { title: 'x' }, paths: {} })).rejects.toThrow(
      /^onemock: invalid spec:/,
    )
  })
})

describe('createMock listen/close', () => {
  it('serves requests over real HTTP once listen() resolves', async () => {
    const mock = await createMock(petStoreSpec)
    const { port } = await mock.listen(0)

    const response = await fetch(`http://localhost:${port}/pets/1`)
    expect(response.status).toBe(200)

    await mock.close()
  })

  it('close() is a no-op when listen() was never called', async () => {
    const mock = await createMock(petStoreSpec)

    await expect(mock.close()).resolves.toBeUndefined()
  })
})

describe('createMock intercept/close', () => {
  it('intercepts requests to the spec base URL once intercept() resolves', async () => {
    const specWithServer = {
      ...petStoreSpec,
      servers: [{ url: 'https://mock-createmock.test' }],
    }
    const mock = await createMock(specWithServer)
    await mock.intercept()

    const response = await fetch('https://mock-createmock.test/pets/1')
    expect(response.status).toBe(200)

    await mock.close()
  })

  it('intercepts two independent mocks on different hosts at the same time', async () => {
    const consumer = await createMock({
      ...petStoreSpec,
      servers: [{ url: 'https://consumer-contracts.test' }],
    })
    const corporate = await createMock({
      openapi: '3.0.0',
      info: { title: 'Corporate', version: '1.0.0' },
      servers: [{ url: 'https://corporate-contracts.test' }],
      paths: {
        '/contracts': {
          get: { operationId: 'listContracts', responses: { '200': { description: 'ok' } } },
          post: { operationId: 'createContract', responses: { '201': { description: 'created' } } },
        },
      },
    })
    await consumer.intercept()
    await corporate.intercept()

    try {
      const petResponse = await fetch('https://consumer-contracts.test/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Rex' }),
      })
      const contractResponse = await fetch('https://corporate-contracts.test/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: 'Acme' }),
      })

      expect(petResponse.status).toBe(201)
      expect(((await petResponse.json()) as { name: string }).name).toBe('Rex')
      expect(contractResponse.status).toBe(201)
      expect(((await contractResponse.json()) as { company: string }).company).toBe('Acme')
    } finally {
      await consumer.close()
      await corporate.close()
    }
  })
})
