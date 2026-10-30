# Handover: P3 audit, gate group (dt_2863c744c4ee)

- Done: `docs/design/p3-acceptance/AUDIT-gate.md` (door table of 42 writes, findings A-gate-1..11 and A-gate-J1..J14, per-step verdicts, browser-walk list). Docs only, no src/ edits, prod read with SELECT counts only.
- Headline: flag `organiser_onboarding_gate` is OFF; 0 of 48 claimed pages would pass (organiser_onboarding_progress empty); no server grace exists, so flipping the flag locks 11 non-admin organisers (4 pages, 7 live series) out of every event write at once (A-gate-1, blocker). Banner copy "Until then everything works as usual" is false with the flag ON (A-gate-2).
- Left: the browser walks listed in the doc (flag ON on a branch DB / test account, never prod). Owner questions are inline under each finding.
- Next: owner decides grace + safety-write exemptions before any flag flip; fix A-gate-3/4/5 (unrouted refusals, no return path).
