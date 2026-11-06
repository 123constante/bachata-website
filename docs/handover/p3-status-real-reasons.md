# Handover: p3-status-real-reasons

Branch `claude/p3-status-real-reasons` (from `main` d00ffae). Brief: `brief/p3-status-real-reasons`
`docs/briefs/p3-status-real-reasons.md` (version 2). No database change.

## The bug
The P3 Status sheet's Put it live, on a draft whose event side is ready, was refused by the server
for a PROFILE gap (organiser page missing `founded_year`), and the Website mapped every
`permission_denied: series.set_lifecycle ... needs a ready series` to one fixed sentence that blamed
"a cover photo, a date coming up and its details".

## Prod survey (read-only, 2026-11-05)
- `series_go_live_check_v1(p_series_id)` needs `auth.uid()`; read through its body
  `_series_go_live_check_p5(series, actor, profile_rule)` (STABLE). Keys returned:
  `ready`, `event_missing[{code, section}]`, `recommended[{code, section}]`,
  `profile_rule_applies`, `profile_missing[{area, organiser_id, fields[]}]`.
- event codes: venue, city, upcoming_date, session, cover, name, country, organiser,
  no_session_first_date, first_date_past, bad_session_times, no_payment, no_flyer (cover's twin);
  recommended: ticket_link. All already in `shared/goLiveKeys.ts` GO_LIVE_BLOCKERS.
- profile fields (`_profile_fields_p5`, required): organiser name, city, logo, category,
  founded_year, instagram, contact_phone; dancer first_name, city, dance_role, photo, nationality,
  languages, instagram, phone_or_whatsapp, dance_started_year; teacher teaching_styles;
  dj dj_name, dj_genres.
- Series 7f0236e5: event_missing [], recommended [ticket_link]; organiser 2631450a
  required_missing [founded_year] (the real blocker).
- Draft/rejected series: 16; event codes across them: no_payment 15, cover 13, no_flyer 13,
  venue 11, city 10, session 10, first_date_past 10, no_session_first_date 9, upcoming_date 4,
  organiser 1; 1 draft has an empty event_missing (the screenshot one).

## What changed
- `shared/goLiveKeys.ts` (the ONE mapping): `PROFILE_GAP_TODO`, `profileGapText`,
  `goLiveReasons`, `goLiveReasonText`, `GO_LIVE_NOT_READY(_LEAD)`. founded_year reads
  "Add the year you started to your organiser page".
- `shared/goLiveCheck.ts`: `isGoLiveRefusal` (the one predicate; `goLiveRefusal` uses it).
- `shared/selfServeErrors.ts`: the code-only refusal sentence is now the neutral
  `GO_LIVE_NOT_READY` (names no item, never the cover).
- `p3/data/eventPage.ts`: `statusRows(ws, today, now, goLive?)` &mdash; a not-ready answer owns
  Put it live's reason; ready / no answer keeps the page's own facts. `STATUS_COPY.goLiveRefused`.
- `p3/screens/StatusSheet.tsx`: asks `useGoLiveCheck` on a draft (before the tap); on a go-live
  refusal keeps Put it live off with the refusal's items, shows an alert, re-asks the check and
  lets a fresh NOT-ready answer replace it (a failed re-ask or a "ready" keeps the refusal).
  An onboarding refusal still goes to the gate first.
- Tests: new `p3/screens/__tests__/goLiveReasons.matrix.test.tsx`; `eventPage.matrix` and
  `archivedEvent` mock `useGoLiveCheck` (they render without a QueryClientProvider);
  `scripts/lint-runtime-architecture.mjs` allowlists the new spec for `organiser_id` (it feeds the
  server answer, same as the other go-live specs).

## Left / next steps
- Orchestrator: walk the Status sheet at 390x844 on a prod-shaped draft (not done here).
- `events/LifecycleActions.tsx` NOT_READY_LINE is the same words as GO_LIVE_NOT_READY_LEAD but a
  separate constant; out of scope (another screen). Could import the lead later.
- The sheet lists each profile field (up to 3, then "And N more"); Home counts the profile as one
  row. Different on purpose (a list vs a count) &mdash; flag if the owner wants them aligned.
