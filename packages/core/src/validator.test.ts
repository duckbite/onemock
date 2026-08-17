import { describe, expect, it } from 'vitest'
import { validateRequest } from './validator'

describe('validateRequest', () => {
  it('is valid when the operation has no parameters or requestBody', () => {
    const result = validateRequest({}, { params: {}, query: {}, body: undefined })

    expect(result).toEqual({ valid: true, issues: [] })
  })

  it('flags a missing required query parameter', () => {
    const operation = {
      parameters: [{ name: 'limit', in: 'query', required: true, schema: { type: 'integer' } }],
    }

    const result = validateRequest(operation, { params: {}, query: {}, body: undefined })

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual([
      { path: 'limit', message: "missing required query parameter 'limit'" },
    ])
  })

  it('is valid when a required query parameter is present and matches its schema', () => {
    const operation = {
      parameters: [{ name: 'limit', in: 'query', required: true, schema: { type: 'integer' } }],
    }

    const result = validateRequest(operation, {
      params: {},
      query: { limit: '5' },
      body: undefined,
    })

    expect(result.valid).toBe(true)
  })

  it('flags a query parameter whose value does not match its schema type', () => {
    const operation = {
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
    }

    const result = validateRequest(operation, {
      params: {},
      query: { limit: 'not-a-number' },
      body: undefined,
    })

    expect(result.valid).toBe(false)
    expect(result.issues[0].path).toBe('limit')
  })

  it('flags a request body missing a required field', () => {
    const operation = {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' } },
            },
          },
        },
      },
    }

    const result = validateRequest(operation, { params: {}, query: {}, body: {} })

    expect(result.valid).toBe(false)
    expect(result.issues[0].path).toBe('body')
  })

  it('is valid when the request body matches its schema', () => {
    const operation = {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' } },
            },
          },
        },
      },
    }

    const result = validateRequest(operation, { params: {}, query: {}, body: { name: 'Rex' } })

    expect(result.valid).toBe(true)
  })
})
