# onemock example: Car insurance contracts

A made-up insurance lookup mocked with [onemock](../../README.md). One
application function talks to **two external APIs** with different specs,
hosts, paths, query params, and response envelopes. Tests mock those
services independently and never mix their state.

- `src/contracts.ts` — application code: `getContractsByLicensePlate`
  fetches consumer policies and corporate fleet contracts in parallel,
  then normalizes them into one list.
- `consumer-contracts-api.json` — CitoCover Personal Motor API
  (`https://api.citocover.test`, `GET /personal-policies?licensePlate=`).
- `corporate-contracts-api.json` — FleetCover Corporate Contracts API
  (`https://contracts.fleetcover.test`, `GET /v2/contracts?registrationNumber=`).
- `src/mocks/consumer.ts` / `src/mocks/corporate.ts` — generated mock
  services, one per spec. Lookups filter the in-memory store by plate /
  registration so other vehicles do not leak into the result.
- `src/contracts.test.ts` — seeds each mock separately, then calls the
  real client with a license plate.
- `prompts/generate-mock-service.md` — prompt used to generate the two
  mock services.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter onemock-example-insurance test
```

## How it works

```ts
consumer = await createMock(consumerSpec, { handlers: consumerContractsMock })
corporate = await createMock(corporateSpec, { handlers: corporateContractsMock })
await consumer.intercept()
await corporate.intercept()

consumer.seed('/personal-policies', { licensePlate: 'AB-123-C', ... })
corporate.seed('/v2/contracts', { registrationNumber: 'AB-123-C', ... })

await getContractsByLicensePlate('AB-123-C')
```

Each `createMock()` has its own store. Seeding a corporate fleet contract
cannot appear as a consumer policy. The application is the only place the
two APIs are composed.
