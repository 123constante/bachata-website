# Brief: acceptance-contract-r1 (the whole-area Acceptance Contract for the organiser area; docs only)

Lane: normal (docs). Model: Sonnet. Branch: claude/acceptance-contract-r1. Docs only: no code, no migration, no prod write.

## Owner words (why)
Owner 2026-10-30: "I should not have to check everything." Rebuilds need ONE whole-area acceptance contract (every person type x every journey x every data shape) that an independent reviewer checks BEFORE the owner sees anything. Owner 2026-10-31: after the flip, "the Acceptance Contract arc" continues; most organisers EDIT events, few create; creates are mostly one-off or recurring. Owner 2026-11-01: the invite path must be easy with no problems; platform future depends on it.

## INVENTORY FIRST
Write `docs/acceptance/INVENTORY.md` BEFORE the contract: every person type (signed-out visitor, new account no profile, dancer with profile, invited joiner, owner, manager, contributor, admin), every journey (claim/invite/join, finish details, edit page, create one-off/weekly/monthly/course/workshop/festival, edit event/session/line-up/prices/tickets, repeat rules/copy, cancel/move, team add/remove/handover, switch page, leave), every data shape (counts from prod, read-only: series by lifecycle x format, empty organiser_ids, 100+ dates, ended, cancelled, no photo, no contact, multi-organiser, co-hosted), with file:line for the screen that serves each. GAPs listed. End with a coverage count: N rows, N mapped, none silently omitted.

## The contract (`docs/acceptance/CONTRACT.md`)
A table: person x journey x shape -> the expected screen/state in plain words, who can do it (server rule: cite the live RPC check, e.g. `_assert_can_edit_series_p5` allows owner/manager, not contributor; empty organiser_ids is admin-only), and how it is checked (unit/matrix test name, e2e spec, 390x844 walk, or owner phone). Mark each row COVERED / GAP / OWNER-PHONE. Rank the GAPs by how many real organisers hit them (counts). Include the 8-row Screen quality bar (calm, plain words, one primary action, empty states say what you CAN do, disabled controls say why, no copy pointing at a missing control, taps >= 44 px, no sideways scroll).

## Hard limits
Supabase read-only (counts only, no personal data). Never merge or approve. Docs-only PR. Handover `docs/handover/acceptance-contract-r1.md`.
