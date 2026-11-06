# Brief: a page row opened from Review returns to Review after its save

Brief-version: 2
Branch: claude/page-row-returns-to-review
Lane: normal, Sonnet. Website (123constante/bachata-website), organiser onboarding only; must not touch src/modules/dancer-app/, the calendar density-exclusion files or any migration.
Serves: an organiser with "1 thing left" on the Review checklist (Page link, Kind of page, Page logo, Contact number) who wants to finish it and get back to Review, not walk six more screens.

## What main lacks
- A page row tapped on Review (org_link, org_category, org_logo, contact_confirm) opens a page step with no Review marker, so after Continue the flow walks on through the rest of the page path and then the person steps (Review rows go to `{ kind: 'page', step }` with no `review` field, while person rows carry `review: { percent }`) -- grep: pageRowPath
- A pure map saying which single page step a Review row needs and where it exits (the page twin of the teach one) -- grep: pageRowExit
- extends: Stage 'page' carries an optional `review` marker like the 'person' stage does -- src/modules/organiser/p3/onboarding/OnboardingFlow.tsx
- A stable test id on the page-step Continue when it came from Review -- grep: p3-ob-page-row-return

## Files
src/modules/organiser/p3/onboarding/OnboardingFlow.tsx
src/modules/organiser/p3/onboarding/pageModel.ts
src/modules/organiser/p3/onboarding/__tests__/pageRowPath.matrix.test.tsx (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. In pageModel.ts add `pageRowPath(step)` (exported, pure): for 'contact', 'contact-phone', 'whatsapp', 'cat', 'link', 'logo' a Review entry returns only that step (contact keeps its own two-step group: phone then WhatsApp), never the rest of the path. Mirror `teachRowPath` in personModel.ts.
2. Add `review?: { percent: number }` to the 'page' Stage; Review's `onRow` sets it for page rows (the percent Review already shows); PageScreens exits to `{ kind: 'review' }` (invalidating `p3-ob` and `p3-ob-status`, as the person `toReview` does) after the row's save and on Back; the progress bar stays where Review had it.
3. A page step reached any other way (welcome, Find, Create, deep link `at=`) behaves exactly as today: no Review marker, same next().
4. If the save fails the person stays on the step with the error where the Continue button is; no navigation happens.

## Tests
`pageRowPath.matrix.test.tsx`, table-driven, red first against current main: rows org_link, org_category, org_logo, contact_confirm (with and without a held phone) x outcomes (save ok, save refused, back) x entry (from Review, from Welcome). Assert: from Review ok -> Review, no later step rendered; refused -> stays, error shown; from Welcome unchanged path. One consistency row: every code in REVIEW_ROWS whose step is a page step is covered by the table.

## Done when
Matrix green, red on unfixed main. PR body has a Verified / Not verified block: shape survey counts of organisers by missing[] code read-only on prod (counts only), a 390x844 walk of each of the four rows on a prod-shaped account, coverage count from INVENTORY.md. Not verified lists anything not walked.
