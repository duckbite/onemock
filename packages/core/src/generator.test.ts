import { describe, expect, it } from 'vitest'
import { SchemaGenerator } from './generator'

describe('SchemaGenerator', () => {
  it('generates deterministic output for the same seed', () => {
    const a = new SchemaGenerator({ seed: 7 })
    const b = new SchemaGenerator({ seed: 7 })
    const schema = { type: 'string', format: 'email' }

    expect(a.generate(schema)).toBe(b.generate(schema))
  })

  it('generates an object matching declared properties', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const result = generator.generate({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    }) as Record<string, unknown>

    expect(typeof result.name).toBe('string')
    expect(typeof result.age).toBe('number')
    expect(Number.isInteger(result.age)).toBe(true)
  })

  it('generates an array of items matching the items schema', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const result = generator.generate({ type: 'array', items: { type: 'string' } }) as unknown[]

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    for (const item of result) {
      expect(typeof item).toBe('string')
    }
  })

  it('picks a value from enum', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const result = generator.generate({ enum: ['a', 'b', 'c'] })

    expect(['a', 'b', 'c']).toContain(result)
  })

  it('generates format-aware strings (uuid, email)', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const uuid = generator.generate({ type: 'string', format: 'uuid' }) as string
    const email = generator.generate({ type: 'string', format: 'email' }) as string

    expect(uuid).toMatch(/^[0-9a-f-]{36}$/)
    expect(email).toContain('@')
  })

  it('returns undefined for an undefined schema', () => {
    const generator = new SchemaGenerator({ seed: 1 })

    expect(generator.generate(undefined)).toBeUndefined()
  })
})
