# Brief: new-dancer journey UX audit (read-only, findings only)

Repo: 123constante/bachata-website, `main` (ecc3432e or later). Push ONLY branch `claude/dancer-journey-audit`
with ONE new folder `docs/audits/dancer-journey-2026-10-16/` (report.md + screenshots). No product code changes,
no PR. Model: Opus. Stop after the push and the report.

## Why (owner's words, 2026-10-16)
"Why am I having to do this? I am a beginner and you should be the professional that is creating the entire design."
The owner found, on a phone, in minutes: (1) organiser search results hidden behind the keyboard; (2) full top and
bottom navigation shown during sign-up, pulling people away; (3) "Terms and privacy policy" disabled with the false
reason "not published yet" (pages are live since #762); (4) the header avatar of a new dancer with no photo is a plain
black circle. Every one should have been found by us first. Your job: find EVERYTHING else of this kind on the
new-dancer journey before the owner sees it again.

## Scope: every screen a new dancer meets, in order
Home (signed out) -> event/night pages -> Create account (/auth?mode=signup) -> email step -> code step (all states:
waiting, wrong code, locked, resend) -> accept card -> first dancer-profile setup (every step, photo step included)
-> dancer area: Home, Nights, Me, Options and everything Options opens (share page, feedback, add to home screen,
help, terms/privacy, sign out, hide profile / download data / delete account) -> /account/settings ->
/account/deleted -> sign back in (restore) -> /privacy, /terms. Organiser screens are OUT of scope.

How: the phone suite (`playwright.phone.config.ts`, `tests/e2e-phone/fakeSupabase.mjs`) on a PRODUCTION build,
at 390x844 and 360x640. Seed realistic data from a read-only prod survey via the Supabase connector (COUNTS and
SHAPES only, never personal data): a brand-new dancer (no photo, no city, no nights), a half-finished profile,
a full profile with a very long name, many saved nights, zero nights.

## Checklist for every screen x state (record pass/fail for each cell)
1. Keyboard: focus each text field, simulate the keyboard (viewport height ~470, and a shrunken visualViewport);
   field and its results/next button visible and tappable. (A fix is in flight on `claude/site-keyboard-safe`;
   still record today's result.)
2. Distraction: during a task (sign-up, profile setup, delete flow) is anything on screen that leads away from it?
3. Disabled or hidden controls: every disabled control states a TRUE reason and what the person can do; no reason
   text that is stale (grep `src` for "not published", "coming soon", "not yet", "TODO" in user-facing strings).
4. Empty states: no photo / no data / zero results show a designed placeholder (initials, illustration, a clear
   next step), never a blank or black shape.
5. Text points only at controls that are on screen; every link and button goes somewhere real (no 404, no dead tap).
6. Contrast >= 4.5:1 for body text, 3:1 for large text and controls (measure, do not eyeball).
7. Tap targets >= 44x44 px; `elementFromPoint` at each primary button hits it; nothing hidden under bars.
8. Copy: plain words a beginner understands; no internal terms; consistent names for the same thing across screens.
9. Dead ends: every screen has an obvious next step or way back.
10. Sideways scroll: none. Long names and emails wrap.

## Output
`report.md`: a findings table ranked by severity (blocker / high / medium / low): screen, state, size, checklist
number, what is wrong, measured evidence, screenshot file, and a SUGGESTED fix in one line (the orchestrator
decides). Then the full screen x checklist matrix. Then "Not verified" (real keyboard, real email, real upload).
Screenshots: PNG, named `<screen>-<state>-<size>.png`, under 400 KB each.

## Rules
- Read and push with PLAIN git. Never `gh api`. Shell commands without variables, loops or `$(...)`.
- Supabase: read-only SELECTs, counts and shapes only. Never a write. Never sign in to the live site.
- Never merge, approve or `--no-verify`. No PR.
- Context: at 25% start nothing new; by 30% push what you have with a "left to audit" list in report.md, last
  commit subject ending `PARTIAL [worker-done <ticket>]`.
