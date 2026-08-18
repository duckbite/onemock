# onemock example: Payments API

A small, made-up "Payments API" mocked with [onemock](../README.md), demonstrating:

- `src/payments.ts` — actual application code: a typed client with `createPayment`,
  `getPayment`, `listPayments`, `deletePayment`, and `getAccountBalance`, each calling
  `fetch()` against the third-party Payments API's base URL, the way a real app would.
- `src/payments.test.ts` — tests only, importing those functions and exercising them
  against a mock. No raw `fetch()` calls to the mock itself live in the test.
- `.intercept()`: since `payments.ts` calls a real-looking base URL
  (`https://api.payments-provider.test`, declared in `payments-api.json`'s `servers[]`),
  onemock transparently intercepts those calls — no server, no port, no code in
  `payments.ts` aware it's being tested.
- A derived value (`GET /account` → running `totalAmount`/`paymentCount`) kept in sync
  by calling `mock.override()` after every create/delete — the override API is the
  right tool here because onemock's engine has no built-in concept of a value computed
  from another resource's state.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter onemock-example-payments test
```

## How it works

`payments.test.ts` loads `payments-api.json` (a small OpenAPI spec) into `createMock()`
and calls `.intercept()`, then imports and calls the real functions from `payments.ts`.
Every test starts from a fresh mock (`beforeEach`), so state never leaks between tests.

Test-local helpers (`recordPayment`, `removePayment`, `syncAccount`) wrap the real
`createPayment`/`deletePayment` calls to track the expected running total and keep
`/account` in sync via `mock.override('get', '/account', { status: 200, body: {...} })`
before the account is ever read. This is a general pattern for mocking any endpoint
whose value depends on state elsewhere in a real API.
