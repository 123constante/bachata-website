# W2 walk-through fixes on PR #977 (Website, normal lane)

Repo: 123constante/bachata-website. Work ON the existing branch `claude/invite-w2-phone-ig-golive` (PR #977, head b310589e). Add commits; do not open a new PR. Read the PR body, its handover, and `docs/design/977.md` first.

## Why
The owner asked for a beginner walk-through before merging #977 (personas: new organiser, teacher/DJ with missing details, dancer) and decided: "fix ALL findings in ONE PR" before merge. The walk was done at 390x844 on localhost with test accounts. A check that would have caught most of these: one table-driven test per screen that every go-live-required key is labelled required, is asked first, and is counted, all from ONE shared mapping.

## Findings (fix all 1-9, verbatim from the walk)
1. BLOCKER-ish: /account/o/complete marks go-live-REQUIRED keys "Optional." (teaching_styles "Which styles do you teach?", dj_name, dj genres "What music do you play?") with no Skip; reaching them takes ~16 optional screens; the "N answers left" counter never moves while skipping optional ones and the first "3 answers left" step is an OPTIONAL surname. Fix: required steps say "Needed before your events can go live." (same words as other required steps), order required steps FIRST (and when entered from Go live / event page with returnTo, ask ONLY the required ones), counter = required only.
2. Completion end screen "You can publish now": only "Keep going"; "Finish later" drops returnTo (lands /account/o, not the event). Fix: primary button "Back to <event>" when returnTo, "Keep going" secondary.
3. Teacher/DJ details editors (/account/t/details, /account/dj/details) say "Every detail is optional" + "(optional)" on the go-live keys. Same words as 1.
4. Organiser home to-do shows 1 item ("Add a date") while the event's Go-live list has 8+; "Finish your profile: 3 answers left" vs real blockers. Fix: home to-do reads the same go-live list (one mapping).
5. Go-live labels: no_session_first_date, no_payment, no_flyer -> "Something else on the event" (no_payment row has no link). Add labels + links (payment section).
6. Phone step help "shows only if you switch that on" but show_phone_publicly defaults TRUE (guard-pinned). Copy: "It shows on your page so dancers can reach you. You can hide it in My page."
7. Sign-up as Organiser after tapping Sign in on a public page lands back on that page (AuthCallback shouldHonorReturnTo honours returnTo for a sign-up) -> organiser never reaches /account/o; dancer home says "Dancer", only route = Options > "Run events? Become an organiser". Fix: an organiser-type sign-up whose returnTo is a plain public browse page lands on /account/o (keep claim/invite returnTo).
8. Beta gate told only at the END of "Create a new page" (after name + city). Say it up front on the Welcome/Find your page screen (and on "Become an organiser").
9. Smaller: "Page name" sheet has no hint (your school/brand name) and a silent disabled Next; city asked again (not prefilled from sign-up city); photo step shows "Not now" in the header while saying it "cannot be skipped"; nationality search "Brit" finds nothing (match demonyms or say "type the country").

## Tests (red first)
- Findings 1, 3, 4, 5: ONE shared mapping (go-live blocker key -> label, link/section, required flag, which profile key it needs). Table-driven tests over every blocker key x every screen (complete flow, t/details, dj/details, organiser home to-do, Go-live list): required keys never say "optional", every blocker has a label other than "Something else on the event" and a link, counter counts required only, home to-do count == Go-live list count. Commit the tests failing first, then the fix.
- Finding 7: unit test over shouldHonorReturnTo (organiser sign-up + public browse returnTo -> /account/o; claim/invite returnTo kept; sign-in unchanged).
- Finding 2: returnTo survives "Finish later" and the end screen.
- A disabled control says why (finding 9 Next); empty states say what the person can do.

## Boundaries
- No database change, no `supabase/**`, no migration. If a fix seems to need one, write it in the handover and skip it.
- Do not touch the dancer edit slice that was split out (dancer-area isolation).
- Vercel is at 70/100 deploys in 24 h: run every CI job step locally in your sandbox (read `.github/workflows/*`), then push ONCE.
- Update the PR body: per-job table, Phone QA section (390x844 shots of the changed screens), a "Walk-through fixes 1-9" list with the commit for each, and update `docs/design/977.md` (Design Gate stage 4 checks: contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll).

## Output
End with a handover in the PR body: each finding 1-9 -> fixed (commit) / not fixed (why), tests added, CI per-job table, what is left.
