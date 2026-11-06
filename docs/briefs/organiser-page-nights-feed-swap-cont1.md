# Brief: organiser page nights feed swap, continuation 1 (regenerate types.ts only)

Brief-version: 2
Branch: claude/organiser-page-nights-feed-swap (ALREADY has the swap commit 2348463e; continue on it, do not recreate). Normal lane, Sonnet, context cap 50%. One push. No `supabase/**`.

## Decisions
The first worker finished the swap but `types-drift` (CI) is red: `src/integrations/supabase/types.ts` is stale against the live database (it lacks `get_organiser_nights_v2` and functions from other merged migrations, for example `set_organiser_team_member_hidden_v1`, the ambassador tables). `npm run gen:types` needs a token the sandbox does not have, so use the Supabase connector instead.

## What main lacks
- the generated types lack the nights feed RPC and other merged functions -- grep: ambassador_invite_links

## What to build
0. Read docs/design/organiser-page-nights/INVENTORY.md if present (written by the first worker); no new design work here.
1. Call the Supabase connector tool `generate_typescript_types` for project `stsdtacfauprzrdebmzg` (read-only). The answer is about 486,000 characters and is saved to a file by the harness: read the saved file path it prints and extract the TypeScript text with a small script (the file may be a JSON string or an object with a `types` field; use `node -e` to parse and write it). Never paste it into chat.
2. Write it to `src/integrations/supabase/types.ts` keeping the file's CRLF line endings (the committed file uses CRLF; check with `file`). The diff against the committed file should be about 335 changed lines, not the whole file; if the whole file differs, you have a line-ending mismatch, fix that.
3. Run `npm run check:rpc-typing` and `npx tsc -p tsconfig.app.json --noEmit` and report the error count (the baseline in scripts/pre-ship.mjs is 106; do not add errors) and run `npx vitest run src/modules/profile app/routes`. Run `npm run check:mojibake`.
4. Commit `chore(types): regenerate supabase types from the live database [worker-done <ticket>]` and push ONCE (not [skip preview]).

## Files
- src/integrations/supabase/types.ts

## Done when
types.ts matches the live database (CI `types-drift` green is the proof), tsc error count not higher than before your change, the profile and route tests pass.
