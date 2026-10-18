# Brief: rebuild the public dancer page to mockup F13 (teal)

Owner said GO on 2026-10-18. You are the ONE worker on branch claude/dancer-app-r1b (PR #821 exists on it; do NOT open another PR; push ONCE at the end). Model: Sonnet (budget mode).

Mockups (you cannot open the canvas): this brief branch holds static HTML of the final page and the four stress shapes in briefs/: dancer-page-f13-mockup-F13.html (final), -F14a (thin), -F14b (overfull), -F14c (one event, no practice), -F14d (no events, practising). Open them with a headless browser at 390 wide and match them. Fonts there are Outfit/IBM Plex Mono/Archivo Black for drawing only; build with the site's own fonts. Read them with: git fetch origin arc/briefs-dancer-rebuild then git show origin/arc/briefs-dancer-rebuild:briefs/<file> (plain git, never gh api).

## What to build (src/pages/DancerProfile.tsx and its parts)
Top to bottom, 390 wide first:
1. Back / Share bar (44px targets).
2. Teal card (gradient #1C7D93 -> #0F5468 -> #0A3A4A, 24px radius): small label DANCER (not "member card"); round 116px photo with 4px #5EE0E6 ring, nationality flag 42px at its top-right (none if nationality unset; initials if no photo); name (26px, wraps, up to 3 lines); "Role · City" (role shown ONCE; city = city name only, never a postcode); facts row: DANCING (years), LEVEL, STYLE as equal columns, a column only if the value exists (grid columns = number present; none -> no row); SPEAKS centred below, languages NAMED (Spanish, English), hidden if none. Fact labels 11px minimum.
3. Practice stamp (compact, tilted -2deg, gold #F2C14E outline): "PRACTICE PARTNER WANTED" + "Goal: <goal>". Shown ONLY when looking_for_partner is true. Goal = partner_practice_goals (first two joined) in plain words; hide the Goal line if the array is empty. Never say "follower"/"leader wanted".
4. Going next: 1 event = one full-width card; 2 = two side-by-side; more than 2 = first 2 plus a "See all N events" link. Card: amber-gold caps date line (use site Bachata Amber #FF9900 for the date), bold event name, small venue. Hidden if none. PRIVACY: owner has NOT yet decided whether this is on by default; build it behind a dancer opt-in and OFF by default (Going is beta-only and private today).
5. Contact: one row per link: handle/address in teal #5EE0E6, underlined, with a small arrow icon; tapping opens it; long text cut with "..." (the Copy button copies the FULL text). Right of it, a C8 Copy button: thin divider line, copy icon + "Copy", no box, min 50px tall; after a tap it says "Copied" in green for ~2s. Hidden if no links.
6. Achievements: stacked lines in one card, hidden if empty.
7. "Dance bachata too? Get your own card": small, low-key, at the bottom.
NO gallery. NO description (owner: stays hidden).

## Look
Dark teal world (page #06191F, cards #0D3340, borders #1F5566, text #EAF7FA). Fonts: use the Website's existing font stack (Inter), not a new font. Mockup used Outfit only for drawing. Owner chose to KEEP teal as a named "dancer ID world" (Website DESIGN.md allows named departures); record that reason in the code comment and in docs.

## Data facts found (read-only, branch e0541df1)
- practice: dancing_role_details.looking_for_partner (boolean) and partner_practice_goals (string[]) via src/modules/profile/dancerPublicProfile.ts (lookingForPartner, partnerPracticeGoals). There is NO "role wanted" field, so nothing to drop; just do not print one. /practice-partners (src/pages/PracticePartners.tsx) lists looking_for_partner = true: keep its wording consistent ("practice partner").
- Prod has no real dancers yet (owner 2026-10-18), only test profiles (Ricky). Test lines "Proof Rebuild Song" on Ricky's profile should be cleaned by an admin before launch.

## Gates (every worker brief)
Red-first, table-driven tests over the F14 shapes: thin (only years + one link), overfull (long name, 3 styles, 5 languages, 6 events, long links, 4 achievements), one event, no events + practising, and no nationality / no photo. Same fact reads the same everywhere. Run every CI job step from the workflows in the sandbox and report each job with command + exit code (GitHub Actions billing may refuse jobs: read the annotation). Plain git only (no gh api). No shell variables/loops/$() where a plain command works. Check `npm run build`, not only dev. Push ONCE; checkpoint + handover doc before stopping. PARTIAL at 25-30% context with `PARTIAL [worker-done <ticket>]`. Never merge/approve; bot-authored PRs; Supabase read-only.
Phone checks the worker must record: 44px min targets; no horizontal scroll at 390; handles look clickable; Copy copies the full text.

## Owner decisions already made
Teal kept; F13 layout; C8 Copy; practice wording "Practice partner wanted"; Contact above Achievements; languages as a centred fact; city = London only; no gallery; Join low-key.
## Still open (decide under owner rules, log in the PR)
Going next opt-in default (recommend OFF).
