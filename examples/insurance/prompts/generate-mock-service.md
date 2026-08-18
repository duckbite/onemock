# Generate onemock mock services (multi-spec)

Use this prompt once per OpenAPI spec, before writing tests. This example
has two specs, so you run it twice and get two files. Tests stay
deterministic: no LLM runs at test time.

Copy everything below the line into an agent chat. Paste **one** spec per
run, and set the output path/export to match that spec.

---

You are generating a **full onemock mock service** from an OpenAPI spec.

## Goal

Create a TypeScript module that implements one handler per OpenAPI
`operationId`, including CRUD. The handlers are the fake backend: they
decide status codes, persist resources, and encode how the real API
normally behaves (lookup-by-key, 404s, response envelopes).

Do **not** generate an HTTP client. Application code keeps calling `fetch`.
Do **not** merge two specs into one mock. Each spec is its own
`createMock()` instance with its own store.

## Output for this example

Run once per spec:

| Spec | File | Export |
|---|---|---|
| `consumer-contracts-api.json` | `examples/insurance/src/mocks/consumer.ts` | `consumerContractsMock` |
| `corporate-contracts-api.json` | `examples/insurance/src/mocks/corporate.ts` | `corporateContractsMock` |

Import: `import type { MockService } from 'onemock'`

## Spec to implement

<ATTACH OR PASTE ONE OPENAPI SPEC HERE>

## onemock handler contract

```ts
import type { MockService } from 'onemock'

export const serviceMock: MockService = {
  operationId(ctx) {
    return { status: 200, body: { /* response */ } }
  },
}
```

Each handler receives:

```ts
{
  params: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
  collection: string  // path without `{param}` segments
                      //   /personal-policies            → "personal-policies"
                      //   /v2/contracts/{contractRef}   → "v2/contracts"
  store: MockStore
}
```

`store` is onemock's in-memory DB, shared across handlers **on this mock
instance only**, and cleared by `mock.reset()` / a new `createMock()`:

```ts
store.list(collection)
store.get(collection, id)
store.create(collection, data, id?)
store.update(collection, id, data)
store.delete(collection, id)
```

Return `{ status, headers?, body? }`. You may return a Promise of that shape.

Request validation against the spec runs **before** your handler.

Overrides registered with `mock.override()` still win over handlers.

Generate a handler for every `operationId`.

## Behavior rules

1. **Round-trip CRUD.** `POST` persists the request body plus API-assigned
   ids (`policyId`, `contractRef`, …). `GET` by id returns that object or
   a spec-shaped 404. Do not invent faker records for unknown ids.
2. **Lookup/search filters the store.** If the operation takes
   `licensePlate` or `registrationNumber` (query or path), return only
   matching records. Never return the whole collection. A plate with no
   matches is an empty list, not a 404.
3. **List envelopes match the spec / client.** Consumer list is
   `{ policies: [...] }`. Corporate search is `{ results: [...] }`. Do
   not wrap either in onemock's default `{ data, total }` envelope.
4. **Id fields match the spec.** Consumer records use `policyId`;
   corporate records use `contractRef`. `store.create` also sets `id` —
   keep the spec's id field in the JSON body.
5. **Deterministic.** No `Math.random()`, no network.
6. **No test helpers** that re-query or merge the two APIs. Composition
   belongs in application code.

## Style

- One function per `operationId`, named exactly as in the spec.
- Small local helpers are fine (`asRecord`, `matchesPlate`).
- File-level comment: spec path + that this was generated from this prompt.

## How tests will use both mocks

```ts
const consumer = await createMock(consumerSpec, { handlers: consumerContractsMock })
const corporate = await createMock(corporateSpec, { handlers: corporateContractsMock })
await consumer.intercept()
await corporate.intercept()
```

Two interceptors on different `servers[]` hosts must work at the same
time. Do not combine the APIs into one spec or one handler map.
