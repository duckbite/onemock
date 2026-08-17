import Ajv, { type ValidateFunction } from 'ajv'

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationRequest {
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

interface OpenApiParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  schema?: Record<string, unknown>
}

const ajv = new Ajv({ allErrors: true, strict: false })
const compiledCache = new WeakMap<object, ValidateFunction>()

function compileSchema(schema: Record<string, unknown>): ValidateFunction {
  const cached = compiledCache.get(schema)
  if (cached !== undefined) return cached
  const compiled = ajv.compile(schema)
  compiledCache.set(schema, compiled)
  return compiled
}

function coerce(value: string, schema: Record<string, unknown>): unknown {
  if (schema.type === 'integer' || schema.type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? value : parsed
  }
  if (schema.type === 'boolean') {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  }
  return value
}

export function validateRequest(
  operation: Record<string, unknown>,
  request: ValidationRequest,
): ValidationResult {
  const issues: ValidationIssue[] = []

  const parameters = (operation.parameters as OpenApiParameter[] | undefined) ?? []
  for (const parameter of parameters) {
    if (parameter.in !== 'query' && parameter.in !== 'path') continue

    const source = parameter.in === 'query' ? request.query : request.params
    const value = source[parameter.name]

    if (value === undefined) {
      if (parameter.required) {
        issues.push({
          path: parameter.name,
          message: `missing required ${parameter.in} parameter '${parameter.name}'`,
        })
      }
      continue
    }

    if (parameter.schema !== undefined) {
      const validate = compileSchema(parameter.schema)
      if (!validate(coerce(value, parameter.schema))) {
        for (const error of validate.errors ?? []) {
          issues.push({ path: parameter.name, message: error.message ?? 'invalid value' })
        }
      }
    }
  }

  const requestBody = operation.requestBody as
    | { required?: boolean; content?: Record<string, { schema?: Record<string, unknown> }> }
    | undefined
  const bodySchema = requestBody?.content?.['application/json']?.schema

  if (bodySchema !== undefined && (request.body !== undefined || requestBody?.required)) {
    const validate = compileSchema(bodySchema)
    if (!validate(request.body)) {
      for (const error of validate.errors ?? []) {
        issues.push({
          path: `body${error.instancePath}`,
          message: error.message ?? 'invalid value',
        })
      }
    }
  }

  return { valid: issues.length === 0, issues }
}
