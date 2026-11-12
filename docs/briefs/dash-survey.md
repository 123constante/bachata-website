# Brief: dashboards slice 0, stats data survey (admin issue #1532, parent #1531; careful lane, READ-ONLY)
Branch: claude/dash-survey. Output only: docs/briefs/dash-survey.report.md. No code, no migration, no prod write.
## Goal
Say which dashboard tiles have real data on prod today. Tiles: Going (event_attendance), opens (event_views, split by source), link clicks (event_link_clicks by link_type), organiser page opens, city organiser counts (5+ organisers rule), Nights attended (dancer).
## Do
1. Read the contract in the Website repo docs if present; else this list: organiser light dashboard (next action, share page, per-night Going/opens/clicks, positive-only), dancer dark dashboard (finish profile, nights attended).
2. Supabase MCP, read-only SELECTs only. For each source table report: row count, date range, rows per shape (organisers with 0 / 1-5 / 6+ upcoming nights; past-only; huge = max rows per event), distinct viewer_session_id, source split, link_type split, status split for event_attendance. Note server dedupe: per session + day.
3. Organiser page opens: find whether any table records them; if none say NONE.
4. City organiser counts: how many cities have >=5 organisers.
5. Verdict table: tile | real data? | rows | caveat | empty-state needed.
## Done when
Report committed on the branch, every number labelled with its query. Handover section: Verified / Not verified. Counts only, no personal data in the report.
