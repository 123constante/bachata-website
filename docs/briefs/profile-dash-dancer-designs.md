# Brief: dancer dashboard, 3 design options (admin issue #1533, parent #1531; normal lane, DESIGN ONLY)
Branch: claude/profile-dash-dancer-designs. Output: docs/design/dancer-dashboard/ (INVENTORY.md, option-a/b/c .html, 390x844 PNGs, notes.md). No app code.
## Acceptance contract
Dancer (DARK theme) x new stub / partial / complete-claimed / unclaimed-match x mockups at 390x844. Owner picks ONE; an independent reviewer critiques.
Calm, clean, spacious: first screen = ONE main card + 3 items. Journeys: D1 new account sees Finish your profile + next step + preview, no stats; D2 unfinished: checklist shows next missing step, untouched Save sends nothing; D3 complete: checklist hidden, Nights attended count (empty = suggested action); D4 unclaimed match: Claim your page button. No page-view tiles, charts, enquiries, saves or weekly summary.
## Step 1 (BEFORE drawing): write INVENTORY.md
Every field, state and option of the dancer profile in the admin app, the current Website (src/pages, dancer profile/account screens) and the public dancer page, each with file:line. List GAPs. End the whole work with a COVERAGE COUNT (inventory items shown / total, GAPs explained).
## Step 2: three options
Option A adapts mockup-organiser-area/dashboard/profile.html (find it in the repo) to the dancer dark theme; B and C are different structures. Each option shows all four shapes. Real-looking data, real copy; empty states say what to do; disabled controls say why; taps >=44px; contrast >=4.5; no sideways scroll.
## Step 3: checks and record
Screenshots of every option x shape at 390x844 in the PR. Record in notes.md: your recommended option and why, alternatives. docs/design/<pr>.md per repo convention. Verified / Not verified block in the handover.
