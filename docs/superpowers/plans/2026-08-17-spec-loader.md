# Spec Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the spec loader (Linear DB-282): load an OpenAPI/Swagger spec from a file path, URL, or in-memory object; resolve `$ref`s; validate it; and build the internal route table (method + path → operation) that later tickets (DB-290 Engine core) will consume.

**Architecture:** Two small, independently testable modules in `packages/core/src`. `spec-loader.ts` owns I/O and validation (wraps `@readme/openapi-parser`, throws immediately with a clear `onemock:`-prefixed message on any invalid/unparseable input). `route-table.ts` owns a pure, dependency-free transform from a dereferenced document's `paths` object into a flat list of routes. Neither module is wired into `createMock()` yet — that wiring is DB-290, a separate ticket that depends on this one; `createMock()` stays the throwing stub from the core scaffolding work.

**Tech Stack:** `@readme/openapi-parser` (spec parsing/validation), TypeScript, Vitest.

## Global Constraints

- Spec parsing must use `@readme/openapi-parser` — it resolves `$ref`s, validates, and covers OpenAPI 3.0/3.1 + Swagger 2.0, per the design spec's "Key library choices" table (`docs/superpowers/specs/2026-08-16-onemock-pivot-design.md`).
- Invalid/unparseable specs must throw immediately (at load time, not later at first request) with a message pointing at the offending part of the spec, per the spec's "Error Handling" section and Linear ticket DB-282's acceptance text.
- This ticket does NOT modify `createMock()` in `packages/core/src/index.ts` or wire these modules into it — that is DB-290's job, which depends on this ticket completing first. Do not touch `index.ts`.
- Follow the existing `packages/core` conventions from the core-scaffolding work: TypeScript strict mode, ESM (`"type": "module"`), Vitest for tests, no unnecessary dependencies.

---

### Task 1: `spec-loader.ts` — load, dereference, and validate a spec

**Files:**
- Modify: `packages/core/package.json` (add `@readme/openapi-parser` dependency)
- Create: `packages/core/src/spec-loader.ts`
- Create: `packages/core/src/spec-loader.test.ts`
- Create: `packages/core/src/__fixtures__/valid-openapi3.json`
- Create: `packages/core/src/__fixtures__/valid-swagger2.json`
- Create: `packages/core/src/__fixtures__/valid-openapi31.json`
- Create: `packages/core/src/__fixtures__/invalid-semantic.json`
- Create: `packages/core/src/__fixtures__/malformed.json`

**Interfaces:**
- Produces: `export type OpenApiDocument = Awaited<ReturnType<typeof dereference>>`, `export type SpecInput = string | URL | Record<string, unknown>`, `export interface LoadedSpec { document: OpenApiDocument; specification: 'OpenAPI' | 'Swagger' }`, `export async function loadSpec(input: SpecInput): Promise<LoadedSpec>`. Task 2's `buildRouteTable` consumes values shaped like `LoadedSpec.document` (specifically its `paths` property) but does not import from this file — see Task 2's own interface.

- [ ] **Step 1: Add the `@readme/openapi-parser` dependency**

Edit `packages/core/package.json`. Add a `"dependencies"` field (this repo's `packages/core/package.json` currently has no `dependencies` key, only `devDependencies` — add `dependencies` as a new top-level key, placed directly before `"devDependencies"`):

```json
  "dependencies": {
    "@readme/openapi-parser": "^7.0.1"
  },
```

- [ ] **Step 2: Install and verify**

Run: `pnpm install`
Expected: completes successfully, `@readme/openapi-parser` appears in `packages/core/node_modules` and in the updated `pnpm-lock.yaml`.

- [ ] **Step 3: Create the fixture files**

`packages/core/src/__fixtures__/valid-openapi3.json`:
```json
{
  "openapi": "3.0.0",
  "info": { "title": "Pet Store", "version": "1.0.0" },
  "paths": {
    "/pets": {
      "summary": "Pet collection",
      "get": {
        "operationId": "listPets",
        "responses": {
          "200": {
            "description": "A list of pets",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/PetList" }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createPet",
        "responses": {
          "201": {
            "description": "Created",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Pet" }
              }
            }
          }
        }
      }
    },
    "/pets/{petId}": {
      "parameters": [
        { "name": "petId", "in": "path", "required": true, "schema": { "type": "string" } }
      ],
      "get": {
        "operationId": "getPet",
        "responses": {
          "200": {
            "description": "A pet",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Pet" }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Pet": {
        "type": "object",
        "properties": { "id": { "type": "string" }, "name": { "type": "string" } }
      },
      "PetList": {
        "type": "array",
        "items": { "$ref": "#/components/schemas/Pet" }
      }
    }
  }
}
```

`packages/core/src/__fixtures__/valid-swagger2.json`:
```json
{
  "swagger": "2.0",
  "info": { "title": "Pet Store", "version": "1.0.0" },
  "paths": {
    "/pets": {
      "get": {
        "operationId": "listPets",
        "responses": {
          "200": { "description": "A list of pets" }
        }
      }
    }
  }
}
```

`packages/core/src/__fixtures__/valid-openapi31.json`:
```json
{
  "openapi": "3.1.0",
  "info": { "title": "Pet Store", "version": "1.0.0" },
  "paths": {
    "/pets": {
      "get": {
        "operationId": "listPets",
        "responses": {
          "200": { "description": "A list of pets" }
        }
      }
    }
  }
}
```

`packages/core/src/__fixtures__/invalid-semantic.json` (valid JSON, but fails OpenAPI schema validation — missing required `info.version`):
```json
{
  "openapi": "3.0.0",
  "info": { "title": "Broken" },
  "paths": {}
}
```

`packages/core/src/__fixtures__/malformed.json` (not valid JSON — intentionally broken):
```
{ this is not valid json
```

- [ ] **Step 4: Write the failing tests**

`packages/core/src/spec-loader.test.ts`:
```ts
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
    const result = await loadSpec(new URL('./valid-openapi3.json', import.meta.url))

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
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `spec-loader.ts` does not exist yet, so `loadSpec` cannot be imported.

- [ ] **Step 6: Implement `loadSpec`**

`packages/core/src/spec-loader.ts`:
```ts
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
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 7 tests in `spec-loader.test.ts` passing.

- [ ] **Step 8: Run build and typecheck**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck`
Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/core/package.json packages/core/src/spec-loader.ts packages/core/src/spec-loader.test.ts packages/core/src/__fixtures__ pnpm-lock.yaml
git commit -m "feat: add spec loader with OpenAPI/Swagger validation and dereferencing"
```

---

### Task 2: `route-table.ts` — build the route table from a loaded document

**Files:**
- Create: `packages/core/src/route-table.ts`
- Create: `packages/core/src/route-table.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 by import — intentionally decoupled (see below). Callers (e.g. the future DB-290 engine core) pass `loadSpec(...)`'s returned `LoadedSpec.document` straight into `buildRouteTable`; the two modules are connected by callers, not by a direct dependency between the files.
- Produces: `export const HTTP_METHODS: readonly ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']`, `export type HttpMethod = (typeof HTTP_METHODS)[number]`, `export interface RouteTableEntry { method: HttpMethod; path: string; operation: Record<string, unknown> }`, `export interface DocumentWithPaths { paths?: Record<string, Record<string, unknown> | undefined> }`, `export function buildRouteTable(document: DocumentWithPaths): RouteTableEntry[]`.

`route-table.ts` deliberately does not import `OpenApiDocument` from `spec-loader.ts`. It only needs the `paths` shape, and a real `OpenApiDocument` (from any of OpenAPI 2.0/3.0/3.1) structurally satisfies `DocumentWithPaths` — this keeps route-table logic testable with plain object literals and free of any parser dependency.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/route-table.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildRouteTable } from './route-table'

describe('buildRouteTable', () => {
  it('extracts one entry per HTTP method across multiple paths', () => {
    const document = {
      paths: {
        '/pets': {
          summary: 'Pet collection',
          get: { operationId: 'listPets' },
          post: { operationId: 'createPet' },
        },
        '/pets/{petId}': {
          parameters: [{ name: 'petId', in: 'path' }],
          get: { operationId: 'getPet' },
        },
      },
    }

    const table = buildRouteTable(document)

    expect(table).toHaveLength(3)
    expect(table).toContainEqual({
      method: 'get',
      path: '/pets',
      operation: { operationId: 'listPets' },
    })
    expect(table).toContainEqual({
      method: 'post',
      path: '/pets',
      operation: { operationId: 'createPet' },
    })
    expect(table).toContainEqual({
      method: 'get',
      path: '/pets/{petId}',
      operation: { operationId: 'getPet' },
    })
  })

  it('excludes non-method path item keys like summary, description, and parameters', () => {
    const document = {
      paths: {
        '/pets': {
          summary: 'Pet collection',
          description: 'All pets',
          parameters: [{ name: 'unused', in: 'query' }],
          get: { operationId: 'listPets' },
        },
      },
    }

    const table = buildRouteTable(document)

    expect(table).toEqual([{ method: 'get', path: '/pets', operation: { operationId: 'listPets' } }])
  })

  it('returns an empty array when the document has no paths', () => {
    expect(buildRouteTable({})).toEqual([])
    expect(buildRouteTable({ paths: {} })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `route-table.ts` does not exist yet, so `buildRouteTable` cannot be imported. (`spec-loader.test.ts` from Task 1 continues to pass.)

- [ ] **Step 3: Implement `buildRouteTable`**

`packages/core/src/route-table.ts`:
```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all tests in `route-table.test.ts` passing, plus all 7 from `spec-loader.test.ts` still passing (10 total).

- [ ] **Step 5: Run build and typecheck**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck`
Expected: both exit 0.

- [ ] **Step 6: Verify `buildRouteTable` accepts a real loaded document (integration sanity check)**

This step confirms the two modules actually compose, even though they're not directly coupled in code. Temporarily add this test to the end of `packages/core/src/route-table.test.ts`, run it, then leave it in place as a permanent regression test:

```ts
import { fileURLToPath } from 'node:url'
import { loadSpec } from './spec-loader'

describe('buildRouteTable with a real loaded spec', () => {
  it('builds a route table from a loadSpec() result', async () => {
    const fixturesDir = fileURLToPath(new URL('./__fixtures__/', import.meta.url))
    const { document } = await loadSpec(`${fixturesDir}valid-openapi3.json`)

    const table = buildRouteTable(document)

    expect(table).toHaveLength(3)
    expect(table.map((entry) => `${entry.method} ${entry.path}`).sort()).toEqual([
      'get /pets',
      'get /pets/{petId}',
      'post /pets',
    ])
  })
})
```

Add this import at the top of `packages/core/src/route-table.test.ts` alongside the existing ones: `import { fileURLToPath } from 'node:url'` and `import { loadSpec } from './spec-loader'`.

Run: `pnpm --filter onemock test`
Expected: PASS — 11 tests total (7 from `spec-loader.test.ts`, 4 from `route-table.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/route-table.ts packages/core/src/route-table.test.ts
git commit -m "feat: add route table builder from spec paths"
```
