import { describe, expect, it } from 'vitest'
import { createMock } from './index'

const petStoreSpec = {
  openapi: '3.0.0',
  info: { title: 'Pet Store', version: '1.0.0' },
  paths: {
    '/pets': {
      get: { responses: { '200': { description: 'ok' } } },
      post: { responses: { '201': { description: 'created' } } },
    },
    '/pets/{petId}': {
      parameters: [
        { name: 'petId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      get: { responses: { '200': { description: 'ok' } } },
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

  it('rejects an invalid spec', async () => {
    await expect(
      createMock({ openapi: '3.0.0', info: { title: 'x' }, paths: {} }),
    ).rejects.toThrow(/^onemock: invalid spec:/)
  })
})
