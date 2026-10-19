# Brief: fix pass 1 for Website PR #843 (portrait video), ONE push

Repo: 123constante/bachata-website. Branch: `claude/portrait-video-web` (PR #843 already open, bot-authored; head 65363a72). Read the original brief first (`docs/briefs/portrait-video-web.md` on branch `arc/briefs-portrait-video`) and `docs/handover-portrait-video-web.md` on the work branch. Do NOT open a new PR. Push ONCE to the same branch when finished, and update the PR body (add a "Fix pass 1" section; keep the existing sections correct). Final commit subject ends with `[worker-done <your ticket>]`.

## The finding (one, reviewed by the orchestrator)
`src/components/VideoFrame.tsx` keeps `measured` in `useState(() => frameFor())` and `src/components/venue/VenueVideoEmbed.tsx` does the same. The state is never reset when the `video` / `videoUrls` prop changes. The event page keys blocks by block name (`BentoGrid.tsx` line 276 `key={blk.id}`), not by event, so the same `VideoFrame` instance can stay mounted when the person moves from event A to event B. Failure: event A has a direct PORTRAIT clip (measured = portrait); the person navigates inside the app to event B whose video is a YouTube watch link or Vimeo (no metadata event ever fires) -> B's 16:9 embed is drawn inside A's portrait frame (narrow, centred). Same for two direct clips: B starts in A's shape until its own metadata loads.

## Fix (smallest change, no new feature)
- Store the measurement WITH the source it came from, and only use it when it matches the current video: for example `useState<{ src: string; shape: VideoFrameShape } | null>(null)` and `const frame = video.kind === 'direct' && measured?.src === video.src ? measured.shape : (youtube portrait ? frameFor(9, 16) : frameFor())`. A non-direct video can never use a measured shape. Apply the identical rule in `VenueVideoEmbed.tsx` (its first matching playable URL is the source). Keep ONE shared helper if that is smaller than two copies; do not duplicate logic.
- Do not change any other behaviour, class name or style value: landscape output must stay byte-identical for landscape clips.

## Tests (RED FIRST on the current branch head, keep the failing output for the PR body)
In `src/components/__tests__/VideoFrame.test.tsx` (extend it; do not make a new file unless needed):
1. Render `VideoFrame` with a direct 480x848 clip, fire `loadedmetadata` (adaptive), then `rerender` with a YouTube watch video -> the frame is landscape (`aspect-video`, no inline aspect-ratio).
2. `rerender` direct portrait A -> direct B (different src), before B's metadata: landscape; after B fires 848x474: landscape; after B fires 480x848: adaptive.
3. Same two cases for `VenueVideoEmbed` (rerender with different `videoUrls`).
4. Existing tests stay green.

## Gates (same as the original brief; run every CI job step you can, report per job with command and exit code)
`npm run test:unit` (note: 15 failures in 4 files, eventViewCompat, integrityCouldNotRun, occurrenceProgram, publicEventPageLineup, were reported identical on `main` by the first worker; confirm they are still identical on `main` and say so), typecheck, lint, production build `npm run build`, bundle-budget. GitHub checks on PR #843 were all green before this fix (23 pass, 9 skipping, none failing); after your push, report whether they still are.

## Boundaries
Plain git only; NEVER `gh api`; shell commands without variables, loops or `$(...)` where a plain command works. Never merge or approve, never `--no-verify`. PR must stay bot-authored. Push ONCE (Vercel deploy cap). Context: at 25% start nothing new; by 30% push and leave a handover (append to `docs/handover-portrait-video-web.md`) with a last commit subject ending `PARTIAL [worker-done <ticket>]`. Stop after the push and report: head SHA, per-job checks, Verified / Not verified.
