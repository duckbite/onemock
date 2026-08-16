# OneMock

Intelligent, stateful mock APIs generated from an OpenAPI spec — for your tests.

> **🚧 Status: early development.** This repo is being rebuilt from scratch as a
> lightweight npm library. The core package currently exports a `createMock()`
> stub that throws `not implemented yet` — none of the usage below is
> functional yet. It documents the approved target design so contributors and
> early adopters know where this is headed. Follow progress in the design spec
> and the [Linear project](https://linear.app/duckbite/project/onemock-cf0ed953ffa0).

## What is OneMock?

OneMock turns an OpenAPI spec into a working, stateful mock API your tests can
talk to — no hosted account, no external services, no per-vendor handler code
to write.

- **Bring your own spec** — point it at any OpenAPI 3.0/3.1/Swagger 2.0
  document: a vendor's public spec (Stripe, GitHub, Slack, ...) or your own
  internal API.
- **Genuinely intelligent, not random** — responses are schema-aware and
  internally consistent, and the mock is **stateful**: a `POST` you make is
  retrievable by a later `GET`, like a real backend.
- **Minimal footprint** — no required config file, no external services, ~5
  lines of setup in a test file. Heavy adapter dependencies (like `msw`) are
  lazy-loaded so installing OneMock for server-mode-only use doesn't pull them
  in.
- **Full control from your tests** — force specific responses, error codes,
  and fixtures per test via an override API, not just happy-path generation.
- **Optional preset ecosystem** — thin, pure-data `@onemock/<service>`
  packages ship a pinned spec for popular services, installed only when
  wanted.

Full product and architecture design:
[`docs/superpowers/specs/2026-08-16-onemock-pivot-design.md`](docs/superpowers/specs/2026-08-16-onemock-pivot-design.md)

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

## Repository layout

pnpm workspace:

```
packages/
  core/       → published as `onemock` — engine, adapters, CLI
  presets/    → thin @onemock/<service> spec packages (not started yet)
```

## Development

Requirements: Node.js >=20, pnpm (this repo pins `pnpm@10.20.0` via
`packageManager` in the root `package.json`).

```bash
pnpm install    # install workspace dependencies
pnpm build      # build all packages
pnpm test       # run all tests
pnpm lint       # lint the whole repo
pnpm typecheck  # typecheck all packages
pnpm format     # check formatting (pnpm format:write to fix)
```

## License

MIT
