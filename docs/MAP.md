# Repo map

React + TypeScript + Vite (react-router) + Supabase, deployed on Vercel. Mobile-first. Read CLAUDE.md first.

- `src/pages/` route screens; `src/modules/<feature>/` feature code (event-page, organiser, tickets, going...); `src/components/` shared UI; `src/hooks/`, `src/lib/` helpers; `src/integrations/supabase/` client + types.
- `app/` react-router root/entry/SSR helpers; `api/` Vercel functions (embed/ICS feeds); `middleware.ts` edge.
- Data: this repo owns NO migrations (`supabase/migrations/` must not exist); schema lives in the admin repo. Reads go through RPCs.
- Tests: `src/**/*.test.ts(x)` and `tests/**/*.test.ts` (Vitest); `tests/e2e/*.spec.ts` (Playwright smoke).
- `scripts/` CI guards (`check-*.mjs`, each with `--self-test`) and tooling; `scripts/lib/` shared helpers.
- `.github/workflows/` CI + automation; `docs/` handbooks (`ci-guard-notes.md`, `automerge.md`, `queue.md`).

Checks:
- `npx tsc --noEmit -p .` types
- `npm run test:unit` unit tests
- `npm run lint` lint chain
- `npm run check:mojibake`
- Use HTML entities (`&mdash;`) in JSX, never raw Unicode punctuation.
