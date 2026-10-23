# People arc S3 -- the DJ world -- handover

- Branch: `claude/people-dj-world` (from `main` 7cfedc6). Brief: `briefs/PEOPLE-S3-dj-world-brief.md` on
  `brief/people-arc` (sha 0a8eb15f). PR: **#984**.
- Content commit: `b69f547`. Stage 5 critique + fix pass: the commit after `001d3bf` (head = `git log -1 origin/claude/people-dj-world`).
- Design record (shape table, Gate 4 self-checks, screenshots): [`docs/design/people-s3-dj-world.md`](../../design/people-s3-dj-world.md).
- Behind `flags.personWorlds`. Flag OFF = today's `/djs/:id`, unchanged (tested over every shape). The `/people/:id` tab is unchanged too.

## Turning the flag on for the preview

Set `VITE_ENABLE_PERSON_WORLDS=true` in Vercel, Project -> Settings -> Environment Variables, Preview, scoped
to branch `claude/people-dj-world`, then redeploy that branch's latest preview. It is a build-time `VITE_` var, so
an existing deployment does not pick it up. **Needs owner:** api.vercel.com is refused by this sandbox's proxy,
so the worker could not set it or check the preview.

Local equivalent: `VITE_SUPABASE_URL=<prod>`, `VITE_SUPABASE_PUBLISHABLE_KEY=<prod anon>` and
`VITE_ENABLE_PERSON_WORLDS=true` (the sandbox shell exports a NON-prod Supabase URL, which wins over `.env.local`:
export them in the shell), then `npm run build`, then
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/_serve-build.mjs --port 4173`.
The walks are `docs/people-arc/s3/walk.mjs` (shots + checks) and `walk-back.mjs` (Back via the dancer page). Copy
them under `node_modules/.cache/` to run, so `playwright` resolves.

## Shapes (prod survey 2026-10-23, read-only, counts only; screenshots flag ON, prod data)

| Shape | Prod count | Slug walked | 390x844 | 360x800 |
|---|---|---|---|---|
| 0 upcoming | 23 of 40 | brito, chong, dj-chino-bzuk26 | [brito](shots/brito-390.png) | [brito](shots/brito-360.png) |
| 1 upcoming | 10 | nico, bobby-blanco, carlos-de-la-cruz | [nico](shots/nico-390.png) | [nico](shots/nico-360.png) |
| 2+ upcoming (max 4) | 7 | papacito, ramiro-zapata, jeff | [jeff](shots/jeff-390.png) | [jeff](shots/jeff-360.png) |
| played at, yes | 11 | papacito, chong | [chong](shots/chong-390.png) | [chong](shots/chong-360.png) |
| DJ name differs from the public name | 12 | papacito (Morcilla / Papacito), nico | [papacito](shots/papacito-390.png) | [papacito](shots/papacito-360.png) |
| no DJ name | 28 | jeff, ramiro-zapata | [ramiro](shots/ramiro-zapata-390.png) | [ramiro](shots/ramiro-zapata-360.png) |
| "DJ " prefix (cut; equal to the public name, so no small line) | 5 | carlos-de-la-cruz | [carlos](shots/carlos-de-la-cruz-390.png) | [carlos](shots/carlos-de-la-cruz-360.png) |
| no photo / no city | 5 / 5 | bobby-blanco, carlos-de-la-cruz | [bobby](shots/bobby-blanco-390.png) | [bobby](shots/bobby-blanco-360.png) |
| no name at all (h1 "DJ") | 2 | dj-chino-bzuk26 | [chino](shots/dj-chino-bzuk26-390.png) | [chino](shots/dj-chino-bzuk26-360.png) |
| other roles (tabs) | DJ + dancer seen | papacito, ramiro-zapata, nico, ... | tabs at y=163 | tabs at y=163 |
| languages | 10 | - | not shown on the DJ world (approved design) | |
| longest name (20) | 1 | carlos-de-la-cruz | one line, no clipping | |

Every render: lowest contrast >= 5.91, taps >= 44 px, no clipping, no sideways scroll, no page errors.

## API changes for S2 to adopt after merge (all additive)

`facts/`:

| Function | Rule |
|---|---|
| `wallDayOf(raw)` | the day of a stored gig stamp, as written ("2026-10-23 23:30:00+00" -> "2026-10-23"). Event times are a London wall clock stamped +00: **use this, not `londonDayOf`, for RPC event times** (`londonDayOf` converts, and a 23:30 BST gig moves to the next day) |
| `gigDateLabel(raw)` | "Friday 23 October" = `dateLabel(wallDayOf(raw))` |
| `dayNumber(raw)` | "23" (no leading zero) |
| `timeLabel(raw)` | "19:30" as stored; midnight on the dot = no time = `null` |
| `monthLabel(raw)` | "October 2026" (Played at) |

`frame/`:

| Export | Contract |
|---|---|
| `PersonFrame` | same props. Back now goes back in history when the previous page was on this site, else to `backHref`. The `href` stays `backHref`, and a modified click is left to the browser |
| `backGoesToHistory(key, idx?)` | the rule: a numeric `history.state.idx` decides (> 0); otherwise the location key (not `"default"`) decides |
| `currentHistoryIdx()` | React Router's idx from `window.history.state` (undefined on the server) |

`worlds/dj/`: `DjWorld`, `djWorldView` (pure view model), `linkText`.

S3 did not switch the old DJ copies (`djFormat` month names, `djRoleModel` counts, `DjTiles` initials, the
upcoming split in `DJProfile.tsx`) on the flag-OFF path: they still serve today's page, so none could be deleted.
The flag-ON path uses only facts/frame. Delete the old copies when the flag is removed.

## Not verified

- Real photos: the image host is blocked from the sandbox, so every face rendered the initials fallback.
- The Vercel preview (api.vercel.com refused). Share on a real phone.
- The flag-OFF page in a browser: it is unit-tested only, and the code path is unchanged.
- The `/code-review` pass: the owner types it. Not run in this unattended session; the diff was self-reviewed
  adversarially, which led to the Back idx hardening (a client `replace` redirect on the first page).
- On a thin page the site-wide `GlobalLayout` `min-h-screen` leaves DJ ground above the footer; the approved
  design lifted the footer. That layout is not S3's file.
- The local CI run is on b69f547 (per-job table in the PR body). The unit failures (15) are the same as main's in
  this sandbox. The 2 phone-suite failures passed when rerun alone.

## Stage 5: independent critique + one fix pass (2026-10-23)

Brief: `briefs/PEOPLE-S3-critique-brief.md` on `brief/people-arc` (sha 9919ea49). Fresh worker, not the builder.
Full ordered list with severities and verdicts: [`docs/design/people-s3-critique.md`](../../design/people-s3-critique.md).

### What changed

| Finding | Severity | Change |
|---|---|---|
| The world jumped down 58 px when the role tabs arrived (layout shift 0.033-0.054; 36 of 40 DJs hold 2+ roles) | should | `PersonFrame` takes an optional `rolesPending` (default false, so S2's call is unchanged) and keeps the 52 px tabs row while the roles read is out; `/djs/:id` passes `!person.answered`. No new read. After: 0 on every multi-role DJ walked. The 4 DJ-only people now see the kept row close (0.031-0.038) |
| The booking row jumped when the dates arrived (0.022-0.035) | should | the row waits for the dates read (shows on ready and on failed) |

Tests: `DJProfileWorlds.test.tsx` "no jump when the late reads answer" (4 roles states x the tabs row, 3 dates states x the
booking row). Red on the unfixed code (2 failures: the pending slot, the booking row while loading), green after.
Mutations: the count at 1 and the "DJ " prefix put back each turn the matrix red.

### Owner calls (not built)

1. Thin and past-only pages say nothing about dates. Recommend a muted line: "No dates on the calendar yet." above
   "Parties this week" (0 dates), "No dates coming up yet." on a past-only DJ. New copy, so yours to approve.
2. Thin page: ~430 px of DJ ground before the footer (`GlobalLayout` `min-h-screen`, site-wide). Recommend a
   later opt-out for the worlds.
3. "Parties this week" lands on `/parties` ("Find Your Next Party", a calendar). Recommend "Find a party".
4. No name at all (2 in prod): h1 "DJ", initial "D" (the D5 fallback).
5. The DJ-only trade in the shift fix (4 of 40 move up once). Removing it needs the roles in the first read.

### Seams (looked at every retaken shot, 390 and 360, plus papacito at 430)

Header (black 85%) to the DJ ground: no step, the site's gold rule between. Sleeve and section cards: a warm brown
edge on the ground, read as cards. Page to footer: dark to the amber footer, the same edge as every page and the
mock. Thin pages (brito, chino, carlos, bobby): the sleeve, then the action(s), then empty ground (owner call 2).
Focus ring: cream 2 px outline seen on the gig row and Back by keyboard.

### CI, every applicable job step, run locally on the fix commit

| Job (workflow) | Result |
|---|---|
| unit (unit-tests): ci-live-db-gate, test:unit:offline, test:unit, test:unit:timing, dancer-area-isolation (+self-test) | test:unit 15 failed / 12611 passed: the same 15 as main in this sandbox (3 live-DB contract files on the sandbox's non-prod key, `integrityCouldNotRun`); offline 5 (`integrityCouldNotRun` only). Every other step passes |
| typecheck: check:rpc-typing, check:wallclock-brand | pass. `npm run typecheck` 100 errors (baseline 106), none in touched files |
| guard (architecture-guard): integrity, legacy-tables, legacy-program-rpcs, lint:architecture, check:images AUDIT_STRICT=1 | pass (`bin/check-integrity.sh` is not executable in the sandbox, exit 126; `bash bin/check-integrity.sh` = ok, 0 issues; CI runs chmod first) |
| lint chain | 19 of 20 links pass; the 20th is the same integrity exit 126. eslint on the touched files: only the unchanged `setMounted` line |
| bundle (perf-budget): 3 self-tests, build, bundle-budget, first-load-requests, chunk-cycles | pass. lighthouse needs a preview |
| seo-check: self-test / check:seo | self-test pass / check:seo needs a live preview (0 pages fetched from the sandbox) |
| e2e (e2e-smoke): test:e2e | 154 passed, 4 failed (account-settings x2, magic-link returnTo, organiser header Sign in), 7 skipped; the 4 failed specs' files rerun alone: 22 passed, 0 failed |
| phone-qa: phone suite / build smoke | 271 passed, 1 failed (organiser contact sheet 360x640), rerun alone: 12 passed / build smoke 67 passed |
| workflow-lint | pass |

### Verified / Not verified (this pass)

- Verified: production build, prod data, flag ON, Chromium at 390x844 and 360x800 (9 DJs) and 430x932 (papacito):
  lowest contrast 5.91, every tap >= 44 px, no clipping, no sideways scroll, no page errors, tabs at y = 163; layout
  shift measured before and after; Back: fresh tab -> `/djs`, dancer page -> DJ -> Back -> the dancer page; the gig
  time 21:00 matches the event page's own start (9:00 PM).
- Not verified: real photos (image host blocked), the Vercel preview (no token here: needs owner), a real phone,
  the share sheet, flag OFF in a browser (unit-tested), the `/code-review` pass (the owner types it).

### PR body (ready to paste)

````markdown
## Summary
- **What changed:** with `flags.personWorlds` ON, `/djs/:id` renders `PersonFrame` (Back, Share top right, role tabs above the photo) and then the new DJ world (`src/modules/person-page/worlds/dj/`): the record sleeve (vinyl, DM Serif Display name, the real name small under it, a count only from 2), Upcoming rows, Played at records, a "Book <DJ>" row, and the D8 invite ("Dance bachata too? Get your own card", 44px, to the existing `/auth?mode=signup&returnTo=...` entry). The guestbook is gone. A DJ with no dates gets one "Parties this week" button.
- **Frame Back rule (D9):** history back when the previous page was on this site; a shared link or a new tab goes to `backHref`. Rule: `frame/backRule.ts`.
- **facts/:** `wallDayOf`, `gigDateLabel`, `dayNumber`, `timeLabel` ("19:30"), `monthLabel` ("October 2026"), reading the stored London wall clock.
- **Stage 5 critique + fix pass (fresh worker):** `PersonFrame` takes an optional `rolesPending` and keeps the tabs row while the roles read is out, so the world no longer jumps 58 px when the tabs arrive (36 of 40 DJs hold 2+ roles); the booking row waits for the dates read so it no longer jumps. No new read. Critique: `docs/design/people-s3-critique.md`.
- **Flag OFF:** today's page, unchanged (tested over every shape). `rolesPending` defaults to false, so S2's frame call is unchanged.
- Design record: `docs/design/people-s3-dj-world.md`. Handover: `docs/people-arc/s3/HANDOVER.md`.

## Owner calls (in the handover, not built)
1. A muted "No dates on the calendar yet." line on thin pages (and "No dates coming up yet." on past-only DJs).
2. Thin pages: ~430 px of DJ ground before the footer (site-wide `GlobalLayout` `min-h-screen`).
3. "Parties this week" lands on `/parties` (a calendar, "Find Your Next Party"): suggest "Find a party".
4. No name at all (2 in prod): h1 "DJ", initial "D".
5. DJ-only people (4 of 40) see the kept tabs row close once (58 px up) when the roles read answers.

## Scope
- [x] Only S3's files: `src/pages/DJProfile.tsx`, `person-page/frame/**`, `facts/**`, `worlds/dj/**`, tests and docs. No DB change.
- [x] Additive, backwards compatible frame/facts API.

## Privacy Gates (Hard Requirement)
- [x] The DJ world renders no `phone` or `whatsapp`. The booking row uses `listenLinks` only.

## CI (every applicable job step run locally on the critique fix commit)
| Job (workflow) | Result |
|---|---|
| unit (unit-tests): live-db gate, test:unit:offline, test:unit, test:unit:timing, dancer-area-isolation (+self-test) | test:unit 15 failed / 12611 passed, the same 15 as main in this sandbox (3 live-DB contract files on a non-prod key, `integrityCouldNotRun`); the rest pass. New tests pass, and were red on the unfixed code |
| typecheck: check:rpc-typing, check:wallclock-brand | pass (`tsc` 100 errors, baseline 106, none in touched files) |
| guard (architecture-guard): integrity, legacy-tables, legacy-program-rpcs, lint:architecture, check:images AUDIT_STRICT=1 | pass (integrity: exit 126 = not executable in the sandbox; `bash bin/check-integrity.sh` ok, 0 issues) |
| lint chain | 19 of 20 links pass, the 20th is that integrity exit 126; eslint on touched files: only the unchanged `setMounted` line |
| bundle (perf-budget): self-tests, build, bundle-budget, first-load-requests, chunk-cycles | pass; lighthouse needs a preview |
| seo-check | self-test pass; check:seo needs a live preview |
| e2e (e2e-smoke): test:e2e | 154 passed, 4 failed (auth/account/organiser specs), rerun alone: 22 passed, 0 failed |
| phone-qa: phone suite / build smoke | 271 passed, 1 failed (organiser contact sheet), rerun alone: 12 passed / 67 passed |
| workflow-lint | pass |

## Verified on real data
- Shapes surveyed: read-only on prod, counts only. 40 public DJs: 0 upcoming gigs for 23, 1 for 10, 2+ for 7 (max 4); 11 with played-at; 12 whose DJ name differs from the public name; 28 with no DJ name; 5 with a "DJ " prefix; 5 no photo; 5 no city; 2 no name at all. Roles: 36 hold 2+ roles, 4 are DJ-only.
- Checks run: a table-driven vitest matrix (6 prod shapes x flag ON, the same x flag OFF unchanged), the late-read matrix (4 roles states x the tabs row, 3 dates states x the booking row; red on the unfixed code), dates loading/failed/Try again, invite waiting on roles, gig time facts, the Back rule. Mutations (count at 1, "DJ " prefix back) turn the matrix red. A production build on prod data, flag ON, Chromium at 390x844 and 360x800 over 9 real DJs and 430x932 on papacito: lowest contrast 5.91, taps >= 44px, no clipping, no sideways scroll, no page errors, tabs at y=163; layout shift measured before/after (multi-role 0.033-0.054 + 0.022-0.035 -> 0.0003-0.0008). Back in Chromium: direct open -> /djs; dancer page -> DJ -> Back -> the dancer page. Gig time 21:00 matches the event page's start (9:00 PM).
- NOT verified: real photos (image host blocked, initials rendered), the Vercel preview (no token: needs owner), a real phone, the share sheet, the flag OFF page in a browser (unit-tested), the `/code-review` pass (the owner types it).

## Phone QA
- Sizes checked: 390x844, 360x800, 430x932 (production build, prod data, flag ON)
- Walked: 9 real DJs covering every surveyed shape (screenshots in `docs/people-arc/s3/shots/`), Back from a direct open and from the dancer page, gig row to the event page, keyboard focus ring
- Not verified: real photos, a real phone, the Vercel preview, the share sheet

## Preview
Needs `VITE_ENABLE_PERSON_WORLDS=true` on the Vercel Preview environment for branch `claude/people-dj-world`, then a redeploy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PbLkKWGt2Eeb35ACJbqzUd
````

## S3b: invite everywhere, one world shell, thin wording, short-page footer, serif (2026-10-23)

Brief: `briefs/PEOPLE-S3b-continuation-brief.md` on `brief/people-arc` (sha e3fbb034). Content commit: the
`feat(people): S3b ...` commit; head = `git log -1 origin/claude/people-dj-world` (this doc rides the last commit).
Design record + walk table: [`docs/design/people-s3-dj-world.md`](../../design/people-s3-dj-world.md#s3b-2026-10-23-invite-everywhere-one-world-shell-thin-wording-short-page-footer-serif).

### What changed

| Item | Change |
|---|---|
| (a) D8' invite | `djWorldView` always returns `invite` (type no longer nullable). The role condition and the `roles` / `rolesAnswered` inputs are gone from `DjWorldInput`: shown always, so it never appears late (no jump from the roles read). Matrix: every shape asserts it |
| (b) frame jump | NEW `frame/WorldPage.tsx`: `GlobalLayout` (no sub-header, the world's ground, `fitContent`) + `px-3 pb-6 pt-2` + `mx-auto w-full max-w-xl` + a slot. Every flag-ON DJ state uses it: loading, NEW flag-ON not-found box (`dj-world-missing`, "Back to DJs" 44 px), full. Padding pick: the compact DJ one (`px-3 pt-2`, density rule), width `max-w-xl` (576 px at 1280) |
| (c) D11/D12 thin | `emptyAction` = `{ note, label: 'Find a party', href: '/parties' }` whenever nothing is coming up: note "No dates on the calendar yet." (0 dates) / "No dates coming up yet." (past only). Rendered where Upcoming would be (above Played at), muted `card.muted` |
| (d) D13 footer | `GlobalLayout` `fitContent` (default false): drops `min-h-screen` AND releases `.route-shell`'s min height for that page only via an inline `.route-shell:has(> [data-fit-content]){min-height:0}` (in the served HTML, so no move on hydration). The second hold was found in the walk: dropping `min-h-screen` alone left 177-307 px. No world sets its own min height on the flag-ON path |
| (e) serif | `DjWorld` calls `useDjPageFonts()` itself, so any DJ preview that renders it gets DM Serif Display. The hook is ref-counted now: the link is removed when the LAST user unmounts (before: the first unmount removed it while another user was still on screen) |

Tests (red first, on e64b952: 18 failed): `DJProfileWorlds.test.tsx` (invite per shape, thin note + label per shape,
"one shell for every state" x 6 shapes + loading + not found: frame inside `world-page-slot`, identical classes,
no min height on any ancestor), `GlobalLayout.fitContent.test.tsx` (default keeps `min-h-screen`, no release),
`worldShellGuard.test.ts` (every file rendering `<PersonFrame` does so straight inside `<WorldPage`, no
padding / width / min-height between; canary), `djPageFonts.test.tsx` (one link, ref-count, DjWorld loads it).
Mutations, each turned a test red: invite made conditional (7), shell padding `px-4 pt-3` (8), past-only wording
(1), `fitContent` removed from the shell (8), font call removed (1), ref-count broken (1), a `px-4 pt-3` wrapper
put around PersonFrame in DJProfile (guard, 1).

### Shell API for S2 (dancer page)

```tsx
import { PersonFrame, WorldPage } from '@/modules/person-page/frame';

<WorldPage
  world="dancer"                                  // PersonRole: picks the ground ('dancer') and the ink
  breadcrumbs={buildBreadcrumbs('dancer.detail', { entityName, isLoading })}
  backHref="/dancers"
  head={jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}  // optional
>
  <PersonFrame backHref="/dancers" ... current="dancer">...</PersonFrame>   // or the loading / not-found box
</WorldPage>
```

S2 deletes: its own `<GlobalLayout ... gradientPalette="dancer">` wrapper, the `px-4 pt-3` (and any `pb-*`)
padding div, the `max-w-xl` div, and any `min-h-screen` / `HUB.groundMinHeight` on the flag-ON path. Its
loading and not-found states go in the same shell. `worldShellGuard.test.ts` fails if a world pads the frame
itself. `WORLD_PAGE` (the two class strings) is exported for tests. The teacher world has no ground yet
(`default` until S4 adds one to `pageGrounds.ts`).

### Frame box per shape (390x844 / 360x800, prod data)

Back L10 T113 and bar W 370 / 340 on papacito, jeff, brito, chong, carlos-de-la-cruz, dj-chino-bzuk26,
bobby-blanco (identical on every shape). 1280x800: Back L352 T68, bar 576. Content to footer: 54 px everywhere
(the site footer's own `mt-16`). Bar W = the Back/Share row's width (the brief's 361 / 354 were measured on
another box; the rule that matters, equal on every shape, holds).

### Not verified (S3b)

- The dancer page through the shell: S2's file, not on this branch. Only the DJ world is checked; the
  equal-box claim across worlds holds once S2 adopts `WorldPage`.
- Real photos (image host blocked), the Vercel preview (no token: needs owner), a real phone.
- The flag-OFF page in a browser (unit-tested; its code path is unchanged; `fitContent` defaults off).
- The `/code-review` pass (the owner types it).
- Prod shape counts were not re-run: the S3 survey from this morning (23 of 40 with no upcoming gig, 11 with
  played-at) stands; the thin wording was checked on brito / dj-chino (0 dates) and chong (past only).

### CI, every applicable job step, run locally on b570a69

| Job (workflow) | Result |
|---|---|
| unit (unit-tests): ci-live-db-gate, test:unit, dancer-area-isolation (+self-test) | test:unit 15 failed / 12627 passed: the same 15 as main in this sandbox (3 live-DB contract files on the sandbox's non-prod key, `integrityCouldNotRun`). The new tests pass and were red on e64b952 |
| typecheck: check:rpc-typing, check:wallclock-brand | pass. `npm run typecheck` 100 errors (= S3's count, baseline 106), none in touched files |
| guard (architecture-guard): integrity, legacy-tables, legacy-program-rpcs, lint:architecture, check:images AUDIT_STRICT=1 | pass (`bash bin/check-integrity.sh`; the file is not executable in the sandbox, CI runs chmod first) |
| lint chain | 19 of 20 links pass, the 20th is that integrity exit 126. eslint on touched files: only the unchanged `setMounted` line in DJProfile |
| bundle (perf-budget): 3 self-tests, build, bundle-budget, first-load-requests, chunk-cycles | pass. lighthouse needs a preview |
| check:doc-weight, seo-check check:seo | need a live preview (GITHUB_REPOSITORY / preview URL), not runnable here |
| e2e (e2e-smoke): test:e2e | 163 passed, 1 failed (organiser-profile "About saved"), 1 skipped; that spec rerun alone: 4 passed |
| phone-qa: phone suite | 272 passed, 0 failed, 74 skipped |
| workflow-lint: masking, notification (+self-test), no-preview-prefixes, docs-only self-test | pass |
