# Auth + Vendor Dashboard Sign-off Checklist

Date: 2026-02-12
Scope: Auth exit/save/restore journey and Vendor Dashboard mobile readability

## Setup

- Run app: `npm run dev`
- Use browser devtools responsive mode for widths: 360, 390, 430, 768, 1024
- Clear local state before first pass:
  - `localStorage.removeItem('auth_signup_draft_v1')`
  - Sign out active user session

---

## A) Auth Flow (Mode + Exit + Draft)

### A1. Entry and mode switch

- [ ] Open `/auth?mode=signup&returnTo=/profile`
  - Expected: Header shows create-account context and role-first step (Step 1 of 4)
- [ ] Tap `Sign in`
  - Expected: Switches to sign-in card without visual break
- [ ] Tap `Create account`
  - Expected: Returns to signup flow with Step 1 visible

### A2. Exit without progress

- [ ] On signup Step 1 with untouched fields, tap top-right `X`
  - Expected: Dialog appears with leave copy
- [ ] Confirm leave
  - Expected: Navigates to `returnTo` route
  - Expected: No draft key in localStorage

### A3. Save and exit with progress

- [ ] Re-open signup and make progress:
  - Pick role
  - Continue to Step 2
  - Enter email
- [ ] Tap `X`
  - Expected: Dialog includes save option and password-not-saved note
- [ ] Tap `Save & Exit`
  - Expected: Navigates away
  - Expected: `auth_signup_draft_v1` exists in localStorage

### A4. Restore behavior

- [ ] Re-open signup
  - Expected: Prior state restored (step/role/email/name/access mode)
  - Expected: One-time toast “Draft restored” appears
  - Expected: Inline “Draft restored” badge visible and dismissible

### A5. Leave without saving

- [ ] While draft exists, tap `X` then `Leave without saving`
  - Expected: Navigates away
  - Expected: `auth_signup_draft_v1` is removed

### A6. Successful sign-in clears draft

- [ ] Seed draft again (A3), then switch to sign-in mode
- [ ] Complete valid password sign-in
  - Expected: Navigates to `returnTo`
  - Expected: `auth_signup_draft_v1` is removed

### A7. Successful sign-up session clears draft

- [ ] Seed draft, complete password signup in an environment where `data.session` is returned immediately
  - Expected: Redirects to selected role create-profile route
  - Expected: `auth_signup_draft_v1` is removed

### A8. Email-confirmation signup behavior (known expected)

- [ ] Complete password signup in email-confirmation-required environment (no immediate session)
  - Expected: “Check your email” toast
  - Expected: Draft may remain until user returns and completes auth

---

## B) Vendor Dashboard Responsive QA

Open vendor dashboard and verify at widths: 360, 390, 430, 768, 1024.

### B1. Top stat strip readability

- [ ] Completion/logo/products/promo/shipping/events cards render without text overlap
- [ ] No clipped numbers or labels

### B2. Attention strip + quick actions

- [ ] “Needs attention” text remains readable
- [ ] Action buttons wrap cleanly (no overflow/cutoff)

### B3. Capability grid density

- [ ] Cards auto-fit without squashed content
- [ ] Missing sections surface early on mobile (ordering intent preserved)
- [ ] Buttons stay tappable and legible

### B4. Content edge cases

- [ ] Long business name does not break layout (line-clamp behavior)
- [ ] Empty sections show sensible placeholders
- [ ] Event row with long title remains contained

---

## C) Final Regression Smoke

- [ ] Navigate between auth, profile, and vendor routes without console errors
- [ ] Build still passes: `npm run build`
- [ ] Existing non-blocking warnings unchanged

---

## Sign-off

- QA Owner: __________________
- Date: ______________________
- Result: Pass / Pass with notes / Fail
- Notes:

---

## Quick 5-Min Pre-Merge Pass

Use this when you need a fast confidence check before merge.

- [ ] Open `/auth?mode=signup&returnTo=/profile` and verify Step 1 is role-first
- [ ] Add signup progress (role + email), tap `X`, choose `Save & Exit`, confirm draft exists
- [ ] Re-open signup, confirm draft restore toast + badge, then `Leave without saving` clears draft
- [ ] Complete password sign-in and confirm navigation + draft cleared
- [ ] Check vendor dashboard at 390px and 768px for no card/button overflow
- [ ] Run `npm run build` and confirm success (known non-blocking warnings acceptable)
