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

export function matchPath(template: string, actualPath: string): Record<string, string> | null {
  const templateSegments = template.split('/').filter((segment) => segment.length > 0)
  const actualSegments = actualPath.split('/').filter((segment) => segment.length > 0)

  if (templateSegments.length !== actualSegments.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < templateSegments.length; i++) {
    const templateSegment = templateSegments[i]
    const actualSegment = actualSegments[i]
    if (templateSegment.startsWith('{') && templateSegment.endsWith('}')) {
      params[templateSegment.slice(1, -1)] = decodeURIComponent(actualSegment)
    } else if (templateSegment !== actualSegment) {
      return null
    }
  }
  return params
}
