# People arc S6 -- dancer world without the socials filler (#1008): independent critique (Design Gate stage 5)

Brief: `briefs/PEOPLE-S6-critique-brief.md` on `brief/people-arc` (sha 3bee9ba3). Critic: a fresh worker, not the
builder. Judged on 2026-10-24 against the PR head 2b20832f built for production with `VITE_ENABLE_PERSON_WORLDS=true`
on prod data (anon key, public reads only), Chromium at 390x844 and 360x800; a second build with
`VITE_ENABLE_TEACHER_DETAIL=true` for the teacher world and teacher previews.

Visitor: a London dancer on a phone opening a dancer's page from a shared link. Owner: a beginner on a phone.

**Outcome: no code change in this pass.** Every blocker / should found sits either in the frame (S1/S3), in a
shared mapping that flag-OFF pages also render, or needs a new read -- all outside the S6 owner decisions, so they
go to the owner below with a recommendation. The PR's own code holds up on every check the brief lists.

## Ordered fix list

| # | Finding | Why it matters to the visitor | Severity | Verdict |
|---|---|---|---|---|
| 1 | **Dancer pages of DJ / teacher holders shift 0.13-0.16** (0.05 on `main` for undated DJs). Sources, `brito` at 390: `0.123` = the role-tab bar (52 px) arriving at ~1.7 s together with the 64 px reserve, pushing the card, the invite and the footer; then `0.037` = the reserve collapsing when the dates answer empty. Dated (`bobby-blanco`): `0.124` then `0.017` (the "Coming up" heading arrives with the preview). The reserve cannot be in the first paint: the roles are read client-side after mount, so it appears in the same frame as the tabs and then changes again. The DJ page (`/djs/bobby-blanco`) is 0.056, the teacher world 0.005 (it holds the tabs row). | Above Google's 0.1 "needs improvement" line on 40 of 174 dancer pages today (every DJ holder; 138 of 174 once teacher pages open). A thumb going for the invite can land on the footer. Before S6 the same tab push happened but the footer sat below the fold behind a week of socials, so it scored lower. | should | **owner call** (frame + a new read). Recommendation: dehydrate `get_public_person_roles_v1` in the `/dancers/:id` loader (one RPC the `/people/:id` loader already runs) so the tabs and the 64 px reserve are in the served HTML; then the only shift is reserve -> preview / nothing. Holding the tabs row client-side (`rolesPending`, as the teacher world does) is wrong today: it would move the jump onto the 134 of 174 pages that show no tabs. |
| 2 | **Reserve -> preview still moves 22-45 px**: the reserve is one 64 px row with no heading; the preview brings the 23 px "Coming up" heading (and a 2-line venue grows the row to 82 px). | A small second jump on the 17 DJ-dated pages. | nice | **owner call** (the 64 px rule is the owner's). Recommendation: keep; holding heading room too would make the 23 undated DJ holders' collapse bigger (they are the majority). |
| 3 | **"WEBSITE www.instagram.com/ben_bachatero/?hl=en"** on 4 of 12 walked shapes (`ben`, `alex-boneva`, `john-otaran`, `b`); at 360 it wraps inside the query string ("?/hl=en"). The label is the raw URL minus `https://`. | A newcomer sees a tracking parameter and an Instagram link called "Website". | nice | **owner call**: the label comes from `src/modules/dancer-app/public-page/model.ts` (line 277), which the flag-OFF page also renders, so changing it here would break "flag-OFF unchanged". Recommendation: a separate PR -- drop the query string from the label, and file an instagram.com website under Instagram. Pre-existing since S2, not caused by S6. |
| 4 | **Signed-in visitor on a dancer-only page with no contacts sees the card alone.** | The page ends at the card with nothing to do; reads as unfinished. | nice | **owner call** (owner D8'': invite hidden when signed in; builder flagged it too). Recommendation: keep; a signed-in dancer has their own card already, and adding copy is new content. |
| 5 | **GlobalLayout blast radius.** The `<style>` is now raw HTML. It renders only when `fitContent` is true; the only caller passing `fitContent` is `frame/WorldPage.tsx` (grep: `src/modules/person-page/frame/WorldPage.tsx:48`), and `WorldPage` is rendered only by the flag-ON branches of `DancerProfile`, `DJProfile` and `TeacherProfile` (`flags.personWorlds && !embedded`). Every other page takes the `fitContent=false` path, which this diff does not touch (test: "default: min-h-screen, no style"). The new `renderToString` test fails against `main`'s `GlobalLayout.tsx` (re-run here: 1 failed / 3 passed) and passes on the PR. The string is a module constant, no input reaches it. | It can change the layout of no page other than the three flag-ON world pages, and there only by making the served rule valid (the footer no longer jumps on hydration). | -- | **not a bug**; stays in this PR (no other page can change). |
| 6 | **Prod-shape claim.** Re-measured with the anon key (`dancer_profiles` visible to anon, then `get_public_person_roles_v1` and `get_profile_event_timeline_v2` per row, 0 RPC errors): 174 live rows, dancer-only **36**; teacher 98 (35 dated, 16 past, 47 none); DJ 14 (5 dated, 2 past, 7 none); teacher + DJ 26 (teacher 12 dated / 4 past / 10 none; DJ 12 dated / 4 past / 10 none). Dancer-only by photo/city: 26 photo+city, 4 no photo+city, 1 photo+no city, 5 neither. | The builder's numbers are right, to the row; the brief's "159 of 189" does not reproduce from the roles RPC (189 is not the anon-visible row count; 159 matches no slice). With teacher pages closed, `snapshot.roles` drops teacher, so 134 of 174 pages behave as dancer-only today and reserve nothing; 40 (the DJ holders) reserve one row. The reserve follows `snapshot.roles` (the roles that can produce a preview), which is the right input. | -- | **not a bug**. |
| 7 | **Frame boxes.** Measured on `/dancers/*`, `/djs/bobby-blanco`, `/teachers/alex-boneva` (teacher-open build): 390 -- Back L10 T113 63x44, Share L310 T113 70x44, tabs L10 T163 370x52, frame W370; 360 -- Share L280, tabs/frame W340. Identical on all three worlds. The brief's numbers (60x44, L298, T166 H44, W354) are the same stale set the S4 critique already traced to another measure. | Tabs and Back in the same place on every world. | -- | **not a bug**. Mutation: wrapping the dancer world's `PersonFrame` in `<div className="px-1 pt-1">` turned `worldShellGuard.test.ts` red (1 failed / 4 passed); restored. |
| 8 | **Negative checks.** "Socials in" / "this week" / "All socials" (and "Find a party") on 0 of 24 renders (walk `filler=false`); `getCalendarEvents` is mocked and call-counted in the matrix and asserted never called (signed out and signed in); every deleted symbol (`socialsThisWeek`, `CalendarLike`, `SocialRow`, `SocialsDay`, `SOCIALS_MAX`, `SOCIALS_COPY`, `ALL_SOCIALS_HREF`, `DEFAULT_CITY`, `PARTY_ACTION`, `SocialsState`, `SkeletonWeek`, `PillLink`) has 0 hits in `src app scripts e2e`; `dancer-world-socials` survives only as a negative assertion in the matrix. The DJ world (`worlds/dj/`, `pages/DJProfile.tsx`) has no diff; its "Find a party" is untouched. | -- | -- | **not a bug**. |
| 9 | **Signed-in view** cannot be walked (no test account). The matrix covers it: "signed in / every lower half: no invite, still no filler, no calendar read", and the D8'' rows (signed in, auth resolving). | -- | -- | **not walked**; matrix only (said, not claimed). |
| 10 | **Stuck reserve.** A failed date read counts as settled (retry 1 in the app's QueryClient, so ~1 s more pulse at most); a paused one (`fetchStatus: 'paused'`) too; teacher pages closed = no teacher role in `snapshot.roles` = no teacher read wanted. Matrix rows exist for each. | -- | -- | **not a bug**. |

## What the eye hits, every shot (retaken this pass, `docs/people-arc/s6/shots`, 12 shapes x 2 widths)

- **Thin page (`aitor-angelica-tbf`)**: Back/Share, the teal card ("Aitor & Angelica", Madrid), the Instagram row,
  the invite, ~75 px of ground, the footer. Reads as a short finished page, not a broken one: the invite's button
  is the last thing and the gap below matches the page's bottom padding on every world.
- **Dancer-only x3 (`ben`, `pao-pao-army`, `florian`)**: name first (initials ring, 28 px name), then the invite.
  No heading without an item, no empty box. `ben` shows the item-3 website row.
- **Teacher holders (teacher pages closed: `alex-boneva`, `alexa-bzuk26`)**: same as dancer-only -- no tabs, no
  preview (correct: the teacher page is closed, a preview would link to a 404).
- **DJ holders (`bobby-blanco`, `brito`, `kal`, `b`, `john-otaran`, `nickchata`)**: the DJ / Dancer tabs, the card,
  then "Coming up" + one gold-chip DJ row ("Next gig Saturday 7 November", full weekday) where dated, else straight
  to the invite.
- **Seams**: header (black, gold rule) -> dark teal ground: clean. Teal card on the ground: reads as a card (lighter
  gradient + border). DJ preview row (brown) on the teal ground: the DJ world's own colour, intended, bordered.
  Page -> amber footer: the same hard edge as every page. No seam inside the lower half (no empty section box).
- **Copy**: "Back", "Share", "Coming up", "Next gig Saturday 7 November", "Dance bachata too?", "Get your own card".
  Nothing points at a control that is not on screen.
- **Taps**: 0 under 44 px on 24 renders (invite 44 px explicit, preview 64 px, tabs 52). **Contrast**: lowest 5.06
  (the "DANCER" kicker on the card) on every render. **Focus ring**: `FOCUS_RING` 2 px `#FBEBDD` outline on the
  invite button, the preview rows, Back/Share (shared token, unchanged): 15.34 on the dancer ground `#061A1F`, 12.19 on the invite section `#0D2F37`.
- No clipping, no sideways scroll at 360.

## Shift numbers (this pass, same build and script as the builder's)

| Page | 390 | 360 | Make-up |
|---|---|---|---|
| dancer-only (`ben`, `pao-pao-army`, `florian`), teacher holders (closed) | 0 | 0 | nothing reserved, nothing arrives |
| DJ undated / past (`brito`, `kal`) | 0.161 | 0.164 | tabs + reserve appear 0.123, reserve collapses 0.037 |
| DJ dated (`bobby-blanco`, `nickchata`) | 0.141 | 0.143 | tabs + reserve 0.124, preview heading 0.017 |
| teacher + DJ dated (`b`) | 0.128 | 0.132 | tabs 0.123, heading 0.005 |
| teacher + DJ undated (`john-otaran`) | 0.153 | 0.155 | tabs 0.123, collapse 0.030 |
| teacher-open build: `alex-boneva` dated / `b` / `john-otaran` | 0.139 / 0.150 / 0.153 | 0.143 / 0.156 / 0.155 | tabs 0.123-0.127 + reserve settling |
| `/djs/bobby-blanco` (reference) | 0.056 | 0.057 | DJ world's own |
| `/teachers/alex-boneva` (reference, teacher-open) | 0.005 | 0.005 | holds the tabs row |

The walk's numbers match the builder's `checks-after.json` exactly on all 24 renders.

## Checks run

`npm run build` (flag ON, twice: teacher closed / open); `AUDIT_STRICT=1 npm run check:images` (0 missing);
`npm run check:mojibake`; `npm run check:dancer-area-isolation`; `npm run typecheck` (94, baseline 106, same count
on the PR head with and without this pass); `npm run test:unit` (15 failed, all in `tests/eventViewCompat`,
`occurrenceProgram`, `publicEventPageLineup` contract tests against the sandbox's non-prod Supabase and
`integrityCouldNotRun` fixtures -- the same 15 the builder saw, none in a file this PR touches); `npm run lint`
(21 of 22 links green; `check:integrity` exits 126 only because `bin/check-integrity.sh` is mode 644 in the repo --
`bash bin/check-integrity.sh` = ok, 0 issues); `npm run test:e2e` (see the handover). `check:doc-weight` needs a
Vercel preview and `GITHUB_REPOSITORY`: CI only.
