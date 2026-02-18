# Dancer Dashboard Pilot Framework (Phased)

## Scope
Controlled pilot for Dancer dashboard architecture using Vendor dashboard structural DNA.

- Keep ecosystem consistency.
- Keep design language and primitives unchanged.
- Reuse structure/interaction systems where role-relevant.
- Remove vendor-only operational complexity.

---

## Phase 1 — Vendor Structural DNA Extraction

### 1) Structural Patterns (Extracted)

Source: [src/components/profile/VendorDashboard.tsx](src/components/profile/VendorDashboard.tsx), [src/pages/VendorDashboardPage.tsx](src/pages/VendorDashboardPage.tsx)

- Header layout
  - Compact role header + role subtitle + primary objective CTA summary card.
  - “Core steps” counter + context CTA (`nextStepAction`) creates guided progression.

- Bento grid logic
  - Tile schema object (`ModuleSlot`) drives layout and behavior.
  - Responsive span system (`spanClass`) maps semantic col spans to breakpoints.
  - Auto-row grid with compact tile cards and one primary action per tile.

- Tab structure
  - Four-purpose tabs (`growth`, `catalog`, `presence`, `operations`) create mental grouping.
  - Each tab has short purpose copy and focused tiles.

- Section hierarchy
  - Dashboard shell (overview + guidance) -> modular tiles -> embedded section editor.
  - Editor sections are ordered, numbered, and save-target aware in Vendor editor.

- Action placement
  - Primary CTA in summary card.
  - Secondary CTAs at tile level (“Open/Manage/Edit”).
  - Save-action zones at section level in editor, with focused-mode inline save.

- Status badge logic
  - Binary status model (`live`, `attention`) + status dots.
  - Section progress map (`VendorDashboardProgressMap`) determines completion state.
  - “Updated” pulse badge appears after section save.

- Modal patterns
  - Dashboard shell opens editor in `Dialog` with forced-section context.
  - Embedded focused mode passes section + profile focus.
  - Shared modal primitives keep overlay/elevation/motion consistent.

### 2) Module Categorization

#### Universal modules (cross-role reusable)
- Guided progress summary (core steps + next action).
- Tabbed bento shell.
- Tile-level action model.
- Section completion map.
- Focused section edit modal pattern.
- Local draft/save affordances.

#### Vendor-specific modules
- Product catalog management.
- Categories + shipping controls.
- Team leadership and member linking.
- Vendor-specific FAQ/business fields.

#### Revenue-related modules
- Promo code and discount model.
- Product price + variants + image commerce data.

#### Publishing modules
- Event linking for visibility/discovery.
- Public profile share card and link copy.

#### Media modules
- Business logo upload.
- Product image upload.

#### Profile identity modules
- Business basics (name, city).
- Contact/social channels.

### Deliverable: Vendor Structural DNA
- Captured as reusable shell primitives + role-specific content layers.
- Reusable architecture = tabs + bento + progress + modal editor.
- Variable layer = role modules, data fields, action semantics.

---

## Phase 2 — Dancer Core Purpose Framework

Source: [src/components/profile/DancerDashboard.tsx](src/components/profile/DancerDashboard.tsx)

### 1) Primary purpose of a Dancer in platform context
Priority order:
1. Discover and attend events/classes/festivals.
2. Build personal dance identity (role, styles, city, profile completeness).
3. Connect with partners and community.
4. Maintain active participation rhythm (going/interested/tickets/upcoming).
5. Access relevant opportunities (social links, future discounts if role-relevant).

### 2) Emotional outcome targets
- Empowered: clear next actions and progress visibility.
- Connected: partner/event pathways always nearby.
- Recognized: identity/profile expression is visible and editable.
- Organized: upcoming plans and activity are easy to scan.

### Deliverable: Dancer Dashboard Purpose Framework
- Job-to-be-done: “Help me move from intent -> attendance -> identity growth quickly.”
- Emotional promise: “I know what to do next, and I feel part of the scene.”

---

## Phase 3 — Feature Relevance Matrix (Vendor -> Dancer)

### Keep (as-is structural concept)
- Header + summary CTA model.
- Tabbed bento layout engine.
- Tile action conventions.
- Completion/status signaling.
- Embedded/focused edit modal pattern.

### Modify (adapt for dancer relevance)
- Growth tab -> Engagement/Discovery outcomes (events, classes, partners, festivals).
- Presence tab -> Personal identity (profile completeness, styles, role, city, media).
- Operations tab -> Personal planning (tickets, attendance, availability, partner intent).
- Event integration -> attendance-focused instead of storefront visibility.
- Contact/social -> lightweight personal links, not business contact stack.

### Remove
- Products.
- Categories/shipping.
- Team/leader management.
- Business FAQ section pattern.
- Vendor-specific commerce metadata.

### Replace
- Promo offer module -> optional “Deals/Discount perks” module if dancer-benefit exists.
- Business logo/media complexity -> profile photo + compact media identity.
- Publish/status copy -> participation momentum copy.

### Deliverable: Feature Relevance Matrix
- Vendor commerce/admin modules removed.
- Universal dashboard shell retained.
- Dancer-centric activity + identity modules prioritized.

---

## Phase 4 — Dancer Dashboard Architecture (Pilot)

### 1) Dancer Dashboard Layout Map

- Top Overview Section
  - Identity snapshot (name/city/avatar)
  - Core progress strip (completion + next best action)
  - One primary action CTA

- Core Activity Zone
  - Upcoming events/tickets
  - Going/interested counters
  - Discover events/classes shortcuts

- Engagement Zone
  - Partner search state + quick toggle
  - Festival plans / social participation
  - Community actions

- Profile Zone
  - Dance role + styles + experience
  - Profile completeness card
  - Edit profile action

- Settings Zone
  - Social/contact preferences
  - Account/system actions (kept compact)

### 2) Section Breakdown (tab-aligned)
- Overview: identity + next action + momentum widgets.
- Activity: events/classes/tickets/attendance.
- Engagement: partners + festivals + community.
- Profile: identity depth fields.
- Settings: low-frequency personal configuration.

### 3) Component Inventory

Required (MVP pilot)
- Dashboard header block.
- Progress summary card.
- Tab shell + bento tile renderer.
- Activity cards (next event, counts, tickets list).
- Profile completeness card.
- Edit-profile modal/sheet entry.

Optional (phase-after-pilot)
- Discount/perk tile.
- Personal goals/progress tracker.
- Rich media/playlist storytelling card.

### 4) Required vs Optional Features

Required
- Event discovery + attendance status.
- Partner/community connection entry points.
- Profile completeness + edit flow.
- Clear next action.

Optional
- Gamified milestones.
- Extended social proof modules.
- Secondary personalization widgets.

### 5) UX Flow Explanation
1. Land -> immediate identity + next action clarity.
2. Choose tab by intent (activity, engagement, profile).
3. Use tile action -> focused edit/flow.
4. Save -> return with visible updated state.
5. Repeat lightweight loop.

---

## Phase 5 — Simplification Check (Dancer Pilot)

### Complexity guardrails
- No vendor commerce modules.
- No admin/operator workload framing.
- No dense business metadata forms.
- No multi-step publish pipelines in dancer shell.

### Desired Dancer feel
- Lighter: fewer heavy form sections in primary shell.
- Personal: identity and participation first.
- Clear: one dominant next action, concise copy.
- Motivating: momentum metrics over operational burden.

### Pass/Fail checklist
- If a module does not improve dancer participation or identity, remove it.
- If a module reads as business operations, demote/remove.
- If scan time exceeds ~3 seconds for “what next,” simplify.

---

## System-Scale Outcome

This pilot preserves ecosystem consistency while proving a scalable role-dashboard system:
- Same shell primitives (tabs, bento, progress, focused modal edit).
- Role-specific module packs.
- Reusable governance for Teacher/DJ/Organiser rollout after Dancer validation.
