# BRIEF: bristol-ambassador-landing cont1, fix the types-drift check (Website; normal lane; Sonnet)

Brief-version: 2
Branch: claude/bristol-ambassador-landing
Source: PR #1455 (feat(ambassador): /join/a/:code shared link landing + join) has one red check, `types-drift`: src/integrations/supabase/types.ts does not match the live schema after the ambassador RPCs (admin #1277 is applied on prod). Continuation on the SAME branch and PR; push ONCE. Same fix class as the earlier types.ts regeneration continuation for #1459.

## What main lacks
- a types.ts that matches prod for the ambassador RPCs this PR calls -- #1455
- a green types-drift check on PR #1455 -- #1455

## Files
- extends: src/integrations/supabase/types.ts

## Build
1. `git fetch origin main` and merge origin/main into the branch if behind (plain merge, no rebase). Read the failing `types-drift` job in .github/workflows (find which script/command it runs and how types.ts is regenerated: do not guess, read it and its docs in docs/ci-guard-notes.md).
2. Regenerate src/integrations/supabase/types.ts exactly the way that check does (the Supabase connector in this session is READ-ONLY: use generate_typescript_types or the project script the workflow uses, never any write). Commit ONLY the types.ts diff; confirm the diff contains the ambassador functions the PR calls and no unrelated churn (if unrelated churn appears, report it instead of committing it).
3. Run `npm run lint`-chain parts that apply to a types-only change and `npx tsc --noEmit -p .`: zero errors in files you touched; run the check the CI job runs locally if it can run offline.

## Hard limits
Supabase read-only. No .github/workflows, no src outside types.ts, no merge/approve. Push ONCE with [skip preview] ONLY if a second push follows; otherwise no flag on the final push. Keep the PR body's required labels (## Verified on real data / ## Phone QA) intact. Last commit subject ends `[worker-done <ticket>]`.
