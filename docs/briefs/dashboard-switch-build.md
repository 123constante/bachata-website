# Brief: dashboard switch build (option C, Round-4 everywhere)

Class: BUILD-visual. Branch: claude/dashboard-switch. Behind a flag (follow the repo's existing flag convention; name it `dashboardSwitchR4`). One PR. Lane: normal.

## Approved design (do not redesign)
Source of truth: `origin/claude/dashboard-switch-look` (PR #1825): `docs/design/dashboard-switch/look-round.html` (draw C = "Round-4 everywhere", BEFORE/AFTER) and `INVENTORY.md` (54-row keep-list; every row must survive unless listed below). Fetch that branch and read them with grep + offset reads (look-round.html is big, never read whole). Organiser Switch page look = canvas Round 4 screen 5 (https://claude.ai/artifact/WyBvUeP1paFcUYR8frNyiR). Registry row "Dashboard switch (all worlds)" in `~/.claude/plans/DESIGN-REGISTRY.md` (owner picks 2026-11-19):

1. Top-right switch sheet on dancer AND organiser, Round-4 look (white card, 1px #E9E9E9, radius 11, buttons 42px, 13px UI text, orange #C2410C only for main action/active).
2. Switch button shown even with ONE profile (sheet = that profile + "+ Add a profile").
3. Teacher/DJ rows: grey "coming soon", shown ONLY if the role was picked at onboarding (`isAreaShown` signal, `areas/home/areaStatus.ts`). This now also hides them for people who merely HOLD the role (owner confirmed 2026-11-19).
4. Organiser sheet gets the same "+ Add a profile" row, same place as dancer sheet.
5. Organiser Switch page `/account/o/switch`: each row keeps name, Owner/Manager word, to-do badge, Live chip, Showing chip. Add card = option B, one row.
6. "Sign out" MOVES out of the sheet to a quiet text link at the very bottom of Account settings; two-step confirm kept; do not make it prominent.
7. Everything else in INVENTORY.md stays as is (Esc/backdrop close, loading/error states, Account settings link, "Your areas", Discard-changes guard, status dots/words).

## Rules
- Flag off = pixel-identical to today. Flag on = new look.
- Anything noticed but not in this list: LIST it in the PR body, never change it.
- Density exclusions and `.claude/rules/*.md` apply. Do not touch the calendar files or `components/ui/dialog.tsx`.
- Tests: unit for the Teacher/DJ rule and one-profile button; e2e per repo spec list (add by name).
- 390x844 screenshots BEFORE and AFTER (flag on) for: dancer sheet, organiser sheet, Switch page, Account settings foot. Attach to the PR.
- PR body from `~/.claude/docs/pr-body-template.md`; include "Verified on real data" (prod read-only counts of profiles per user; no personal data).
- Do not merge. Bot-authored PR. Push early.
