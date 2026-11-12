# Handover: organiser dashboard Option A fixes (admin #1544, parent #1531)

Branch `claude/profile-dash-organiser-a-fixes`, stacked on `claude/profile-dash-organiser-designs` (#1538, not yet on
main), so the PR diff includes #1538's files until that merges. Brief: `docs/briefs/profile-dash-organiser-a-fixes.md`
on `brief/profile-dash-organiser-a-fixes` (blob df84676). Docs/design only: no app code, no DB, no migrations.

## Done
- All 8 critique fixes + the minor WhatsApp padding fix, in `tools/gen.py` (Option A section). Table in `options.md`
  ("Option A v2").
- New `tools/test_mapping.py`: consistency matrix for Option A over every state x every night (Tickets sold vs Ticket
  link taps from different sources, Going never a tile, max 4 tiles, no "N more", no zero printed, exactly one gold
  primary per state, city-aware empty copy).
- Re-shot 390x844 (first screen + full page) for no-events, upcoming, selling, huge, all-zero, cancelled, plus the new
  no-events-no-city. B and C were re-shot too (shared data changed in huge and no-events).

## Verified
- `node docs/design/organiser-dashboard/tools/check-shots.mjs`: 19/19 pass (taps >= 44, contrast >= 4.5 (A lowest 4.97),
  no sideways scroll, no clipping).
- `python3 -I docs/design/organiser-dashboard/tools/test_mapping.py`: 6 tests OK. The huge test fails on the old data
  (sold == ticket taps == 6,013).
- Looked at the upcoming, huge and cancelled shots myself.

## Not verified
- No prod shape survey (docs-only mock; magnitudes from the earlier brief).
- Full-page shots show the sticky tab bar part-way down the page (a Playwright full-page artefact of `position:sticky`);
  the first-screen shots are correct.
- No real-phone check; system font stack, not the site's fonts.

## Next steps (owner)
- Confirm Option A v2; the GAPs in `options.md` (per-night opens/clicks, cancelled nights in RPCs, share-my-page link)
  still have to close before a build.

## Ship status
- PR #1565 (opened by the bot, description filled in by this session). Neither merged nor approved.
- tsc run on 91b80bd: 0 errors in branch files (no TS files touched; whole project clean).
- No `automerge-ok` label: the diff is over 400 lines because it carries #1538's files.
- Vercel: not checked (no VERCEL_TOKEN in this session; needs owner: Vercel token).
