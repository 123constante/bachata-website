# W1 people surfaces: independent review (PR #893)

Reviewed `origin/claude/w1-people-surfaces` at `1f00b24` against `origin/main`. The diff is `origin/main...HEAD`, base `0ab0ff9`, 90 files. The reviewer is not one of its authors. No product code was changed. Brief: `briefs/W1-review-brief.md` @ `82558ae`.

Labels used below:
- Severity: **BLOCKING**, **SHOULD**, **NIT**.
- **CONFIRMED** means reproduced by a test, a scratch script, a mutant, a read-only prod SELECT, or an unambiguous code read (marked "code").
- **PLAUSIBLE** means not reproduced.

## Verdict

**Not ready.** There is one BLOCKING defect: `/dancers` tells visitors there are no dancers whenever the badges read fails. There are several SHOULDs. The headline one is that the search overlay and the `/search` page now disagree about the same person.

The mapping itself (`badges.ts`) is sound. Prod data shows no dead-end hrefs, and the badges RPC exposes nothing private. Unit-test failures and the build are identical to `origin/main`.

## Suite and build (run once on this branch, and once on an `origin/main` worktree)

| | branch | origin/main |
|---|---|---|
| `npx vitest run` | 15 failed / 10357 passed / 29 skipped (450 files) | 15 failed / 10226 passed / 29 skipped (447 files) |
| failing files | eventViewCompat.contract, occurrenceProgram.contract, publicEventPageLineup.contract (live DB), integrityCouldNotRun (sandbox env) | **the same 15 tests**, diffed by name |
| `npm run build` | exit 0 | exit 0 |

None of the failures come from W1.

Running the suite rewrites 11 tracked `.snap` files with CRLF-only noise (`git diff --ignore-cr-at-eol` is empty). That happens on both trees, and the files were restored.

## 1. Correctness and regressions

| # | Sev | Verdict | Where | Failure scenario |
|---|---|---|---|---|
| C1 | BLOCKING | CONFIRMED (scratch jsdom test + code) | `src/pages/Dancers.tsx:77,318-325`, `src/components/dancers/dancerListModel.ts:9` | If `get_public_people_badges_v1` errors or times out, `badgesLoading` turns false and `badges` stays empty. `onlyDancers` then returns `[]`, so the page states "No dancers yet. Be the first to join!", which is false. Scratch run: `EMPTY_STATE_SHOWN=true TILES=0`. There is no retry UI, and the page stays wrong until a refetch. |
| C2 | SHOULD | CONFIRMED (scratch test) | `src/components/layout/GlobalLayout.tsx:181-194` vs `:203` | The `<html>`/`<body>` paint effect runs before the `if (embedded) return` early exit. On `/people/:id` (a live route, `app/routes.ts:24`), an embedded Dancer tab or DJ tab repaints the document under the person page's graphite wash. Switching from the Dancer tab to the DJ tab leaves the body at `#0A080B` under a graphite page. |
| C3 | SHOULD | CONFIRMED (code) | `src/pages/DJProfile.tsx:225` | `showSubheader={false}` removes `PageBreadcrumb`, which is the only place the BreadcrumbList JSON-LD is rendered (`src/components/PageBreadcrumb.tsx`). `app/routes/djs.tsx` does not emit it, so `/djs/:id` lost its structured-data breadcrumbs. |
| C4 | SHOULD | CONFIRMED (code) | `src/pages/DJProfile.tsx:77-99` (DjShare) | When the outcome is `manual`, it shows "Copy this link to share the page:" but never renders the URL. That is copy pointing at something not on screen (CLAUDE.md DoD rule 2). The dancer Share renders the URL in the same case. |
| C5 | SHOULD | CONFIRMED (scratch test) | `src/components/dj/djContacts.ts:6` | A bare `www.instagram.com` (the case this was written for) becomes an "Instagram" button that opens Instagram's home page. `/explore/...` and `/p/...` links get the same treatment. Each is a link to no person: a dead end in spirit. Matching is otherwise right: http/https/none, query strings, case, and `instagram.com.evil.com` rejected. NITs: `m.instagram.com` and `instagr.am` are not recognised. When `instagram` is already set and the website is a different Instagram URL, the website is dropped silently. |
| C6 | SHOULD | CONFIRMED (mutant M5 below + code) | `src/modules/event-page/bento/blocks/ScheduleBlock.tsx:1096-1100` | If the badges read errors, every DJ/dancer chip in the programme loses its link (no badge = no link). While loading, the chip for a dancer who is also a DJ links `/dancers/` and then flips to `/djs/`. |
| C7 | NIT | CONFIRMED (code) | `src/modules/event-page/bento/blocks/schedule/PersonChip.tsx` | `emitProfileView` still sends `profileType:'teacher'` when the chip now goes to `/djs/`. Telemetry no longer matches the destination. |
| C8 | NIT | PLAUSIBLE | `src/pages/DJProfile.tsx:186,202` | The loading and error states keep `showGradientBg={false}`, so the near-black ground arrives only with the data (a flash of `#000`). |
| C9 | NIT | CONFIRMED (code) | `PublicDancerPageV2.tsx:143`, `page.test.tsx:166` | The `extrasOk` prop is now dead, and the test "extras read failed" passes whatever the code does. |
| C10 | NIT | PLAUSIBLE | `PublicDancerPageV2` `showRoleLabel` | The DANCER label shows while the badge is unknown, then disappears for a non-dancer: a small layout shift after hydration. |

Checked and fine:
- Route changes between palettes (dancer → dj → bento → default → unmount) restore the ground correctly. CONFIRMED by scratch test. React runs the old tree's cleanup before the new mount, and no AnimatePresence keeps two layouts alive.
- `/djs` order: upcoming first by `next_gig_date` ascending, then the rest in RPC order.
- Chunking over 300 ids.
- Also bar: null when there is no badge, an error, the page is embedded, or there is no id.

## 2. ONE mapping and same-person consistency

| # | Sev | Verdict | Where | Problem |
|---|---|---|---|---|
| M1 | SHOULD | CONFIRMED (code) | `src/lib/searchRpc.ts:202-212` (`mapPersonV7`, the header overlay) vs `src/pages/SearchResults.tsx:118-128` (`PersonRow`) | The same person gets a different link and different tags. The overlay goes to `/people/:id` and hides Teacher while the flag is off. The `/search` page goes to `/djs/`/`/dancers/` and shows Teacher as plain text. Only `PersonRow` reads `badges.ts`. |
| M2 | SHOULD | CONFIRMED (code) | `src/pages/OrganiserProfile.tsx:395-396` | The team strip leads with the stage name (`nameFor('dj')`) for any member holding the DJ role. A team strip is not a DJ thing, so this breaks "stage name leads on DJ things only". `/search` shows the same person under their real name. For "DJ ..." names, the strip then reads `DJ El Rugido` + `DJ · DJ El Rugido`. |
| M3 | SHOULD | PLAUSIBLE | `src/pages/SearchResults.tsx` `PersonRow` | Tags come from the search payload's `p.roles`, while the link comes from the badge. Every other W1 surface takes roles from the badge, so a stale search index can disagree with `/dancers` and the strip. |
| M4 | NIT | CONFIRMED (code) | `Dancers.tsx:339`, `DJs.tsx:103` | Hand-written `/dancers/` and `/djs/` fallbacks after `hrefForRole`. This is dead code, because the function never returns null for those roles, but it is a second copy. |
| M5 | NIT | CONFIRMED (code) | `src/modules/event-page/bento/blocks/schedule/EventScheduleGrid.tsx:180-194` | The chip's role text still comes from a local `roleLabel`/`hrefFor` here, not from `roleTagsFor`. |
| M6 | NIT | PLAUSIBLE | `DJProfile.tsx` h1 | The h1 uses `resolvePublicName` (`display_name` first), not `nameFor('dj')`. It matches the list and chips only because `get_public_dj_v1` builds `display_name` from `dj_name` today. Similarly, `djListModel.ts:39` vs `:46` takes the chip's name from the badge and the tile's name from the row. |
| M7 | SHOULD (a11y) | CONFIRMED (snapshot) | `/dancers` tile | The accessible name is "Ana Lopez TeacherDJ": tags are joined without a separator. |

Unchanged and pre-existing, noted only: with v7 OFF, the v6 `/search` Teachers section (`SearchResults.tsx:392`, `hrefFor('teacher')`) still links `/teachers/` (the coming-soon gate).

## 3. Dead ends (prod, read-only SELECT, 2026-10-21)

All 180 `dancer_profiles` with `is_active` not false went through `get_public_people_badges_v1`:

| shape | count |
|---|---|
| badge rows returned (16 archived ids are absent) | 164 |
| DJ role | 40, of which **0** have `get_public_dj_v1` = null |
| Dancer role | 92, of which **0** lack a `/dancers/:id` row |
| empty role list | 5 (no link, no tags) |
| teacher-only | 62 (no link while the flag is off) |
| `dj_name` starting "DJ " | 5 |

For `list_public_djs_v1`:
- 40 DJs, all with a badge, and all holding the DJ role.
- 0 without a DJ page.
- 17 upcoming.
- 0 cases where `next_gig_date` differs between the list and the badge.

**No href that `linkFor`/`hrefForRole` produces dead-ends on today's data.**

Side effect, an improvement: the `/dancers` list query does not filter `archived_at`. The 16 archived rows have no badge, so W1 now hides them from the list.

`/people/:id` IS a route (`app/routes.ts:24`). So the S3 claim "no route", and the reason given for rewriting `tests/searchV7People.test.tsx`, is false. The overlay links are not dead ends; the problem is M1.

Not checked on data: programme people on event lineups whose id has no `dancer_profiles` row. After load those chips lose their link (C6 path). Count them with a SELECT over programme person ids before the fix pass.

## 4. Privacy

`get_public_people_badges_v1` (SECURITY DEFINER, `search_path ''`) returns `id`, `roles` (from `get_public_person_roles_v1`), `dj_name` (only when the person is a DJ), `dj_has_upcoming` and `next_gig_date`. It skips inactive and archived profiles. **Nothing private is exposed.**

No surface newly renders email, phone or WhatsApp. The phone and WhatsApp links on the DJ panel predate W1. `djContacts` only relabels the existing website value.

## 5. Performance

- **RPC count:** one badges call per surface.
  - Event page: ScheduleBlock.
  - `/dancers`: one chunk of about 180 ids.
  - `/djs`: one call.
  - Organiser page: the team.
  - `/search`: one call per result set.
  - `/dancers/:id`: `AlsoRoles` and `DancerProfile` both call `usePeopleBadges([id])` with the same key, so React Query sends ONE request.
- **Cache key:** the sorted id set, so different surfaces share nothing unless their sets are identical.
- **RPC cost** (`EXPLAIN ANALYZE`, prod): 768 ms and 122k buffer hits for 180 ids, against 5 ms for 1 id. The cost is linear, driven by a per-id `get_public_person_roles_v1` + `_dj_next_gig_date_v1`.
- **`/dancers` waterfall:** three serial reads (`dancer_profiles` → `withPublicNames` → badges, about 0.8 s server-side). The page shows a spinner until the badges answer. It still downloads every profile, including the 62 teacher-only and 5 empty-role rows, and filters on the client.
- **Other waterfalls:** the event page waits on the programme read, which is inherent. The role pages run the badge read in parallel with the profile read, so no new waterfall.
- **Bundle:** the S3 handover says `/event` first load now includes `badges.ts` + `searchEntities.ts`. `check:bundle-budget` passed per S3, and was not re-run here. `npm run build` exit 0.

## 6. Flags: what a visitor sees on prod today

Prod env values **could not be read**: `api.vercel.com` and `www.bachatacalendar.co.uk` are both refused by this sandbox's egress proxy (`VERCEL_TOKEN` is set, but the connection is rejected). **Needs owner:** Vercel → Project → Settings → Environment Variables (Production), or `vercel env ls production`.

The repo ships no `.env.production`, and every `VITE_ENABLE_*` in `.env.example` is blank, so the code reads each one as **false** unless Vercel sets it. On that default:

| surface | gate | visible on prod by default |
|---|---|---|
| `/dancers` list (dancer-only, labels, mojibake fix) | none | **yes** |
| `/djs` list (upcoming first, Playing soon) | none | **yes** |
| `/dancers/:id`, `/djs/:id` (grounds, Also bar, songs, Share row) | none | **yes** |
| graphite default ground (every `default`-palette page) | none | **yes** |
| event lineup chips (ScheduleBlock / PersonChip) | none | **yes** |
| organiser team strip | `VITE_ENABLE_ORGANISER_DETAIL` | only if set |
| `/search` PersonRow | `VITE_ENABLE_SEARCH_V7` | only if set; flag comment says OFF until `/people/:id` ships |
| header overlay person rows | v7 + v5 | only if set |
| `/teachers/:id` Also bar, Teacher links | `VITE_ENABLE_TEACHER_DETAIL` | only if set (owner: OFF) |

## 7. Verdicts on the authors' open points

- **a. DJ hero vinyl label "clipped": disagree with the diagnosis.**
  - The disc is a fixed 188 px at every width, and `inset:32%` gives a label about 68 px across. Two initials at 17 px with `.12em` spacing are about 34 px by 20 px, inside the 34 px radius.
  - What makes the letters look cut is the 9 px dark spindle dot (`DjTiles.tsx:176-189`) drawn over their centre, while the whole label spins.
  - Fix: drop the spindle when initials show, or offset the initials, and stop the label text spinning.
  - PLAUSIBLE: code math only, no new shot.
- **b. "DJ · DJ El Rugido": disagree with keeping it.** Choice A says the DJ *label* always shows. A label that repeats the word is noise and does not satisfy A any better. Strip a leading `DJ ` (case-insensitive) from `djName` inside the `roleTagsFor` label only (`badges.ts:101`). The label stays "DJ · El Rugido", and the `/djs` tile name keeps the full stage name. 5 prod people are affected. **Owner to confirm** (orchestrator read it differently).
- **c. Header overlay: agree it must change, but the premise is wrong.** `/people/:id` exists (`app/routes.ts:24`), so these links are not dead ends. The defect is M1: two rules for one person. The fix is to make `mapPersonV7` use `linkFor` + `roleTagsFor`, since the owner decision is separate role pages. It is flag-gated (v7), so it is not prod-visible by default.
- **d. Team strip lost "Founder": disagree as shipped.**
  - The title is organiser-authored, real information. Only the old `|| 'Team'` fallback was a default shown as fact.
  - Show the custom title when one is set, alongside the badge tags.
  - **Owner to confirm.**
- **e. `/djs` tiles lost genre chips: acceptable, but it is the authors' call, not the owner's.** Three columns plus the 26 px label row leave no room, but genre was the only style signal on the tile. **Owner to confirm**, or move genre onto the DJ page only (it is already there).
- **f. Chi-Wei, start year = this year hidden: partly disagree.**
  - Prod `dancing_role_details`: all 120 never-edited rows store **null**, so the database does not default the year. Only 2 rows hold 2026, both edited, so they may be genuine newcomers.
  - `years > 0` therefore hides real answers. Keep null hidden, and show a current-year value as "New this year" (or "Since 2026").
  - If the editor pre-fills the year picker, fix that at the source.
- **g. Conflict with PR #850: agree it conflicts, but W1 is not the cause.** `git merge-tree` of W1 vs `claude/search-v7-web` conflicts in 5 files:
  - `docs/handover/search-v7-web.md`
  - `src/lib/searchEntities.ts`
  - `src/lib/searchRpc.ts`
  - `src/pages/SearchResults.tsx`
  - `tests/searchV7People.test.tsx`

  #850 against `origin/main` alone gives the **same 5**: #850 is stale against main, and W1 adds no new conflicted file. Rebase or close #850 first. Then the `SearchResults.tsx` people block from W1 wins.
- **h. S4 never measured the footer strip or icon-over-text: agree it is unmeasured, and the code-level risk is low.**
  - The footer is `relative mt-16 bg-primary`, and the fixed wash covers its margin.
  - After a client navigation, framer-motion leaves an inline `transform`/`filter` on `.route-shell`, which makes the fixed wash local. The body paint covers exactly that case.
  - A band can still appear on pages that skip the ground (`showGradientBg={false}`, see C8) or on the bento palette (no body paint).
  - Needs one 390 px footer shot on a default page after a client nav, plus one on `/event`, on a real deploy preview.

## 8. Do the tests bite? (each mutant run on its own file, then reverted)

| slice | mutant | test | result |
|---|---|---|---|
| S0 | (authors' M1-M3, not re-run) | badges.test.ts | RED per handover |
| S1 | drop the sort inside `sortDjsUpcomingFirst` | djListModel.test.ts | RED |
| S1 | `DJs.tsx:87` render `djs` instead of `sorted` | djListModel.test.ts | **GREEN**: page order unguarded |
| S1 | `/dancers` skips the dancer-only filter | directoryAttendance.today | RED (4) |
| S2 | AlsoRoles passes `teacherPagesOpen={true}` | embedded.test.tsx | RED (3); alsoBar.test GREEN (it tests the pure bar, as expected) |
| S2 | songs shown when empty | page.test.tsx | RED |
| S2 | facts `years >= 0` | model.test.ts | RED |
| S3 | ScheduleBlock keeps the feed's `/teachers/` link while loading | w1S3Strips.test.tsx | RED (1) |
| S3 | ScheduleBlock ignores badges (`people: s.people`) | w1S3Strips + 10 event-page block files | **GREEN 133/133**: the `/teachers/` fix is unguarded at component level |
| S3 | TeamCircle back to `/dancers/:dancerId` | w1S3Strips.test.tsx | RED (12) |
| S4 | floating icons back on default | GlobalLayout.grounds.test.tsx | RED |
| S4 | default base `#000000` | GlobalLayout.grounds.test.tsx | RED |

Gaps in what the tests check:
- `w1S3Strips` computes its expected values with the same `roleTagsFor`/`linkFor` it is checking. It tests wiring, not the rules.
- Nothing covers C2 (embedded paint) or C1 (error state).

Were the old fixtures and snapshots changed for a right reason?
- **embedded.test.tsx / alsoRolesBox.test.tsx / page.test.tsx:** yes. The hrefs moved to the role pages, the "Also:" prefix was dropped by design, and the "No public contacts yet" line was removed (thin page).
- **directoryAttendance.today snapshot:** mostly yes ("??" gone, tiles are now links with labels), but partly rubber-stamped:
  - The fixture made `d4` (the nameless person rendered as "Dancer") teacher-only, so the nameless-name shape is no longer exercised on `/dancers`.
  - The lost Follower/Leader and style chips were accepted silently.
  - `h.badges` is not declared in the `vi.hoisted` object.
- **tests/searchV7People.test.tsx:** it reverses the earlier reviewed contract (F1/F2) on a false premise ("/people has no route"). The Teacher-as-plain-text half matches the owner rule. The link half is the M1 decision.

## For the fix pass (ranked; execute top-down)

1. **BLOCKING, C1.** `src/pages/Dancers.tsx`:
   - Read `isError` from `usePeopleBadges`. Add `isError` to its return in `badges.ts`, as an additive field.
   - On error, render the unfiltered list without labels, or an error line with a retry. Never "No dancers yet".
   - Add a test: badges RPC error → tiles render and no empty state. Run it RED on the current code first.
2. **SHOULD, M1 + 7c.** In `src/lib/searchRpc.ts` `mapPersonV7` (the overlay), take the href from `linkFor` and the role line from `roleTagsFor` (Teacher plain while closed). This makes the overlay and `/search` agree. Add one table test over the 8 S0 shapes covering both surfaces.
3. **SHOULD, C2.** `GlobalLayout.tsx:181`: `const groundBase = !embedded && showGradientBg && ground ? ground.base : null;`. Add a case to `GlobalLayout.grounds.test.tsx` that renders inside the embedded provider and expects the body untouched.
4. **SHOULD, M2.** `OrganiserProfile.tsx:395`: use `nameFor('other', ...)` for the team-strip name, so the stage name appears in the DJ tag only. Update `w1S3Strips.test.tsx`.
5. **SHOULD, 7b (pending owner confirmation).** `badges.ts` `roleTagsFor`: strip a leading `/^dj\s+/i` from `djName` in the label. Add an S0 table row with "DJ El Rugido" → "DJ · El Rugido".
6. **SHOULD, C3.** `DJProfile.tsx`: with the subheader hidden, render `renderBreadcrumbListJsonLd(djBreadcrumbs)` (from `src/lib/breadcrumbs/jsonLd.ts`) directly. Test that the JSON-LD script is present on `/djs/:id`.
7. **SHOULD, C4.** `DJProfile.tsx` DjShare: when the outcome is `manual`, render the page URL as selectable text, the same as the dancer Share.
8. **SHOULD, C5.** `djContacts.ts`: treat a website as Instagram only when it carries a handle segment that is not `explore|p|reel|stories`. Otherwise drop the link. Add `m.instagram.com`. Extend the `splitInstagramWebsite` table.
9. **SHOULD, C6 + mutant gap.** ScheduleBlock: on badges error, keep the feed's own DJ/dancer link (never a `/teachers/` link). Add a component-level test that renders ScheduleBlock with a teacher in the programme and expects no `/teachers/` href. It must go RED with `people: s.people`.
10. **SHOULD, M7.** Separate the tile tags in the accessible name, e.g. a visually hidden ", " between tags or an `aria-label` "Name, Teacher, DJ".
11. **SHOULD, 7f (pending owner confirmation).** `model.ts` facts: show a current-year start as "New this year" instead of hiding it. Keep null hidden.
12. **SHOULD, 7d (pending owner confirmation).** Team strip: show the organiser-authored title when set (no `'Team'` default), next to the tags.
13. **NIT.** Add a `/djs` page-level order test (mutant `sorted` → `djs` must go RED).
14. **NIT.** Remove the dead hand-written hrefs at `Dancers.tsx:339` and `DJs.tsx:103`.
15. **NIT.** Make `EventScheduleGrid.tsx:180-194` read its role text from `ROLE_LABEL` via `roleTagsFor`.
16. **NIT.** Fix C7 (telemetry `profileType` follows the link's role) and C8 (paint the ground on DJ loading and error states).
17. **NIT.** Remove the dead `extrasOk` prop and its no-op test (C9).
18. **NIT.** Restore a nameless-person row with the Dancer role in the `directoryAttendance` fixture.
19. **NIT.** DJ hero (7a): hide the spindle dot when initials are shown.
20. **Process.** Before "ready":
    - Browser walk at 390x844 on a deploy preview: footer strip after a client nav on a default page and on `/event` (7h), plus `/dancers` with the badges RPC blocked (C1).
    - Count lineup person ids without a `dancer_profiles` row (section 3).
    - Read the prod flag values in Vercel (section 6).
    - Rebase or close #850 before merging (7g).

## Verified / Not verified (this review)

**Verified:**
- Full unit suite and build on the branch and on `origin/main` (identical failures).
- Read-only prod SELECTs: the RPC definition, dead-end counts, list-vs-badge agreement, and RPC timing.
- 12 mutants (RED/GREEN above).
- Scratch reproductions of C1, C2 and C5.
- `git merge-tree` against #850.

**Not verified:**
- Prod flag values (proxy blocks Vercel and the site).
- No browser walk or screenshots.
- No real phone.
- `check:bundle-budget` and the lint chain were not re-run.
- GitHub Actions on #893 were not read (no `gh`).
- Lineup ids without a profile row were not counted.
- 7a is code math only.
