# Brief: dancer dashboard slice 1 build (admin #1534), Website only, NO DB change

Lane normal. Branch `claude/profile-dash-dancer-build`. One slice = one branch = one push-set; open one PR.

## Design to build (owner picked Option A, 2026-11-12; on main)
- `docs/design/profile-dash/dancer-option-a.html` (open in a browser; controls switch shapes), `dancer.md` (design record, inventory with file:line), screenshots `shot-a-*.png` (390x844).
- Base prototype: `docs/design/profile-dash/prototype.html.md` (HTML saved under .md; copy to .html to open). Dark theme, Bricolage Grotesque + DM Sans, role strip with top-right Switch sheet. Existing code: `src/modules/dancer-app/**`; dark tokens `src/modules/dancer-app/theme/dancer.css`.
- Core only: Home (D1 new stub, D2 unfinished, D3 complete/claimed, D4 unclaimed match), Switch sheet, Add a profile, Account sheet, Edit screen. No page-view tiles, no charts, no stats on a new account.

## Fixes to apply (independent critique, these beat the HTML where they differ)
1. D1: no tappable "Your numbers" row (plain text line like D2). Headline "Finish your profile"; the specific step label only on the button; no kicker.
2. D2: show progress once (the list); no subtitle count, no kicker.
3. D3 with 0 nights: one CTA only (no duplicate Browse / Find a night); calm first screen (1 main card + 3 items).
4. Add the "Your name here / No photo" placeholder line to the Preview your page row.
5. Edit screen follows the journey: no hardcoded name/city; only controls that exist; no copy about photo/styles/bio/links without the control; untouched Save sends NOTHING and says why it is off.
6. D4 claim (OWNER DECISION): the button re-runs the existing no-arg `claim_my_dancer_profile_v1()` (`src/lib/claimMyDancerProfile.ts`) and shows the returned status. Draw and wire states: linked (success), no_match, ambiguous, email_unproven. Merge "This is not me" and "Start fresh" into one dismissal. No DB change.
7. One profile = no Switch (button reads "Account", D129, `src/modules/dancer-app/shell/SwitcherGate.tsx`).
8. REMOVE the unverified copy "In beta" and "It counts here the day after" (owner decision).
9. Nights attended = `my_dancer_stats_v1.nights_went`; Going via `get_my_going_v1`; both near-empty on prod: explicit empty states, never a headline "0".

## Acceptance (person x journey x data shape), walk each at 390x844
D1 stub: Finish your profile + next step + preview, no stats. D2 partial: next missing step, untouched Save sends nothing. D3 complete: checklist hidden, Nights attended, empty = suggested action. D4 unclaimed match: Claim your page works with real status messages. Plus 3 roles, 1 role, switch sheet, add profile, account.

## Rules
Contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll, every empty/loading/error state actionable, disabled controls say why. Table-driven tests screen x shape with one shared mapping (red first). Run every CI job step; put the per-job CI table in the PR. `docs/design/<pr>.md` for the design record; screenshots on the PR. Supabase connector is read-only; no migration, no `supabase/**`. PR body: Verified / Not verified block.
