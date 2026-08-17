# Payments Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/example` project from Linear DB-295: a small, made-up "Payments API" mocked with `onemock`, demonstrating full CRUD (`POST`/`GET`/`DELETE` on `/payments`) and a derived running total (`GET /account`) kept in sync via the override API.

**Architecture:** A new pnpm workspace member at `example/` that depends on `onemock` via `workspace:*` (linked locally, no publish needed — verified: pnpm symlinks the package directory and Node resolves through it to the built `dist/` output). One OpenAPI spec (`example/payments-api.json`) describes three resources — `/payments` (list+create), `/payments/{paymentId}` (get+delete), `/account` (a derived singleton). One Vitest file drives the whole flow through a real `.listen()` server with plain `fetch`. Every line of spec and test code in this plan has already been run successfully against the real, already-merged `packages/core` engine in a scratch check — including a real bug this exercise found: a GET route with no `{param}` segment (like `/account`) is indistinguishable from a list endpoint to the current engine, so `/account` must be driven entirely through `.override()`, never `.seed()` (seed adds to the list rather than replacing it, and the wrapped `{data, total}` shape doesn't match a singleton resource anyway).

**Tech Stack:** onemock (workspace-linked), TypeScript, Vitest.

**Spec:** Linear issue DB-295 (created during brainstorming — see its description for the full design rationale, including the confirmed engine limitation).

## Global Constraints

- No publish to the npm registry is needed or in scope — `example/` consumes `onemock` via `"onemock": "workspace:*"`, which pnpm resolves to a symlink into `packages/core`, using its built `dist/` output (the same artifact a real npm consumer would get).
- `/account` must be handled purely through `.override()`, called before the very first read reaches it (i.e. in `beforeEach`, before any test body runs). Do not use `.seed()` for `/account` — verified to produce the wrong response shape (see Architecture above).
- Use `.listen()` (real HTTP server + `fetch`), not `.intercept()` — simplest mode to read without explaining request interception.
- `example/` must not break root `pnpm install && pnpm build && pnpm lint && pnpm typecheck` (per DB-295's acceptance criteria). `pnpm -r <script>` silently skips a workspace package that doesn't define that script (verified) — so `example/package.json` only needs the scripts it actually uses (`test`, `typecheck`); it needs no `build` script.
- Follow existing repo conventions: TypeScript strict mode, ESM, Vitest.

---

### Task 1: Workspace scaffolding + OpenAPI spec

**Files:**
- Modify: `pnpm-workspace.yaml` (add `example` to package globs)
- Create: `example/package.json`
- Create: `example/tsconfig.json`
- Create: `example/vitest.config.ts`
- Create: `example/payments-api.json`
- Modify: `README.md` (fix now-stale "not yet implemented" claims; add `example/` to repository layout)

**Interfaces:**
- Produces: a working pnpm workspace member `onemock-example-payments` at `example/`, with `onemock` resolvable via workspace linking, and the Payments API spec file Task 2's test will load. No code interfaces (this task is pure scaffolding/config + a data file).

- [ ] **Step 1: Add `example` to the pnpm workspace**

Edit `pnpm-workspace.yaml` so it reads:
```yaml
packages:
  - 'packages/*'
  - 'example'
```

- [ ] **Step 2: Create the example package.json**

`example/package.json`:
```json
{
  "name": "onemock-example-payments",
  "private": true,
  "type": "module",
  "scripts": {
    "pretest": "pnpm --filter onemock build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "onemock": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "typescript": "^5.7.2",
    "vitest": "^2.1.5"
  }
}
```

The `pretest` script means `pnpm --filter onemock-example-payments test` (and root `pnpm test`, since pnpm runs `pretest` hooks even under `pnpm -r` — verified) always builds `packages/core` first, so `example/`'s tests never run against a stale or missing `dist/`.

- [ ] **Step 3: Create the example tsconfig**

`example/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create the Vitest config**

`example/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Create the Payments API spec**

`example/payments-api.json`:
```json
{
  "openapi": "3.0.0",
  "info": { "title": "Payments API", "version": "1.0.0" },
  "paths": {
    "/payments": {
      "get": {
        "operationId": "listPayments",
        "parameters": [
          { "name": "limit", "in": "query", "schema": { "type": "integer" } },
          { "name": "offset", "in": "query", "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": {
            "description": "A list of payments",
            "content": {
              "application/json": {
                "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Payment" } }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createPayment",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": { "schema": { "$ref": "#/components/schemas/NewPayment" } }
          }
        },
        "responses": {
          "201": {
            "description": "Created",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Payment" } }
            }
          }
        }
      }
    },
    "/payments/{paymentId}": {
      "parameters": [
        { "name": "paymentId", "in": "path", "required": true, "schema": { "type": "string" } }
      ],
      "get": {
        "operationId": "getPayment",
        "responses": {
          "200": {
            "description": "A payment",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Payment" } }
            }
          }
        }
      },
      "delete": {
        "operationId": "deletePayment",
        "responses": {
          "204": { "description": "Deleted" }
        }
      }
    },
    "/account": {
      "get": {
        "operationId": "getAccount",
        "responses": {
          "200": {
            "description": "Account summary",
            "content": {
              "application/json": { "schema": { "$ref": "#/components/schemas/Account" } }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "NewPayment": {
        "type": "object",
        "required": ["amount"],
        "properties": {
          "amount": { "type": "number" },
          "currency": { "type": "string" },
          "description": { "type": "string" }
        }
      },
      "Payment": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "amount": { "type": "number" },
          "currency": { "type": "string" },
          "description": { "type": "string" },
          "createdAt": { "type": "string", "format": "date-time" }
        }
      },
      "Account": {
        "type": "object",
        "properties": {
          "totalAmount": { "type": "number" },
          "currency": { "type": "string" },
          "paymentCount": { "type": "integer" }
        }
      }
    }
  }
}
```

- [ ] **Step 6: Install and verify the workspace member resolves**

Run: `pnpm install`
Expected: completes successfully; `example/node_modules/onemock` exists as a symlink to `../../packages/core`.

Run: `ls -la example/node_modules/onemock`
Expected: shows a symlink (`->`) pointing at `../../packages/core`.

- [ ] **Step 7: Fix the now-stale claims in the root README**

`README.md` currently says (lines 5-10) the core is a stub that "throws `not implemented yet`" and (line 37) that usage is "not yet implemented." Both are false now that DB-283 through DB-292 have landed — only the CLI and preset packages are still unbuilt. Fix both spots.

Replace the status banner block:
```markdown
> **🚧 Status: early development.** This repo is being rebuilt from scratch as a
> lightweight npm library. The core package currently exports a `createMock()`
> stub that throws `not implemented yet` — none of the usage below is
> functional yet. It documents the approved target design so contributors and
> early adopters know where this is headed. Follow progress in the design spec
> and the [Linear project](https://linear.app/duckbite/project/onemock-cf0ed953ffa0).
```
with:
```markdown
> **🚧 Status: early development.** The core engine and both adapters
> (`.listen()` for a local server, `.intercept()` for network interception)
> are implemented and tested — `createMock()` works end to end. The CLI
> (`onemock serve`) and the `@onemock/<service>` preset packages are not
> built yet, and this package is not published to npm. See
> [`example/`](example/) for a working demo, the design spec, and the
> [Linear project](https://linear.app/duckbite/project/onemock-cf0ed953ffa0)
> for progress.
```

Replace the `## Target usage (not yet implemented)` section heading and its content:
```markdown
## Target usage (not yet implemented)

```ts
import { createMock } from 'onemock'
import stripeSpec from '@onemock/stripe'

const stripe = createMock(stripeSpec)

beforeAll(() => stripe.listen(4010))
afterEach(() => stripe.reset())
afterAll(() => stripe.close())
```

Or run a standalone mock server for e2e tests via the CLI:

```bash
onemock serve stripe --port 4010
```

See the design spec's "Data Flow", "CLI", and "Preset Package Shape" sections
for the full target API.
```
with:
```markdown
## Usage

```ts
import { createMock } from 'onemock'
import stripeSpec from '@onemock/stripe'

const stripe = createMock(stripeSpec)

beforeAll(() => stripe.listen(4010))
afterEach(() => stripe.reset())
afterAll(() => stripe.close())
```

This works today, except `@onemock/stripe` and the other preset packages
don't exist yet — bring your own spec in the meantime. See
[`example/`](example/) for a full working demo (a mocked Payments API with
CRUD, `.listen()`, and the override API).

A CLI (`onemock serve <spec> --port 4010`) for running a standalone mock
server is planned but not implemented yet.
```

Update the repository layout section:
```markdown
## Repository layout

pnpm workspace:

```
packages/
  core/       → published as `onemock` — engine, adapters, CLI
  presets/    → thin @onemock/<service> spec packages (not started yet)
example/      → a working demo: a mocked Payments API using onemock
```
```

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml example/package.json example/tsconfig.json example/vitest.config.ts example/payments-api.json README.md pnpm-lock.yaml
git commit -m "chore: scaffold example/ workspace member and Payments API spec"
```

---

### Task 2: Demo test — CRUD + override-synced account

**Files:**
- Create: `example/src/payments.test.ts`
- Create: `example/README.md`

**Interfaces:**
- Consumes: `createMock` and `MockInstance` from `onemock` (the package built in Task 1's prerequisite `packages/core`); `example/payments-api.json` from Task 1.
- Produces: nothing consumed by other tasks — this is the plan's final deliverable.

- [ ] **Step 1: Write the demo test file**

`example/src/payments.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMock, type MockInstance } from 'onemock'
import paymentsApiSpec from '../payments-api.json'

interface Payment {
  id: string
  amount: number
  currency?: string
  description?: string
}

let mock: MockInstance
let port: number
let totalAmount: number
let paymentCount: number
let paymentAmounts: Map<string, number>

function syncAccount(): void {
  mock.override('get', '/account', {
    status: 200,
    body: { totalAmount, currency: 'USD', paymentCount },
  })
}

async function createPayment(amount: number): Promise<Payment> {
  const res = await fetch(`http://localhost:${port}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'USD' }),
  })
  const payment = (await res.json()) as Payment
  paymentAmounts.set(payment.id, amount)
  totalAmount += amount
  paymentCount += 1
  syncAccount()
  return payment
}

async function deletePayment(id: string): Promise<void> {
  await fetch(`http://localhost:${port}/payments/${id}`, { method: 'DELETE' })
  totalAmount -= paymentAmounts.get(id) ?? 0
  paymentCount -= 1
  paymentAmounts.delete(id)
  syncAccount()
}

beforeEach(async () => {
  mock = await createMock(paymentsApiSpec)
  const listen = await mock.listen(0)
  port = listen.port
  totalAmount = 0
  paymentCount = 0
  paymentAmounts = new Map()
  syncAccount()
})

afterEach(async () => {
  await mock.close()
})

describe('Payments API mock', () => {
  it('starts with a zeroed account before any payment exists', async () => {
    const response = await fetch(`http://localhost:${port}/account`)
    const account = await response.json()

    expect(account).toEqual({ totalAmount: 0, currency: 'USD', paymentCount: 0 })
  })

  it('increases totalAmount when a payment is created', async () => {
    await createPayment(100)

    const account = await (await fetch(`http://localhost:${port}/account`)).json()

    expect(account).toEqual({ totalAmount: 100, currency: 'USD', paymentCount: 1 })
  })

  it('accumulates totalAmount across multiple payments', async () => {
    await createPayment(100)
    await createPayment(50)

    const account = await (await fetch(`http://localhost:${port}/account`)).json()

    expect(account).toEqual({ totalAmount: 150, currency: 'USD', paymentCount: 2 })
  })

  it('decreases totalAmount when a payment is deleted', async () => {
    const payment = await createPayment(100)

    await deletePayment(payment.id)

    const account = await (await fetch(`http://localhost:${port}/account`)).json()
    expect(account).toEqual({ totalAmount: 0, currency: 'USD', paymentCount: 0 })
  })

  it('lists all payments', async () => {
    await createPayment(100)
    await createPayment(50)

    const response = await fetch(`http://localhost:${port}/payments`)
    const body = (await response.json()) as { data: Payment[]; total: number }

    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
  })

  it('gets a single payment by id', async () => {
    const created = await createPayment(42)

    const response = await fetch(`http://localhost:${port}/payments/${created.id}`)
    const fetched = await response.json()

    expect(fetched).toEqual(created)
  })

  it('returns 204 with no body when deleting a payment', async () => {
    const created = await createPayment(42)

    const response = await fetch(`http://localhost:${port}/payments/${created.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  it('rejects creating a payment with no amount', async () => {
    const response = await fetch(`http://localhost:${port}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'USD' }),
    })

    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter onemock-example-payments test`
Expected: PASS — all 8 tests in `payments.test.ts` passing. (The `pretest` script builds `packages/core` first automatically.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter onemock-example-payments typecheck`
Expected: exit 0.

- [ ] **Step 4: Write the example README**

`example/README.md`:
```markdown
# onemock example: Payments API

A small, made-up "Payments API" mocked with [onemock](../README.md), demonstrating:

- Full CRUD: `POST /payments`, `GET /payments`, `GET /payments/{paymentId}`, `DELETE /payments/{paymentId}`
- A derived value (`GET /account` → running `totalAmount`/`paymentCount`) kept in sync
  by calling `mock.override()` after every create/delete — the override API is the
  right tool here because onemock's engine has no built-in concept of a value computed
  from another resource's state.
- `.listen()`: a real local HTTP server, hit with plain `fetch()`.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter onemock-example-payments test
```

## How it works

`src/payments.test.ts` loads `payments-api.json` (a small OpenAPI spec) into
`createMock()`, starts a real server with `.listen(0)`, and drives it with `fetch()`.
Every test starts from a fresh mock (`beforeEach`), so state never leaks between tests.

A helper (`syncAccount`) tracks the running total in the test itself and calls
`mock.override('get', '/account', { status: 200, body: {...} })` any time a payment
is created or deleted, before the account is ever read. This is a general pattern for
mocking any endpoint whose value depends on state elsewhere in a real API.
```

- [ ] **Step 5: Run the full test suite from the root to confirm nothing broke**

Run: `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck`
Expected: all succeed — `packages/core`'s existing tests still pass, `example`'s new tests pass, lint and typecheck are clean across the whole repo.

- [ ] **Step 6: Commit**

```bash
git add example/src/payments.test.ts example/README.md
git commit -m "feat: add Payments API example demonstrating CRUD and override-synced account"
```
