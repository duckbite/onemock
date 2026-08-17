import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadSpec } from './spec-loader'

const fixturesDir = fileURLToPath(new URL('./__fixtures__/', import.meta.url))

describe('loadSpec', () => {
  it('loads and dereferences a valid OpenAPI 3.0 spec from a file path', async () => {
    const result = await loadSpec(`${fixturesDir}valid-openapi3.json`)

    expect(result.specification).toBe('OpenAPI')
    expect(result.document.info.title).toBe('Pet Store')
    expect(JSON.stringify(result.document)).not.toContain('$ref')
  })

  it('loads a spec from a URL input (file:// URL of the same fixture)', async () => {
    const result = await loadSpec(new URL('./__fixtures__/valid-openapi3.json', import.meta.url))

    expect(result.specification).toBe('OpenAPI')
    expect(result.document.info.title).toBe('Pet Store')
  })

  it('loads a valid Swagger 2.0 spec and reports its specification', async () => {
    const result = await loadSpec(`${fixturesDir}valid-swagger2.json`)

    expect(result.specification).toBe('Swagger')
  })

  it('loads a valid OpenAPI 3.1 spec and reports its specification', async () => {
    const result = await loadSpec(`${fixturesDir}valid-openapi31.json`)

    expect(result.specification).toBe('OpenAPI')
  })

  it('loads an in-memory spec object directly', async () => {
    const result = await loadSpec({
      openapi: '3.0.0',
      info: { title: 'Inline', version: '1.0.0' },
      paths: {},
    })

    expect(result.specification).toBe('OpenAPI')
  })

  it('rejects with a prefixed, detailed error for a semantically invalid spec', async () => {
    await expect(loadSpec(`${fixturesDir}invalid-semantic.json`)).rejects.toThrow(
      /^onemock: invalid spec:[\s\S]*version/,
    )
  })

  it('rejects with a prefixed error for malformed (unparseable) input', async () => {
    await expect(loadSpec(`${fixturesDir}malformed.json`)).rejects.toThrow(
      /^onemock: failed to load spec:/,
    )
  })

  it('rejects with a prefixed error for a nonexistent path', async () => {
    await expect(loadSpec(`${fixturesDir}does-not-exist.json`)).rejects.toThrow(
      /^onemock: failed to load spec:/,
    )
  })
})
