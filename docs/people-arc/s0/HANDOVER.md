# People arc S0 handover: wall split from #963

Branch `claude/people-wall-split` (from main d4bff82). Head sha and PR number: this branch's tip, and the PR
`bot-pr.yml` opens for it on push (the worker's final report names both; this file cannot know its own sha).

## Done
- Taken from #963 (`claude/w2d-hub-build` 2c99d77c), wall only:
  - `wall/model.ts`: `wallDateLabel` = full date "Friday 23 October" (full weekday + month).
  - `wall/usePhotoFallback.ts` (new) + `wall/__tests__/photoFallback.test.tsx` (new), wired into `WallTile.tsx`.
  - `wall/__tests__/wall.test.tsx`: the full-date expectations.
- NOT taken: `hub/**` source, `roleSwitch.ts` + test, hub CSS in `src/index.css`, `featureFlags.ts`,
  `badges.ts` (its #963 change is `personDestination` for the hub; the wall model does not need it, and
  `tileHref` stays as on main, so tiles link to role pages), `RoleChip.tsx` `big` prop and `tokens.ts` HUB
  changes (hub-only), `app/routes/people*`, the hub mockups/docs.
- Owner pick B: the date chip on the face is gone; `tile-date` is a gold line after `tile-name`
  (`DATE_LINE`, `SIZE.dateLine`, `SIZE.dateLineHeight`).
- Tests: `date-chip` renamed `tile-date`, every assertion kept; new "the date is not inside wall-face and sits
  after tile-name" (ran red on the chip version first); wallContrast asserts the date line on WALL.page and on
  the measured seam grounds; photoFallback adds "a lazy photo not fetched yet stays a photo".
- Main's hub shares `wallDateLabel`, so two hub TEST strings changed ('Thu 22' / 'Fri 23' to the full date).
  No hub source change.

## Screenshots (local prod build reading prod, read-only, VITE_ENABLE_PEOPLE_WALL=true)
`djs-360x800.png`, `djs-390x844.png`, `dancers-360x800.png`, `dancers-390x844.png`, numbers in `report.json`
(`shoot.mjs` re-runs them). /djs 40 tiles, 17 dated; /dancers 97 tiles, 14 dated. Date never on the face, no
clipped name or date, no sideways scroll. Extra probe at 320x640 with "Wednesday 30 September": no overflow.

## Not verified
- Real face photos: the sandbox proxy blocks media.bachatacalendar.co.uk, so every visible face fell back to
  initials (which exercises the fallback, not the photo look). The date no longer sits on the face, so photos
  cannot change the date's contrast.
- The superseded hub (flag `personHub` off) with the longer date in its CTA: not walked.
- Preview-only jobs (doc-weight, lighthouse, OG/SEO on preview) and Vercel preview: not run locally.
- Real phone.

## Next
S1 owns `person-page/facts|frame|worlds`. Close #963 once this PR is open (owner/orchestrator).
