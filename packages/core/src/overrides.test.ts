import { describe, expect, it } from 'vitest'
import { OverrideRegistry } from './overrides'

describe('OverrideRegistry', () => {
  it('returns a registered static response for a matching method and path', () => {
    const registry = new OverrideRegistry()
    registry.override('get', '/pets/{petId}', { status: 200, body: { id: '1', name: 'Fixed' } })

    const result = registry.resolve('get', '/pets/1', { query: {}, headers: {}, body: undefined })

    expect(result).toEqual({ status: 200, body: { id: '1', name: 'Fixed' } })
  })

  it('does not match a different method', () => {
    const registry = new OverrideRegistry()
    registry.override('get', '/pets/{petId}', { status: 200, body: {} })

    const result = registry.resolve('post', '/pets/1', { query: {}, headers: {}, body: undefined })

    expect(result).toBeUndefined()
  })

  it('does not match a different path', () => {
    const registry = new OverrideRegistry()
    registry.override('get', '/pets/{petId}', { status: 200, body: {} })

    const result = registry.resolve('get', '/owners/1', { query: {}, headers: {}, body: undefined })

    expect(result).toBeUndefined()
  })

  it('calls a function handler with the matched request context', () => {
    const registry = new OverrideRegistry()
    registry.override('get', '/pets/{petId}', (request) => ({
      status: 200,
      body: { id: request.params.petId },
    }))

    const result = registry.resolve('get', '/pets/42', { query: {}, headers: {}, body: undefined })

    expect(result).toEqual({ status: 200, body: { id: '42' } })
  })

  it('limits a response to N matching requests when times is set', () => {
    const registry = new OverrideRegistry()
    registry.override('get', '/pets/{petId}', { status: 500, body: {} }, { times: 1 })

    const first = registry.resolve('get', '/pets/1', { query: {}, headers: {}, body: undefined })
    const second = registry.resolve('get', '/pets/1', { query: {}, headers: {}, body: undefined })

    expect(first).toEqual({ status: 500, body: {} })
    expect(second).toBeUndefined()
  })

  it('prefers the most recently registered matching override', () => {
    const registry = new OverrideRegistry()
    registry.override('get', '/pets/{petId}', { status: 200, body: { name: 'First' } })
    registry.override('get', '/pets/{petId}', { status: 200, body: { name: 'Second' } })

    const result = registry.resolve('get', '/pets/1', { query: {}, headers: {}, body: undefined })

    expect(result).toEqual({ status: 200, body: { name: 'Second' } })
  })

  it('reset clears all registered overrides', () => {
    const registry = new OverrideRegistry()
    registry.override('get', '/pets/{petId}', { status: 200, body: {} })
    registry.reset()

    const result = registry.resolve('get', '/pets/1', { query: {}, headers: {}, body: undefined })

    expect(result).toBeUndefined()
  })
})
