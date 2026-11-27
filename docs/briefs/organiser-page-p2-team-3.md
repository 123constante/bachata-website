# Brief: organiser page P2 Team -- continuation 3 (close the PR)
Brief-version: 2
Branch: claude/organiser-page-p2-team
Lane: careful, hard-tier (touches scripts/; independent review + owner Approve at head). Opus. Repo 123constante/bachata-website. PR #1437 is open; push to the same branch, do NOT open a new PR.

## Goal
Make PR #1437 green and honest. Read docs/handover/organiser-page-p2-team.md on the branch first: it lists what continuation 2 did and what is left. Do not redo done work.

## What main lacks
- extends: an entry in the onboarding write-doors list for set_organiser_team_member_hidden_v1, reason "Organiser-page team visibility, not an event edit." (same shape as the existing organiser_team_set_public_v1 entry under not_event_writes), so `npm run check:onboarding-write-doors` passes -- grep: Organiser-page team visibility
- a continuation-3 section in the handover with the final CI per-job table and the bundle budget main vs branch -- docs/handover/organiser-page-p2-team.md

## Files
- scripts/onboarding-write-doors.json
- docs/handover/organiser-page-p2-team.md (new)

## What to build
1. Add the ONE not_event_writes entry above to scripts/onboarding-write-doors.json. Authorised by the lead for this brief only; touch nothing else under scripts/. Run `npm run check:onboarding-write-doors` and show it green.
2. Re-check each failing CI job on the branch head (integrity, phone-qa, contract-check were red at 30ae8f9): run every step of each job that applies (read .github/workflows), say which are fixed by item 1 and which are not. Pre-existing and identical on main (4 eslint errors in EditInPlaceLayer.tsx, the TeamPicker.test.tsx(297) tsc error): prove "same on main" by running them on origin/main and say so; do not fix them here.
3. Bundle budget: `npm run build` then the budget check on main and on the branch; put both numbers in the handover.
4. Update the handover (Done / Left / Verified / Not verified). The 390x844 browser walk is done by the lead, not you: list it under Not verified.

## Do NOT touch
Workflows, supabase/**, migrations, .env*, the density-exempt calendar files, any other scripts/ file, any screen behaviour (this brief changes no UI).

## Done when
One push to claude/organiser-page-p2-team; PR body updated with the per-job table and Verified / Not verified; last commit subject ends with the [worker-done ...] marker.
