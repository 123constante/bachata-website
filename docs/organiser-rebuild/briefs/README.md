# Organiser R1 briefs (phase 5, 2026-10-16)

Each slice brief = `00-COMMON.md` (the plan-4.9 header + phase-5 additions) + that slice's 4.4 row, its 4.3 interfaces verbatim, its 4.5 tests, the D-numbers it embodies (D5-D65) and the 4.12 R3 lines that touch it. The plan copy is `../R1-PLAN.md` (4.11 and 4.12 amend 4.1-4.9).

| Wave | Slice | Repo | Branch | Base | Brief |
|---|---|---|---|---|---|
| 0 | A0 parity | bachata-admin | `claude/org-r1-e2e-parity` | `main` | `A0-parity.md` |
| 0 | S0a shell | bachata-website | `claude/org-r1-shell` | `main` | `S0a-shell.md` |
| 1 | A1 admin (A1a `20261126180000` + A1b `20261126190000`) | bachata-admin | `claude/org-r1-admin` | `main` | `A1-admin.md` |
| 1 | S0b core | bachata-website | `claude/org-r1-core` | `main` | `S0b-core.md` |
| 2 | S1 home | bachata-website | `claude/org-r1-home` | `feat/organiser-r1` | `S1-home.md` |
| 2 | S2 change | bachata-website | `claude/org-r1-change` | `feat/organiser-r1` | `S2-change.md` |
| 3 | S3 add+cancel | bachata-website | `claude/org-r1-addcancel` | `feat/organiser-r1` | `S3-addcancel.md` |
| 3 | S4 new | bachata-website | `claude/org-r1-new` | `feat/organiser-r1` | `S4-new.md` |
| 4 | S5 events | bachata-website | `claude/org-r1-events` | `feat/organiser-r1` | `S5-events.md` |
| 4 | S6 team | bachata-website | `claude/org-r1-team` | `feat/organiser-r1` | `S6-team.md` |
| 5 | S7 page+more | bachata-website | `claude/org-r1-pagemore` | `feat/organiser-r1` | `S7-pagemore.md` |
| 5 | S9 door | bachata-website | `claude/org-r1-door` | `feat/organiser-r1` | `S9-door.md` |
| 6 | S8 e2e+matrix | bachata-website | `claude/org-r1-e2e` | `feat/organiser-r1` | `S8-e2e.md` |
| each | R-n review | same repo | `claude/org-r1-review-<slice>` | the slice branch | review brief = "REVIEW-<slice>.md only; opus xhigh; findings to the SAME slice in one pass" |

Two workers at a time (owner rule). `feat/organiser-r1` is cut from `main` by the orchestrator after S0a + S0b are reviewed, and rebased onto #785 when that merges (R3-16). A1a goes to prod early (owner apply); A1b only in the merge train right before the R1 Website merge (D58).
