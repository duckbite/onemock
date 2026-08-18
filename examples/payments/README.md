# onemock example: Payments API

A small, made-up "Payments API" mocked with [onemock](../../README.md), demonstrating:

- `src/payments.ts` — actual application code: a typed client with `createPayment`,
  `getPayment`, `listPayments`, `deletePayment`, and `getAccountBalance`, each calling
  `fetch()` against the third-party Payments API's base URL, the way a real app would.
- `src/mocks/payments.ts` — a generated mock _service_: one handler per OpenAPI
  `operationId`, including CRUD and the derived `GET /account` total. Tests do not
  keep a running balance or call `mock.override()`.
- `src/payments.test.ts` — tests only, importing the real client functions and
  exercising them against the mock. No raw `fetch()` calls live in the test.
- `prompts/generate-mock-service.md` — the prompt used (and reusable) to generate
  `src/mocks/payments.ts` from `payments-api.json`.
- `.intercept()`: since `payments.ts` calls a real-looking base URL
  (`https://api.payments-provider.test`, declared in `payments-api.json`'s `servers[]`),
  onemock transparently intercepts those calls — no server, no port, no code in
  `payments.ts` aware it's being tested.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter onemock-example-payments test
```

## How it works

`payments.test.ts` loads `payments-api.json` into `createMock()` together with
`paymentsMock`, then calls `.intercept()`. Every test starts from a fresh mock
(`beforeEach`), so state never leaks between tests.

```ts
mock = await createMock(paymentsApiSpec, { handlers: paymentsMock })
await mock.intercept()
```

The mock service owns domain behavior. `createPayment` / `deletePayment` write
to onemock's in-memory store; `getAccount` re-reads that store and returns
`totalAmount` and `paymentCount`. Tests just call the real client:

```ts
await createPayment({ amount: 100, currency: 'USD' })
await expect(getAccountBalance()).resolves.toEqual({
  totalAmount: 100,
  currency: 'USD',
  paymentCount: 1,
})
```

## Generating a mock service

To produce a file like `src/mocks/payments.ts` for another spec, open
[`prompts/generate-mock-service.md`](prompts/generate-mock-service.md), paste
the spec into the placeholder, and run it in an agent chat. The result is
ordinary TypeScript you commit and edit — no LLM at test time.
