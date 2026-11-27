# BRIEF: welcome-w1-link-rel (Website; BUILD non-visual; normal lane; Opus)

Brief-version: 2
Contract: the Welcome contract cell J12.8 (branch `brief/welcome-contract`, sha 84e5a5cd). Anyone can now create a teacher/DJ page (D1), so the links they type on it are user-generated and must not pass ranking credit or leave a referrer-free opener. Organiser pages already do this; teacher, DJ and dancer pages do not. Branch `claude/welcome-w1-link-rel`. Zero migrations, no copy change, no visual change.

## What main lacks
- User-link anchors on teacher/DJ/dancer public pages using the shared rel -- grep: PUBLIC_LINK_REL in src/pages/TeacherProfile.tsx (absent on main)

## What to do (in order)
1. Reuse the existing constant `PUBLIC_LINK_REL` (`noopener nofollow ugc`, `organiserLinkLabels` module, line 71). Do not define a second one.
2. Replace `rel="noopener noreferrer"` with `rel={PUBLIC_LINK_REL}` ONLY on anchors whose `href` is a value the page owner typed: Instagram, Facebook, website, SoundCloud, Mixcloud, gallery/video URLs, and the person-page contact links when `external`. Leave app-generated links (WhatsApp help, Terms, Privacy, in-app action hrefs (e.g. the DjRolePage no-dates action)) as they are. For each of the lines below say in the PR table: changed or left, and why.
   - `src/modules/person-page/PersonPage.tsx:142`, `worlds/dancer/DancerWorld.tsx:61`, `worlds/dj/DjWorld.tsx:158`, `worlds/teacher/TeacherWorld.tsx:149`
   - `src/pages/TeacherProfile.tsx:372,377,382,523,543`, `src/pages/DancerProfile.tsx:242`
   - `src/components/dj/DjTiles.tsx:275,291,296,303,304,305,329,341,516`, `src/components/dj/DjRolePage.tsx:196,213`
   - `src/components/profile/DancerProfileGrid.tsx:204,209,214,347,367`
3. Keep `target="_blank"` everywhere it is today. Do not touch snapshots except where the rel text itself is in a snapshot (the dancer-app public-page snapshot is NOT in scope; say if it renders the same links and park it).
4. Add `tests/publicLinkRel.test.ts`, table-driven: one row per changed file above, reading the source text and asserting that every `<a ... target="_blank">` whose href is a user-link variable carries `PUBLIC_LINK_REL` and none carries `noreferrer`. The table lists the exact allowed exceptions (app-generated links) by file and line text so a new unlisted `noopener noreferrer` anchor in these files turns it red. Prove the test red first (revert one file's change and see it fail).
5. Run `npm run test:unit`, `npm run lint`, `npm run pre-ship`; paste the per-job CI table in the PR body.

## Verified on real data (PR block)
Read-only prod survey (project `stsdtacfauprzrdebmzg`, counts only, no personal data): number of live teacher, DJ and dancer rows with a non-empty instagram / facebook / website / soundcloud / mixcloud, to show which link kinds actually render. Never any write.

## Not in scope
Copy, layout, the "Report this page" control (J12.5), noindex (D12), any claim or Ask-to-join change, the dancer-app screens.

## Files
- `src/modules/person-page/PersonPage.tsx`
- `src/modules/person-page/worlds/dancer/DancerWorld.tsx`
- `src/modules/person-page/worlds/dj/DjWorld.tsx`
- `src/modules/person-page/worlds/teacher/TeacherWorld.tsx`
- `src/pages/TeacherProfile.tsx`
- `src/pages/DancerProfile.tsx`
- `src/components/dj/DjTiles.tsx`
- `src/components/dj/DjRolePage.tsx`
- `src/components/profile/DancerProfileGrid.tsx`
- `tests/publicLinkRel.test.ts` (new test)
