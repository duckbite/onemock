# OneMock Pivot: Lightweight Intelligent Mocking Library

**Status:** Approved for planning
**Date:** 2026-08-16
**Tracked in:** Linear project [onemock](https://linear.app/duckbite/project/onemock-cf0ed953ffa0) (Duckbite team, DB)

## Background

The original OneMock.io was designed as a hosted, multi-tenant SaaS: a NestJS + AWS Lambda
service behind `api.onemock.io/[service]/[endpoint]`, with DynamoDB-backed accounts, API-key
auth, per-service handlers (starting with a hardcoded Stripe handler), and OpenAI-powered
response generation. That implementation has been removed (see git history prior to this
commit) but the docs in `docs/product.md` and `docs/architecture.md` still describe it and will
be superseded by this doc.

This document defines the new direction: OneMock becomes an **npm dependency**, not a hosted
service.

## Product Vision

OneMock is a lightweight, TypeScript-first npm package that turns an OpenAPI spec into an
intelligent, stateful mock API — one your test code (unit or e2e) can talk to via a local server
or in-process network interception, with no hosted account, no AWS, and no per-service handler
code to write.

## Core Value Proposition

- **Bring your own spec**: point OneMock at any OpenAPI 3.0/3.1/Swagger 2.0 document — a vendor's
  public spec (Stripe, GitHub, Slack, ...) or your own internal API — and get a working mock.
- **Genuinely intelligent, not random**: responses are schema-aware and internally consistent
  (correct types/formats/enums), and the mock is **stateful** — a `POST` you make is retrievable
  by a later `GET`, like a real backend, not a fresh random blob every time.
- **Minimal footprint**: no required config file, no external services (no Redis/DB/Docker), no
  hosted account. Setup in a test file is ~5 lines. Heavy adapter dependencies (e.g. `msw`) are
  lazy-loaded so installing OneMock for server-mode-only use doesn't pull them in.
- **Full control from your tests**: force specific responses, error codes, and fixtures per test
  via an override API — not just happy-path generation.
- **Optional preset ecosystem**: thin, pure-data `@onemock/<service>` packages ship a pinned spec
  for popular services, installed only when wanted.

## Target Users

- Developers writing unit/integration/e2e tests against code that calls external APIs
- QA engineers testing integration edge cases (errors, rate limits, timeouts) that are hard to
  trigger against a real vendor sandbox
- Teams building internal services who want contract-accurate mocks of their own OpenAPI-described
  APIs for consumer-side testing

## Out of Scope (this pivot)

Everything about the old SaaS model is explicitly dropped: hosted multi-tenant service, AWS
Lambda/DynamoDB/ElastiCache/S3 infrastructure, API-key account system, usage quotas/billing,
AI/LLM-powered response generation, and hardcoded per-vendor handler code (e.g. the old Stripe
handler). Any "mock Stripe" capability now comes from pointing the generic engine at a spec, not
from bespoke code.

## Architecture

### Monorepo layout

pnpm workspaces (consistent with prior tooling):

```
packages/
  core/                 → published as `onemock` — engine, server adapter,
                          interception adapter, CLI
  presets/
    stripe/              → `@onemock/stripe`
    github/               → `@onemock/github`
    slack/                → `@onemock/slack`
```

### Key library choices

| Concern | Choice | Why |
|---|---|---|
| Spec parsing | `@readme/openapi-parser` | Resolves `$ref`s, validates, covers OpenAPI 3.0/3.1 + Swagger 2.0 |
| Data generation | Custom schema-walker on `@faker-js/faker`, seeded per instance | This is the product's core differentiator; not delegated to a library |
| Interception adapter | `msw` | De facto standard; not reinvented. **Lazy-loaded** — only imported when `.intercept()` is called |
| Server adapter | Node's native `http` + a minimal router | No Express/Fastify dependency; keeps default footprint small |
| Request validation | `ajv` (JSON Schema validation) | Standard, small, already the underlying validator most OpenAPI tooling uses |

Both adapters sit on top of one shared engine instance — behavior must be identical between them
(see Testing Strategy).

## Core Engine Components

1. **Spec loader** — loads a spec (local file, URL, in-memory object, or a `@onemock/*` preset
   export), resolves `$ref`s, validates it. Throws immediately on an invalid spec, at
   `createMock()` time, not at first request.
2. **Schema-to-data generator** — walks each operation's response schema and produces seeded,
   format-aware fake values; `$ref`-linked objects stay internally consistent.
3. **State store** — an in-memory "fake DB" keyed by resource, seeded from the schema on first
   access. Mutating verbs (POST/PUT/PATCH/DELETE) write to it; GET/LIST read from it. This is what
   makes create-then-fetch flows round-trip correctly.
4. **Override/seed API** — `.seed(path, data)` pre-populates state; `.override(method, path,
   response | (req) => response)` forces a specific response (including error codes) for the next
   N matching requests or indefinitely.
5. **Request validator** — checks incoming requests against the spec; returns a spec-shaped 400
   with a field-level explanation if they don't match, rather than generating a response anyway.
6. **Behavior simulators** — pluggable middleware for rate limiting (429 after N reqs/window,
   configurable) and latency/flakiness (configurable delay or random failure rate), per-instance or
   per-route.
7. **Pagination handler** — recognizes common pagination shapes from the spec (cursor/offset/page
   query params + response envelope) and paginates list-endpoint state automatically.

## Data Flow

1. **Ingest**: `createMock(spec)` loads/validates the spec, builds an internal route table.
2. **Instantiate**: engine creates an empty state store and a seeded faker instance (fixed default
   seed for reproducibility, overridable).
3. **Expose**: caller picks an adapter:
   - `.listen(port)` → starts the HTTP server; real requests route through the engine
   - `.intercept()` → registers MSW handlers so in-process `fetch`/`http` calls to the spec's
     `servers[]` URL(s) route through the same engine
4. **Per-request resolution order** (identical for both adapters):
   1. Match route by method + path template → 404 (spec-shaped) if unmatched
   2. Check active overrides → return directly if one matches and hasn't exceeded its use count
   3. Run behavior simulators → short-circuit with 429 or simulated failure if triggered
   4. Validate request against the operation schema → 400 (spec-shaped) if invalid
   5. Route to state store: mutating verbs write and return the affected resource(s); GET/LIST
      read, applying pagination if configured; an unseeded GET generates-and-stores a fresh fake
      resource on first access
5. **Reset**: `.reset()` clears state store + overrides; `.seed()` repopulates. Typically called in
   `beforeEach`/`afterEach`.

## Minimal Footprint Principles

These are binding constraints on every future design/implementation decision for this project,
not just this pivot:

- No required config file for the standard case. A config file is optional sugar for advanced
  multi-spec setups only.
- No required env vars, no external processes (no Redis/DB/Docker/hosted account).
- Heavy adapter dependencies lazy-load — using `.listen()` only must never pull in `msw`.
- Setup in a test file targets ~5 lines:
  ```ts
  import { createMock } from 'onemock'
  import stripeSpec from '@onemock/stripe'

  const stripe = createMock(stripeSpec)
  beforeAll(() => stripe.listen(4010))
  afterEach(() => stripe.reset())
  afterAll(() => stripe.close())
  ```
  No custom test-runner plugin required — any runner's own setup/teardown hooks call this API
  directly.
- Preset packages are pure data (spec file + metadata only) — installing one adds a file, not a
  dependency tree.

## Error Handling

- **Invalid/unparseable spec**: throws at `createMock()` time with a message pointing at the
  offending part of the spec.
- **Unmatched route** (server mode): real HTTP 404 with a JSON body identifying it as an OneMock
  "unhandled route" response, distinguishable from a spec-defined 404.
- **Unmatched request** (interception mode): **errors loudly by default** — a missing mock must be
  a visible test failure, not a silent real network call, since "test without touching real
  services" is the product's core premise. An explicit opt-in (`createMock(spec, { passthrough:
  true })`, or per-route) allows deliberate mixed real/mock traffic for the rare case that wants
  it.
- **Request fails validation**: 400 with a spec-shaped error body listing which field(s) failed
  and why.
- **Simulated failures** (rate limit, latency/flake): intentional, spec-shaped responses (e.g. a
  real 429 with `Retry-After`), not thrown errors — so the caller's real error-handling code path
  is what gets exercised.
- **Override function throws**: the engine catches it and surfaces the error clearly attributed to
  the specific `.override(...)` call.

## V1 Scope

**Core (not optional):**
- OpenAPI spec ingestion (3.0 / 3.1 / Swagger 2.0)
- Deterministic, seeded schema-based data generation (no AI/LLM dependency)
- Stateful in-memory store with CRUD round-tripping
- Local server adapter + in-process interception adapter, sharing one engine
- Full override/seed API (force responses, errors, fixtures per test)
- CLI (`onemock serve`) + programmatic API (`createMock`)
- Bring-your-own-spec, with optional pure-data `@onemock/<service>` preset packages

**Also in v1 (from scope decisions):**
- Rate limiting simulation
- Latency/network simulation
- Request validation against the spec
- Request/response logging (debug visibility into what the mock received/returned)
- Multi-spec / multi-service instances (independent stateful mocks running concurrently)
- Pagination handling

**Explicitly deferred (not v1):**
- Webhook simulation (outbound webhook calls to the app under test)
- GraphQL schema support (OpenAPI/REST only for now)

Both deferred items are additive — nothing in this design precludes adding them later.

## Testing Strategy (for the OneMock project itself)

- **Unit tests** (Vitest): schema-to-data generator, state store CRUD, override resolution order,
  request validator, rate-limit/latency simulators, pagination handler.
- **Shared behavior suite across both adapters**: engine behavior tests are written once against
  an adapter-agnostic interface and run twice — once driving real HTTP against the local server,
  once driving `fetch` through interception — so the two modes can't silently diverge.
- **Preset package tests**: each `@onemock/*` package gets a test confirming its pinned spec parses
  successfully through the core parser.
- **CLI tests**: smoke test spawning the built CLI against a fixture spec, plus argument-parsing
  unit tests.
- **CI** (GitHub Actions): lint, typecheck, full suite across supported Node LTS versions, on every
  PR.

## CLI

Single verb, minimal flags, no `init`/scaffolding command:

```
onemock serve <spec> [options]

  <spec>              path to a local spec file, a URL, or a bare preset name
                      resolved from an installed @onemock/* package
                      (e.g. `onemock serve stripe` if @onemock/stripe is installed)

  --port, -p <n>      port to listen on (default: 4010)
  --seed <file>       JSON file to pre-populate state store
  --delay <ms>        global artificial latency
  --rate-limit <spec> e.g. "100/60s"
  --no-validate       disable request validation
  --watch             reload spec on file change (local files only)
```

This covers the "standalone process for e2e" use case. Anything more advanced (per-route
overrides, custom simulators) is programmatic-API territory.

## Preset Package Shape

```
packages/presets/stripe/
  package.json          → name: "@onemock/stripe", exports index
  spec.json              pinned OpenAPI spec (checked in, versioned)
  src/index.ts            exports default spec object + { name, apiVersion } metadata
  scripts/update-spec.ts  maintainer-only: refreshes spec.json from upstream
```

- `index.ts` exports the parsed spec plus metadata (e.g. which upstream API version is pinned);
  consumers do `import stripeSpec from '@onemock/stripe'` and pass it to `createMock()`.
- `update-spec.ts` is a maintainer tool (run manually or via scheduled CI), not shipped to
  consumers.
- No custom per-preset logic (binding decision) — every preset package is mechanically the same
  shape, so adding a new one is: fetch spec, add package.json, done.

## Naming

Project keeps the name **OneMock**. Core package publishes as `onemock`; presets as
`@onemock/<service>`.

## Open Items for Implementation Planning

- Exact package.json `exports` map / dual ESM+CJS build setup (tsup vs. tsc, target Node versions)
- Fixed default faker seed value and how `--seed`/programmatic seed override interact
- Rate limit and latency simulator config syntax (CLI string format like `"100/60s"` needs a
  parser; programmatic API should accept the same shape)
- Which specific services get initial preset packages (Stripe first, per this conversation's
  running example — others TBD)
