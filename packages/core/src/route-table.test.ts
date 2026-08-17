import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildRouteTable, matchPath } from './route-table'
import { loadSpec } from './spec-loader'

describe('buildRouteTable', () => {
  it('extracts one entry per HTTP method across multiple paths', () => {
    const document = {
      paths: {
        '/pets': {
          summary: 'Pet collection',
          get: { operationId: 'listPets' },
          post: { operationId: 'createPet' },
        },
        '/pets/{petId}': {
          parameters: [{ name: 'petId', in: 'path' }],
          get: { operationId: 'getPet' },
        },
      },
    }

    const table = buildRouteTable(document)

    expect(table).toHaveLength(3)
    expect(table).toContainEqual({
      method: 'get',
      path: '/pets',
      operation: { operationId: 'listPets' },
    })
    expect(table).toContainEqual({
      method: 'post',
      path: '/pets',
      operation: { operationId: 'createPet' },
    })
    expect(table).toContainEqual({
      method: 'get',
      path: '/pets/{petId}',
      operation: { operationId: 'getPet' },
    })
  })

  it('excludes non-method path item keys like summary, description, and parameters', () => {
    const document = {
      paths: {
        '/pets': {
          summary: 'Pet collection',
          description: 'All pets',
          parameters: [{ name: 'unused', in: 'query' }],
          get: { operationId: 'listPets' },
        },
      },
    }

    const table = buildRouteTable(document)

    expect(table).toEqual([{ method: 'get', path: '/pets', operation: { operationId: 'listPets' } }])
  })

  it('returns an empty array when the document has no paths', () => {
    expect(buildRouteTable({})).toEqual([])
    expect(buildRouteTable({ paths: {} })).toEqual([])
  })
})

describe('buildRouteTable with a real loaded spec', () => {
  it('builds a route table from a loadSpec() result', async () => {
    const fixturesDir = fileURLToPath(new URL('./__fixtures__/', import.meta.url))
    const { document } = await loadSpec(`${fixturesDir}valid-openapi3.json`)

    const table = buildRouteTable(document)

    expect(table).toHaveLength(3)
    expect(table.map((entry) => `${entry.method} ${entry.path}`).sort()).toEqual([
      'get /pets',
      'get /pets/{petId}',
      'post /pets',
    ])
  })
})

describe('matchPath', () => {
  it('matches a static path with no params', () => {
    expect(matchPath('/pets', '/pets')).toEqual({})
  })

  it('extracts a single path param', () => {
    expect(matchPath('/pets/{petId}', '/pets/abc123')).toEqual({ petId: 'abc123' })
  })

  it('extracts multiple path params', () => {
    expect(matchPath('/owners/{ownerId}/pets/{petId}', '/owners/o1/pets/p1')).toEqual({
      ownerId: 'o1',
      petId: 'p1',
    })
  })

  it('returns null when segment counts differ', () => {
    expect(matchPath('/pets/{petId}', '/pets')).toBeNull()
  })

  it('returns null when a static segment does not match', () => {
    expect(matchPath('/pets/{petId}', '/owners/1')).toBeNull()
  })

  it('decodes URI-encoded param values', () => {
    expect(matchPath('/pets/{petId}', '/pets/a%20b')).toEqual({ petId: 'a b' })
  })
})
