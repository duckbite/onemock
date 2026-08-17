export const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface RouteTableEntry {
  method: HttpMethod
  path: string
  operation: Record<string, unknown>
}

export interface DocumentWithPaths {
  paths?: Record<string, Record<string, unknown> | undefined>
}

export function buildRouteTable(document: DocumentWithPaths): RouteTableEntry[] {
  const entries: RouteTableEntry[] = []
  const paths = document.paths ?? {}

  for (const [path, pathItem] of Object.entries(paths)) {
    if (pathItem === undefined) continue

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method]
      if (operation !== undefined) {
        entries.push({ method, path, operation: operation as Record<string, unknown> })
      }
    }
  }

  return entries
}
