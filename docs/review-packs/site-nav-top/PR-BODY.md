## Summary
Moves the public section row (Organisers, Venues, Community, Raffles when flagged) from a fixed bottom bar to a sticky top row under the header. Bottom-edge maths updated (`.route-shell`, sticky action bars, edit-in-place layers). Merged with current main (10693f7); the closed `/app` dancer area keeps its own chrome and is untouched.

## Phone QA
- Sizes checked: 390x844 and 360x640 (phone suite), plus 360x780 on the production build.
- Walked: home, event, festival, organisers, account-save, venue sticky bar and the organiser save bar with the phone suite (site-nav-top, small-queue-gaps, organiser-save-bar specs: 32 passed, 10 skipped). Header 60px plus row 46px is 106px; no horizontal overflow; no fixed element touching the bottom edge.
- Not verified: signed-in `/app` (no session in the sandbox); a real phone; Lighthouse; the full phone suite end to end after the last merge.

## Verified on real data
- Shapes surveyed: no database read was done. This change is layout only, with no data-dependent rendering. The phone fixtures reuse the organiser, event and festival page shapes already in the suite.
- Checks run: dancer-area isolation check (OK after the merge), production build, build-smoke, the phone specs above, the unit suite (15 failures, all live-DB contract or sandbox-environment tests that fail identically on main).
- NOT verified: behaviour on live production data, the live-DB contract tests, GitHub Actions jobs, signed-in dancer app chrome.
