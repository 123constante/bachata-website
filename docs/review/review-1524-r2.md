# Review 1524-r2: Website PR #1524 fix round, PUBLIC_LINK_REL on teacher / DJ / dancer user links (J12.8)

Reviewer: review-1524-r2 (independent delta re-review, read-only on the PR branch). Reviewed at head
`cf9d24d55fc96c4a59d84436c9fc8fb37aa25740` of `claude/welcome-w1-link-rel`, base `main` at
`17bd32185a3c90f6965661fa80fb46292d2fb1c4`. First review: `docs/review/review-1524-r1.md`
(branch `claude/review-1524-r1`, PASS-with-fixes at `f8e330b70`). Fix brief:
`docs/briefs/welcome-w1-link-rel-fix.md` (brief-version 2). Fresh `npm ci --ignore-scripts` in this
worker's own clone, PR head checked out detached.

## Verdict: PASS

The fix round does exactly what r1 asked and nothing else. The delta `f8e330b70..cf9d24d55` is five
files, +38 / -7: one rel attribute (F1), one test row (F1), two one-line comments (N1), and the
handover doc (F3). The PR body is filled (F2) and its prod counts match this reviewer's own read-only
recount to the row. The F1 line was verified at the code, reverted, and the test went red. Seven of
eight mutants are killed; the one survivor is the trust-by-inclusion class r1 already recorded as
N2 (an exception row re-added together with the old rel), not a regression of this round. Three new
nits below, none blocking, none needing another round.

## F1 to N1 status

| Item | r1 asked | At `cf9d24d55` | Status |
|---|---|---|---|
| F1 | `DjRolePage.tsx:76` no-dates anchor takes `PUBLIC_LINK_REL`; test row `userLinks: 3, exceptions: []`; prove red first | Line 76 is `rel={PUBLIC_LINK_REL}` on the only branch that renders an `<a>` (`e.action.external`, which `noDates()` in `djRoleModel.ts:99-103` sets only when the href is the DJ's Instagram; the `/` branch is still a `<Link>`). Test row is `{ file: 'src/components/dj/DjRolePage.tsx', userLinks: 3, exceptions: [] }`; the old exception row is gone. Reverting line 76 alone to `rel="noopener noreferrer"` makes the DjRolePage row fail (M1, 1 failed / 9 passed) | fixed |
| F2 | PR body: no bot stub lines left, changed/left table, per-job CI table, Verified on real data with read-only counts, Not verified | Body read via the GitHub API at this head: zero stub lines left; changed/left table covers all 27 anchors in the brief list (main line numbers) plus the F1 line; CI per-job table present (for head `47bc178`, see N5); "Verified on real data" has counts that match this review's recount exactly (table below); "NOT verified" names the preview DOM check, `pre-ship` end to end and the parked dancer-app page | fixed |
| F3 | Fill or drop the 3-line placeholder handover | `docs/handover-welcome-w1-link-rel.md` is now 36 lines: Done / Not verified / Left / fix-round gates. No placeholder text remains (N4 is a stale figure inside it) | fixed |
| N1 | One-line comment at both WhatsApp sites saying why they differ | `DjTiles.tsx:275` ("App-built wa.me link ... keeps noreferrer, unlike the typed links below") and `DancerWorld.tsx:62` ("whatsapp is an app-built wa.me link ... takes the ugc rel too ... DjTiles leaves its standalone wa.me on the plain rel"). Both sites, both say why | done (see N3 on placement) |
| N2 | (no change proposed) exception rows trusted by inclusion | Unchanged by design; M2 below shows the class is still open, as r1 said | as recorded |

## New findings (delta only)

1. **N3 (nit) `src/components/dj/DjTiles.tsx:275`, `src/modules/person-page/worlds/dancer/DancerWorld.tsx:62`: the N1
   comments sit INSIDE the `<a` opening tag, so the source guard reads them as tag text.** The guard's
   `openingAnchors()` slices from `<a` to the first `>` at brace depth 0, and a `//` JSX comment between
   attributes lands inside that slice. The DjTiles comment contains the word `noreferrer`; that anchor
   is the listed exception, so only `toContain('noopener')` runs on it and it passes. On a USER anchor the
   same wording would turn the guard red: M7 (adding `noreferrer` to the DancerWorld comment) fails the
   DancerWorld row with `not to match /noreferrer/`. Nothing is wrong today (tsc, eslint and the test are
   all green on both files), but the next edit to either comment can break the guard for a reason that
   has nothing to do with the rel. Suggest moving both to a `{/* ... */}` line above the anchor in a
   later touch; not worth a round on its own.
2. **N4 (nit, docs) `docs/handover-welcome-w1-link-rel.md:22`** says "SoundCloud/Mixcloud anchors on a real
   row (0 in prod)". The PR body says soundcloud 1, mixcloud 1, and this review's recount agrees (1 and 1
   on live DJ rows). The handover figure is stale from before the recount; the PR body is right.
3. **N5 (nit, docs) PR body CI table is for `47bc178`** (the `[skip preview]` push) with three rows "in
   progress at time of writing"; the final head is `cf9d24d55`. The table in this review is for
   `cf9d24d55`. No action needed beyond knowing which head a table describes.

## Delta scope (`f8e330b70..cf9d24d55`)

| File | Change | Beyond rel / comment / test row / docs? |
|---|---|---|
| `src/components/dj/DjRolePage.tsx` | line 76 `rel="noopener noreferrer"` to `rel={PUBLIC_LINK_REL}` (import already present from `f8e330b70`) | no |
| `src/components/dj/DjTiles.tsx` | one `//` comment line inside the wa.me anchor | no |
| `src/modules/person-page/worlds/dancer/DancerWorld.tsx` | one `//` comment line inside the contact anchor | no |
| `tests/publicLinkRel.test.ts` | DjRolePage row: `userLinks: 2` + exception to `userLinks: 3, exceptions: []` | no |
| `docs/handover-welcome-w1-link-rel.md` | placeholder to full handover | docs |

No copy, className, style, layout, snapshot, workflow, `scripts/` or `.css` change; none of the
protected calendar files; `target="_blank"` kept on the F1 anchor. Whole PR vs main is still the 11
files r1 listed (+162 / -26).

### Missed-link re-grep (same pages as r1, at `cf9d24d55`)

`git grep` for `noopener noreferrer`, `rel="noreferrer"` and `window.open` across `src/pages`,
`src/modules/person-page`, `src/components/{dj,profile,teacher,people}` and
`src/modules/dancer-app/public-page`:

- In the nine PR files the only remaining `noreferrer` is `DjTiles.tsx:277` (the app-built wa.me
  anchor, listed exception). The F1 anchor no longer appears. Nothing new.
- Same out-of-scope set as r1, unchanged: `PublicDancerPageV2.tsx:273` (parked by the brief, and now
  SAID in the PR body), `AllProfiles.tsx:184,195`, `FestivalDetail.tsx:2994,3776` (ticketUrl),
  `PromoCodes.tsx:70`, `VendorDetail.tsx:543`. App-generated and correctly untouched:
  `ProfileCompletionChrome.tsx:108`, `Organisers.tsx` WhatsApp anchors, `FestivalDetail.tsx` calendar
  links, `LegalShell.tsx:42`, `Auth*.tsx`, `Faq.tsx`.

## Tests

- `npx vitest run tests/publicLinkRel.test.ts` at `cf9d24d55`: 10 passed, exit 0.
- `npx tsc --noEmit -p .` at `cf9d24d55`: 0 errors, exit 0. (The PR body's "147 errors" is
  `tsc -p tsconfig.app.json`, a different config, and the same 147 on main; not re-run here.)
- `npx eslint` on the three delta source files and the test: exit 0.
- `npm run check:mojibake` at `cf9d24d55`: 2658 files scanned, clean, exit 0.
- `npm run test:unit` at `cf9d24d55`: see "Checks run" below.

### Mutants (each applied alone to the PR head, `tests/publicLinkRel.test.ts` run, tree restored between)

| # | Mutant | Result |
|---|---|---|
| M1 | restore `rel="noopener noreferrer"` on `DjRolePage.tsx:76` | killed (DjRolePage row: `must use PUBLIC_LINK_REL`) |
| M2 | M1 AND re-add the old exception row (`snippet: 'href={e.action.href}'`, `userLinks: 2`) | **survived** (10 passed): the r1 N2 class, an exception row is trusted by inclusion; needs the reviewer to read the model, as done here |
| M2b | re-add the exception row only, source left fixed | killed (`to contain 'noopener'`, the exception must still be the old rel) |
| M3 | DjRolePage `userLinks: 3` to `2` | killed (`length of 2 but got 3`) |
| M4 | add an unlisted `<a href={e.action.href} target="_blank" rel="noopener noreferrer">` in `DjRolePage.tsx` | killed |
| M5 | hand-written `rel="noopener nofollow ugc"` on the F1 line | killed (`must use PUBLIC_LINK_REL`) |
| M6 | drop `target="_blank"` from the F1 anchor | killed (`length of 3 but got 2`) |
| M7 | fragility probe: add the word `noreferrer` to the N1 comment inside the DancerWorld user anchor | guard goes red (`not to match /noreferrer/`), see N3 |

7 of 8 killed (M2 the known N2 survivor; M7 is a probe of test fragility, counted as killed since the
guard did fire).

## CI at the PR head `cf9d24d55` (36 check runs)

Read twice from the GitHub API, 16:24 and 16:27 UTC on 2026-11-10 (jobs started 16:18); re-read at the
end of this review, see the last line of the table.

| Job | Conclusion |
|---|---|
| `unit (America/New_York, tz-sensitive)` | success |
| `unit (Australia/Sydney, tz-sensitive)` | success |
| `unit (Europe/London, full)` | success (completed 16:31 UTC) |
| `dancer-area-isolation` | success |
| `integrity` | success |
| `build-smoke` | success |
| `phone-qa (2)`, `phone-qa (3)` | success |
| `phone-qa (1)` | success (completed 16:30 UTC) |
| `phone-qa-section` | success |
| `real-data-verified` | success |
| `e2e-smoke` | success (completed 16:32 UTC) |
| `contract-check`, `live-db-gate` | success |
| `bom-check`, `bom-check-routed`, `route` | success |
| `masking-check`, `notification-check` | success |
| `bundle-budget`, `wallclock-brand` | success |
| `no-preview-reason` (x4) | success |
| `decide`, `open-pr` | success |
| `seo-check`, `seo-preview`, `synthetic`, `synthetic-preview`, `og-check`, `og-preview`, `lighthouse`, `doc-weight`, `enable` | skipped (no Vercel preview for this head; the final commit subject has no `[skip preview]`, so the skip is the workflows' own gate, not the subject) |
| Final re-read 16:35 UTC | all 36 completed: 27 success, 9 skipped, 0 failed, 0 pending |

As in r1, no typecheck check run is among the 36; tsc was run locally (above). `mergeable_state`
is `blocked` (review required), no reviews or review comments on the PR.

## Verified on real data

- Shapes surveyed (read-only `SELECT`, prod `stsdtacfauprzrdebmzg`, counts only, no personal data, no
  write): `dancer_profiles` with `coalesce(is_active,true) and archived_at is null`, role via
  `person_roles` (`coalesce(is_active,true)`), listen links via `dj_role_details`. This recount vs the
  PR body's numbers:

  | Role | live rows | instagram | facebook | website | soundcloud | mixcloud | gallery | PR body |
  |---|---|---|---|---|---|---|---|---|
  | djing | 44 | 7 | 2 | 31 | 1 | 1 | 1 | same |
  | teaching | 126 | 22 | 2 | 50 | - | - | 1 | same |
  | dancer (all live) | 183 | 25 | 2 | 57 | - | - | 1 | same |

  Every figure in the PR body's "Verified on real data" block matches. The F1 anchor renders for any
  of the 7 live DJs with an Instagram once they have no upcoming dates. (Extra, not in the PR body:
  live rows with a whatsapp value are 5 djing / 7 teaching / 10 dancers; those are the app-built
  wa.me anchors N1 talks about.)
- Checks run: `tests/publicLinkRel.test.ts` exit 0 (10 passed); 8 mutants (7 killed, 1 known-class
  survivor); `npx tsc --noEmit -p .` exit 0, 0 errors; eslint on the delta files exit 0;
  `npm run check:mojibake` exit 0; `npm run test:unit` at `cf9d24d55`: exit 1, 902 of 906 files passed, 29345 tests passed, 15 failed, 31 skipped; the 15 failures are the same four sandbox-environment files r1 and the PR body report (`tests/integrityCouldNotRun.test.ts` 5, `tests/occurrenceProgram.contract.test.ts` 2, `tests/eventViewCompat.contract.test.ts` 5, `tests/publicEventPageLineup.contract.test.ts` 3; live-DB anon client and temp-repo typescript precondition), none touched by the PR, and the three CI `unit` jobs plus `contract-check` and `live-db-gate` are green on this head. The run also rewrote 12 unrelated `.snap` files to LF line endings in the working tree (whitespace-only, discarded, not part of this review).
- NOT verified: a browser walk of the changed pages (rel-only change, no visual delta, none done, same
  as r1 and the PR); the PR's `npm run lint` / `npm run pre-ship` (builder's gate; the PR body says
  pre-ship did not complete in the builder's sandbox); the rendered `rel` on a live preview (no
  preview exists for this head); the parked dancer-app page.

## Handover (review worker)

- Done: this review file; verdict PASS; no change to the PR branch. Review PR: #1526 (`claude/review-1524-r2` to `main`, docs only).
- Left: nothing on this brief. N3 to N5 are nits for a later touch of PR #1524 or its follow-up, not a new round.
- Next steps: owner reads the verdict; PR #1524 waits on the owner (mergeable_state `blocked`, review required). A follow-up brief for the out-of-scope `noopener noreferrer` user links (`PublicDancerPageV2`, `AllProfiles`, `FestivalDetail` ticketUrl, `PromoCodes`, `VendorDetail`) remains the open item from r1.
- tsc run on `cf9d24d55` (the reviewed head): 0 errors, exit 0. This branch adds no TypeScript, so no tsc run on its own head.
