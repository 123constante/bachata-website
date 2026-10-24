# Session handover 2026-10-24 -- people arc S4 (teacher world)

Branch `claude/people-teacher-world`, PR **#999**. Worker ticket dt_93e9d13e25e3. Full handover:
`docs/people-arc/s4/HANDOVER.md`; design record `docs/design/people-s4-teacher-world.md`.

## Done
- 42ab253: teacher world behind `flags.personWorlds` (flag OFF unchanged), matrix tests, prod walk, docs.
- d1b9980: merged main (#992); teacher grid moved from `pageGrounds.ts` into `frame/WorldPage` so /event stays
  under its 381 KB first-load budget (CI bundle-budget green).
- PR body: one `## Verified on real data` section (another account had appended a second one, which failed
  `real-data-verified`; merged into one).
- ffa8139 (another worker, dt_319f352ac288): Stage 5 critique fix pass, not reviewed by this session.

## Open
- `contract-check` (DB Contract Check) red: `check-teacher-dj-assignment-integrity.mjs` reports 8 unassigned DJs
  vs a baseline of 7. Live prod data, not this PR; also red on main (464c4eb) and #998. PR comment posted.
- Teacher-only 404: `get_public_teacher_detail_v1` requires first_name + avatar_url + based_city_id; 62 of 64
  teacher-only people fail it. SQL, admin repo, careful lane. Not fixed here.
- Q2 (old detail sections on the world): thin reading taken; ffa8139 adds "extra detail when filled" per owner
  rules. Owner to confirm.
- Not verified: real photos, Vercel preview with both flags, a class abroad, `/code-review`.

## Next
1. Read CI on the current head of #999 (after ffa8139 + this doc commit).
2. If only contract-check is red and the DJ baseline is unchanged on main, nothing on the PR is left to fix.
3. Vercel preview: `node scripts/preview-deploy.mjs --flag VITE_ENABLE_PERSON_WORLDS=true --flag VITE_ENABLE_TEACHER_DETAIL=true`.
