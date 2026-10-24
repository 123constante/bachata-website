# Going stats total -- Website building blocks (NORMAL lane, one worker, one push)

Repo 123constante/bachata-website, branch `claude/going-stats-total-web` (from main). Lane: Normal (no database change, no migration, no `supabase/**`). Context cap 50%.

## Why

Admin PR #988 is merged and applied on prod (24 Oct 2026): `get_my_organiser_going_total_v1()` (no args) returns `{going_total, nights, events}` for the signed-in caller's UPCOMING, NOT-cancelled nights. `going_total` counts going taps, not people: one person going to 3 nights counts 3. It always equals `get_my_event_going_v1` summed over the caller's events. Anon is refused (42501, message `not_signed_in`). No owner/manager seat is NOT an error: it returns `{0,0,0}`. On prod today every organiser reads `{0,0,0}` (the 5 going rows are all on past nights), so the ZERO state is the state everyone sees first.

## Scope: pure building blocks in `src/modules/going/` ONLY. NOT MOUNTED anywhere.

The only mount point is the organiser lane's rebuilt Stats screen (mockup C3, `origin/claude/er-p3-mock-c3`, file `docs/organiser-rebuild/p3/mockups/C3.html`, the `R.stats` function: the second `card stat` in the `pair`, comment "GoingNightSummary slot (Stats total)"). Owner/organiser-lane rule: **never touch `src/modules/organiser/**` or `OrganiserRoutes.tsx`**. The organiser lane mounts it when its phase names the mount points. So you build, test and export; you do not mount.

## Build (follow the existing pattern in the same files; read them first)

1. `goingRpc.ts`: add `myTotal: 'get_my_organiser_going_total_v1'` to `GOING_RPC`; add it to the header comment; type `MyOrganiserGoingTotal = { going_total: number; nights: number; events: number }`; `parseMyOrganiserGoingTotal(v: unknown)` that never casts through: each field must be a finite non-negative integer else 0, and a non-object is `{0,0,0}`; `fetchMyOrganiserGoingTotal()` calling the existing `call` helper with no args. Refusals arrive as `GoingRpcError.code` (not_signed_in expected; network/unknown).
2. `useNightGoing.ts` `goingKeys`: add `organiserTotal: (userId) => ['going','organiserTotal', userId ?? null] as const`.
3. `useMyOrganiserGoingTotal.ts` (new), modelled on `useMyEventGoing.ts`: off while `GOING_CHECKIN_ENABLED` is false; no request for signed-out or anonymous viewers (the not_signed_in state without a request); `staleTime` 30 s; same `retryable`. Return `{ view, total, retry, fetching, refreshFailed }`. Reuse `organiserGoingStateFor` if it fits; if a new state mapping is needed keep it in `goingState.ts` and test it (no second copy of any rule).
4. `goingCopy.ts`: ONE function `organiserTotalText(total)`. Rules (owner, binding): "N going across M nights"; singular nights "1 night"; NEVER "people"; the number is taps, so 3 going on 1 night reads "3 going across 1 night". Zero (`going_total === 0`): "No one going yet" as the headline, and a second line that says what the organiser CAN do (e.g. share the event link; dancers tap I'm going on a night's page). Never "0 going across 0 nights". Never a cancelled-night count. Use the `RSQ`/`ELLIPSIS`/`DOT` constants, never raw Unicode punctuation (mojibake rule, see CLAUDE.md "HTML entities over raw Unicode"). British English, full words.
5. A pure presentational component `GoingTotalStat` in `OrganiserGoing.tsx` (or a new file exported from `index.ts`) that renders the number and label like the C3 stat card, with the states: loading, ready (zero + non-zero), error with Try again (calls `retry`), not signed in with Sign in again (copy already exists: `orgNotSignedIn`/`orgSignIn`). It takes the hook result as props, so it needs no providers. Tap targets use explicit px (`ORGANISER_GOING_TAP_PX`), never rem: the site sets html font-size to about 13.5px on phones. Reuse `goingTheme` tokens; invent no colours.
6. Export everything from `index.ts`.

## Tests (table-driven, one shared mapping; the Definition of Done in CLAUDE.md applies)

- Parse: `{7,4,3}`, `{0,0,0}`, `{1,1,1}`, `{3,1,1}`, huge `{123456,999,500}`, null, string, array, fields as strings/negatives/floats/NaN/missing -> safe zeros, never throws.
- Copy: every shape above x text; assert no output contains "people"; zero never contains a digit-then-"nights" pair; singular/plural; the zero second line names an action (non-empty, contains a verb from a small allow-list you define in the test); no raw non-ASCII punctuation in the source (the repo's mojibake check runs it).
- Hook: signed out and anonymous -> no `rpc` call; flag off -> no call; signed in -> exactly one call to `get_my_organiser_going_total_v1` with no args; a refusal is not retried; network failure retried once; a failed RE-read keeps the numbers (`refreshFailed`).
- Component: every state x the shapes; the error state has a Try again control; nothing points at a control that is not rendered; untouched render sends nothing.
- No test may touch `src/modules/organiser/**`.

## Verify before you push (run in your sandbox; paste counts in the PR body "Verified / Not verified")

`npm run test:unit -- src/modules/going` , `npm run lint` (the chain; eslint at the end is informational), `npx tsc --noEmit` (or the repo's typecheck script), `node scripts/check-mojibake.mjs` if it exists. Read `.github/workflows` and run every step of every job that applies; put the per-job table in the PR body. Do not run the e2e gate unless a step needs it.

## Hard rules

CLAUDE.md "File-write safety": source files over 2 KB go through `scripts/safe-edit.py` / `scripts/safe-write.py`. Do NOT edit the calendar density-exempt files. No `supabase/**`. Vercel cap is 71/100: **push ONCE**. Leave `docs/handover/going-stats-total-web.md`: what you built, the exact copy strings, what the organiser lane must do to mount it (import names, props, where C3 puts it), Not verified: **no 390x844 look, because nothing mounts it**.
