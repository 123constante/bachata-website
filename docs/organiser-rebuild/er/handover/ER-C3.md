# ER-C3 handover: rules + lookup (ER-S1) and the switch (ER-S0)

Branch `claude/er-s1-rules`. Later slices read THIS file for the pinned interface.
Module root below = `src/modules/organiser/`.

## Files
| File | What |
|---|---|
| `shared/event-rules.json` | THE rules (data only). Byte-identical copy goes in the admin repo. |
| `shared/eventRules.ts` | Typed reader + pure functions. No React. |
| `shared/useOrganiserSeries.ts` | ONE series lookup (hook + pure `resolveSeries`, `findSeries`, `allSeries`, `listedFromOrganisers`). |
| `shell/rebuildSwitch.ts` | ER-S0: `rebuildEnabled`, `useRebuildSwitch`, context. Read once in `shell/OrganiserRoutes.tsx`. |
| `scripts/check-event-rules-mirror.mjs` | `npm run check:event-rules-mirror` (+ `:self-test`). |
| `flows/add/notFoundText.ts` | Sentence for each not-found state (used by WhichDay, Time). |

## JSON schema (`event-rules.json`, `version: 1`)
- `time`: `{ rolloverBefore: "08:00", minutesPerDay: 1440, source: "sessions" }`
- `formats`: `["recurring","one_off","course","festival"]`
- `sessionKinds`: key (`class|workshop|masterclass|party|showcase|competition`) -> `{ label, storedType, section, level: boolean, lessonLengths: boolean, lineupLabel }`. `showcase.storedType = "performance"`. `level` true only on class + masterclass.
- `lessonLengths`: `{ minutes: [45,60,90,120], default: 60, other: "Other" }`
- `festival`: `{ defaultStart: "22:00", defaultEnd: "04:00", payment: ["ticket_link"] }`
- `payment`: `{ atLeast: 1, separator: ",", codes: { ticket_link, door, bank_transfer, cash, free -> label } }`
- `cancelReasons`: the server list (Venue closed / Teacher unavailable / Bank holiday / Low signups / Other).
- `blockers`: code -> 2-4 word reason: `name, format, venue, date, dateInPast, session, sessionTimes, payment, paymentNotAllowed`.
- `readiness`: `{ ready, blocked }` labels. `seriesLookup`: `{ loading, notFoundArchived, noAccess, gone }` sentences.
- `fixtures`: `validSessionPair[]`, `timeFromSessions[]`, `readiness[]`: the table BOTH repos run.

## `shared/eventRules.ts` exports
```ts
type SessionKind = 'class'|'workshop'|'masterclass'|'party'|'showcase'|'competition'
type PaymentCode = 'ticket_link'|'door'|'bank_transfer'|'cash'|'free'
type BlockerCode = keyof rules.blockers
interface RuleSession { kind?: string|null; start: string|null; end: string|null }   // HH:MM
interface RuleDate { date: string /*YYYY-MM-DD*/; sessions: RuleSession[] }
interface RuleSeries { name: string|null; format: string|null; venueId: string|null;
                       payment: readonly string[]; firstDate: RuleDate|null; today: string }
interface Blocker { code: BlockerCode; reason: string }
interface Readiness { ready: boolean; label: string; blockers: Blocker[] }

readiness(series: RuleSeries): Readiness
blockers(series: RuleSeries): Blocker[]            // order: name, format, venue, date(+past/session/times), payment
startFromSessions(sessions: readonly RuleSession[]): string|null   // earliest start; after-midnight (<08:00) rolls to the night before
endFromSessions(sessions: readonly RuleSession[]): string|null     // latest end, HH:MM, wraps
validSessionPair(start, end): { valid: boolean; nextDay: boolean } // end == start invalid; end < start = next day
sessionKindRules(kind: string): SessionKindRules | null
   // { kind, label, storedType, section, levelAllowed, quickLengths: readonly number[]|null, lineupLabel }
sessionKinds: SessionKind[]
paymentCodes(format?: string|null): PaymentCode[]  // festival -> ['ticket_link']
parsePaymentMethods(stored: string|null|undefined): PaymentCode[]   // comma list -> known codes
formatPaymentMethods(codes: readonly string[]): string
toMinutes(t), toHHMM(minutes)
cancelReasons: readonly string[]; festivalDefaultHours: { start, end }; lookupMessages; EVENT_RULES
```
Blocker semantics: only the FIRST date is checked (rule 10). "No payment" = fewer than 1 known code; a festival with a non-`ticket_link` code is `paymentNotAllowed`. `passes` is not a payment code (3 live series use it; they read "How to pay needed" until the owner picks).

## `useOrganiserSeries(seriesId)` (shared/useOrganiserSeries.ts)
```ts
type OrganiserSeriesState =
 | { state: 'loading' }
 | { state: 'found'; series: HomeSeriesFull }
 | { state: 'not-found-archived' }
 | { state: 'no-access' }
 | { state: 'gone' }
 | { state: 'error'; retry: () => void }   // added: a read failed for another reason (offline); never shown as Not found
```
Order: `organiser_home_v1` (shared cache key) first; only if home does not list it, `admin_event_workspace_p5`. `permission_denied` -> `no-access`; no such series -> `gone`; archived (home or workspace) -> `not-found-archived`. A series with 0 dates is `found`. For a workspace-built series `next_dates` holds the first 3 scheduled dates and the counts are from today.
`findSeries(home, id)` / `allSeries(home)` stay (synchronous, home only); `flows/add/addModel` and `flows/change/changeModel` re-export `findSeries` so existing imports keep working. `events/eventsApi.listedSeries` sits on `listedFromOrganisers`. Use `notFoundText(state)` (flows/add) for the sentence.

## Switch (ER-S0)
`VITE_ORGANISER_REBUILD` (build-time): comma list of organiser page ids = ON for logins holding one of those pages; `*` = everyone; unset/empty = OFF. Rebuilt screens call `useRebuildSwitch()` (`shell/rebuildSwitch`) and render the old screen when false. Old screens are deleted only after it is `*` for everyone. The owner sets it in Vercel; `.env.example` was not touched.

## Done / left
Done: all 7 items of the brief. Left in this slice: nothing. Callers still on the synchronous `findSeries` (move to the hook in ER-S4): flows/cancel WhichDate + Confirm, flows/change WhichDate / Pick / Day / useChange, events/OneEvent. The "no time input" ratchet (`shared/__tests__/eventRules.nofield.test.ts`) lists 5 offenders: dates/DateSheet, events/ProgrammeSheet, flows/add/Time, flows/change/Time, flows/new/NewFlow; remove each line when C7/C8/C9 remove the input. (The Details "Time" row in `events/eventModel.ts` is not a time input and is not caught by it; ER-S3 removes it.)
