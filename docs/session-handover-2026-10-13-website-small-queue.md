# Session handover 2026-10-13 -- Website small queue (branch `claude/website-small-queue`)

Brief: `docs/briefs/website-small-queue.md` on `arc/briefs-website-small-queue`. One branch, one PR.

## What shipped

1. **Gap above the BottomNav** (shared fix, no per-page code).
   - Cause A: every route wrapper (`app/InitialVisiblePageTransition.tsx` plain div and
     `src/components/PageTransition.tsx`) had `min-height: 100vh` ON TOP of AppChrome's 60px header
     spacer and 64px nav spacer, so any page shorter than the screen was 124px taller than it. The home
     shell is sized to fit exactly, so the home always scrolled into a 127px dead band.
     Fix: `.route-shell` in `src/index.css` = `calc(100svh - 124px - safe-area)` (vh fallback first).
   - Cause B: the BottomNav box was 61px (2px line + 58px row + 1px border) over a 64px spacer: a 3px
     strip under every footer at full scroll. Fix: row `h-[61px]`, so the nav is exactly 64px.
   - Measured at full scroll (nav top minus the lowest visible content, clipped to its scroller):

     | route | 390x844 before | after | 360x640 before | after |
     |---|---|---|---|---|
     | `/` (home) | 127 | 0 | 127 | 0 |
     | `/events` (404 page) | 2.9 | -0.1 | 3.4 | 0.4 |
     | `/djs` | 3.0 | 0 | 2.7 | -0.3 |
     | `/organisers` | 2.9 | -0.1 | 3.0 | 0 |
     | `/event/:id` | 3.2 | 0.2 | (not captured, output cut) | -0.4 |

     Home document height: 968 -> 844 (390x844), 764 -> 640 (360x640): it no longer scrolls.
2. **Contrast.**
   - (a) Calendar past-day numbers (`CalendarGrid.tsx`): `text-muted-foreground/60` -> `/80`:
     #6e6e6e -> #8c8c8c on #121212, 3.67:1 -> about 5.6:1. Colour only (the file is on the density
     exclusion list; the owner approved this item in the brief; no layout touched). The axe ratchet
     entries for /parties and /classes are deleted from `tests/e2e-phone/axe-contrast-baseline.json`.
     The site has one theme (`:root` and `.dark` carry the same tokens).
   - (b) **NOT DONE**: the empty link-row placeholder lives in
     `src/modules/organiser/edit-in-place/parts.tsx` (`rgba(246,241,234,0.45)` on INK, 4.12:1). The
     brief puts organiser edit-in-place off limits to this branch, so it is skipped. The fix is one
     colour there (0.45 -> about 0.55 reaches 4.5:1 on #0c0a0d; re-measure), then delete the
     `span[title=""]` baseline entries.
3. **Empty band under the EQ bars** (organiser hero, `src/pages/OrganiserProfile.tsx`). The bars were
   already flush with the hero base; the band was the brand-colour fade after the hero, a 10vh / 80px
   empty div. It now takes no height and lies under the stats strip (zIndex 1). Bars untouched (28 bars,
   44px strip, 0.16 opacity, reduced-motion still stills them). Band 79px -> 0 (-1 = the 1px seam overlap)
   at both sizes.
4. **Programme nationality from the programme read.** `parseProgramItems` reads `nationality_code` off
   each person; `useProgrammeNationalities`, `parseProgrammeNationalities` and `withNationalities` are
   deleted; ScheduleBlock no longer asks `dancer_profiles`. Network on `/event/:id` (phone suite): 1
   `dancer_profiles` request -> 0; stickers ES, CO, AR still shown.

## Tests (red on the unfixed code first)

- `src/modules/event-page/bento/blocks/__tests__/programmeNationalityOneRead.test.tsx` (3 shapes) and the
  programme row of `nationalityFlag.surfaces.matrix.test.tsx` now feed `nationality_code` on the person:
  8 red on the unfixed code, green after.
- `tests/e2e-phone/small-queue-gaps.phone.spec.ts`: gap per route, home fits, hero band (also under
  reduced motion), programme request count. Red on the unfixed code (gaps 127 / 3px, band 79px, one
  dancer_profiles request); plus the contrast ratchet red on /parties and /classes once the baseline
  entries were deleted.

## Open

- Item 2b (above) for whoever owns organiser edit-in-place.
- PR #746 (claude/surname-screens) also edits `src/pages/OrganiserProfile.tsx` (different lines);
  #744 edits `src/components/AppChrome.tsx`, which this branch does not touch.
- `npm run typecheck` reports 96 errors in this sandbox on untouched `main` as well (same count), so
  it is a sandbox/dependency matter, not this diff; none are in lines this branch changed.

## Update 2026-10-13 22:30 UTC (context gate, PR #747)

- Another session pushed `6079a65` and `35e5774` to this branch: a vendor-ui <-> vendor-ui-modal cycle fix,
  a build-time cycle guard and a production-build smoke (`docs/session-handover-2026-10-13-747-preview-fix.md`).
- `main` merged #748, a separate fix for the same cycle (focus-scope moved to the shell list). On the merge
  ref two `tests/chunkClassifierGraph.test.ts` cases failed. Fixed: merged `main` (`10438c9`) and switched
  them to `@radix-ui/react-focus-guards` (`3b8d7a7`). Local checks on the merged tree: build, budgets,
  `check:chunk-cycles` and lint all exit 0; build smoke 3/3; unit offline shows only the 5 sandbox-only failures.
- `contract-check` red on `35e5774`: 45 unmigrated prod DDL changes plus the anon-grant posture. It reads live
  prod; this PR has no DB change, and `main` was green at 21:52. Not this PR's; commented on the PR.
- `festivalClientState.test.tsx` London flake: pre-existing on `main`; commented. Re-runs return 403.

## Next

1. Read CI on the head after this doc push: expect green except possibly `contract-check` (DB owner)
   and the London flake (maintainer re-run).
2. Item 2b stays open for the organiser edit-in-place owner.
3. Never merge or approve.
- NEW, not yet diagnosed: `phone-qa` on `35e5774` failed `overlap.phone.spec.ts` "overlap /auth: no sideways
  scroll, fixed bottom controls tappable": failed at 390x844 (also on retry), flaky at 360x640; 168 passed.
  It passed on `f50eff1` (my own run and CI). Suspects: the other session's commits, or the 64px nav on /auth.
  The /auth orbs belong to #744 (off limits). Next session: read phone-qa on the current head; if still red, run
  `npx playwright test --config playwright.phone.config.ts -g "overlap /auth"` and read which assertion fails
  (sideways scroll vs covered control) before touching anything.
