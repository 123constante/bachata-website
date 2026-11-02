# Handover: review-live-now-lag-r1

**Done:** `docs/review/live-now-lag-r1.md` &mdash; independent review of PR #1260
(`claude/live-now-lag-r1` at `17514e1`). Verdict **BLOCK** until two PLAN.md
edits land: F1 (the "Live now" check reads a `version` field the public
`event_view_p5` payload does not carry &mdash; confirmed in prod, read-only) and
F2 (option C's hard delete is scoped to `city-*` and `seo-landing` too, so one
cancel cold-renders the city home and nine SEO pages). F3 adds the omitted
`/tonight`, `/search`, `/parties`, `/classes` surfaces; F4-F7 are matrix and
wording nits. Docs only, `npm run lint` 24 of 24 green.

**Verified (read-only):** every cited file:line on `main` `ff20808`; the 33 ms
save-to-purge pair (`updated_at` 19:19:39.003, webhook 19:19:39.036, tags
`event-<uuid>`, `city-london-gb`, `seo-landing`); `pg_net` retention ~6 h;
`event_view_p5` has no `version` / `updated_at`; no option touches a protected
calendar file; PR #1260 checks 23 success, 8 skipped, 0 failed.

**Not verified:** live response headers (proxy 403 here too); whether
`/venue-entity/:id` SSR embeds its event list; the exact `.data` URL shape for
a single-route fetch.

**Next steps:** builder edits PLAN.md per F1-F4 on `claude/live-now-lag-r1`
(or a r2 branch); owner decides whether the admin migration exposing a public
`version` is in scope before the Live-now check is briefed; remove
`automerge-ok` from #1260 until F1/F2 are addressed.
