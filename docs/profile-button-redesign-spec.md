# Profile Button Redesign Spec

> Implemented state (Feb 2026): Multi-role profile entry uses selector-only switching (no top-level Continue/My Profiles hub cards). This spec reflects current shipped behavior plus forward-looking decisions marked as open or phased.

Status legend:
- Current: shipped/default behavior
- Future: planned or optional enhancement

## Goal
When users tap Profile in bottom navigation, they should land in the most useful next step with minimal friction.

Primary outcomes:
- Reduce dead-end states
- Reduce unnecessary role switching friction
- Improve completion of missing profile data
- Keep behavior predictable for multi-role users

---

## Current Entry Points
- Bottom nav Profile trigger: src/components/MobileBottomNav.tsx
- Main destination screen: src/pages/Profile.tsx
- Role existence resolver: src/hooks/useUserIds.tsx
- Role management surface: src/components/profile/ManageProfilesHub.tsx

---

## Behavior Decision Tree (Current + Future)

### 1) User not authenticated
Status: Current (default) + Future (optional)

Action on Profile tap:
- Current: Navigate to /auth?mode=signin&returnTo=/profile
- Future: Open auth gate sheet/dialog with:
  - Sign in
  - Create account
  - Preserved return target to profile flow after auth

### 2) User authenticated, zero roles
Status: Current

Action:
- Route to Profile shell with prominent empty-state launcher:
  - Create first profile
  - Role cards with one primary CTA each
- Keep ManageProfilesHub visible below fold.

### 3) User authenticated, exactly one role
Status: Current

Action:
- Auto-enter that role dashboard directly (skip role selector)
- Keep “Add/Claim another profile” visible lower on page.

### 4) User authenticated, multiple roles
Status: Current

Action:
- Show role selector and enter selected role dashboard in one tap.

---

## UX Information Architecture

## A) Profile Landing Header
Status: Future

- User identity (name/avatar)
- Account status chips (example: 1 profile needs attention)
- Fast actions: Edit account, Add role, Sign out

## B) Role selector section
Status: Current

- Sticky selector for available roles
- One-tap switch between role dashboards
- Keep current role visibly highlighted

## C) Manage/Expand section
Status: Current

- Existing ManageProfilesHub behavior retained
- Create and Claim options unchanged but surfaced with clearer hierarchy

---

## Data + State Rules
Status: Current

Derived states from useUserIds result:
- isAuthenticated: boolean
- roleCount: number
- availableRoles: UserRole[]
- defaultRole:
  - lastActiveRole from localStorage when valid
  - else first available role

New local preference:
- profile_last_active_role
  - Write whenever user switches role
  - Read on Profile entry

## Component Plan

### Keep
- src/pages/Profile.tsx
- src/components/profile/ManageProfilesHub.tsx

### Add
- src/components/profile/ProfileEntryRouter.tsx
  - Encapsulates current decision tree logic

### Update
- src/components/MobileBottomNav.tsx
  - Profile tab should route into entry router behavior
- src/components/profile/ProfileSelector.tsx
  - Primary multi-role switcher at profile entry

---

## Route/Navigation Contract
Status: Current

No backend changes required.

Recommended route behavior:
- /profile remains canonical profile route
- ProfileEntryRouter inside Profile page determines which view to show:
  - Auth gate
  - Empty launcher
  - Single-role direct dashboard
  - Multi-role selector + dashboard

---

## Accessibility + Usability
Status: Current guidance
- Keep one clear primary action per state
- Minimum touch target 44px
- Visible focus states for all actionable controls
- Avoid hidden critical actions behind tabs for first step
- Use concise copy and explicit verbs: Open, Switch role, Add role

---

## Rollout / Delivery Status

### Phase 1
Status: Completed

- Added ProfileEntryRouter logic
- Preserved Profile page content below
- Added last active role persistence

### Phase 2
Status: Completed

- Kept multi-role entry minimal with selector-only switching

### Phase 3
Status: Partially completed

- Completed: analytics events added for profile entry/switch/add-role flows
- Future: auth gate dialog for unauthenticated Profile tap

---

## Acceptance Criteria
Status: Current target
- Unauthenticated user tapping Profile sees sign-in/create action in <= 1 step
- User with one role reaches useful dashboard in <= 1 tap
- Multi-role user can switch roles in <= 1 tap from selector
- No white-screen or dead-end routes

---

## Analytics Events (recommended)
Status: Current + optional extensions
- profile_entry_opened
- profile_entry_state_detected (unauthenticated|zero_roles|single_role|multi_role)
- profile_role_switched
- profile_add_role_clicked

---

## Vendor Status Tiers
Status: Current (frontend-only)

Purpose:
- Show vendors a clear maturity path without removing any existing fields or strict publish checks.

Tiers:
- Draft
  - Default state when core launch criteria are incomplete.
- Basic Published
  - Business name
  - City
  - At least 1 category
  - At least 1 product
  - At least 1 contact channel
- Optimized
  - All Basic Published criteria, plus:
  - Primary image
  - FAQ
  - At least 2 product images
  - At least 1 linked event
  - Active promo
  - At least 2 contact channels

UX notes:
- Tier badge appears in vendor dashboard identity/visibility surfaces.
- Tier panel shows completion counters and top missing criteria for both Basic Published and Optimized.
- This is UI-only guidance; no backend/schema changes and no publish-rule relaxations.

Implementation refs:
- src/components/profile/VendorDashboard.tsx
- src/pages/CreateVendorProfile.tsx

---

## Core Profile First Strategy (Recommended)
Status: Future recommendation

### Product framing
Use a core-profile-first model (optionally still labeled Dancer in UI).

Why:
- Prevent orphan role profiles.
- Keep multi-role linking deterministic.
- Keep community identity consistent across roles.

### UX rule
If user chooses a non-dancer role first (Vendor/Teacher/DJ/Organiser/Videographer):
- Ensure a core/dancer profile exists.
- Auto-create a minimal stub if missing.
- Continue to selected role flow without forcing full dancer onboarding.

### Minimal dancer stub (autocreated)
Store only safe basics:
- user_id
- first_name/surname (if available)
- city (required)
- status flag: `is_stub = true`

Do not require heavy onboarding fields at this step.

### Completion prompt policy
- Do not block role creation after stub exists.
- Prompt users later via dashboard banners and manage-profile surfaces.

---

## Data/Schema Contract
Status: Future recommendation

### Required invariant
For any user owning a non-dancer role profile, there must be a dancer profile for the same user.

### Preferred enforcement layers
1) Frontend guard (fast UX): call ensureDancerProfile(userId) before non-dancer create routes.
2) Backend RPC (source of truth): ensure_dancer_profile(p_user_id uuid) finds or creates stub and returns dancer id.
3) Optional DB hardening (later): add trigger/check to block non-dancer inserts without dancer row.

---

## Migration Plan (Existing Users)
Status: Future recommendation

### Step 1: Backfill script
Backfill dancer stubs for users with non-dancer profiles but no dancer profile.

Backfill logic:
- Collect distinct user_ids from organiser/teacher/dj/vendor/videographer tables.
- Left join dancer by user_id.
- Insert missing rows with `is_stub = true` and best-available names.

### Step 2: App rollout
- Deploy frontend guard + backend RPC.
- Keep soft completion prompts.

### Step 3: Observe
- Track role-creation and profile-linking errors.
- Measure non-dancer onboarding conversion.

### Step 4: Optional strict enforcement
Add DB constraint/trigger only after migration metrics are clean.

---

## Routing + Flow Changes
Status: Future recommendation

### Auth/Create-account role-first path
When user picks a role:
- Dancer: route to dancer create flow directly.
- Any other role: ensure dancer exists (RPC), then route to selected role create flow.

### Manage Profiles Hub
For “Create” actions on non-dancer roles:
- Run ensure step first, then navigate.

### Profile entry states
- Single-role non-dancer user still allowed.
- Internally, dancer stub ensures linked base identity.

---

## Acceptance Criteria (Core-first extension)
Status: Future target

- Any non-dancer role creation results in an existing dancer profile for that user.
- Non-dancer onboarding adds no extra mandatory step before role creation.
- Existing non-dancer users are backfilled with dancer stubs.
- City remains required and validated for every profile type.
- No regressions in vendor/teacher/dj/organiser creation success rates.

---

## Open Decisions
Status: Active
- Resolved: Create-account path shows role picker first (before email/password) to increase motivation and role intent clarity.
- Resolved: Adopt core-profile-first model using automatic dancer stub creation for non-dancer role onboarding.
- Should unauthenticated Profile tap open modal or route to full auth page?
- Should we add lightweight completion nudges without reintroducing a top-level hub?
- Should completion logic be strict per role now, or start with vendor-only and expand?
