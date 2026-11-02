# Handover: live-now slice 2, Website half -- PARTIAL (stop rule hit)

Brief: `brief/live-now-s2web:docs/briefs/live-now-s2web.md`. Base: main 61c970668.
Ticket: dt_2a614767bef0. No code changed; this file is the only diff.

## Stop rule that fired

> If the live event_view_p5 does NOT return `version` on prod: stop, write
> PARTIAL with the observed keys, do not invent a field.

On the call path the Website actually uses, it does not.

## Evidence (prod `stsdtacfauprzrdebmzg`, read-only, 2026-11-02)

1. `event_view_p5(jsonb,jsonb)` is `STABLE SECURITY DEFINER` (no writes), body
   6059 chars. Migration 20270312410000 adds
   `v_result || jsonb_build_object('version', public._event_public_version_v1(...))`
   ONLY in the native-shape branches (occurrence_id and series_id). Its own
   comment says "additive, native shape only".
2. The Website calls it with `p_viewer = {role:'anon', shape:'snapshot_compat'}`
   (`src/modules/event-page/useEventPageQuery.ts`, `useEventPageQuery`, and the
   same path via the `app/routes/event.tsx` loader). The `snapshot_compat`
   branch returns `_event_view_snapshot_compat_v1(p_target)` plus
   `has_timed_session` and RETURNS before the version merge.
   `_event_view_snapshot_compat_v1` does not mention `version` (position = 0).
3. Live calls, 40 `lifecycle_status='live'` series ids:
   - `snapshot_compat`: 5 non-null objects, **0 with `version`**. Union of
     top-level keys observed: `attendance, byline_organisers, event, event_id,
     location_default, occurrence_effective, occurrence_id, occurrences,
     organiser_byline, organiser_card, organisers`.
   - native (no shape): keys `program, series, version`; `version` is a JSON
     **number**.

So the brief's premise ("adds a top-level `version` to the event_view_p5
payload") holds for the native shape only. Parsing `payload.version` in
`parseEventPageSnapshot` would always yield null on prod; a contract check
pinning `version` on the compat shape would be red on day one.

## Not done (all of Build 1-4)

- `EventPageSnapshot.version` parser field + tests -- not started (would be
  inventing a field the payload does not carry).
- `.data` loader shape test -- not started.
- `scripts/check-*.mjs` contract + db-contract-check.yml step -- not started.

## Owner decision needed (pick one)

A. **Admin follow-up migration** (recommended): in the `snapshot_compat` branch
   of `event_view_p5`, merge
   `jsonb_build_object('version', public._event_public_version_v1(<series id>, <occurrence id>))`
   before `RETURN v_result`, using the target's ids. Additive, keeps the
   Website's single RPC. Then re-dispatch this brief unchanged; the type is
   `number` (from the native shape), parse with the existing `asNumber`.
B. **Website second call**: have the `/event` loader also call the native shape
   (or `_event_public_version_v1` if exposed) for `version`. Costs one extra RPC
   on every SSR render of `/event`; not recommended.

## Verified / Not verified

- Verified: function body (both halves read), volatility, compat vs native keys
  on live prod data (counts/keys only, no personal data, no writes).
- Not verified: occurrence_id-targeted compat calls (same early RETURN in the
  body, so same result expected); why 35/40 live series ids return null from
  compat (pre-existing, unrelated; compat likely keys on a different id).
