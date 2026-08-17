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
