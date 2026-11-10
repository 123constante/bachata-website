# Handover: welcome-w1-link-rel (J12.8)

Branch `claude/welcome-w1-link-rel`, PR #1524. Brief: `brief/welcome-w1-link-rel:docs/briefs/welcome-w1-link-rel.md`.

## Done
- Owner-typed new-tab links on teacher / DJ / dancer public pages now use the shared
  `PUBLIC_LINK_REL` (`noopener nofollow ugc`) instead of `noopener noreferrer`, in all 9 brief files.
- Left as-is (app-generated): `DjTiles.tsx` wa.me WhatsApp anchor only (comment added saying why).
- Fix round 1 (review `claude/review-1524-r1`, F1/F2/F3/N1): `DjRolePage.tsx` no-dates anchor is the DJ's own
  Instagram (the in-app branch is a `<Link>`), so it now carries `PUBLIC_LINK_REL`; test row set to
  `userLinks: 3, exceptions: []`, proven red on the unfixed source first. WhatsApp comments at
  `DjTiles.tsx` and `DancerWorld.tsx`. PR body filled. Prod recount: 44 live DJ rows, 7 with Instagram.
- `tests/publicLinkRel.test.ts`: table-driven source guard, proven red (main's DjTiles) then green.
- Prod survey (read-only counts) in the PR body.
- tsc (`tsc -p tsconfig.app.json --noEmit`, no typegen): 147 errors on branch AND on main; 0 new. The only one in a
  branch file (`PersonPage.tsx:21`, `PublicPageV2Data` import) is pre-existing on main.
- `npm run lint`: 34 of 34 links green (trailing eslint informational).

## Not verified
- 390x844 browser walk (rel-only change, no visual delta).
- SoundCloud/Mixcloud anchors on a real row (0 in prod).
- pre-ship is red on `test:unit` (live-DB contract tests + env-dependent integrity test) and the typecheck
  count ratchet (baseline 106 is stale; main is 129) -- identical on origin/main, not caused by this diff.

## Left / next steps
- Parked: `PublicDancerPageV2.tsx:273` (dancer-app) renders owner-typed links with `noopener noreferrer`;
  its snapshot would change. Out of scope per brief -- a follow-up brief should cover it.
- Owner: re-baseline the typecheck ratchet (106 -> 129) separately if intended.
