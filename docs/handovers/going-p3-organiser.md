# Handover -- Going P3: organiser "who is going" components

Branch `claude/going-p3-organiser` (from `claude/going-p2-website`). Stacks on P2 (#992): until #992 merges, this
PR's diff against `main` includes P2. Switch `GOING_CHECKIN_ENABLED` stays false (off = the hook runs nothing and
the parts render nothing).

## What is done
- `useMyEventGoing(publicEventId)` -- React Query wrapper of `get_my_event_going_v1` (live on prod, checked).
- `GoingNightSummary`, `GoingPeopleSheet`, `GoingLoadState` in `src/modules/going/OrganiserGoing.tsx`.
- One organiser mapping in `goingState.ts` (`organiserGoingStateFor`, `organiserNightView`), words in `goingCopy.ts`
  (`GOING_COPY.org*`, `organiserNightText`), tokens in `goingTheme.ts` (`ORGANISER_GOING_THEME`).
- `not_organiser` is a `GoingErrorCode`; `ORGANISER_GOING_REFUSAL_CODES` lists the read's three refusals.
- `GoingFace` pulled out of `GoingPeople` (photo or initials circle) and shared; P2 renders the same.
- `invalidateGoing` also invalidates the organiser reads (`goingKeys.eventPrefix`).
- `check-going-rpcs.mjs` also proves anon is refused `get_my_event_going_v1` (+1 canary, 43 cases).
- Tests: `src/modules/going/__tests__/organiserGoing.test.tsx` (57): every component x every night shape x every read state.
- Screenshot harness: `node tests/harness/going-p3/shoot.mjs` -> `docs/handover/going-p3/` (29 PNGs + INDEX.md with
  stage 4 numbers). Design record: `docs/design/going-p3-organiser.md`.

## For the organiser lane: exactly how to mount

Everything imports from `@/modules/going`. Do not copy any of it.

```ts
import {
  useMyEventGoing, GoingNightSummary, GoingPeopleSheet, GoingLoadState,
  type MyEventGoingNight,
} from '@/modules/going';

const { view, nights, retry, fetching, refreshFailed } = useMyEventGoing(publicEventId /* uuid | null; null = wait */);
// view.state: 'off' | 'loading' | 'ready' | 'not_signed_in' | 'not_found' | 'not_organiser' | 'error'
// nights: MyEventGoingNight[] -- upcoming nights only, cancelled included, start order; [] until 'ready'
// refreshFailed: a re-read failed while nights were on screen -- they STAY (view stays 'ready')
// A non-uuid id is 'not_found' without a request. retry is stable across renders.
```

`MyEventGoingNight` (exactly the RPC's night):
`{ occurrence_id: string; occurrence_date: string | null; starts_at_local: string | null; is_cancelled: boolean; going_count: number; people: { dancer_profile_id: string | null; first_name: string; photo_url: string | null }[] }`

Match a night to your date by `occurrence_id` (the P5 occurrence id, `event_occurrence_p5.id`).

| Component | Props | Renders |
|---|---|---|
| `GoingNightSummary` | `night: MyEventGoingNight` (required); `variant?: 'compact'` (the only one); `onOpen?: (night) => void`; `theme?` | "12 going" + chevron as a button (>= 44 px) when somebody is going AND `onOpen` is given; else text: "Nobody has said they&rsquo;re going yet" / "This date is cancelled" (+ " &middot; 3 had said they were going"). No navigation of its own. |
| `GoingPeopleSheet` | `night: MyEventGoingNight` (required); `eventId?: string \| null` (profile-view telemetry); `listMaxHeight?: string` (default `min(60vh, 520px)`); `theme?` | The CONTENT of your sheet: h3 "Who&rsquo;s going", the night line ("Thursday 29 Oct &middot; 9 PM", from `starts_at_local` as stored), the count line, then every person (56 px rows; photo or initials; a link to the dancer page only when `dancer_profile_id` is set). The list scrolls inside. Bring your own SheetView (scrim, grab bar, close). |
| `GoingLoadState` | `view` (from the hook, required); `onRetry` (required; pass `retry`); `onSignIn?`; `busy?` (pass `fetching`); `theme?` | Nothing for `off` / `ready`. Otherwise the words + at most one button: loading; error -> "Try again"; not_signed_in -> "Sign in again" (only if `onSignIn`); not_found / not_organiser -> words saying what to do. |

The three slots (agreed 2026-10-23):
- Home "Next up" hero: `<GoingNightSummary night={n} onOpen={openWhoSheet} />` under the title.
- Date-strip sheet row: your "Who&rsquo;s going" row with `<GoingNightSummary night={n} onOpen={openWhoSheet} />` at its end;
  the sheet body is `<GoingPeopleSheet night={n} eventId={publicEventId} />`.
- Stats "By event": `<GoingNightSummary night={n} />` (with `onOpen` if the row should open the list) beside/under the views.
- Above any of these while `view.state !== 'ready'`: `<GoingLoadState view={view} onRetry={retry} busy={fetching} />`
  (or render nothing in a slot and show it once per screen).

The parts paint with `var(--fg)`, `var(--mut)`, `var(--card)`, `var(--card2)`, `var(--line)`, `var(--line-strong)` --
the organiser's own tokens -- so they must sit inside `.org-theme` (they do, in the organiser shell).

## Review
One `/code-review` round (high) before commit: 10 findings, all fixed as edits (failed re-read no longer blanks the list,
non-uuid id is not_found, `onRetry` required, stable `retry`, invalidation limited to the event that holds the night,
one count rule, `variant` read, refusal list drives the parser, `moreSentence` copy). The fixes themselves were tested
(6 new tests) but not re-reviewed.

## Left / next steps
1. Organiser lane mounts the parts (their PR; no file here changes).
2. When #992 merges, update this branch from `main`; the diff then shrinks to P3 only. The 5 new
   `scripts/dancer-area-isolation-allowlist.json` seams (needed only while the stacked diff touches `src/modules/dancer-app/`)
   should be mirrored to `briefs/dancer-rebuild-INTERFACE.md` section 5 by the orchestrator, as P2's were.
3. `check-going-rpcs.mjs` is still not a step in `db-contract-check.yml` (P2's R8 left the workflow edit to the owner).
4. Signed-in shapes of `get_my_event_going_v1` are proven by the parser tests and the function body read on prod,
   not by a live signed-in call (no test organiser account).

## Facts found on the way
- `get_my_event_going_v1` writes `starts_at_local` as `materialised_start_utc AT TIME ZONE 'UTC'`: the column holds the
  London wall clock stamped as UTC (the same "local-as-Z" convention `get_my_going_v1` documents), so it IS London
  wall clock and renders as is.
- The function raises `not_signed_in` and `not_organiser` with SQLSTATE 42501; the client reads the message first,
  so neither is mistaken for PostgREST's own permission-denied.
- Prod shape survey (2026-10-24, counts only): 64 series with upcoming nights (684 with none), 1786 live upcoming nights,
  all at 0 going; 50 cancelled upcoming nights, all at 0; max 57 upcoming nights per series; 34 finished dancer profiles,
  0 with the photo switch on, longest first name 21 chars.
