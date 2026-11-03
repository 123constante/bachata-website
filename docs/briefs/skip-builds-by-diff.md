# Brief: Vercel skips builds automatically when a push changes no app code (Website, careful lane: scripts/**)

Lane: careful. Model: Opus. Branch: claude/skip-builds-by-diff. One PR, push once, no run-ci. One independent review, one fix round.
Why: owner 2026-11-03: Vercel deploys cap about 100/24 h; docs/walk/review branches carry no app code but each push builds. Owner clicks: decide BY DIFF, automatic, no branch-name list to maintain.
Today: scripts/vercel-ignore-build.sh skips only main, bot/*, dependabot/*; every other branch always builds because preview jobs (perf-budget lighthouse/doc-weight, synthetic-ssr-monitor) poll scripts/lib/previewProbe.mjs, which THROWS after 600 s when no ready deployment exists for the head sha.
## Do
1. Read the script header and the workflows that use previewProbe first; list every job that needs a preview for the head sha.
2. Make previewProbe treat an ignored/CANCELED build as a green skip ONLY when the same diff rule says the push touched no BUILD_PATHS; share the rule in one module used by both the script and the probe (never two copies).
3. Extend the ignore script to any branch: skip when the diff from the last successful deployment of that branch touches none of BUILD_PATHS (src, public, index.html, package files, vite/vercel config, anything in BUILD_PATHS). Any doubt (no previous sha, diff error) BUILDS.
## Tests (table-driven, red first)
Diff shapes: docs only / tests only / src change / package-lock only / config change / mixed / empty / unknown base: build or skip as specified; probe: skipped build + no-app-code diff = green, skipped build + app-code diff = fails. Mutants: skip on a src change; probe green on app-code diff; unknown base skips.
## Rules
Run every CI step that applies; per-job table in the PR body. Do not edit perf-budgets.json or vite.config.ts. Supabase read-only. Never merge or approve. Handover docs/handover/skip-builds-by-diff.md. Say how many past PRs (counts) this rule would have skipped (read git history, counts only).
