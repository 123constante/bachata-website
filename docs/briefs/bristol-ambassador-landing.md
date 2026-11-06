# Brief W1 -- Bristol ambassador shared link landing + join (Website, careful lane, opus)

Brief-version: 2
Context cap 30%. Push an early checkpoint commit as soon as the screen renders; push again before every pause. Supabase READ-ONLY. Never `gh api`, never `--no-verify`, never merge/approve. If PARTIAL, subject ends PARTIAL and the handover lists what is left. Bristol stays INACTIVE: no city activation, no city set, no flag flip, no prod data write.

- **Repo:** 123constante/bachata-website. **Branch:** `claude/bristol-ambassador-landing`. **Lane/model:** careful (auth path), opus.
- **BLOCKED:** needs admin-migration:ambassador_shared_link_v1 applied (admin PR #1277, branch claude/bristol-ambassador-link-admin: open, not yet reviewed/merged/applied). Do not dispatch until the RPCs exist on prod (read-only check: `select proname from pg_proc where proname like '%ambassador_link%'`).

## Goal (owner 2026-10-26 and 2026-10-29)
One permanent shared Bristol link per ambassador (Jan). The page says "Jan invited you to Bristol"; the joiner signs in or up and joins Bristol. The invite message is the ambassador's own words; we provide only the page. Bristol is inactive, so the landing must work with an INACTIVE city and must never use the city picker (`search_cities` filters `is_active`).

## RPCs (shapes from admin PR #1277 migration `99990101000000_ambassador_shared_link_v1.sql`; the migration wins, use the renumbered file if renamed)
- `get_ambassador_link_public_v1(p_code text)` (anon): `{status:'ok', first_name, city_name, city_slug, is_active:true}` or `{status:'not_found'}` (unknown, switched off, or ambassador removed).
- `record_ambassador_link_join_v1(p_code text)` (authenticated): `{status:'joined'|'already_joined', city_slug, city_name}`; refuses an anonymous sign-in and the ambassador's own link; never sets the joiner's city.

## Do
1. Route `/join/a/:code` in `src/components/AnimatedRoutes.tsx` (beside the `/invite` routes at lines 291-292; the ambassador route is line 289). Lazy page under `src/modules/ambassador/link/`. `git grep` for an existing `/join` route first.
2. Landing states from ONE mapping file `linkLandingModel.ts`: loading; ok (heading "<first_name> invited you to <city_name>", or "You are invited to <city_name>" when first_name is null); not_found ("This link is switched off or wrong. Ask whoever sent it for a new one" plus a Contact us button); signed-out (Sign in / Create account, both return to this URL); signed-in not joined (Join <city_name> button); joined / already_joined (done state naming the next step: open your organiser area `/app`); error (retry). Every state names what the person CAN do; a disabled button states why.
3. After sign-in call `record_ambassador_link_join_v1` once, only on the button tap (never on load). Then hand into the existing organiser onboarding (`src/modules/admin-organisers/join/JoinPage.tsx`, `src/modules/organiser/home/onboarding/`). The new page's city is a FIXED chip read by id from `cities` (RLS public read), never via `search_cities`. Confirm with a test how `src/modules/organiser/edit-in-place/CitySheetBody.tsx` shows a current city absent from search results (it shows `currentName` first).
4. Follow `.claude/rules/design-density.md`, explicit-px 44px taps (html font is about 13.5px on phones), HTML entities not raw Unicode.

## Tests (vitest, table-driven)
- {signed-out, signed-in, already joined} x {ok with name, ok without name, not_found, rpc error}: heading, buttons, disabled reasons.
- Join fires exactly once per tap, never on render; an untouched page sends no write.
- A grep test fails if the landing imports or calls `search_cities`.
- Own-link and anonymous-session refusals render one plain sentence, not a raw error.

## Walk and design
390x844 for each state on a stand-in active city (mocked RPC); screenshots attached to the PR. Design record `docs/design/bristol-ambassador-landing.md`, with INVENTORY first (existing `/invite` pages and `/ambassador`, file:line).

## Done
Bot-authored PR, every CI job step run, Verified / Not verified block (Not verified: real link until #1277 is applied and Jan has an account), handover `docs/handover/bristol-ambassador-landing.md`.

## What main lacks
No shared ambassador link route, no landing, join record call or `/join/a/` path anywhere on origin/main (git grep for ambassador link finds only the A1 queue under src/modules/ambassador). The DB half is admin PR #1277 (unmerged).

## Files
`src/components/AnimatedRoutes.tsx` (route), new `src/modules/ambassador/link/*`, `src/modules/admin-organisers/join/JoinPage.tsx` (read only, hand-off), tests under `src/modules/ambassador/link/__tests__/`.
