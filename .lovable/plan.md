

## Celebration Confirmation After Magic Link Submission

### Problem

Both the MobileBottomNav modal and the Auth page show a plain, minimal "Check your email" message after submitting. The modal version is especially bare -- just one line of text and a button. Plus, both fire a redundant toast notification on top. This feels generic and unhelpful.

### Solution

Replace the post-submission confirmation in both surfaces with a celebratory, informative experience:

1. **Animated entrance** with confetti burst (using existing `triggerMicroConfetti` from `src/lib/confetti.ts`)
2. **Show the email address** the link was sent to
3. **Resend countdown timer** (30 seconds) -- disabled "Resend" button that counts down, then enables
4. **Remove the redundant toast** -- the inline confirmation is the feedback
5. **Framer Motion animations** for smooth transitions

### Files to Change

#### 1. `src/components/MobileBottomNav.tsx`

**Replace the `magicLinkSent` confirmation block** (lines 296-302) with:

- Animated mail icon with a scale-in + glow effect (framer-motion)
- Heading: "Magic link sent!" with a sparkle emoji
- Subtext showing: "We sent a link to **{signInEmail}**. Check your inbox and click to continue."
- Resend timer: a `useState` countdown from 30 to 0, displayed as "Resend in {n}s" (disabled), becomes "Resend magic link" button when timer hits 0
- "Use a different email" ghost button (already exists, keep it)
- Fire `triggerMicroConfetti` once when `magicLinkSent` becomes true

**Remove the toast** on line 157 (`toast({ title: 'Check your email' ...})`). The inline UI replaces it.

**Add state**: `resendCountdown` (number), reset to 30 when magic link is sent, decremented by `setInterval`.

#### 2. `src/pages/Auth.tsx`

**Replace the `magicLinkSent` confirmation card** (lines 128-154) with the same celebratory pattern:

- Animated mail icon with entrance animation
- "Magic link sent!" heading
- Shows the email address
- Resend countdown timer (30s) with resend button
- "Use a different email" and "Continue browsing" buttons (already exist)
- Fire `triggerMicroConfetti` on mount of this view

**Remove the toast** on line 92. The full-page confirmation replaces it.

**Add state**: `resendCountdown` with the same countdown logic.

### Resend Logic (both files)

```text
When magicLinkSent becomes true:
  1. Set resendCountdown = 30
  2. Start interval decrementing every 1s
  3. Fire triggerMicroConfetti at center of mail icon

Resend button:
  - While countdown > 0: disabled, shows "Resend in {countdown}s"
  - When countdown === 0: enabled, shows "Resend magic link"
  - On click: calls handleSendMagicLink again, resets countdown to 30
```

### Visual Design (Lovable handles styling)

- Mail icon: gradient background circle (festival-teal to cyan), animated scale-in
- Checkmark or sparkle particle animation around the icon
- Heading uses slightly larger text with a warm tone
- Email address displayed in bold
- Timer text in muted foreground, transitions smoothly when it hits 0
- Overall: warm, celebratory, clear -- not clinical

### What Does NOT Change

- No routing logic changes
- No database/RLS changes
- No changes to the sign-in/sign-up form UI itself
- No changes to AuthCallback or Onboarding
- Dev tools remain untouched

