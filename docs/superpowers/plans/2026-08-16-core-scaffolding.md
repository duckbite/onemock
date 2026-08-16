# Monorepo & Core Package Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm workspace and the `packages/core` package (published as `onemock`) with a working TypeScript build, lint, typecheck, test, and CI pipeline — no feature logic yet, just a correctly-built, correctly-tested `createMock()` stub export.

**Architecture:** A pnpm workspace (`packages/*`) with one package today (`packages/core`). Root holds repo-wide tooling (ESLint flat config, Prettier, shared `tsconfig.base.json`) and aggregate scripts that fan out to each package via `pnpm -r`. `packages/core` owns its own build (tsup, dual ESM+CJS output with `.d.ts`), typecheck (`tsc --noEmit`), and test (Vitest) tooling so it stays self-contained as more packages (presets) are added later.

**Tech Stack:** pnpm workspaces, TypeScript 5, tsup (build), Vitest (test), ESLint 9 flat config + typescript-eslint, Prettier, GitHub Actions.

## Global Constraints

- Package manager is pnpm (matches prior project tooling and Linear ticket DB-281).
- No Express/Fastify or other heavy runtime dependency in `packages/core` at this stage — this task only produces a stub export, not the server adapter.
- `packages/core` builds dual ESM+CJS with type declarations, per the "Architecture" section of `docs/superpowers/specs/2026-08-16-onemock-pivot-design.md`.
- Minimal footprint principle from the spec applies to tooling choices too: no unnecessary devDependencies (e.g. no monorepo build orchestrator like Turborepo — `pnpm -r` is sufficient for one package).
- Node engines target `>=20` (Node 18 is EOL; installed dev Node is v22.21.1, pnpm is 10.20.0).
- Acceptance criterion from DB-281: `pnpm install && pnpm build && pnpm lint && pnpm typecheck` must succeed from a clean clone.

---

### Task 1: Root workspace & shared tooling

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.prettierignore`

**Interfaces:**
- Produces: root scripts `build`, `lint`, `format`, `typecheck`, `test` (each fans out via `pnpm -r <script>` to every workspace package). `tsconfig.base.json` is extended by every package's own `tsconfig.json` (Task 2 is the first consumer).

- [ ] **Step 1: Create the pnpm workspace file**

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 2: Create the root package.json**

`package.json`:
```json
{
  "name": "onemock-monorepo",
  "private": true,
  "packageManager": "pnpm@10.20.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "pnpm -r build",
    "lint": "eslint .",
    "format": "prettier --check .",
    "format:write": "prettier --write .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "@eslint/js": "^9.15.0",
    "eslint": "^9.15.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.3.3",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.15.0"
  }
}
```

- [ ] **Step 3: Create the shared base tsconfig**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: Create the ESLint flat config**

`eslint.config.js`:
```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
)
```

- [ ] **Step 5: Create Prettier config**

`.prettierrc.json`:
```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all"
}
```

`.prettierignore`:
```
dist
pnpm-lock.yaml
```

- [ ] **Step 6: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: completes successfully, creates `pnpm-lock.yaml` (no packages to link yet since `packages/core` doesn't exist until Task 2 — this just confirms root tooling installs cleanly).

- [ ] **Step 7: Verify lint runs clean on the empty workspace**

Run: `pnpm lint`
Expected: exits 0 (no files to lint yet beyond config files themselves, which must pass their own rules).

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json eslint.config.js .prettierrc.json .prettierignore pnpm-lock.yaml
git commit -m "chore: set up pnpm workspace and shared lint/format/tsconfig tooling"
```

---

### Task 2: `packages/core` package scaffold

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/index.ts` (temporary placeholder, replaced in Task 3)

**Interfaces:**
- Consumes: `tsconfig.base.json` from Task 1 (extended by `packages/core/tsconfig.json`).
- Produces: package `onemock` with scripts `build` (tsup), `typecheck` (`tsc --noEmit`), `test` (`vitest run`) — these are the scripts Task 1's root `pnpm -r <script>` commands fan out into. Entry point `packages/core/src/index.ts`, built output at `packages/core/dist/index.{js,cjs,d.ts}`.

- [ ] **Step 1: Create the core package.json**

`packages/core/package.json`:
```json
{
  "name": "onemock",
  "version": "0.1.0",
  "description": "Spec-driven, intelligent mock APIs for tests — generate a stateful mock server or in-process interceptor from an OpenAPI spec.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create the core package tsconfig**

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create the tsup build config**

`packages/core/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
})
```

- [ ] **Step 4: Create the Vitest config**

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Create a temporary placeholder entry file**

`packages/core/src/index.ts`:
```ts
export {}
```

This is replaced with the real `createMock` stub in Task 3 — it exists here only so Steps 6-7 below have something to build/typecheck against.

- [ ] **Step 6: Install workspace dependencies**

Run: `pnpm install`
Expected: completes successfully; `packages/core/node_modules/.bin` now has `tsup`, `tsc`, `vitest` available.

- [ ] **Step 7: Verify build and typecheck succeed**

Run: `pnpm --filter onemock build`
Expected: exits 0, produces `packages/core/dist/index.js`, `packages/core/dist/index.cjs`, `packages/core/dist/index.d.ts`.

Run: `pnpm --filter onemock typecheck`
Expected: exits 0, no output.

- [ ] **Step 8: Commit**

```bash
git add packages/core/package.json packages/core/tsconfig.json packages/core/tsup.config.ts packages/core/vitest.config.ts packages/core/src/index.ts pnpm-lock.yaml
git commit -m "chore: scaffold packages/core with build, typecheck, and test tooling"
```

---

### Task 3: `createMock` stub (TDD)

**Files:**
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/index.test.ts`

**Interfaces:**
- Produces: `createMock(spec: unknown): never` — exported from `onemock`'s package root. Later tickets (DB-282 onward) replace the throwing body with the real implementation; the exported name and signature's parameter position (`spec` as first argument) must stay stable since DB-290 (engine core) and every adapter ticket build on this export.

- [ ] **Step 1: Write the failing test**

`packages/core/src/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createMock } from './index'

describe('createMock', () => {
  it('is exported as a function', () => {
    expect(typeof createMock).toBe('function')
  })

  it('throws a not-implemented error for now', () => {
    expect(() => createMock({})).toThrow('onemock: createMock is not implemented yet')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter onemock test`
Expected: FAIL — `createMock` is not exported from `./index` (current `index.ts` is `export {}`).

- [ ] **Step 3: Implement the minimal `createMock` stub**

`packages/core/src/index.ts`:
```ts
export function createMock(spec: unknown): never {
  throw new Error('onemock: createMock is not implemented yet')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter onemock test`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Run build and typecheck again to confirm the real export compiles**

Run: `pnpm --filter onemock build && pnpm --filter onemock typecheck`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/index.test.ts
git commit -m "feat: add createMock stub export with not-implemented placeholder"
```

---

### Task 4: CI workflow + full acceptance verification

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts `lint`, `typecheck`, `build`, `test` from Task 1; `packages/core`'s `build`/`typecheck`/`test` scripts from Tasks 2-3.
- Produces: a passing GitHub Actions check on every push/PR. DB-294 (shared cross-adapter test suite + CI) later extends this workflow's test matrix once the adapters exist — this task only establishes the base pipeline the DB-281 Linear ticket calls for (lint + typecheck), plus build/test since both are cheap and already working.

- [ ] **Step 1: Create the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.20.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Verify the full local acceptance criterion from DB-281**

Run: `rm -rf node_modules packages/core/node_modules packages/core/dist && pnpm install && pnpm build && pnpm lint && pnpm typecheck`
Expected: all four commands exit 0 in sequence, simulating a clean clone.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint, typecheck, test, build"
```

- [ ] **Step 4: Update Linear**

Move DB-281 to "In Review" (or "Done" if the user confirms no PR review step is needed) once pushed, since this plan's tasks fully satisfy its acceptance criterion.
