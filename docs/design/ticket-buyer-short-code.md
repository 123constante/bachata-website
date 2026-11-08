# Design record: the buyer's short door code (ticket-buyer-short-code-web)

Brief: `docs/briefs/ticket-buyer-short-code-web.md` (branch `brief/ticket-buyer-short-code-web`).
Inventory (written first): [`ticket-buyer-short-code/INVENTORY.md`](ticket-buyer-short-code/INVENTORY.md), 23 / 25 covered, 2 N/A.
Walk (390x844, prod-shaped): [`../walk/ticket-buyer-short-code/`](../walk/ticket-buyer-short-code/).

## What a buyer sees

Under each QR on **My tickets** and on the **thank-you page**: `Door code K7M 2QX`. The code is
monospace, 18px, in two groups of three, and plain text (not tappable, so no tap-target rule
applies). On a checked-in ticket the line is muted and ends with `Checked in`. With no valid
code there is no line and no words about a code. The QR and the email wording do not change.

| Screen | Ticket state | Code line |
|---|---|---|
| My tickets | valid, QR open | directly under the QR, above "Hide QR code" |
| My tickets | valid, QR collapsed (4th+ upcoming, or past) | in the QR's place, above "Show QR code" |
| My tickets | checked in (QR behind "Show anyway") | under "Show anyway", muted, "Checked in" |
| My tickets | QR token unusable | under "QR code unavailable", so the code is the fallback |
| Thank-you | valid / checked in | under the QR box in the card; checked in is muted |
| both | void | never in the reply (`t.status <> 'void'` in both RPCs) |

## Decisions

1. **One alphabet, one formatter, one line.** `parseShortCode` reuses the door's `SHORT_CODE_RE`
   (`organiser/p3/door/model.ts`), so the buyer and the door cannot disagree about the alphabet.
   `formatShortCode` is the only grouping. `DoorCodeLine` is the only markup, shared by both screens.
2. **Strict parse.** The code must be exactly 6 characters of the alphabet after upper-casing. A
   grouped (`K7M 2QX`), short, number or banned-letter value becomes null, as does a missing key
   (an old reply). A bad code never drops the ticket row: the QR still shows.
3. **Gated on the door flag.** `ticketDoorCode` (`VITE_ENABLE_TICKET_DOOR_CODE`) is OFF in prod
   today. While the door can take only the QR, telling a buyer to give a "Door code" would point at
   a check that does not exist, so with the flag off the code is treated as null. Turning the flag
   on lights up the door box and the buyer line together. The flag is imported from `doorFlags.ts`
   (a dependency-free one-liner), not re-read from env, so the money-set env name stays out of the
   ticket files.
4. **Shown even when the QR is hidden.** The brief asks for checked-in tickets to show the code
   (muted). A collapsed QR is collapsed for phone CPU, not for secrecy. A used code is refused
   by the door anyway.
5. **Accessibility.** The visible code is `aria-hidden`. A visually hidden copy spells it out
   (`K 7 M 2 Q X`) so screen readers read characters, not a word. `translate="no"` stops
   page translation from rewriting it.
6. **Never logged.** No logging was added. Each test spies on every console method and asserts
   the code never reaches one.
