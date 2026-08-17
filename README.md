# OneMock

Intelligent, stateful mock APIs generated from an OpenAPI spec — for your tests.

> **🚧 Status: early development.** The core engine and both adapters
> (`.listen()` for a local server, `.intercept()` for network interception)
> are implemented and tested — `createMock()` works end to end. The CLI
> (`onemock serve`) and the `@onemock/<service>` preset packages are not
> built yet, and this package is not published to npm. See
> [`example/`](example/) for a working demo, the design spec, and the
> [Linear project](https://linear.app/duckbite/project/onemock-cf0ed953ffa0)
> for progress.

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

## Repository layout

pnpm workspace:

```
packages/
  core/       → published as `onemock` — engine, adapters, CLI
  presets/    → thin @onemock/<service> spec packages (not started yet)
example/      → a working demo: a mocked Payments API using onemock
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
