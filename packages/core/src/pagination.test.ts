import { describe, expect, it } from 'vitest'
import { paginate } from './pagination'

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5]

  it('returns all items with just a total when no pagination params are present', () => {
    const result = paginate(items, { query: {} })

    expect(result).toEqual({ items, meta: { total: 5 } })
  })

  it('slices by offset and limit', () => {
    const result = paginate(items, { query: { offset: '1', limit: '2' } })

    expect(result).toEqual({ items: [2, 3], meta: { offset: 1, limit: 2, total: 5 } })
  })

  it('defaults limit to the full remaining length when only offset is given', () => {
    const result = paginate(items, { query: { offset: '3' } })

    expect(result).toEqual({ items: [4, 5], meta: { offset: 3, limit: 5, total: 5 } })
  })

  it('slices by page and pageSize', () => {
    const result = paginate(items, { query: { page: '2', pageSize: '2' } })

    expect(result).toEqual({ items: [3, 4], meta: { page: 2, pageSize: 2, total: 5 } })
  })

  it('defaults pageSize to 20 when only page is given', () => {
    const result = paginate(items, { query: { page: '1' } })

    expect(result).toEqual({ items, meta: { page: 1, pageSize: 20, total: 5 } })
  })
})
