import { describe, expect, it } from 'vitest'
import { createMock } from './index'

describe('createMock', () => {
  it('is exported as a function', () => {
    expect(typeof createMock).toBe('function')
  })

  it('throws a not-implemented error for now', () => {
    expect(() => createMock({})).toThrow('onemock: createMock is not implemented yet')
  })
})
