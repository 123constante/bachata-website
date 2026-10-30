<!-- Paste as the body of PR #1132. Plain git cannot edit a PR body. -->
# P3 W4b2 slices 2+3: page onboarding screens 1-9, full-path %, Review, go-live stub, Home banner, Settings (behind `organiserP3`)

## What
Route `/account/p3/start[?o=<page>][&at=<step>]` (full screen, outside P3Shell): Welcome -> find / claim / ask to join, or Create (name, city) -> contact -> WhatsApp -> category -> link -> logo -> slice 1's person screens (reused) -> Review -> Live.
- Progress is the FULL path (`pageModel.fullPath` / `flowPercent`), fixing S6; Review = 100%.
- Review reads `organiser_onboarding_status_v1`; all 18 missing codes have a row.
- Go live: `complete_organiser_onboarding_v1` is deployed in admin #1119; intentionally not wired in this PR, so a stub (`deployed: false`) disables the button with "Going live opens soon. Everything you added is saved." Never a fake "You're live".
- Home grace banner (`GraceBanner`, rules in `graceModel.ts`), lazy Settings sheet (dark mode, rename, sign out).
- Flag `organiserP3` stays OFF. No migration, no `supabase/**`, `perf-budgets.json` / `vite.config.ts` untouched.

## Why
Self-serve organiser onboarding (build 2 of W4b). Design record: [`docs/design/onboarding-prototype.md`](docs/design/onboarding-prototype.md). Handover with decisions: `docs/handovers/p3-w4b2-page.md`.

## CI sweep (run locally, branch vs main)
| Job / step | Result |
|---|---|
| Source Integrity: `bin/check-integrity.sh` | pass (run via `bash`; the exec bit is missing in the sandbox) |
| legacy-tables, legacy-program-rpcs, `lint:architecture` | pass |
| `check:images` with `AUDIT_STRICT=1` | pass |
| Typecheck workflow: `check:rpc-typing`, `check:wallclock-brand` | pass |
| `npm run typecheck` (tsc) | 99 errors; byte-identical list to main (99); none new |
| `npm run lint` chain | 21/22 links green; `check:integrity` exit 126 is the sandbox exec bit (passes via bash); the trailing eslint was skipped by the chain |
| `check:mojibake`, `check:dancer-area-isolation` | pass |
| `test:unit:offline` | 28 failed on first run: 23 were MINE (Home now mounts `GraceBanner`, which needs a QueryClient) -> fixed in f7ed6bd by mocking it in `screens.matrix.test.tsx`; re-run of `src/modules/organiser/p3` + `auth.today` 39 files / 2474 tests green. The other 5 (`tests/integrityCouldNotRun.test.ts`) fail on main too (sandbox exec bit) |
| Perf: build (flags off), `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | pass |
| `check:bundle-budget` with `VITE_ENABLE_ORGANISER_P3` + self-serve ON | OVER on `dancer-app` (375.4 vs 374 KB) and chunk ratchets for `auth` / `dancer-app`; IDENTICAL on main with flags on (pre-existing, not chased) |
| `test:e2e` (CI env, flags off) | 174 passed, 52 skipped, 10 failed in a loaded full run; the 9 other failures passed on re-run with 2 workers (timeouts under load); `organiser-home.spec.ts:55` fails on main too. Nothing new |
| `walk-p3-w4b2-page.spec.ts` + `walk-p3-w4b2-person.spec.ts` (flags on) | 33/33 pass |
| Not run locally: Lighthouse, doc-weight, db-contract-check (needs live DB), og-image (needs a deploy) | see Not verified |

## Verified on real data
Read-only on prod (`stsdtacfauprzrdebmzg`, counts only, 2026-10-29): 49 organiser pages, all live; phone E.164 40 / legacy 5 / none 4; WhatsApp set 0; category null 2; no link 2 (IG 47, web 27, FB 24); logo null 1; city null 0; bio null 48; 61 memberships / 12 users (1 user on 2+ pages); progress rows 0; gate flag off; complete members 0; missing codes: teach_answer 60, dj_answer 59, contact_confirm 56, languages 7, nationality 6, instagram 6, dance_role 2, org_link 2, and 1 each of city, org_category, org_logo, first_name, teach_years, photo, dj_genres, teach_levels. Function bodies read with `pg_get_functiondef`; `complete_organiser_onboarding_v1` deployed in admin #1119; intentionally not wired in this PR, `deployed: false` until the go-live slice.
Table-driven matrices: `pageModel.matrix.test.ts` (126), `pageScreens.matrix.test.tsx` (44) + slice 1 suites. No-scroll walk at 390x844 / 360x640 / 320x568 x 100% / 130% text, filled / empty / no-page personas, tap targets >= 44.

## Not verified
- Any real save on prod (no writes allowed); only prod-shaped fakes.
- A real iPhone / Android keyboard; dark mode in the walk; the Live screen in a browser (unreachable until go-live ships).
- Vercel preview; the browser walk on a live deploy; Lighthouse / doc-weight / db-contract / og checks; eslint backlog.
- `/code-review` has not been run (Ricky types it).
- `?o=` is not checked against the person's own pages (server-gated: not_found / permission_denied).
- Decisions to confirm: "Use an email instead" (5c) not built (server refuses `contact_email` for non-admins); person codes without a screen open the dancer profile editor; DJ screen is the obvious next slice.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WoGkiC293uYUsTagMPUefm
