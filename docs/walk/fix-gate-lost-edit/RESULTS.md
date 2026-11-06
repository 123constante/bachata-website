# Walk: fix-gate-lost-edit (390x844, P3 flags on, refusal MOCKED)

Spec: `tests/e2e/walk-fix-gate-lost-edit.spec.ts` (not in the CI gate). Harness copied from
`walk-invite-recheck` (wait for a heading and finished animations, resize to full page height). Every server
answer is a `page.route` mock (OrganiserFake + a mocked `onboarding_incomplete` on `series_command_p5`). 5 of 5
passed: 10, 6, 3, 2 and 1 left.

Path per count: event page -> Repeat -> tap Monday -> Save -> gate -> Continue -> checklist -> Back to your event
-> event with the Repeat sheet reopened.

| Picture | What it shows | Opened by me |
|---|---|---|
| `01-gate-10-left.png` | "A few details first", 10 rows, Continue / Not now, over the Repeat sheet | Yes |
| `02-checklist-10-left.png` | "10 things left", one row + Show all, footer **Back to your event** (was "Go to Home") | Yes |
| `03-event-kept-10-left.png` | Event page, Repeat sheet reopened: "We kept your changes", Mon + Fri picked, "Save the new pattern" ready | Yes |
| `01/02/03-*-{6,3,2,1}-left.png` | Same steps at 6 / 3 / 2 / 1 left | Read via `texts.jsonl` text only |

The five `03-event-kept-*` files have the same byte size on purpose: the event page and the reopened sheet do
not depend on the left count. I opened `03-event-kept-10-left.png` and it is not blank.

Writes: with the status read predicting the refusal (F-12) the Save is held and NOTHING is written, before or
after coming back (`savesSent: 0` in `texts.jsonl`). Coming back never saves: the person taps Save again.

Not walked: the draft-page variant (Go live + secondary "Back to your event"): the fake page is live. It is
covered by the unit matrix (`pageScreens.matrix.test.tsx`, "fix-gate-lost-edit" block, page draft cells).
