# Going stats total (website building blocks): handover

Branch `claude/going-stats-total-web`, brief `briefs/going-stats-total-web.md`
(branch `brief/going-stats-total-web`). Normal lane: no DB change, no
`supabase/**`, nothing under `src/modules/organiser/**`. **Nothing mounts it yet.**

## What was built (all in `src/modules/going/`, exported from `@/modules/going`)

| Piece | File | What it does |
|---|---|---|
| `GOING_RPC.myTotal` | `goingRpc.ts` | `'get_my_organiser_going_total_v1'` |
| `MyOrganiserGoingTotal` | `goingRpc.ts` | `{ going_total, nights, events }` |
| `parseMyOrganiserGoingTotal(v)` | `goingRpc.ts` | Each field must be a finite non-negative integer, else 0. A non-object (null, string, array) gives `{0,0,0}`. Never throws. |
| `fetchMyOrganiserGoingTotal()` | `goingRpc.ts` | Calls the RPC with no args. Refusals come back as `GoingRpcError.code` (`not_signed_in`; failures are `network` / `unknown`). |
| `goingKeys.organiserTotal(userId)` / `organiserTotalPrefix` | `useNightGoing.ts` | `['going','organiserTotal', userId ?? null]`. `invalidateGoing` now also invalidates it, so a going tap anywhere marks the total stale. |
| `useMyOrganiserGoingTotal(opts?)` | `useMyOrganiserGoingTotal.ts` | Returns `{ view, total, retry, fetching, refreshFailed }`. Off while `GOING_CHECKIN_ENABLED` is false. Sends no request for signed-out or anonymous viewers. `staleTime` is 30 s. Only network / unknown failures are retried, once. A failed re-read keeps the numbers (`refreshFailed`), but a REFUSAL on a re-read shows the refusal state. State comes from the shared `organiserGoingStateFor`, so there is no new state rule. |
| `organiserTotalText(total)` | `goingCopy.ts` | `{ text, figure, label, hint }`, the ONE place for these words |
| `GoingTotalStat` | `GoingTotalStat.tsx` | The inside of the C3 stat card. Takes the hook result as props and needs no providers. |

## Exact copy

- Non-zero: figure `7` (grouped with `toLocaleString('en-GB')`, so `123,456`), label `going across 4 nights`; full `text` is `7 going across 4 nights`.
  - Singular: `1 going across 1 night`. Taps, not people: `3 going across 1 night`.
  - A reply with taps but `nights: 0` (inconsistent) still says `across 1 night`.
  - The copy never says "people" and never counts cancelled nights.
- Zero (`going_total === 0`): headline `No one going yet`, second line
  `Share your event link on WhatsApp or Instagram. When dancers say they're going to one of your nights, it counts here.`
  It never says "0 going across 0 nights".
- A failed re-read: `Couldn't refresh. This may be out of date.` + `Try again`.
- Loading / error / signed out reuse the organiser going words (`GoingLoadState`):
  `Loading who's going...`, `Couldn't load who's going.` + `Try again`,
  `You're signed out. Sign in again to see who's going.` + `Sign in again`.
  (In the source the apostrophes and ellipsis are `RSQ` / `ELLIPSIS` escapes.)

## How the organiser lane mounts it

Mockup C3 (`origin/claude/er-p3-mock-c3`, `docs/organiser-rebuild/p3/mockups/C3.html`,
`R.stats`): the SECOND `card stat` inside the `pair`, marked
`<!-- GoingNightSummary slot (Stats total) -->`. It replaces that card's `.n` / `.l` content.

```tsx
import { GoingTotalStat, useMyOrganiserGoingTotal } from '@/modules/going';

const goingTotal = useMyOrganiserGoingTotal();
// ...
<div className="card stat">
  <GoingTotalStat {...goingTotal} onSignIn={openSignIn} />
</div>
```

- Pass the hook result whole: `refreshFailed` is a required prop.
- `onSignIn` is optional. Without it the signed-out state shows only the words, never a dead button.
- `theme` defaults to `ORGANISER_GOING_THEME` (`--fg`, `--mut`, ...), so it follows the organiser look it is mounted in.
- It renders nothing while the going switch is off: the host should hide the card, or keep it, in that case.
- Tap targets are 44px explicit (`ORGANISER_GOING_TAP_PX`).

## Not verified

- **No 390x844 look, because nothing mounts it.** The organiser lane's mount PR owns the browser walk.
- Not run against a signed-in prod session (the connector is read-only SQL; the RPC needs `auth.uid()`).
- The `e2e` / `phone-qa` suites were not run locally (no route changes).
- Done in #1022: a live contract check for this RPC in `scripts/check-going-rpcs.mjs` (anon refusal).
- Not touched (outside scope, noted in review): `useMyEventGoing` has the same "refusal on a re-read is kept as refreshFailed" behaviour that this hook now avoids.
