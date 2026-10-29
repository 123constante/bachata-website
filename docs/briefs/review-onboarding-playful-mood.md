# Brief: independent review of Website PR #1155 (onboarding playful mood) -- user-facing copy + CSS, normal lane

You did NOT build this (a Sonnet worker did). Review PR #1155 on `claude/onboarding-playful-mood` (repo 123constante/bachata-website). Read `docs/handovers/onboarding-playful-mood.md` and `docs/design/onboarding-playful-mood.md` on that branch, and the audit it answers (`docs/audits/onboarding-tapthrough-2026-10-29.md` on `claude/onboarding-tapthrough-audit`). Change NO product code.

## Review for
1. The Welcome title mapping: first name shapes (empty, whitespace, multi-word, long, non-Latin/RTL, emoji, an apostrophe or `<`, `&`): can any of them break layout, render unescaped, or say "Hey , you made it!"? Does it fall back correctly when the name is unknown?
2. Chip pop and reactions: reduced-motion respected? Any layout shift, focus loss, or disabled-control confusion? Contrast >= 4.5 on the new colours, light and dark.
3. Flag emoji fallback: a failed image never leaves an empty box; no layout jump; alt/aria sensible; Nationality sheet rows too.
4. Scope: nothing changed outside `src/modules/organiser/p3/onboarding/*` and the design/handover docs; guard G3 ("for review" wording) still passes; zero-byte /app first load claim (rerun `npm run check:bundle-budget` on main and the branch).
5. Copy: British English, no raw Unicode punctuation in JSX, no copy pointing at a control that is not on screen, every empty state says what the person can do.

## Output
Docs-only `docs/reviews/onboarding-playful-mood-r1.md` on branch `claude/review-onboarding-playful-mood`: verdict PASS / PASS with should-fix / FIX FIRST, numbered findings (BLOCK / SHOULD-FIX / NIT) with file:line and a concrete failing scenario per BLOCK, a Not verified section. Push once, subject ending `[worker-done review-playful]`.
