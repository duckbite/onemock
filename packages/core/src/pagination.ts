export interface PaginationRequest {
  query: Record<string, string>
}

export interface PaginationResult {
  items: unknown[]
  meta: Record<string, unknown>
}

export function paginate(allItems: unknown[], request: PaginationRequest): PaginationResult {
  const { query } = request

  if (query.page !== undefined) {
    const pageSize = Number(query.pageSize ?? query.per_page ?? 20) || 20
    const page = Number(query.page) || 1
    const start = (page - 1) * pageSize
    return {
      items: allItems.slice(start, start + pageSize),
      meta: { page, pageSize, total: allItems.length },
    }
  }

  if (query.offset !== undefined || query.limit !== undefined) {
    const offset = Number(query.offset ?? 0) || 0
    const limit = Number(query.limit ?? allItems.length) || allItems.length
    return {
      items: allItems.slice(offset, offset + limit),
      meta: { offset, limit, total: allItems.length },
    }
  }

  return { items: allItems, meta: { total: allItems.length } }
}
