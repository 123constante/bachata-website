# Brief: Onboarding "Find" step must say new pages are by invite

Brief-version: 2
Repo: Website. Branch: claude/onboarding-find-invite-copy. Lane: normal, Sonnet. Not hard tier. No database change. Design record: short docs/design/<pr>.md (copy-only change, one alternative considered).

## What main lacks
- Invite wording on the Find step: the primary footer button reads "Not listed? Create a page" (`label`, src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:592) and goes straight to create-name then create-city, yet creating a new organiser page is invite-only (INVITE_REQUIRED_COPY; admin trigger raises `organiser_invite_required`), so an uninvited person fills two screens and then fails -- grep: FIND_INVITE_NOTE
- An ask-for-an-invite control on the Find step. The only existing ask control is `supportLinks()` (src/modules/organiser/shared/support.ts; WhatsApp and email, each null when its Vercel env var is unset), rendered by the private `SupportRows` in src/modules/organiser/flows/newpage/NewPageFlow.tsx:267 -- grep: FindInviteNote
- A test mapping the Find footer text to the screen state -- grep: findFooter.matrix

## Files
src/modules/organiser/p3/onboarding/OnboardingFlow.tsx (foot block, ~lines 592-615), src/modules/organiser/p3/onboarding/pageModel.ts (put the copy constant beside PAGE_COPY.find), src/modules/organiser/shared/selfServeErrors.ts (reuse INVITE_REQUIRED_COPY, do not edit), src/modules/organiser/shared/support.ts, new test src/modules/organiser/p3/onboarding/__tests__/findFooter.matrix.test.tsx (copy the harness from pageScreens.matrix.test.tsx).

## What to build
1. On the `find` step only, one short note above the primary button (compact, text-sm, p-3, no new colours): `FIND_INVITE_NOTE` = "New pages are by invite from the Bachata Calendar team. Have an invite? Create your page below." Then, when `supportLinks()` returns a value, a "Message us" row per available link (WhatsApp, email), never a dead link; when neither exists add nothing. Reuse the INVITE_REQUIRED_COPY wording; do not invent a route.
2. Relabel the Find button "Have an invite? Create a page"; keep its behaviour (move to create-name) and data-testid `p3-ob-continue`. Update existing tests that assert the old label (grep "Not listed").
3. Table test, RED FIRST: rows = find step with 0 results / results / search error / short query, crossed with support links both / one / none; assert the note is present on find and absent on every other step, link hrefs only when configured, the button label, and that no text names a control that is not on screen.
4. Walk at 390x844 (find step, 3 states), screenshots in the PR, full Verified / Not verified block. Use px sizes for tap targets (html font-size trap).

## Out of scope
No change to who may create pages, no database or RPC change, no admin change, no change to the Ask-to-join claim flow.
Not verified by this brief: that invite-only is still enforced on prod today (owner decision 2026-10-20). Before the PR says so, confirm with a read-only check of the trigger; if it was lifted, stop and ask.
