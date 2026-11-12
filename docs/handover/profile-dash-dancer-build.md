# Dancer dashboard build, slice 1 (admin 1534) -- design record

Branch `claude/profile-dash-dancer-build`. Website only, no DB change. Design: `docs/design/profile-dash/dancer-option-a.html`.

## What shipped
- Home main card + Claim your page (first worker): `screens/home/homeModel.ts` (one mapping), `HomeMainCard.tsx`, `ClaimYourPage.tsx`.
- Strip button top right (`ProfileSwitcher.tsx`, dancer area only): reads **Switch** with 2+ profiles, **Account** with one (`SwitcherGate.tsx`; D129: no Switch word for one profile).
- Switch sheet: every profile, tick on the current, **Add a profile**, Account settings, Sign out.
- Add a profile sheet: "Run events? Become an organiser" (organiser area) and "DJ or teach? Message us". Back returns.
- Edit screen: already has no hardcoded name/city (reads the profile) and an untouched Save is disabled with "Nothing has changed yet. Edit a field above to save." and sends no request (covered by walk + existing tests).
- Fixed a duplicate `lazyWithRetry` import in `EditScreen.tsx` (TS2300).

## Tests
- `screens/home/__tests__/homeComponents.test.tsx`: HomeMainCard per shape; ClaimYourPage per status (linked, no_match, ambiguous, email_unproven, unavailable) + the one dismissal.
- `__tests__/emberRestyle.test.tsx`: Account vs Switch label, Add a profile sheet.
- `tests/e2e/dancer-app/profile-dash-walk.spec.ts` (in `test:e2e`): 8 walks at 390x844; screenshots in `docs/handover/profile-dash/walk/` (run with `WALK_SHOTS=1`).

## Not done / owner calls
- Home still shows the hero, Going tile, numbers tiles, partner tile and line-up below the main card (first worker kept them); the brief's "calm first screen: 1 main card + 3 items" is NOT met. Needs a pass that removes them with their tests.
- The strip is a button with avatar + label, not a separate role strip with a Dancer/DJ/Organiser grouped list; groups are not drawn.
- Real-device and real Google Fonts not checked.
