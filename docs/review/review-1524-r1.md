# Review 1524-r1: Website PR #1524, PUBLIC_LINK_REL on teacher / DJ / dancer user links (J12.8)

Reviewer: review-1524-r1 (independent, read-only on the PR branch). Reviewed at head
`f8e330b701f7655cbf4cff22eb27cddd15733b4b` of `claude/welcome-w1-link-rel`, base `main` at
`17bd32185a3c90f6965661fa80fb46292d2fb1c4`. Build brief: `docs/briefs/welcome-w1-link-rel.md`
(brief-version 2). Fresh checkout of the PR head in this worker's own clone, existing `node_modules`
from `npm ci`.

## Verdict: PASS-with-fixes

The rel swap is correct on 24 of the 25 new-tab anchors in the nine files, the diff is rel-only
plus the test, and the test kills every mutant tried (10 of 10). One anchor the PR lists as an
"app-generated" exception is in fact a user-typed Instagram link (F1), so the J12.8 gap the PR
closes is still open on one rendered path, and the test now enshrines that gap. The PR body is
still the bot stub (F2). Both are small, same-branch fixes; nothing needs a design decision.

## Findings

1. **F1 (medium, fix before merge) `src/components/dj/DjRolePage.tsx:76`: the no-dates action
   anchor is user-typed, not app-generated.** `noDates(instagram)` in
   `src/components/dj/djRoleModel.ts:99-103` returns `{ href: instagram, external: true }` when the
   DJ has an Instagram and `{ href: '/', external: false }` otherwise. The component renders the
   `<a target="_blank" rel="noopener noreferrer">` only on the `external` branch, so that anchor's
   href is ALWAYS the DJ's own Instagram URL; the in-app `/` branch is a `<Link>` and never a
   new-tab anchor. The build brief's hint ("in-app action hrefs (e.g. the DjRolePage no-dates
   action)") was wrong on inspection and the PR followed it without checking, then listed the
   anchor as a test exception (`exceptions: [{ snippet: 'href={e.action.href}' ... }]`), which makes
   the guard assert that this user link KEEPS `noopener` with no `nofollow ugc`. Reproduced by
   reading the model and the two render branches at the PR head; a DJ with an Instagram and no
   upcoming dates (prod has 44 live DJ rows, 7 with Instagram) renders exactly this anchor.
   Fix: `rel={PUBLIC_LINK_REL}` on line 76, and in `tests/publicLinkRel.test.ts` set the
   `DjRolePage.tsx` row to `userLinks: 3, exceptions: []`. The existing
   `src/components/dj/__tests__/djRolePage.test.tsx:182` checks only the label, so nothing else
   changes.
2. **F2 (low, owner rule) PR body is the unfilled bot stub.** All six `TO FILL` lines are still in
   place: no "Verified on real data" block, no prod counts, no per-job CI table, and no
   changed/left table for the brief's anchor list (brief step 2 asked for one). The
   `real-data-verified` and `phone-qa-section` checks on this head are green despite the stub, so
   those gates did not catch it; worth a look by whoever owns them, but out of this review's scope.
   The counts that block needed are below (read-only, counts only) so the builder can paste them.
3. **F3 (low) `docs/handover-welcome-w1-link-rel.md` is a 3-line placeholder** ("Status: in
   progress -- see final section once complete"). Either fill it or drop it from the PR.
4. **N1 (nit) WhatsApp consistency.** `DjTiles.tsx:276` keeps `noopener noreferrer` on the app-built
   `wa.me` link (phone digits only), while `DancerWorld.tsx:62` now puts `PUBLIC_LINK_REL` on the
   dancer's `whatsapp` contact (`external: c.kind !== 'email'`, also an app-built `wa.me` href).
   Both are harmless (`nofollow` means nothing to wa.me, and wa.me needs no referrer). A one-line
   comment at either site saying why they differ would stop the next reader "fixing" one of them.
5. **N2 (nit, test design)** An exception row is trusted by inclusion: the test proves the row
   matches one anchor and that it still says `noopener`, but nothing checks the `why`. That is how
   F1 passed. No code change proposed; the reviewer of any future exception row has to read the
   model behind the href, as here.

## Anchor table (PR head line numbers; brief listed main's)

User-typed = the href is a value the page owner typed (or uploaded). Correct = the PR changed a
user-typed anchor to `PUBLIC_LINK_REL` or left an app-generated one alone.

| File:line (PR head) | href | User-typed | PR action | Correct |
|---|---|---|---|---|
| `src/modules/person-page/PersonPage.tsx:143` | `person.instagramUrl` | Y | changed | Y |
| `src/modules/person-page/worlds/dancer/DancerWorld.tsx:62` (spread) | `c.href`, `external` = any kind but email: instagram, facebook, website, whatsapp | Y (whatsapp is app-built from a typed number) | changed | Y (see N1) |
| `src/modules/person-page/worlds/dj/DjWorld.tsx:159` | `view.book.href` = first of soundcloud / mixcloud / instagram / website / facebook (`model.ts:77`) | Y | changed | Y |
| `src/modules/person-page/worlds/teacher/TeacherWorld.tsx:150` | `view.contact.href` = website, else instagram, else facebook (`model.ts:107`) | Y | changed | Y |
| `src/pages/TeacherProfile.tsx:373` | `instagramUrl` | Y | changed | Y |
| `src/pages/TeacherProfile.tsx:378` | `normalizeUrl(teacher.facebook)` | Y | changed | Y |
| `src/pages/TeacherProfile.tsx:383` | `websiteUrl` | Y | changed | Y |
| `src/pages/TeacherProfile.tsx:524` | `instagramUrl` | Y | changed | Y |
| `src/pages/TeacherProfile.tsx:544` | `websiteUrl` | Y | changed | Y |
| `src/pages/DancerProfile.tsx:243` | gallery `url` (uploaded) | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:276` | `` `https://wa.me/${phoneDigits(p.phone)}` `` | N (app-built) | left | Y |
| `src/components/dj/DjTiles.tsx:292` | `sc` (soundcloud) | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:297` | `mc` (mixcloud) | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:304` | `ig` | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:305` | `web` | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:306` | `fb` | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:330` | `sc` | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:342` | `mc` | Y | changed | Y |
| `src/components/dj/DjTiles.tsx:517` | gallery `url` (uploaded) | Y | changed | Y |
| `src/components/dj/DjRolePage.tsx:76` | `e.action.href` = the DJ's Instagram on the only branch that renders an `<a>` | **Y** | left, listed as exception | **N (F1)** |
| `src/components/dj/DjRolePage.tsx:197` | gallery `u` (uploaded) | Y | changed | Y |
| `src/components/dj/DjRolePage.tsx:214` | `l.href` from `listenLinks()` (soundcloud / mixcloud / instagram / website / facebook) | Y | changed | Y |
| `src/components/profile/DancerProfileGrid.tsx:205` | `dancer.connectLinks.instagram` | Y | changed | Y |
| `src/components/profile/DancerProfileGrid.tsx:210` | `dancer.connectLinks.facebook` | Y | changed | Y |
| `src/components/profile/DancerProfileGrid.tsx:215` | `dancer.connectLinks.website` | Y | changed | Y |
| `src/components/profile/DancerProfileGrid.tsx:348` | `dancer.connectLinks.instagram` | Y | changed | Y |
| `src/components/profile/DancerProfileGrid.tsx:368` | `dancer.connectLinks.facebook` | Y | changed | Y |

Brief's main-line list mapped one to one (main 142/61/158/149; 372,377,382,523,543; 242;
275,291,296,303,304,305,329,341,516; 196,213; 204,209,214,347,367) to the rows above, each one
line lower where an import was added. No app-generated anchor was wrongly changed.

### Missed-link grep (same public pages and neighbours)

`git grep` at the PR head for `noreferrer`, `window.open`, `target=` and `rel={` across
`src/pages`, `src/modules/person-page`, `src/components/{dj,profile,teacher,people}` and
`src/modules/dancer-app/public-page`:

- In the nine PR files: the only remaining `noreferrer` anchors are `DjTiles.tsx:276` (wa.me,
  correct) and `DjRolePage.tsx:76` (F1). No `window.open`, no rel built by a helper.
- `src/modules/dancer-app/public-page/PublicDancerPageV2.tsx:273` renders the same dancer contact
  links (instagram / facebook / website / whatsapp) with `rel: 'noopener noreferrer'`; its snapshot
  `__tests__/__snapshots__/embedded.test.tsx.snap` holds that rel text. The build brief parks the
  dancer-app page; the PR should SAY so (it does not). Parked, not a defect of this PR.
- Outside the brief's pages, user-typed new-tab links still on `noopener noreferrer`:
  `src/pages/AllProfiles.tsx:184,195` (`profile.instagram`, `profile.website` on the public
  profiles directory), `src/pages/FestivalDetail.tsx:2994,3776` (`ticketUrl`, organiser-typed),
  `src/pages/PromoCodes.tsx:70` (`promo.external_url`), `src/pages/VendorDetail.tsx:331-332,543,
  579-580` (vendor links, `rel="noreferrer"` only). Out of J12.8's teacher/DJ/dancer scope; a
  follow-up brief candidate, listed here so it is not lost.
- `src/components/profile/ProfileCompletionChrome.tsx:108` (`model.cta.href`) and the
  `WHATSAPP_GET_LISTED_URL` anchors in `src/pages/Organisers.tsx` are app-generated. Correctly
  untouched.

## Tests

- `npx vitest run tests/publicLinkRel.test.ts` at the PR head: 10 passed, exit 0.
- The file sits under `tests/`, which `vitest.config.ts` includes, so the `unit` CI jobs run it.
- `npm run test:unit` at the PR head: see "Checks run" below.

### Mutants (each applied alone, test run, tree restored to the PR head between them)

| # | Mutant | Result |
|---|---|---|
| M1 | revert `DjTiles.tsx` to main (8 anchors back to `noreferrer`) | killed (1 file failed) |
| M2 | revert `TeacherProfile.tsx` to main | killed |
| M3 | add an unlisted `<a href={u} target="_blank" rel="noopener noreferrer">` in `DjRolePage.tsx` | killed |
| M4 | remove the wa.me allowed-exception row from the test table | killed (wa.me anchor then fails the user-link rule) |
| M5 | change `PUBLIC_LINK_REL` to `'noopener noreferrer'` in `organiserLinkLabels.ts` | killed (constant test and every row) |
| M6 | drop `target="_blank"` from the `DjTiles.tsx` Instagram anchor | killed (user-anchor count 7, expected 8) |
| M7 | hand-written `rel="noopener nofollow ugc"` in `PersonPage.tsx` instead of the constant | killed (`nofollow ugc` literal guard) |
| M8 | exception anchor `DjRolePage.tsx:76` loses `noopener` | killed |
| M9 | spread form in `DancerWorld.tsx:62` back to `rel: 'noopener noreferrer'` | killed |
| M10 | second anchor matching the `DjRolePage` exception snippet | killed ("must match exactly one") |

10 of 10 killed. The first pass of this table ran M3-M10 on a tree where M1/M2's revert had been
staged and not restored; it was rerun with a full restore between mutants, and M9 was rerun once
more after a stale line number made the edit a no-op. Figures above are from the clean runs.

## Diff scope

11 files, +130 / -25: nine source files (one `import { PUBLIC_LINK_REL }` line and the rel
attributes, nothing else), the new test, and the placeholder handover doc (F3). No copy, layout,
className, snapshot, workflow or `scripts/` change; none of the protected calendar files
(`EventCalendar`, `calendar/*`, `useCalendarEvents`, `ui/dialog`). `target="_blank"` kept on every
anchor. Zero migrations.

Referrer check: the destinations that lost `noreferrer` are instagram.com, facebook.com,
soundcloud.com, mixcloud.com, owner websites and Supabase storage gallery URLs; none needs a
referrer. No iframe / embed or maps anchor is in the diff; the only WhatsApp anchor in these files
(`DjTiles.tsx:276`) is unchanged, and the dancer-world whatsapp contact (N1) works without a
referrer too.

## CI at the PR head (36 check runs, all completed)

| Job | Conclusion |
|---|---|
| `unit (Europe/London, full)` | success |
| `unit (America/New_York, tz-sensitive)` | success |
| `unit (Australia/Sydney, tz-sensitive)` | success |
| `dancer-area-isolation` | success |
| `integrity` | success |
| `build-smoke` | success |
| `phone-qa (1)`, `phone-qa (2)`, `phone-qa (3)` | success |
| `phone-qa-section` | success (despite the stub body, F2) |
| `real-data-verified` | success (despite the stub body, F2) |
| `e2e-smoke` | success |
| `contract-check`, `live-db-gate` | success |
| `bom-check`, `bom-check-routed`, `route` | success |
| `masking-check`, `notification-check` | success |
| `bundle-budget`, `wallclock-brand` | success |
| `no-preview-reason` (x4) | success |
| `decide`, `open-pr` | success |
| `seo-check`, `seo-preview`, `synthetic`, `synthetic-preview`, `og-check`, `og-preview`, `lighthouse`, `doc-weight`, `enable` | skipped (commit subject carries `[skip preview]`, so no Vercel preview exists for this head) |

`typecheck.yml` declares a `pull_request` trigger but no typecheck run is among the head's check
runs; tsc was therefore run locally (below). No reviews or review comments on the PR yet.

## Verified on real data

- Shapes surveyed (read-only `SELECT`, prod `stsdtacfauprzrdebmzg`, counts only, no personal data,
  no write): the three public RPCs read every link from `dancer_profiles` (`instagram`, `facebook`,
  `website_url`) plus `dj_role_details` (`soundcloud`, `mixcloud`), filtered to
  `coalesce(is_active,true)` and `archived_at is null`, role via `person_roles`. Live rows with a
  non-empty value:

  | Role | live rows | instagram | facebook | website | soundcloud | mixcloud | gallery |
  |---|---|---|---|---|---|---|---|
  | teaching | 126 | 22 | 2 | 50 | - | - | 1 |
  | djing | 44 | 7 | 2 | 31 | 1 | 1 | 1 |
  | dancer (all live profiles) | 183 | 25 | 2 | 57 | - | - | 1 |

  So every changed link kind renders on at least one live page today; website is by far the most
  common, facebook and the DJ listen links are rare, galleries nearly empty. The PR's own
  "Verified on real data" block does not exist yet (F2), so there were no builder counts to check
  for read-only-ness; the counts above are this review's.
- Checks run: `tests/publicLinkRel.test.ts` exit 0 (10 passed); 10 mutants, 10 killed;
  `npm run test:unit` and `npx tsc --noEmit -p .` at the PR head: RESULT_PLACEHOLDER
- NOT verified: a browser walk of the changed pages (rel attributes only, no visual change, so none
  was done); the PR's `npm run lint` / `npm run pre-ship` (the builder's gate, not re-run here);
  the dancer-app public page (parked by the brief).
