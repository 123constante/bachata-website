# People arc S2b -- dancer world continuation: adopt the shared world shell, wall-clock gig dates, socials times

Continue on branch `claude/people-dancer-world` (PR #986). Lane: normal. Website only, no database change.
FIRST: `git merge origin/claude/people-dj-world` (head b62020f) into your branch (a merge, NOT a rebase; also merge
origin/main if it moved). #984 (the DJ world, S3) is green but is held so the owner merges #984 and #986 together after one
combined walk; until then #986's diff will show S3's files too, which is expected. #984 brings the shared shell
`WorldPage`, the frame's Back rule, `facts.wallDayOf` / `gigDateLabel` / `timeLabel`, and the GlobalLayout `fitContent`
opt-in. Read `docs/people-arc/s3/HANDOVER.md` (the "S3b" section: shell API, what a world deletes) and your own
`docs/people-arc/s2/HANDOVER.md`. Never edit S3's files in this merge; a conflict there = take theirs.
Everything stays behind `flags.personWorlds`; flag OFF stays exactly as main.

## File ownership
You own the dancer page (`src/pages/DancerProfile.tsx`, `app/routes/dancers*`) and `src/modules/person-page/worlds/dancer/**`.
Do NOT edit `frame/**`, `facts/**`, `worlds/tokens.ts`, `GlobalLayout` or the DJ world -- if the shell is missing something,
write "needs frame" in the handover instead. Do not touch `src/modules/dancer-app/**` (a separate follow-up PR).

## Fix (red first for each)
1. Shell: `DancerWorldPage` drops its own wrapper (`max-w-xl px-4 pb-10 pt-3` + ground) and renders through the shared shell
   from `frame/`, every flag-ON state (loading, thin, full). Why: the owner saw the frame change between the DJ and dancer
   worlds; measured Back L10 T113 vs L14 T116 and bar W361 vs W354. Extend the shell's identical-frame test (S3 wrote it)
   with the dancer page so it fails if the dancer world wraps the frame again.
2. `nextAppearance` / the "next gig" line: gig `event_start_time` stamps are London WALL CLOCK stored as +00, so
   `londonDayOf` moves a 23:xx gig to the next day in summer. Use `facts.wallDayOf` and `facts.gigDateLabel` (and the
   future check on the same basis). Matrix rows: a 23:30 summer gig, a winter gig, a past gig, none.
3. "Socials in <city> this week" rows lead with `facts.timeLabel` ("21:00"); no world formats a time itself.
4. If the dancer lower half shows an empty-state button, it uses the same wording rule as the DJ world (owner D12:
   "Find a party" -> `/parties`; D11 muted line when there is nothing) -- reuse the shared wording, never a copy.
5. D13: footer straight after the content (comes from the shell; delete any own min-height).
6. D8' invite "Dance bachata too? Get your own card" stays on every shape.

## Design Gate 4 + walk
390x844 and 360x800 screenshots, prod data, flag ON, every shape from your S2 table (11). Record Back L/T and bar width per
shape; they must equal the DJ world's numbers in the S3 handover. Contrast >= 4.5, taps >= 44px, no sideways scroll.
Update `docs/design/` record for S2.

## Checks before push
Every CI job step that applies (read `.github/workflows`). PR #986 body: per-job CI table, "## Verified on real data" with
lines starting EXACTLY `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: ` (no bold, nothing between label and colon),
"## Phone QA".

## Handover
Push once. Append "S2b" to `docs/people-arc/s2/HANDOVER.md`: head sha, per-item changes, frame box numbers per shape, not verified.
