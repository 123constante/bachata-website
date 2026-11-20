# Handover: dancer layout C, slice S2 (shell, Me Settings, redirects, preview twins)
Branch `claude/dancer-layout-c-s2`. Flag `VITE_ENABLE_DANCER_LAYOUT_C` (default off; off = shell, routes, Me, Options exactly as today).

## TOP: decisions the brief did not cover (owner please confirm)
1. **View-only buyers keep `/app/tickets`.** Redirecting it to Home would bounce a not-allowed buyer (the gate admits them ONLY on /app/tickets) to /account and hide their door QRs. So the Tickets redirect skips view-only people; they see their QRs with Home/Nights/Me locked (the "What are you?" sheet).
2. **No Home -> Tickets `?o=` hop with C on** (it would loop with the Tickets -> Home redirect). The checkout return stays on /app/home with `?o=`; Home must show the order card (S1's ticket card). Check S1 covers the `?o=` order card.
3. `layoutCFlag.ts` was NOT on main: created identical to `origin/claude/dancer-layout-c-s1` (PR #1872). Whichever lands second gets a no-op file.
4. Preview Me organiser row: reads `other_roles` when the profile read returns one, else shows "Run events? Become an organiser" (same href, /account/o).
5. Send feedback row label is optionsRows' own "Send feedback: what's missing?" (reused, not re-worded).

## Done
- routes.ts: `LAYOUT_C_TABS`, `shellTabs(ticketsOn, layoutC)`, `LAYOUT_C_REDIRECTS` (options -> /app/me, tickets -> /app/home, query kept). Route ids and catch-all paths unchanged.
- Shell: three tabs (3-column grid) when C on; locked tabs unchanged.
- Me (C on): no "My page" row; Settings head + rows (from optionsRows) in owner order; Back to website card; feedback + install sheets; no Sign out. no_profile/profile_mismatch Me shows NoProfileWayOut.
- Preview twins (C on): Home ghosts Share my page, Preview my page, Plans, Nights attended; Me ghosts Edit my profile, See my public page; live Settings except Send feedback + Add to home screen (locked ghosts); Back to website; quiet Sign out last. Teaser Options unreachable (redirect).
- Tests: `tests/client/dancerLayoutCShellMe.test.tsx` (22; 18 red on old source, the 4 green are flag-off pure rows). Walk spec `tests/e2e/dancer-app/layout-c-shell-me.spec.ts` (skips unless the flag env is on; not in the e2e gate list).

## Extras (listed, not changed)
- Account settings "Back" label still says Options (from=app, M4) -- S3.
- Install sheet JSX is a second render of INSTALL_STEPS (OptionsScreen's is inline, not exported; OptionsScreen not in this slice's files). Extract to optionsUi in a later slice.
- `TEASER_PATHS` still lists /app/options (harmless: redirect runs first).

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Tab Home | /app/home | prototype |
| Tab Nights | /app/nights | prototype |
| Tab Me | /app/me | prototype |
| (Options tab) | removed | prototype |
| (Tickets tab) | removed | prototype |
| /app/options | redirect /app/me | prototype |
| /app/tickets | redirect /app/home (view-only: stays) | prototype |
| Me profile CTA | mainAction href (edit/photo) | prototype |
| Edit my profile | /app/me/edit | prototype |
| See my public page | /dancers/<id> (disabled + reason if hidden) | prototype |
| Account settings | /account?from=app (APP_ACCOUNT_SETTINGS_PATH) | prototype (page itself = S3) |
| Your areas | /account/areas | prototype |
| Run events? Become an organiser / I run events | /account/o | prototype |
| Send feedback | FeedbackSheet | prototype |
| Help and message us | WhatsApp link | prototype |
| Add to my phone's home screen | install sheet | prototype |
| Terms | /terms | prototype |
| Privacy policy | /privacy | prototype |
| Back to the Bachata Calendar website | / | prototype |
| Preview Home ghosts (Share, Preview my page, Plans, Nights attended) | "Finish your profile to use this" sheet | prototype |
| Preview Me ghosts (Edit, See public page, Send feedback, Add to home screen) | same sheet | prototype |
| Preview Me live Settings rows | as Me rows above | prototype |
| Preview Me Sign out | sign-out confirm sheet | prototype |
| Preview Nights Rate this night | same sheet (unchanged) | prototype |

0 OLD rows. Coverage 10 of 10 checklist lines built (the "prototype-only note" line needs nothing).

## Gates
- tsc run on d9528b7: 0 errors in branch files.
- PR #1874; CI checks were in progress at hand-off (wallclock-budget, no-preview-reason green; the rest running).
