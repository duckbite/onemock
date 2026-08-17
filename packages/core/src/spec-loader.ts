import { compileErrors, dereference, validate } from '@readme/openapi-parser'

export type OpenApiDocument = Awaited<ReturnType<typeof dereference>>

export type SpecInput = string | URL | Record<string, unknown>

export interface LoadedSpec {
  document: OpenApiDocument
  specification: 'OpenAPI' | 'Swagger'
}

export async function loadSpec(input: SpecInput): Promise<LoadedSpec> {
  const source = input instanceof URL ? input.toString() : input

  let document: OpenApiDocument
  try {
    document = await dereference(source as Parameters<typeof dereference>[0])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`onemock: failed to load spec: ${message}`)
  }

  const result = await validate(document)
  if (!result.valid) {
    throw new Error(`onemock: invalid spec:\n${compileErrors(result)}`)
  }
  if (result.specification === null) {
    throw new Error('onemock: spec is not a recognizable OpenAPI or Swagger document')
  }

  return { document, specification: result.specification }
}
