# Handover: Going cosmetic follow-ups

Brief: `brief/going-cosmetic-followups:docs/briefs/going-cosmetic.md` (blob 8a3beb1c).
Branch: `claude/going-cosmetic-followups`. Class: TRIVIAL (wording/docs only, no behaviour change).

## Done

1. `scripts/check-going-rpcs.mjs` header: "four" -> "six" "I'm going" RPCs. Counted from
   the file's `api.rpc(...)` calls: `get_nights_going_v1`, `get_public_dancer_extras_v1`,
   `set_my_going_v1`, `get_my_going_v1`, `get_my_event_going_v1`,
   `get_my_organiser_going_total_v1` (the other two RPCs it calls,
   `get_calendar_events_v2` / `event_view_p5`, only source sample ids). **The brief said
   five; the file shows six** -- `get_my_event_going_v1` (Going P3) was already uncounted
   before #1022 added the total. The file is the authority, per the brief's "count them".
2. `SIGNED_IN_SKIP` now also names the `get_my_organiser_going_total_v1` success shape.
   No test asserts the string verbatim (grep of `tests/`, `src/`, `scripts/`: only the
   file itself), so no test changed.
3. `docs/ci-guard-notes.md` Going RPCs entry: adds the anon refusal of
   `get_my_organiser_going_total_v1` and the signed-in SKIP note for its success shape.
   No check count pinned.
4. `docs/handover/going-stats-total-web.md`: the "Not done ... live contract check"
   bullet is now "Done in #1022" (git log: 4791d9f, PR #1022).

## Left / noticed, not done (outside this brief)

- `docs/ci-guard-notes.md` Going entry also omits the anon refusal of
  `get_my_event_going_v1`, which the script does assert. Not added: the brief scoped item 3
  to the total RPC only.
- `bin/check-integrity.sh` is mode 100644 on main, so `npm run lint` reports
  `check:integrity` exit 126 (Permission denied) in a fresh clone; `bash bin/check-integrity.sh`
  passes. Pre-existing, unrelated.
- In this cloud sandbox `VITE_SUPABASE_URL` names a non-prod project, so a bare
  `npm run check:going-rpcs` reports 33 PGRST202/missing-key violations. Pointed at prod
  (`stsdtacfauprzrdebmzg`, anon key) it is green.
