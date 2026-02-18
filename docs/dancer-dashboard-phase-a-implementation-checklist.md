# Dancer Dashboard — Phase A Implementation Checklist

## Scope lock (Phase A only)

This checklist implements the first controlled build step from the pilot framework.

- Role scope: Dancer only.
- Structural goal: align Dancer shell with Vendor dashboard DNA.
- Constraint: no new design language, no backend schema changes.
- Exclusions: Teacher/DJ/Organiser/Vendor refactors, advanced gamification, new analytics pipelines.

---

## Target outcome

Deliver a Dancer dashboard shell that is:

- Structurally consistent with Vendor architecture (header + progress + tabbed bento + focused edits).
- Content-relevant for dancer purpose (events, attendance, profile identity, partner/community).
- Simpler than Vendor (no commerce/admin complexity).

---

## File-level implementation plan

## 1) Shell normalization

Primary file: [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)

- [ ] Replace mixed long-page + duplicated tab sections with one consistent shell:
  - [ ] Header block
  - [ ] Summary/progress card
  - [ ] Tabbed bento tiles
  - [ ] Focused edit entry point
- [ ] Keep existing role routes/actions intact (no route contract changes).
- [ ] Remove duplicate/competing sections that repeat the same intent.

Acceptance
- [ ] Single top-level information architecture is visible on first load.
- [ ] No duplicated modules across hero/body and tabs.

## 2) Introduce Dancer module schema (Vendor-style)

Primary file: [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)

- [ ] Add typed tab enum for dancer contexts:
  - [ ] overview
  - [ ] activity
  - [ ] engagement
  - [ ] profile
  - [ ] settings
- [ ] Add typed module slot schema for bento tiles:
  - [ ] title
  - [ ] description
  - [ ] span
  - [ ] status
  - [ ] action label
  - [ ] action target
- [ ] Add reusable span class mapper (same pattern as Vendor shell).

Acceptance
- [ ] All tiles render from config, not ad-hoc JSX blocks.
- [ ] Tile placement is responsive and deterministic.

## 3) Dancer progress/status system

Primary file: [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)

- [x] Define dancer progress map (parallel to Vendor concept) with role-relevant checks:
  - [x] identity basics complete
  - [x] profile media complete
  - [x] events participation present
  - [x] partner/community intent set
  - [x] contact/social minimum
- [x] Add two-tier status for tiles:
  - [x] ready/live
  - [x] attention
- [x] Add next-best-action resolver for summary CTA.

Acceptance
- [x] Summary shows a clear next action.
- [x] Each tile status reflects real dancer data state.

## 4) Tab purpose and module mapping

Primary file: [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)

- [x] Overview tab: identity + momentum + next event.
- [x] Activity tab: going/interested/tickets/calendar actions.
- [x] Engagement tab: partner search + festivals/community actions.
- [x] Profile tab: role/styles/experience/profile completeness actions.
- [x] Settings tab: social/contact and low-frequency account actions.

Acceptance
- [x] Every module can be justified by dancer purpose framework.
- [x] No vendor-commerce concepts appear in dancer tabs.

## 5) Focused edit pattern alignment

Primary files:
- [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)
- [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx) (reuse only, avoid style drift)
- [src/components/ui/sheet.tsx](src/components/ui/sheet.tsx) (if already used for edit workflow)

- [x] Keep one clear edit entry pattern (dialog or sheet, not competing flows).
- [x] Ensure tile actions map to focused edit destinations.
- [x] Keep save feedback concise and consistent.

Acceptance
- [x] User can open, edit, save, and return without context loss.
- [x] No duplicate edit pathways for same field group.

## 6) Remove non-relevant complexity

Primary file: [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)

- [x] Remove admin-style operational fragments not needed for dancer.
- [x] Remove placeholder FAQ/admin sections if not dancer-critical in Phase A.
- [x] Keep only role-relevant metrics and actions.

Acceptance
- [ ] Dancer dashboard scan clarity under 3 seconds:
  - [x] What this is
  - [x] What to do next
  - [x] What changed recently

## 7) Copy and label clarity

Primary file: [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)

- [x] Use short, action-first labels.
- [x] Avoid internal/admin terms in dancer-facing copy.
- [x] Keep one primary action per tile.

Acceptance
- [x] No ambiguous CTA text.
- [x] No repeated helper text in adjacent modules.

---

## Validation checklist

## Code quality
- [ ] No TypeScript errors in changed files.
- [ ] No new lint violations attributable to Phase A changes.

## Build
- [ ] Run npm run build successfully.

## UX verification (manual)
- [ ] Mobile: tab scan and button readability.
- [ ] Tablet: tile hierarchy remains clear.
- [ ] Desktop: bento rhythm and whitespace balanced.
- [ ] Edit flow returns user to same dashboard context.

---

## Out of scope for Phase A

- New backend fields or RPC changes.
- Cross-role system rollout beyond Dancer.
- New visual language tokens.
- Incentive/gamification frameworks.

---

## Phase A completion gate

Phase A is complete only when all are true:

- [ ] Dancer shell structurally mirrors Vendor DNA pattern.
- [ ] Dancer feature set is role-relevant and simplified.
- [ ] Navigation/edit loop is coherent and low-friction.
- [ ] Build passes and no new runtime regressions are observed.
