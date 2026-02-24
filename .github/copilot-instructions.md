# Project Guidelines

## Build and Test
- Install dependencies with `npm i`.
- Start local dev server with `npm run dev`.
- Run lint before finishing code changes: `npm run lint`.
- Run unit tests with `npm run test:unit`.
- Run targeted E2E smoke tests with `npm run test:e2e` (Chromium smoke subset).
- Run full E2E suite only when needed: `npm run test:e2e:all`.

## Architecture
- Stack: Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase.
- App composition and global providers are defined in `src/App.tsx` and `src/main.tsx`.
- Route-level pages live in `src/pages/*`; reusable UI and feature pieces live in `src/components/*`.
- Shared state and integrations should stay in existing boundaries: `src/hooks/*`, `src/contexts/*`, and `src/integrations/*`.
- Use existing docs in `docs/*` for feature-specific implementation plans before introducing new patterns.

## Code Style
- Use TypeScript + React function components and existing naming patterns in surrounding files.
- Prefer absolute imports via `@/*` alias instead of long relative paths.
- Reuse existing shadcn/ui primitives in `src/components/ui/*` before creating new base components.
- Keep changes focused and minimal; avoid opportunistic refactors unrelated to the requested task.

## Conventions and Pitfalls
- Use Tailwind theme tokens and CSS variables from `src/index.css`/`tailwind.config.ts`; do not hard-code new color systems.
- Preserve route and auth guard patterns used in `src/App.tsx` (`AuthGuard`, provider wrappers, page transitions).
- This repo intentionally has relaxed TypeScript strictness in tsconfig (`noImplicitAny`, `strictNullChecks` disabled); avoid broad type-tightening as part of feature work.
- For local auth flow testing, DEV quick login appears only when `VITE_DEV_AUTH_EMAIL` and `VITE_DEV_AUTH_PASSWORD` are set in local `.env` and running in dev mode.