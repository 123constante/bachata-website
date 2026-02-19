

## Redesign Signup UX/UI as a Multi-Step Wizard

### Overview
Replace the current single-card signup form (role grid + name + city + email all visible at once) with a clean, animated multi-step wizard. Each step focuses on one concern, reducing cognitive load and reflecting the flow we designed.

### New Signup Steps

```text
Step 1: Role Selection
  "What brings you here?"
  Six role cards in a clean grid. Pick one, tap Continue.

Step 2: About You
  First name + City picker. Two fields, nothing else.

Step 3: Your Email
  Email input + "Send magic link" button.

Step 4: Confirmation
  Existing MagicLinkConfirmation component (confetti, countdown, resend).
```

Sign-in mode stays as-is (single card with email input).

### Visual Design
- Shared progress indicator at the top showing step X of 3 (before magic link is sent)
- Each step slides in/out using AnimatePresence (already in use)
- Back button on steps 2 and 3 to go to the previous step
- The same glassmorphic card style, teal gradient accents, and blur backgrounds
- Role cards become larger with descriptions (like ProfileEntryFlow has) for clarity
- The sign-in/sign-up tab toggle stays at the top, outside the card

### Technical Changes

**`src/pages/Auth.tsx`** (rewrite the signup branch):
- Add a `signupStep` state: 1 (role) | 2 (name/city) | 3 (email)
- Wrap each step in `AnimatePresence` + `motion.div` with slide transitions
- Step 1: Role grid with role descriptions (Dancer: "Find classes, partners, and events", etc.)
- Step 2: First name input + CityPicker, with a Continue button that validates both fields
- Step 3: Email input + "Send magic link" button (disabled until valid email)
- On successful send, switch to the existing `magicLinkSent` state which renders `MagicLinkConfirmation`
- Add a progress bar component showing current step (reuse the existing gradient bar pattern from ProfileEntryFlow)
- Back navigation: each step has a "Back" ghost button that decrements `signupStep`

**No other files change.** The sign-in flow, MagicLinkConfirmation, AuthCallback, CityPicker, and all backend logic remain untouched.

### Step-by-Step Detail

**Step 1 -- Role Selection Card**
- Title: "What brings you here?"
- Subtitle: "You can always add more roles later."
- Six role buttons in a vertical list (icon + label + short description), matching the style from ProfileEntryFlow
- Selected role gets a highlighted border (cyan-300)
- "Continue" button at the bottom

**Step 2 -- About You Card**
- Title: "A little about you"
- Subtitle: "Just two things and we are done."
- First name input with User icon
- City picker with MapPin label
- Inline validation errors (red text below fields) if empty on Continue
- "Continue" button, disabled until both fields are filled
- "Back" ghost button

**Step 3 -- Your Email Card**
- Title: "Last step -- your email"
- Subtitle: "We will send you a magic link to sign in."
- Email input with Mail icon
- "Send magic link" gradient button, disabled until valid email format
- "Back" ghost button

**Progress Bar (above the card)**
- "Step X of 3" label + percentage
- Thin gradient bar (festival-teal to cyan-400), same style as the current progress bar in ProfileEntryFlow

### What Stays the Same
- Sign-in mode (left tab) -- unchanged single-card email flow
- Tab toggle (Sign in / Create account) -- stays at the top
- Exit button (X) and exit confirmation dialog -- unchanged
- MagicLinkConfirmation screen -- unchanged
- Dev tools section -- moved into Step 3 (email step) only
- All Supabase auth logic, metadata passing, and AuthCallback -- unchanged
