# Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining core engine components (Linear DB-283 through DB-289 — schema-to-data generator, in-memory state store, override/seed API, request validator, rate-limit/latency simulators, pagination handler, request/response logging) and wire them into the single request-resolution pipeline (DB-290), replacing `createMock()`'s throwing stub with a real, working implementation.

**Architecture:** Seven small, independently testable modules in `packages/core/src`, each owning exactly one concern from the design spec's "Core Engine Components" list. A new `Engine` class (`engine.ts`) composes all seven into the resolution pipeline described in the spec's "Data Flow" section: match route → check overrides → run simulators → validate request → resolve via state store. `createMock()` in `index.ts` becomes a thin async factory: load the spec, construct an `Engine`, and return a `MockInstance` exposing `seed`/`override`/`reset`/`handle`. `handle()` is the low-level request-processing entry point that the next tickets (DB-291 server adapter, DB-292 interception adapter) will call — no public HTTP surface exists yet after this plan; that is explicitly out of scope here.

Every piece of code in this plan has already been written and verified end-to-end in a scratch environment: the real `@readme/openapi-parser`, `@faker-js/faker`, and `ajv` APIs were checked against their actual installed versions, and the full pipeline (create → fetch round-trip, validation failure, unseeded-GET generation, update, delete, override precedence, reset, pagination, rate limiting, latency/forced-failure) was run end-to-end through both the `Engine` class directly and through the real `createMock()` entry point. The code below is that verified code, not a first draft.

**Tech Stack:** `@faker-js/faker` (schema-based data generation), `ajv` (request validation), TypeScript, Vitest.

## Global Constraints

- Each new module has exactly one responsibility, matching the design spec's "Core Engine Components" list (`docs/superpowers/specs/2026-08-16-onemock-pivot-design.md`).
- The resolution order in `Engine.handle()` must match the spec's "Data Flow" section exactly: route match → override check → behavior simulators → request validation → state store resolution. Do not reorder these.
- Simulated failures (rate limit, latency) are spec-shaped responses (429, 503), not thrown errors — per the spec's "Error Handling" section, so the caller's real error-handling code is what gets exercised.
- No new runtime dependencies beyond `@faker-js/faker` and `ajv` — both are the design spec's own "Key library choices" for this work. No Express/Fastify or other server framework (that's DB-291's concern, not this plan's).
- `createMock()`'s public surface after this plan is `{ seed, override, reset, handle }`. Do **not** add `listen()` or `intercept()` stubs — those are DB-291 and DB-292, separate tickets that depend on this one; adding placeholder methods for them now would risk contradicting how those tickets actually implement them.
- Follow existing `packages/core` conventions: TypeScript strict mode, ESM, Vitest, no `any`.

---

### Task 1: `generator.ts` — schema-to-data generator (DB-283)

**Files:**
- Modify: `packages/core/package.json` (add `@faker-js/faker` dependency)
- Create: `packages/core/src/generator.ts`
- Create: `packages/core/src/generator.test.ts`

**Interfaces:**
- Produces: `export type JsonSchema = Record<string, unknown>`, `export interface GeneratorOptions { seed?: number }`, `export class SchemaGenerator { constructor(options?: GeneratorOptions); generate(schema: JsonSchema | undefined): unknown }`. Task 8 (`engine.ts`) constructs one `SchemaGenerator` per `Engine` instance and calls `.generate(schema)` when a resource needs to be fabricated.

- [ ] **Step 1: Add the `@faker-js/faker` dependency**

Edit `packages/core/package.json`. Add to the existing `"dependencies"` block (created in the spec-loader work) so it reads:

```json
  "dependencies": {
    "@faker-js/faker": "^10.6.0",
    "@readme/openapi-parser": "^7.0.1"
  },
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: completes successfully, `@faker-js/faker` appears in `packages/core/node_modules` and the updated `pnpm-lock.yaml`.

- [ ] **Step 3: Write the failing tests**

`packages/core/src/generator.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { SchemaGenerator } from './generator'

describe('SchemaGenerator', () => {
  it('generates deterministic output for the same seed', () => {
    const a = new SchemaGenerator({ seed: 7 })
    const b = new SchemaGenerator({ seed: 7 })
    const schema = { type: 'string', format: 'email' }

    expect(a.generate(schema)).toBe(b.generate(schema))
  })

  it('generates an object matching declared properties', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const result = generator.generate({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    }) as Record<string, unknown>

    expect(typeof result.name).toBe('string')
    expect(typeof result.age).toBe('number')
    expect(Number.isInteger(result.age)).toBe(true)
  })

  it('generates an array of items matching the items schema', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const result = generator.generate({ type: 'array', items: { type: 'string' } }) as unknown[]

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    for (const item of result) {
      expect(typeof item).toBe('string')
    }
  })

  it('picks a value from enum', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const result = generator.generate({ enum: ['a', 'b', 'c'] })

    expect(['a', 'b', 'c']).toContain(result)
  })

  it('generates format-aware strings (uuid, email)', () => {
    const generator = new SchemaGenerator({ seed: 1 })
    const uuid = generator.generate({ type: 'string', format: 'uuid' }) as string
    const email = generator.generate({ type: 'string', format: 'email' }) as string

    expect(uuid).toMatch(/^[0-9a-f-]{36}$/)
    expect(email).toContain('@')
  })

  it('returns undefined for an undefined schema', () => {
    const generator = new SchemaGenerator({ seed: 1 })

    expect(generator.generate(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `generator.ts` does not exist yet.

- [ ] **Step 5: Implement `SchemaGenerator`**

`packages/core/src/generator.ts`:
```ts
import { Faker, en } from '@faker-js/faker'

export type JsonSchema = Record<string, unknown>

export interface GeneratorOptions {
  seed?: number
}

export class SchemaGenerator {
  private readonly faker: Faker

  constructor(options: GeneratorOptions = {}) {
    this.faker = new Faker({ locale: [en] })
    this.faker.seed(options.seed ?? 1)
  }

  generate(schema: JsonSchema | undefined): unknown {
    return this.generateFromSchema(schema)
  }

  private generateFromSchema(schema: JsonSchema | undefined): unknown {
    if (schema === undefined) return undefined

    const enumValues = schema.enum as unknown[] | undefined
    if (Array.isArray(enumValues) && enumValues.length > 0) {
      return this.faker.helpers.arrayElement(enumValues)
    }

    const allOf = schema.allOf as JsonSchema[] | undefined
    if (Array.isArray(allOf)) {
      let merged: Record<string, unknown> = {}
      for (const sub of allOf) {
        const value = this.generateFromSchema(sub)
        if (typeof value === 'object' && value !== null) {
          merged = { ...merged, ...(value as Record<string, unknown>) }
        }
      }
      return merged
    }

    const oneOf = schema.oneOf as JsonSchema[] | undefined
    if (Array.isArray(oneOf) && oneOf.length > 0) {
      return this.generateFromSchema(oneOf[0])
    }

    const anyOf = schema.anyOf as JsonSchema[] | undefined
    if (Array.isArray(anyOf) && anyOf.length > 0) {
      return this.generateFromSchema(anyOf[0])
    }

    const type = schema.type as string | undefined

    if (type === 'object' || (type === undefined && schema.properties !== undefined)) {
      const properties = (schema.properties ?? {}) as Record<string, JsonSchema>
      const result: Record<string, unknown> = {}
      for (const [key, propSchema] of Object.entries(properties)) {
        result[key] = this.generateFromSchema(propSchema)
      }
      return result
    }

    if (type === 'array') {
      const itemSchema = schema.items as JsonSchema | undefined
      const count = this.faker.number.int({ min: 1, max: 3 })
      return Array.from({ length: count }, () => this.generateFromSchema(itemSchema))
    }

    return this.generatePrimitive(type, schema.format as string | undefined)
  }

  private generatePrimitive(type: string | undefined, format: string | undefined): unknown {
    switch (type) {
      case 'string':
        return this.generateString(format)
      case 'integer':
        return this.faker.number.int({ min: 0, max: 1000 })
      case 'number':
        return this.faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })
      case 'boolean':
        return this.faker.datatype.boolean()
      case 'null':
        return null
      default:
        return this.faker.word.sample()
    }
  }

  private generateString(format: string | undefined): string {
    switch (format) {
      case 'uuid':
        return this.faker.string.uuid()
      case 'email':
        return this.faker.internet.email()
      case 'date':
        return this.faker.date.recent().toISOString().slice(0, 10)
      case 'date-time':
        return this.faker.date.recent().toISOString()
      case 'uri':
      case 'url':
        return this.faker.internet.url()
      default:
        return this.faker.word.words({ count: { min: 1, max: 3 } })
    }
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 6 tests in `generator.test.ts` passing (plus all previously-passing tests still green).

- [ ] **Step 7: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/package.json packages/core/src/generator.ts packages/core/src/generator.test.ts pnpm-lock.yaml
git commit -m "feat: add schema-to-data generator"
```

---

### Task 2: `state-store.ts` — in-memory state store (DB-284)

**Files:**
- Create: `packages/core/src/state-store.ts`
- Create: `packages/core/src/state-store.test.ts`

**Interfaces:**
- Produces: `export interface StateStoreOptions { generateId?: () => string }`, `export class StateStore { constructor(options?: StateStoreOptions); list(collection: string): Record<string, unknown>[]; get(collection: string, id: string): Record<string, unknown> | undefined; create(collection: string, data: Record<string, unknown>, id?: string): Record<string, unknown>; update(collection: string, id: string, data: Record<string, unknown>): Record<string, unknown> | undefined; delete(collection: string, id: string): boolean; reset(): void }`. Deliberately generic (collection + id, no path/schema awareness) — Task 8's `Engine` derives collection keys and ids from route paths and calls into this store.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/state-store.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { StateStore } from './state-store'

describe('StateStore', () => {
  it('creates a resource with an auto-generated id and can fetch it back', () => {
    const store = new StateStore()
    const created = store.create('pets', { name: 'Rex' })

    expect(created.id).toBe('1')
    expect(store.get('pets', '1')).toEqual({ name: 'Rex', id: '1' })
  })

  it('lists all resources in a collection', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' })
    store.create('pets', { name: 'Fido' })

    expect(store.list('pets')).toHaveLength(2)
  })

  it('updates an existing resource by merging fields', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' }, '1')

    const updated = store.update('pets', '1', { name: 'Rex Updated' })

    expect(updated).toEqual({ name: 'Rex Updated', id: '1' })
  })

  it('returns undefined when updating a resource that does not exist', () => {
    const store = new StateStore()

    expect(store.update('pets', 'missing', { name: 'x' })).toBeUndefined()
  })

  it('deletes a resource and reports whether it existed', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' }, '1')

    expect(store.delete('pets', '1')).toBe(true)
    expect(store.delete('pets', '1')).toBe(false)
    expect(store.get('pets', '1')).toBeUndefined()
  })

  it('keeps separate collections independent', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' }, '1')
    store.create('owners', { name: 'Alice' }, '1')

    expect(store.get('pets', '1')).toEqual({ name: 'Rex', id: '1' })
    expect(store.get('owners', '1')).toEqual({ name: 'Alice', id: '1' })
  })

  it('reset clears all collections and the id counter', () => {
    const store = new StateStore()
    store.create('pets', { name: 'Rex' })
    store.reset()

    expect(store.list('pets')).toEqual([])
    expect(store.create('pets', { name: 'Fido' }).id).toBe('1')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `state-store.ts` does not exist yet.

- [ ] **Step 3: Implement `StateStore`**

`packages/core/src/state-store.ts`:
```ts
export interface StateStoreOptions {
  generateId?: () => string
}

export class StateStore {
  private readonly collections = new Map<string, Map<string, Record<string, unknown>>>()
  private readonly generateId: () => string
  private counter = 0

  constructor(options: StateStoreOptions = {}) {
    this.generateId = options.generateId ?? (() => String(++this.counter))
  }

  list(collection: string): Record<string, unknown>[] {
    return Array.from(this.getCollection(collection).values())
  }

  get(collection: string, id: string): Record<string, unknown> | undefined {
    return this.getCollection(collection).get(id)
  }

  create(
    collection: string,
    data: Record<string, unknown>,
    id?: string,
  ): Record<string, unknown> {
    const resourceId = id ?? this.generateId()
    const resource = { ...data, id: data.id ?? resourceId }
    this.getCollection(collection).set(resourceId, resource)
    return resource
  }

  update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const existing = this.getCollection(collection).get(id)
    if (existing === undefined) return undefined
    const updated = { ...existing, ...data }
    this.getCollection(collection).set(id, updated)
    return updated
  }

  delete(collection: string, id: string): boolean {
    return this.getCollection(collection).delete(id)
  }

  reset(): void {
    this.collections.clear()
    this.counter = 0
  }

  private getCollection(collection: string): Map<string, Record<string, unknown>> {
    let map = this.collections.get(collection)
    if (map === undefined) {
      map = new Map()
      this.collections.set(collection, map)
    }
    return map
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 7 tests in `state-store.test.ts` passing.

- [ ] **Step 5: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/state-store.ts packages/core/src/state-store.test.ts
git commit -m "feat: add in-memory state store"
```

---

### Task 3: path matching + `overrides.ts` — override & seed API (DB-285)

**Files:**
- Modify: `packages/core/src/route-table.ts` (add `matchPath` export)
- Modify: `packages/core/src/route-table.test.ts` (add tests for `matchPath`)
- Create: `packages/core/src/overrides.ts`
- Create: `packages/core/src/overrides.test.ts`

**Interfaces:**
- `route-table.ts` produces (in addition to its existing exports): `export function matchPath(template: string, actualPath: string): Record<string, string> | null`. Returns `null` on no match, else a params record (empty object for a path with no `{param}` segments). Used by both `overrides.ts` (this task) and `engine.ts` (Task 8) for route/override path matching — kept here since it's fundamentally a route-path concern, not override-specific.
- `overrides.ts` produces: `export interface OverrideRequest { method: HttpMethod; path: string; params: Record<string, string>; query: Record<string, string>; headers: Record<string, string>; body: unknown }`, `export interface OverrideResponse { status: number; headers?: Record<string, string>; body?: unknown }`, `export type OverrideHandler = OverrideResponse | ((request: OverrideRequest) => OverrideResponse)`, `export interface OverrideOptions { times?: number }`, `export class OverrideRegistry { override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, options?: OverrideOptions): void; resolve(method: HttpMethod, path: string, context: Omit<OverrideRequest, 'method' | 'path' | 'params'>): OverrideResponse | undefined; reset(): void }`. Task 8's `Engine` holds one `OverrideRegistry` and calls `.resolve()` before falling through to the state store.

- [ ] **Step 1: Write the failing tests for `matchPath`**

Add to the end of `packages/core/src/route-table.test.ts` (add `matchPath` to the existing `import { buildRouteTable } from './route-table'` line so it reads `import { buildRouteTable, matchPath } from './route-table'`):

```ts
describe('matchPath', () => {
  it('matches a static path with no params', () => {
    expect(matchPath('/pets', '/pets')).toEqual({})
  })

  it('extracts a single path param', () => {
    expect(matchPath('/pets/{petId}', '/pets/abc123')).toEqual({ petId: 'abc123' })
  })

  it('extracts multiple path params', () => {
    expect(matchPath('/owners/{ownerId}/pets/{petId}', '/owners/o1/pets/p1')).toEqual({
      ownerId: 'o1',
      petId: 'p1',
    })
  })

  it('returns null when segment counts differ', () => {
    expect(matchPath('/pets/{petId}', '/pets')).toBeNull()
  })

  it('returns null when a static segment does not match', () => {
    expect(matchPath('/pets/{petId}', '/owners/1')).toBeNull()
  })

  it('decodes URI-encoded param values', () => {
    expect(matchPath('/pets/{petId}', '/pets/a%20b')).toEqual({ petId: 'a b' })
  })
})
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `matchPath` is not exported yet. (Existing `route-table.test.ts` tests for `buildRouteTable` continue to pass.)

- [ ] **Step 3: Add `matchPath` to `route-table.ts`**

Append to `packages/core/src/route-table.ts`:
```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all `matchPath` tests green, `buildRouteTable` tests still green.

- [ ] **Step 5: Write the failing tests for `OverrideRegistry`**

`packages/core/src/overrides.test.ts`:
```ts
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
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `overrides.ts` does not exist yet.

- [ ] **Step 7: Implement `OverrideRegistry`**

`packages/core/src/overrides.ts`:
```ts
import { matchPath, type HttpMethod } from './route-table'

export interface OverrideRequest {
  method: HttpMethod
  path: string
  params: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
}

export interface OverrideResponse {
  status: number
  headers?: Record<string, string>
  body?: unknown
}

export type OverrideHandler = OverrideResponse | ((request: OverrideRequest) => OverrideResponse)

export interface OverrideOptions {
  times?: number
}

interface RegisteredOverride {
  method: HttpMethod
  pathTemplate: string
  handler: OverrideHandler
  remaining: number | undefined
}

export class OverrideRegistry {
  private overrides: RegisteredOverride[] = []

  override(
    method: HttpMethod,
    pathTemplate: string,
    handler: OverrideHandler,
    options: OverrideOptions = {},
  ): void {
    this.overrides.push({ method, pathTemplate, handler, remaining: options.times })
  }

  resolve(
    method: HttpMethod,
    path: string,
    context: Omit<OverrideRequest, 'method' | 'path' | 'params'>,
  ): OverrideResponse | undefined {
    for (let i = this.overrides.length - 1; i >= 0; i--) {
      const entry = this.overrides[i]
      if (entry.method !== method) continue
      if (entry.remaining !== undefined && entry.remaining <= 0) continue

      const params = matchPath(entry.pathTemplate, path)
      if (params === null) continue

      if (entry.remaining !== undefined) entry.remaining -= 1

      const request: OverrideRequest = { method, path, params, ...context }
      return typeof entry.handler === 'function' ? entry.handler(request) : entry.handler
    }
    return undefined
  }

  reset(): void {
    this.overrides = []
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 7 tests in `overrides.test.ts` passing.

- [ ] **Step 9: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/route-table.ts packages/core/src/route-table.test.ts packages/core/src/overrides.ts packages/core/src/overrides.test.ts
git commit -m "feat: add path matching and override/seed registry"
```

---

### Task 4: `validator.ts` — request validator (DB-286)

**Files:**
- Modify: `packages/core/package.json` (add `ajv` dependency)
- Create: `packages/core/src/validator.ts`
- Create: `packages/core/src/validator.test.ts`

**Interfaces:**
- Produces: `export interface ValidationIssue { path: string; message: string }`, `export interface ValidationRequest { params: Record<string, string>; query: Record<string, string>; body: unknown }`, `export interface ValidationResult { valid: boolean; issues: ValidationIssue[] }`, `export function validateRequest(operation: Record<string, unknown>, request: ValidationRequest): ValidationResult`. `operation` is a `RouteTableEntry.operation` value (Task 8 passes it straight through). Task 8 calls this after the override check and before resolving from the state store.

- [ ] **Step 1: Add the `ajv` dependency**

Edit `packages/core/package.json`, extending `"dependencies"`:

```json
  "dependencies": {
    "@faker-js/faker": "^10.6.0",
    "@readme/openapi-parser": "^7.0.1",
    "ajv": "^8.20.0"
  },
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: completes successfully, `ajv` appears in `packages/core/node_modules` and the updated `pnpm-lock.yaml`.

- [ ] **Step 3: Write the failing tests**

`packages/core/src/validator.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { validateRequest } from './validator'

describe('validateRequest', () => {
  it('is valid when the operation has no parameters or requestBody', () => {
    const result = validateRequest({}, { params: {}, query: {}, body: undefined })

    expect(result).toEqual({ valid: true, issues: [] })
  })

  it('flags a missing required query parameter', () => {
    const operation = {
      parameters: [{ name: 'limit', in: 'query', required: true, schema: { type: 'integer' } }],
    }

    const result = validateRequest(operation, { params: {}, query: {}, body: undefined })

    expect(result.valid).toBe(false)
    expect(result.issues).toEqual([
      { path: 'limit', message: "missing required query parameter 'limit'" },
    ])
  })

  it('is valid when a required query parameter is present and matches its schema', () => {
    const operation = {
      parameters: [{ name: 'limit', in: 'query', required: true, schema: { type: 'integer' } }],
    }

    const result = validateRequest(operation, {
      params: {},
      query: { limit: '5' },
      body: undefined,
    })

    expect(result.valid).toBe(true)
  })

  it('flags a query parameter whose value does not match its schema type', () => {
    const operation = {
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
    }

    const result = validateRequest(operation, {
      params: {},
      query: { limit: 'not-a-number' },
      body: undefined,
    })

    expect(result.valid).toBe(false)
    expect(result.issues[0].path).toBe('limit')
  })

  it('flags a request body missing a required field', () => {
    const operation = {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' } },
            },
          },
        },
      },
    }

    const result = validateRequest(operation, { params: {}, query: {}, body: {} })

    expect(result.valid).toBe(false)
    expect(result.issues[0].path).toBe('body')
  })

  it('is valid when the request body matches its schema', () => {
    const operation = {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' } },
            },
          },
        },
      },
    }

    const result = validateRequest(operation, { params: {}, query: {}, body: { name: 'Rex' } })

    expect(result.valid).toBe(true)
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `validator.ts` does not exist yet.

- [ ] **Step 5: Implement `validateRequest`**

`packages/core/src/validator.ts`:
```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 6 tests in `validator.test.ts` passing.

- [ ] **Step 7: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/package.json packages/core/src/validator.ts packages/core/src/validator.test.ts pnpm-lock.yaml
git commit -m "feat: add ajv-based request validator"
```

---

### Task 5: `simulators.ts` — rate limiting & latency simulators (DB-287)

**Files:**
- Create: `packages/core/src/simulators.ts`
- Create: `packages/core/src/simulators.test.ts`

**Interfaces:**
- Produces: `export interface RateLimitConfig { limit: number; windowMs: number }`, `export interface RateLimitStatus { limited: boolean; retryAfterMs: number }`, `export class RateLimiter { constructor(config: RateLimitConfig, now?: () => number); check(key?: string): RateLimitStatus; reset(): void }`, `export interface LatencyConfig { delayMs?: number; failureRate?: number }`, `export interface LatencyResult { failed: boolean }`, `export function applyLatency(config: LatencyConfig, random?: () => number): Promise<LatencyResult>`. Task 8 constructs one `RateLimiter` per `Engine` (only if `options.rateLimit` is set) and calls `applyLatency` directly with `options.latency` on every request when configured.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/simulators.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { RateLimiter, applyLatency } from './simulators'

describe('RateLimiter', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const limiter = new RateLimiter({ limit: 2, windowMs: 1000 })

    expect(limiter.check().limited).toBe(false)
    expect(limiter.check().limited).toBe(false)
    expect(limiter.check().limited).toBe(true)
  })

  it('reports a positive retryAfterMs when limited', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 })
    limiter.check()

    const result = limiter.check()

    expect(result.limited).toBe(true)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets the count once the window elapses', () => {
    let now = 0
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 }, () => now)

    expect(limiter.check().limited).toBe(false)
    now = 1500
    expect(limiter.check().limited).toBe(false)
  })

  it('tracks separate keys independently', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 })

    expect(limiter.check('a').limited).toBe(false)
    expect(limiter.check('b').limited).toBe(false)
  })

  it('reset clears all counters', () => {
    const limiter = new RateLimiter({ limit: 1, windowMs: 1000 })
    limiter.check()
    limiter.reset()

    expect(limiter.check().limited).toBe(false)
  })
})

describe('applyLatency', () => {
  it('waits at least delayMs before resolving', async () => {
    const start = Date.now()
    await applyLatency({ delayMs: 20 })

    expect(Date.now() - start).toBeGreaterThanOrEqual(20)
  })

  it('never fails when failureRate is 0', async () => {
    const result = await applyLatency({ failureRate: 0 }, () => 0)

    expect(result.failed).toBe(false)
  })

  it('always fails when failureRate is 1', async () => {
    const result = await applyLatency({ failureRate: 1 }, () => 0.5)

    expect(result.failed).toBe(true)
  })

  it('does not fail when the random draw exceeds failureRate', async () => {
    const result = await applyLatency({ failureRate: 0.3 }, () => 0.9)

    expect(result.failed).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `simulators.ts` does not exist yet.

- [ ] **Step 3: Implement `RateLimiter` and `applyLatency`**

`packages/core/src/simulators.ts`:
```ts
export interface RateLimitConfig {
  limit: number
  windowMs: number
}

export interface RateLimitStatus {
  limited: boolean
  retryAfterMs: number
}

export class RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number
  private windows = new Map<string, { count: number; windowStart: number }>()

  constructor(config: RateLimitConfig, now: () => number = () => Date.now()) {
    this.limit = config.limit
    this.windowMs = config.windowMs
    this.now = now
  }

  check(key = '__global__'): RateLimitStatus {
    const currentTime = this.now()
    let window = this.windows.get(key)

    if (window === undefined || currentTime - window.windowStart >= this.windowMs) {
      window = { count: 0, windowStart: currentTime }
      this.windows.set(key, window)
    }

    window.count += 1

    if (window.count > this.limit) {
      const retryAfterMs = this.windowMs - (currentTime - window.windowStart)
      return { limited: true, retryAfterMs }
    }

    return { limited: false, retryAfterMs: 0 }
  }

  reset(): void {
    this.windows.clear()
  }
}

export interface LatencyConfig {
  delayMs?: number
  failureRate?: number
}

export interface LatencyResult {
  failed: boolean
}

export async function applyLatency(
  config: LatencyConfig,
  random: () => number = Math.random,
): Promise<LatencyResult> {
  if (config.delayMs !== undefined && config.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, config.delayMs))
  }

  const failureRate = config.failureRate ?? 0
  const failed = failureRate > 0 && random() < failureRate

  return { failed }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 9 tests in `simulators.test.ts` passing.

- [ ] **Step 5: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/simulators.ts packages/core/src/simulators.test.ts
git commit -m "feat: add rate limit and latency simulators"
```

---

### Task 6: `pagination.ts` — pagination handler (DB-288)

**Files:**
- Create: `packages/core/src/pagination.ts`
- Create: `packages/core/src/pagination.test.ts`

**Interfaces:**
- Produces: `export interface PaginationRequest { query: Record<string, string> }`, `export interface PaginationResult { items: unknown[]; meta: Record<string, unknown> }`, `export function paginate(allItems: unknown[], request: PaginationRequest): PaginationResult`. Task 8 calls this on the full list from the state store before returning a LIST response, spreading `meta` alongside `data: items` in the response body.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/pagination.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `pagination.ts` does not exist yet.

- [ ] **Step 3: Implement `paginate`**

`packages/core/src/pagination.ts`:
```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 5 tests in `pagination.test.ts` passing.

- [ ] **Step 5: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/pagination.ts packages/core/src/pagination.test.ts
git commit -m "feat: add pagination handler"
```

---

### Task 7: `logger.ts` — request/response logging (DB-289)

**Files:**
- Create: `packages/core/src/logger.ts`
- Create: `packages/core/src/logger.test.ts`

**Interfaces:**
- Produces: `export type LogLevel = 'off' | 'basic' | 'verbose'`, `export interface LogEntry { method: string; path: string; status: number; query?: Record<string, string>; body?: unknown; responseBody?: unknown }`, `export interface Logger { log(entry: LogEntry): void }`, `export function createLogger(level?: LogLevel, sink?: (message: string) => void): Logger`. Task 8 creates one `Logger` per `Engine` (`options.logLevel ?? 'off'`) and calls `.log(...)` once per handled request, after the response is determined.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/logger.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createLogger } from './logger'

describe('createLogger', () => {
  it('never calls the sink when the level is off', () => {
    const sink = vi.fn()
    const logger = createLogger('off', sink)

    logger.log({ method: 'get', path: '/pets', status: 200 })

    expect(sink).not.toHaveBeenCalled()
  })

  it('logs a single summary line at basic level', () => {
    const sink = vi.fn()
    const logger = createLogger('basic', sink)

    logger.log({ method: 'get', path: '/pets', status: 200 })

    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenCalledWith('[onemock] GET /pets -> 200')
  })

  it('includes query, body, and response details at verbose level', () => {
    const sink = vi.fn()
    const logger = createLogger('verbose', sink)

    logger.log({
      method: 'post',
      path: '/pets',
      status: 201,
      query: { a: '1' },
      body: { name: 'Rex' },
      responseBody: { id: '1', name: 'Rex' },
    })

    const message = sink.mock.calls[0][0] as string
    expect(message).toContain('[onemock] POST /pets -> 201')
    expect(message).toContain('"a":"1"')
    expect(message).toContain('"name":"Rex"')
    expect(message).toContain('"id":"1"')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `logger.ts` does not exist yet.

- [ ] **Step 3: Implement `createLogger`**

`packages/core/src/logger.ts`:
```ts
export type LogLevel = 'off' | 'basic' | 'verbose'

export interface LogEntry {
  method: string
  path: string
  status: number
  query?: Record<string, string>
  body?: unknown
  responseBody?: unknown
}

export interface Logger {
  log(entry: LogEntry): void
}

export function createLogger(
  level: LogLevel = 'off',
  sink: (message: string) => void = console.log,
): Logger {
  return {
    log(entry: LogEntry) {
      if (level === 'off') return

      const line = `[onemock] ${entry.method.toUpperCase()} ${entry.path} -> ${entry.status}`
      if (level === 'basic') {
        sink(line)
        return
      }

      sink(
        `${line}\n  query: ${JSON.stringify(entry.query ?? {})}\n  body: ${JSON.stringify(entry.body)}\n  response: ${JSON.stringify(entry.responseBody)}`,
      )
    },
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 3 tests in `logger.test.ts` passing.

- [ ] **Step 5: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/logger.ts packages/core/src/logger.test.ts
git commit -m "feat: add request/response logger"
```

---

### Task 8: `engine.ts` — wire the resolution pipeline, update `createMock()` (DB-290)

**Files:**
- Create: `packages/core/src/engine.ts`
- Create: `packages/core/src/engine.test.ts`
- Create: `packages/core/src/__fixtures__/pet-store.json`
- Modify: `packages/core/src/index.ts` (replace the throwing stub with the real implementation)
- Modify: `packages/core/src/index.test.ts` (replace the stub tests with tests for the real `createMock`)

**Interfaces:**
- `engine.ts` produces: `export interface EngineRequest { method: string; path: string; query?: Record<string, string>; headers?: Record<string, string>; body?: unknown }`, `export interface EngineResponse { status: number; headers: Record<string, string>; body: unknown }`, `export interface EngineOptions { seed?: number; rateLimit?: RateLimitConfig; latency?: LatencyConfig; logLevel?: LogLevel }`, `export class Engine { readonly routeTable: RouteTableEntry[]; constructor(spec: LoadedSpec, options?: EngineOptions); seed(pathTemplate: string, data: Record<string, unknown> | Record<string, unknown>[]): void; override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, times?: number): void; reset(): void; handle(request: EngineRequest): Promise<EngineResponse> }`.
- `index.ts` produces: `export type CreateMockOptions = EngineOptions`, `export interface MockInstance { seed(...): void; override(...): void; reset(): void; handle(request: EngineRequest): Promise<EngineResponse> }`, `export async function createMock(spec: SpecInput, options?: CreateMockOptions): Promise<MockInstance>`. This is the last-mile public surface for this plan — DB-291 (server adapter) and DB-292 (interception adapter) will each add their own method (`listen`/`intercept`) to the object `createMock` returns, calling `.handle()` internally. Do not add those methods here.

- [ ] **Step 1: Create the integration fixture spec**

`packages/core/src/__fixtures__/pet-store.json`:
```json
{
  "openapi": "3.0.0",
  "info": { "title": "Pet Store", "version": "1.0.0" },
  "paths": {
    "/pets": {
      "get": {
        "operationId": "listPets",
        "parameters": [
          { "name": "limit", "in": "query", "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "A list of pets",
            "content": {
              "application/json": {
                "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Pet" } }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createPet",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/NewPet" }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Pet" } }
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
              "application/json": { "schema": { "$ref": "#/components/schemas/Pet" } }
            }
          }
        }
      },
      "put": {
        "operationId": "updatePet",
        "responses": {
          "200": {
            "description": "Updated",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Pet" } }
            }
          }
        }
      },
      "delete": {
        "operationId": "deletePet",
        "responses": {
          "204": { "description": "Deleted" }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "NewPet": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "name": { "type": "string" },
          "tag": { "type": "string" }
        }
      },
      "Pet": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "tag": { "type": "string" }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write the failing engine tests**

`packages/core/src/engine.test.ts`:
```ts
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Engine } from './engine'
import { loadSpec, type LoadedSpec } from './spec-loader'

const fixturesDir = fileURLToPath(new URL('./__fixtures__/', import.meta.url))

async function loadPetStore(): Promise<LoadedSpec> {
  return loadSpec(`${fixturesDir}pet-store.json`)
}

describe('Engine', () => {
  it('round-trips a created resource through GET', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const created = await engine.handle({
      method: 'post',
      path: '/pets',
      body: { name: 'Rex', tag: 'dog' },
    })
    expect(created.status).toBe(201)
    const petId = (created.body as { id: string }).id

    const fetched = await engine.handle({ method: 'get', path: `/pets/${petId}` })
    expect(fetched.status).toBe(200)
    expect(fetched.body).toEqual(created.body)
  })

  it('rejects a request body missing a required field with a 400', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const response = await engine.handle({
      method: 'post',
      path: '/pets',
      body: { tag: 'no-name' },
    })

    expect(response.status).toBe(400)
    expect((response.body as { error: string }).error).toBe('validation_failed')
  })

  it('generates a fresh fake resource for an unseeded GET by id', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const response = await engine.handle({ method: 'get', path: '/pets/unseen-id' })

    expect(response.status).toBe(200)
    const body = response.body as Record<string, unknown>
    expect(body.id).toBe('unseen-id')
    expect(typeof body.name).toBe('string')
  })

  it('updates a resource by merging fields', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({
      method: 'post',
      path: '/pets',
      body: { name: 'Rex', tag: 'dog' },
    })
    const petId = (created.body as { id: string }).id

    const updated = await engine.handle({
      method: 'put',
      path: `/pets/${petId}`,
      body: { name: 'Rex Updated' },
    })

    expect(updated.status).toBe(200)
    expect(updated.body).toEqual({ id: petId, name: 'Rex Updated', tag: 'dog' })
  })

  it('deletes a resource', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id

    const deleted = await engine.handle({ method: 'delete', path: `/pets/${petId}` })

    expect(deleted.status).toBe(204)
  })

  it('returns 404 for a route with no matching path', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    const response = await engine.handle({ method: 'get', path: '/nonexistent' })

    expect(response.status).toBe(404)
  })

  it('an override takes precedence over stored state', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id

    engine.override('get', '/pets/{petId}', {
      status: 200,
      body: { id: petId, name: 'Overridden' },
    })
    const response = await engine.handle({ method: 'get', path: `/pets/${petId}` })

    expect(response.body).toEqual({ id: petId, name: 'Overridden' })
  })

  it('reset() clears state and overrides', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    const created = await engine.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id
    engine.override('get', '/pets/{petId}', { status: 200, body: { forced: true } })

    engine.reset()
    const response = await engine.handle({ method: 'get', path: `/pets/${petId}` })

    expect(response.body).not.toEqual({ forced: true })
  })

  it('seed() pre-populates the store', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })

    engine.seed('/pets', { id: 'seeded-1', name: 'Seeded Pet' })
    const response = await engine.handle({ method: 'get', path: '/pets/seeded-1' })

    expect(response.body).toEqual({ id: 'seeded-1', name: 'Seeded Pet' })
  })

  it('paginates list results by offset and limit', async () => {
    const engine = new Engine(await loadPetStore(), { seed: 1 })
    for (let i = 0; i < 5; i++) {
      await engine.handle({ method: 'post', path: '/pets', body: { name: `Pet ${i}` } })
    }

    const response = await engine.handle({
      method: 'get',
      path: '/pets',
      query: { offset: '1', limit: '2' },
    })

    const body = response.body as { data: unknown[]; total: number }
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(5)
  })

  it('enforces a configured rate limit', async () => {
    const engine = new Engine(await loadPetStore(), { rateLimit: { limit: 2, windowMs: 60000 } })

    expect((await engine.handle({ method: 'get', path: '/pets' })).status).toBe(200)
    expect((await engine.handle({ method: 'get', path: '/pets' })).status).toBe(200)
    const limited = await engine.handle({ method: 'get', path: '/pets' })

    expect(limited.status).toBe(429)
    expect(limited.headers['Retry-After']).toBeDefined()
  })

  it('applies configured latency and can simulate a forced failure', async () => {
    const engine = new Engine(await loadPetStore(), { latency: { delayMs: 5, failureRate: 1 } })

    const start = Date.now()
    const response = await engine.handle({ method: 'get', path: '/pets' })

    expect(Date.now() - start).toBeGreaterThanOrEqual(5)
    expect(response.status).toBe(503)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter onemock test`
Expected: FAIL — `engine.ts` does not exist yet.

- [ ] **Step 4: Implement `Engine`**

`packages/core/src/engine.ts`:
```ts
import type { LoadedSpec } from './spec-loader'
import { buildRouteTable, matchPath, type RouteTableEntry, type HttpMethod } from './route-table'
import { SchemaGenerator } from './generator'
import { StateStore } from './state-store'
import { OverrideRegistry, type OverrideHandler } from './overrides'
import { validateRequest } from './validator'
import { RateLimiter, applyLatency, type RateLimitConfig, type LatencyConfig } from './simulators'
import { paginate } from './pagination'
import { createLogger, type LogLevel } from './logger'

export interface EngineRequest {
  method: string
  path: string
  query?: Record<string, string>
  headers?: Record<string, string>
  body?: unknown
}

export interface EngineResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

export interface EngineOptions {
  seed?: number
  rateLimit?: RateLimitConfig
  latency?: LatencyConfig
  logLevel?: LogLevel
}

export class Engine {
  readonly routeTable: RouteTableEntry[]
  private readonly overrides = new OverrideRegistry()
  private readonly store: StateStore
  private readonly generator: SchemaGenerator
  private readonly rateLimiter?: RateLimiter
  private readonly latencyConfig?: LatencyConfig
  private readonly logger: ReturnType<typeof createLogger>

  constructor(spec: LoadedSpec, options: EngineOptions = {}) {
    this.routeTable = buildRouteTable(spec.document)
    this.store = new StateStore()
    this.generator = new SchemaGenerator({ seed: options.seed })
    this.rateLimiter = options.rateLimit ? new RateLimiter(options.rateLimit) : undefined
    this.latencyConfig = options.latency
    this.logger = createLogger(options.logLevel ?? 'off')
  }

  seed(pathTemplate: string, data: Record<string, unknown> | Record<string, unknown>[]): void {
    const collection = collectionKeyFor(pathTemplate)
    const items = Array.isArray(data) ? data : [data]
    for (const item of items) {
      const id = String(item.id ?? this.store.list(collection).length + 1)
      this.store.create(collection, item, id)
    }
  }

  override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, times?: number): void {
    this.overrides.override(method, pathTemplate, handler, { times })
  }

  reset(): void {
    this.store.reset()
    this.overrides.reset()
    this.rateLimiter?.reset()
  }

  async handle(request: EngineRequest): Promise<EngineResponse> {
    const method = request.method.toLowerCase() as HttpMethod
    const query = request.query ?? {}
    const headers = request.headers ?? {}

    const matched = this.matchRoute(method, request.path)
    if (matched === undefined) {
      return this.finish(method, request, this.notFound(request.path))
    }
    const { route, params } = matched

    const overrideResponse = this.overrides.resolve(method, request.path, {
      query,
      headers,
      body: request.body,
    })
    if (overrideResponse !== undefined) {
      return this.finish(method, request, {
        status: overrideResponse.status,
        headers: overrideResponse.headers ?? {},
        body: overrideResponse.body,
      })
    }

    if (this.rateLimiter !== undefined) {
      const status = this.rateLimiter.check()
      if (status.limited) {
        return this.finish(method, request, {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(status.retryAfterMs / 1000)) },
          body: { error: 'rate_limited', message: 'Too many requests' },
        })
      }
    }

    if (this.latencyConfig !== undefined) {
      const latencyResult = await applyLatency(this.latencyConfig)
      if (latencyResult.failed) {
        return this.finish(method, request, {
          status: 503,
          headers: {},
          body: { error: 'simulated_network_failure', message: 'Simulated network failure' },
        })
      }
    }

    const validation = validateRequest(route.operation, { params, query, body: request.body })
    if (!validation.valid) {
      return this.finish(method, request, {
        status: 400,
        headers: {},
        body: { error: 'validation_failed', issues: validation.issues },
      })
    }

    const response = this.resolveFromStore(method, route, params, query, request.body)
    return this.finish(method, request, response)
  }

  private finish(
    method: HttpMethod,
    request: EngineRequest,
    response: EngineResponse,
  ): EngineResponse {
    this.logger.log({
      method,
      path: request.path,
      status: response.status,
      query: request.query,
      body: request.body,
      responseBody: response.body,
    })
    return response
  }

  private matchRoute(
    method: HttpMethod,
    path: string,
  ): { route: RouteTableEntry; params: Record<string, string> } | undefined {
    for (const route of this.routeTable) {
      if (route.method !== method) continue
      const params = matchPath(route.path, path)
      if (params !== null) return { route, params }
    }
    return undefined
  }

  private notFound(path: string): EngineResponse {
    return {
      status: 404,
      headers: {},
      body: { error: 'not_found', message: `onemock: no route matches ${path}` },
    }
  }

  private resolveFromStore(
    method: HttpMethod,
    route: RouteTableEntry,
    params: Record<string, string>,
    query: Record<string, string>,
    body: unknown,
  ): EngineResponse {
    const collection = collectionKeyFor(route.path)
    const idParamName = lastParamName(route.path)
    const id = idParamName !== undefined ? params[idParamName] : undefined

    if (method === 'post') {
      const created = this.store.create(collection, (body as Record<string, unknown>) ?? {})
      return { status: 201, headers: {}, body: created }
    }

    if (method === 'put' || method === 'patch') {
      if (id === undefined) return this.notFound(route.path)
      const updated = this.store.update(collection, id, (body as Record<string, unknown>) ?? {})
      if (updated === undefined) return this.notFound(route.path)
      return { status: 200, headers: {}, body: updated }
    }

    if (method === 'delete') {
      if (id === undefined) return this.notFound(route.path)
      const deleted = this.store.delete(collection, id)
      return deleted
        ? { status: 204, headers: {}, body: undefined }
        : this.notFound(route.path)
    }

    if (id !== undefined) {
      let resource = this.store.get(collection, id)
      if (resource === undefined) {
        const schema = responseSchemaFor(route.operation)
        const generated = this.generator.generate(schema) as Record<string, unknown> | undefined
        resource = this.store.create(collection, { ...(generated ?? {}), id }, id)
      }
      return { status: 200, headers: {}, body: resource }
    }

    let items = this.store.list(collection)
    if (items.length === 0) {
      const schema = responseSchemaFor(route.operation)
      const itemSchema = (
        schema?.type === 'array' ? (schema.items as Record<string, unknown> | undefined) : schema
      ) as Record<string, unknown> | undefined
      const generated = this.generator.generate(itemSchema) as Record<string, unknown> | undefined
      if (generated !== undefined) {
        this.store.create(collection, generated)
        items = this.store.list(collection)
      }
    }

    const { items: pageItems, meta } = paginate(items, { query })
    return { status: 200, headers: {}, body: { data: pageItems, ...meta } }
  }
}

function collectionKeyFor(pathTemplate: string): string {
  return pathTemplate
    .split('/')
    .filter((segment) => segment.length > 0 && !segment.startsWith('{'))
    .join('/')
}

function lastParamName(pathTemplate: string): string | undefined {
  const segments = pathTemplate.split('/').filter((segment) => segment.length > 0)
  const last = segments[segments.length - 1]
  if (last !== undefined && last.startsWith('{') && last.endsWith('}')) {
    return last.slice(1, -1)
  }
  return undefined
}

function responseSchemaFor(operation: Record<string, unknown>): Record<string, unknown> | undefined {
  const responses = operation.responses as
    | Record<string, { content?: Record<string, { schema?: Record<string, unknown> }> }>
    | undefined
  if (responses === undefined) return undefined

  const successKey = Object.keys(responses).find((key) => key.startsWith('2'))
  if (successKey === undefined) return undefined

  return responses[successKey]?.content?.['application/json']?.schema
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter onemock test`
Expected: PASS — all 12 tests in `engine.test.ts` passing.

- [ ] **Step 6: Replace the `createMock` stub with the real implementation**

Replace the entire content of `packages/core/src/index.ts`:
```ts
import { loadSpec, type SpecInput } from './spec-loader'
import { Engine, type EngineOptions, type EngineRequest, type EngineResponse } from './engine'
import type { OverrideHandler } from './overrides'
import type { HttpMethod } from './route-table'

export type CreateMockOptions = EngineOptions

export interface MockInstance {
  seed(pathTemplate: string, data: Record<string, unknown> | Record<string, unknown>[]): void
  override(method: HttpMethod, pathTemplate: string, handler: OverrideHandler, times?: number): void
  reset(): void
  handle(request: EngineRequest): Promise<EngineResponse>
}

export async function createMock(
  spec: SpecInput,
  options: CreateMockOptions = {},
): Promise<MockInstance> {
  const loaded = await loadSpec(spec)
  const engine = new Engine(loaded, options)

  return {
    seed: (pathTemplate, data) => engine.seed(pathTemplate, data),
    override: (method, pathTemplate, handler, times) =>
      engine.override(method, pathTemplate, handler, times),
    reset: () => engine.reset(),
    handle: (request) => engine.handle(request),
  }
}
```

- [ ] **Step 7: Replace the stub tests with real `createMock` tests**

Replace the entire content of `packages/core/src/index.test.ts` (this removes the old "throws not implemented" tests, which are no longer true — `createMock` now works):
```ts
import { describe, expect, it } from 'vitest'
import { createMock } from './index'

const petStoreSpec = {
  openapi: '3.0.0',
  info: { title: 'Pet Store', version: '1.0.0' },
  paths: {
    '/pets': {
      get: { responses: { '200': { description: 'ok' } } },
      post: { responses: { '201': { description: 'created' } } },
    },
    '/pets/{petId}': {
      parameters: [
        { name: 'petId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      get: { responses: { '200': { description: 'ok' } } },
    },
  },
}

describe('createMock', () => {
  it('loads a spec and returns a mock instance with seed/override/reset/handle', async () => {
    const mock = await createMock(petStoreSpec)

    expect(typeof mock.seed).toBe('function')
    expect(typeof mock.override).toBe('function')
    expect(typeof mock.reset).toBe('function')
    expect(typeof mock.handle).toBe('function')
  })

  it('round-trips a created resource end to end through createMock', async () => {
    const mock = await createMock(petStoreSpec)

    const created = await mock.handle({ method: 'post', path: '/pets', body: { name: 'Rex' } })
    const petId = (created.body as { id: string }).id

    const fetched = await mock.handle({ method: 'get', path: `/pets/${petId}` })

    expect(fetched.body).toEqual(created.body)
  })

  it('rejects an invalid spec', async () => {
    await expect(
      createMock({ openapi: '3.0.0', info: { title: 'x' }, paths: {} }),
    ).rejects.toThrow(/^onemock: invalid spec:/)
  })
})
```

- [ ] **Step 8: Run the full test suite**

Run: `pnpm --filter onemock test`
Expected: PASS — every test file green, including the new `index.test.ts`.

- [ ] **Step 9: Build, typecheck, lint**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck && pnpm lint`
Expected: all exit 0.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/engine.ts packages/core/src/engine.test.ts packages/core/src/__fixtures__/pet-store.json packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat: wire engine resolution pipeline into createMock"
```
