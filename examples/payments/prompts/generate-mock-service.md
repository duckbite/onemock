# Generate an onemock mock service

Use this prompt once, before writing tests, to turn an OpenAPI spec into a
small stateful mock service. The generated file is ordinary TypeScript you
own and can edit. Tests stay deterministic: no LLM runs at test time.

Copy everything below the line into an agent chat, and paste the OpenAPI
spec into the placeholder.

---

You are generating a **full onemock mock service** from an OpenAPI spec.

## Goal

Create a TypeScript module that implements one handler per OpenAPI
`operationId`, including CRUD. The handlers are the fake backend: they
decide status codes, persist resources, and encode how the real API
normally behaves (derived totals, 404s, default fields, state machines).

Do **not** generate an HTTP client. Application code keeps calling `fetch`
(or its SDK). Tests pass the generated object into `createMock(spec, {
handlers })` and call `.intercept()` / `.listen()`.

## Output

Write a single file:

- Path: `<tests-or-src>/mocks/<service-name>.ts`
- Export: `export const <serviceName>Mock: MockService = { ... }`
- Import: `import type { MockService } from 'onemock'`

For this example repo the file is `examples/payments/src/mocks/payments.ts` and the
export is `paymentsMock`.

## Spec to implement

<ATTACH OR PASTE THE OPENAPI SPEC HERE>

## onemock handler contract

```ts
import type { MockService } from 'onemock'

export const serviceMock: MockService = {
  operationId(ctx) {
    return { status: 200, body: {/* response */} }
  },
}
```

Each handler receives:

```ts
{
  params: Record<string, string> // path params, e.g. { paymentId: "1" }
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown // parsed JSON body, if any
  collection: string // path without `{param}` segments
  //   /payments            → "payments"
  //   /payments/{paymentId} → "payments"
  //   /account             → "account"
  store: MockStore
}
```

`store` is onemock's in-memory DB, shared across all handlers on this mock
instance, and cleared by `mock.reset()` / a new `createMock()`:

```ts
store.list(collection)                          // all items
store.get(collection, id)                       // item or undefined
store.create(collection, data, id?)             // persists; assigns id if omitted
store.update(collection, id, data)              // merge, or undefined if missing
store.delete(collection, id)                    // true if it existed
```

Return `{ status, headers?, body? }`. You may return a Promise of that shape.

Request validation against the spec runs **before** your handler. Do not
re-implement required-field checks; invalid requests never reach you.

Overrides registered with `mock.override()` still win over handlers.

If an `operationId` has no handler, onemock falls back to generic CRUD.
Still generate a handler for every operation so the file is the full
service.

## Behavior rules

1. **Round-trip CRUD.** `POST` persists the request body (plus `id` and
   any spec fields the API would add, e.g. `createdAt`). `GET` by id
   returns that same object. `GET` collection returns stored items, not
   random fixtures. `PUT`/`PATCH` merge. `DELETE` removes the item.
2. **Missing resources return spec-shaped 404s**, not generated fakes.
3. **List envelopes match the real API / client.** If the client reads
   `response.json().data`, return `{ data: items }`. If the spec is a
   bare array and the client expects an array, return the array.
4. **Derived / singleton endpoints compute from other collections.**
   Example: `GET /account` is not its own stored resource; it is
   `sum(payments.amount)` and `count(payments)`. Re-read the store on
   every call so creates and deletes stay in sync automatically.
5. **Cross-resource side effects** belong in the handler that causes
   them (or in the derived read). Do not ask tests to call
   `mock.override()` to keep related endpoints consistent.
6. **Use `ctx.collection` for the current route's resources.** When a
   handler must read a _different_ collection (account reading payments),
   use that collection's key (the path without params).
7. **Deterministic.** No `Math.random()`, no network, no clocks that
   affect assertions unless the spec field is a timestamp you persist
   on create. Tests may compare create-then-get equality, so don't
   regenerate fields on read.
8. **No test helpers.** Tests will call the real application client
   (`createPayment`, etc.). The mock service is the only extra file.

## Style

- One function per `operationId`, named exactly as in the spec.
- Small local helpers are fine (`asRecord`, `sumAmounts`).
- Do not wrap handlers in classes.
- File-level comment: spec path + that this was generated from this prompt.

## How tests will use it

```ts
import { createMock } from 'onemock'
import spec from '../payments-api.json'
import { paymentsMock } from './mocks/payments'

const mock = await createMock(spec, { handlers: paymentsMock })
await mock.intercept()
```

After generating the file, do not also generate test wrappers that
recompute derived state. If a test still needs `syncAccount()`-style
bookkeeping, the mock service is incomplete — fix the handlers.
