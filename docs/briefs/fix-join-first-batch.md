# Brief: invited-organiser first batch (used link, return to event, banner words)

Lane: normal (careful for any database part, see slice U). Model: Opus (new logic: returnTo + session match). Branch: claude/fix-join-first-batch
(covered by the claimed claude/fix-join-* family). One PR, push once per the standing push rule, no run-ci by the worker.
Owner words 2026-11-03: invited organisers "all simply stop responding" after the invite link. Owner clicks 2026-11-03 (binding):
(1) a person who already redeemed and taps the link again is SIGNED IN AUTOMATICALLY when still signed in on that device; (2) after the
checklist, Continue returns to the SAME EVENT the refused edit came from; (3) Home banner says "Finish your details first to create or edit events. It takes about five minutes."
The gate stays strict and ON. No change to what is required. For INVITED organisers (the 17 invite links), phone first.

## Evidence (read first)
- docs/walk/invite-first-minute/RESULTS.md on branch claude/walk-invite-first-minute (35 pictures at 390x844, mocked server answers). Worst places 1, 2 and 4 are these three fixes.
- Prod: 17 invites, 8 redeemed, 0 of 8 finished the checklist, 0 of 8 made a successful event edit; 6 redeemed BEFORE the gate went ON, so a returning "already used" dead end is a live suspect.

## Step 0, before any code: INVENTORY.md (inventory-first rule) + prove the data source
Write docs/design/fix-join-first-batch/INVENTORY.md listing, with file:line, every screen, string and control each slice touches, in the current Website AND what the admin invite
tools show, and end with a COVERAGE COUNT (states covered / states total). Start from:
- inviteModel.ts:214 (`used: 'This link was already used' ... action: 'home', terminal: true`) and every other dead state in the same map (expired, revoked, invalid).
- GraceBanner.tsx:67 ("Until then everything works as usual.") and every other string that repeats the same claim (grep the tree: GateSheet GATE_COPY, You tab row, page editor toFinish).
- gateModel.ts / gate.ts / GateSheet.tsx / paths.ts:82 (`p3StartReview`, `at=review`) / OnboardingFlow.tsx:332 (`Go to Home`) and pageModel.ts:401 (`Go to Home`): where Continue goes today and where the refused write came from.
Then, read-only on prod (counts only, never a write): read the bodies of the invite peek/redeem RPCs and say whether the SERVER can tell the caller "this invite was used by YOU" (used_by = auth.uid()) without leaking who used it to anyone else.
- If the used-link auto sign-in needs a database change (new field or RPC): STOP slice U, push slices B and R, and write docs/handover/fix-join-first-batch.md describing the migration needed (careful lane). Do not write DDL in this repo.
- If the existing answer is enough (session already signed in, invite resolves to the caller's own team membership), build it client-side.

## Slice B: banner words (copy)
Replace the false line. New banner body: "Finish your details first to create or edit events. It takes about five minutes." plus the existing count line ("N things left") and buttons. One shared string (graceModel.ts or a constants file), never two copies; every other screen that repeats "works as usual" uses it or is removed.

## Slice R: return to the event
When a write is refused by the gate, remember the event the person was on (a path, e.g. /account/p3/e/<id>, validated as an in-app path; never an open redirect). Continue goes to the checklist (existing flow). When the checklist reaches nothing left, the final action and the footer say "Back to your event" and go there; a person who reached the checklist from Home still sees "Go to Home". Guards: a missing, stale or off-site returnTo falls back to Home; the refused edit is NOT silently replayed (the person redoes it); back navigation does not loop.

## Slice U: used link, signed in already
On the "already used" state: if the person is signed in and the server says the invite is theirs, go straight to the page's home (replace history so Back does not return to the dead link). Signed out: change the words to "You already joined. Sign in to continue." with a "Sign in" button (returns to this link afterwards), keep "Ask for a new one" as the smaller option. Signed in as someone ELSE: keep "ask for a new one", say it is a different account, never reveal whose.

## Red-first test matrix (table-driven; run against UNFIXED code first, show red, then green)
- Banner: every screen x every `left` count (0, 1, 2, 6, 10) x admin / member x hidden-for-today: no string contains "works as usual"; the new words appear exactly once per screen; 0 left shows no banner.
- Return: refused from {event page, Repeat sheet, Details, Prices, Cancel} x {returnTo valid, missing, off-site, another organiser's event} x checklist {1 left, 10 left, finished}: final action label and target as specified, never an off-site URL, no loop on Back.
- Used link: invite state {used, expired, revoked, invalid} x viewer {signed out, signed in as redeemer, signed in as someone else}: exact title, body, buttons, destination; a terminal state never shows a button that goes nowhere; untouched state sends no request.
- Empty states say what the person can DO; no copy points at a control that is not on screen.

## Definition of done (every item stated in the PR body)
Shape survey (counts only) of invites by status and of organisers by `left` count; consistency matrix green; every CI job step the PR touches run in the sandbox with a per-job table; a 390x844 walk of every changed screen (pictures under docs/walk/fix-join-first-batch/); `npm run check:bundle-budget` on main and on the branch (add 0 bytes to dancer-app first load); Verified / Not verified block. Phone QA section names 390x844 (replace the stub's section, never add a second).

## Rules
- First action: `git fetch origin main` and verify `git merge-base HEAD origin/main` equals `origin/main` before the first push (cloud sandboxes carry a stale base).
- Stopping rule: one independent review, one fix round, then the orchestrator walk. Supabase read-only. Never merge or approve. Docs/tests under docs/ and src/**/__tests__ are in scope; do NOT edit perf-budgets.json or vite.config.ts.
- HTML entities for punctuation in JSX (&rsquo; &mdash;); explicit px tap targets (html font-size is about 13.5px on phones).
