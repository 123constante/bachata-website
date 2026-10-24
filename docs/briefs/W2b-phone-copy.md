# Brief: dancer edit screen, the phone error says two things that disagree (Website, normal lane, CONTINUATION)

Branch: `claude/invite-dancer-edit` (PR #1005, head 417bf4b, bot-authored). Push to that SAME branch; do NOT open a new PR.
Dancer-app only. Stop after the push and report. Hand-over note in the PR body.

## The failure (measured by the orchestrator, 390x844, walk account, 2026-10-24)
Edit screen, WhatsApp field with +44 picked, typed `12`, blurred. TWO red lines stack under the field:
1. PhoneInput's own: "Looks short. United Kingdom numbers have 10 digits after +44."
2. The screen's: "Your WhatsApp number needs its country. Pick the country, then type the number, like 7700 900123."
Line 2 is wrong: the country IS picked (+44). Source: `invalid_phone` copy in `src/modules/dancer-app/api/errors.ts` (COPY line ~38 and DETAIL_COPY line ~83); the client rule in `screens/me/model.ts` (`copyFor('invalid_phone','whatsapp')`) fires for short, long and missing-country alike.
The organiser wizard already states the rule: "One message, the field's own... never a second step error" (`src/modules/organiser/wizard/__tests__/contactSteps.test.tsx`).
Check that would have caught it: a test that the save-time phone line is true in every case the rule fires.

## Task
1. RED FIRST in `tests/client/dancerAppApi.test.tsx` (inside `describe('errors.ts: one map, every code')`): `copyFor('invalid_phone')` and `copyFor('invalid_phone','whatsapp')` must not match /needs its country|pick the country/i and must match /not complete/i. Show it fail.
2. Reword both strings to be true for every cause, e.g. COPY: `That number is not complete. Check the country and the digits, like 7700 900123.` and DETAIL_COPY: `Your ${FIELD_LABEL[f]} is not complete. Check the country and the digits, like 7700 900123.` Keep the existing `['invalid_phone','whatsapp','WhatsApp number']` DETAIL case green (adjust its expectation only if it pins the old words).
3. Look at `screens/edit/EditScreen.tsx` / `PhoneInput` and decide: if the PhoneInput line is already showing (touched and 'short'/'long'), can the screen show ONE red line instead of two without leaving Save disabled with nothing marked? Only do it if a table-driven test over {untouched, typing before blur, short after blur, long, missing country} proves Save-disabled always has a visible marked field. If it cannot be proven small, keep both lines (now consistent) and say so in the PR body.

## Gates
Targeted vitest (tests/client/dancerAppApi.test.tsx, src/modules/dancer-app), `npx tsc --noEmit`, eslint touched files. Do not touch perf-budgets.json. Max 3 files. PR body: add a "Continuation" note with the red-then-green evidence and Verified / Not verified.
