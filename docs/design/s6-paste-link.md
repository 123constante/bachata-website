# S6: Paste a link inside New event

Status: PARKED. Needs admin PR #996 (S1 lock of `event-smart-import`) applied and deployed with verify_jwt on before this merges.

## Brief
A "Paste a link" option at the top of New event for organisers and admins (one component). One box, one "Read it" button. A good read shows a draft to check; it never saves or publishes. Every failure is a plain sentence and keeps the person moving. Imported text is untrusted.

## Layout chosen, and why
New event here is a step flow (what, name, venue, date, time, cover), and each step saves to the server draft. There is no single form to prefill. So:
- The panel sits above the format rows on the first step (`/account/o/new/what`). Reading saves nothing.
- A good read shows the draft in place (name, date, venue, ticket link, description) headed "Check this before saving", with "Use this to start".
- "Use this to start" goes to the existing name step with the name prefilled and the same read-only summary above it. The person edits, then presses the existing Next (the unchanged create). Venue, date and the rest are chosen in the existing steps; the summary is the reference for them.
- "Add by hand" is on every failure and on the draft: it clears the panel and focuses the normal first format row (the empty start).
This keeps the diff small and the save path untouched. Cost: venue/date/ticket/description are not auto-filled into those steps (there is no field for ticket link or description in this flow).

## Files
`flows/new/paste/`: `smartImportClient.ts` (typed client, S1 contract), `pasteLinkModel.ts` (the one state-to-text/controls mapping), `PasteLink.tsx` (panel). `NewFlow.tsx`: panel on the what step, prefill on the name step.

## Rules kept
- Only well-formed https links are sent; untouched or empty box sends nothing; Read it is off with a reason while empty or reading; double tap sends once; loading state has Cancel (also cancels on leaving, and a 90 s timeout).
- Text only (React text nodes). Ticket links must be https. A past date is never copied: shown as "This date has passed, please set the date".
- 429: "You have used today's link reads; add this one by hand or try tomorrow". Other failures: "We could not read that link. You can add the event by hand". 401 adds a Sign in again link to `/auth`.
- Taps 44 px or more (sm buttons 44, input 52), existing tokens only.

## Checks
Tables in `paste/__tests__/`: link check, button states, date shapes (past / today / none / series / garbage), untrusted text, every result shape (ok full / partial / empty, unreadable, non-https, 401, 403, 429, network, timeout, cancel), failure wording, and the panel for admin and organiser (same behaviour) including double tap and cancel. The client is mocked; the real function is never called.

Not done: browser screenshots at 390x844 and 360 (no signed-in session or deployed function available to the worker).

## Handover
Done: client, model, panel, wiring, tests, this record. Left: browser walk at 390x844 / 360 against the mock; wire venue/date prefill if the owner wants more than the name; confirm `bin/check-integrity.sh` mode (Permission denied in the worker, not caused by this change). Next: merge only after S1's migration is applied and the function is deployed with verify_jwt on.
