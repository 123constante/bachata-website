# Brief: fix pass 3 for Website PR #843 (portrait video): smaller portrait size, ONE push

Repo: 123constante/bachata-website. Branch: `claude/portrait-video-web` (PR #843 open, bot-authored, head 72e73baa). Read first: `docs/handover-portrait-video-web.md` on the work branch, and the earlier briefs on branch `arc/briefs-portrait-video` for the rules. Do NOT open a new PR. Push ONCE to the same branch, then add a "Fix pass 3" section to the PR body. Final commit subject ends with `[worker-done <your ticket>]`.

## Owner's words and decision (click answers, 2026-10-20)
The owner looked at the result and said: "the new portrait size is too big". Measured today at 390x844: a portrait frame is 343x606-609 px, about 72% of the screen height. Decisions:
- On a PHONE the portrait frame is capped at 55% of the screen height (`55svh`): about 261x464 px for a 9:16 clip on 390x844.
- On a larger screen (the `md` breakpoint and up, 768px by Tailwind default; check `tailwind.config` in case `screens.md` is customised and say what you used) the cap stays `75svh` as now.
- Landscape output must stay byte-identical. Nothing else changes.

## Change (smallest)
- `src/lib/videoFrame.ts`: `frameStyle(frame)` width becomes `min(100%, calc(var(--video-cap) * <ratio>))` (aspect-ratio and `marginInline: auto` unchanged). Export `VIDEO_CAP_CLASS = '[--video-cap:55svh] md:[--video-cap:75svh]'`.
- Apply `VIDEO_CAP_CLASS` to the adaptive frame element in `src/components/VideoFrame.tsx` and `src/components/venue/VenueVideoEmbed.tsx` (only when the frame is NOT landscape). Landscape frames get no cap class.
- Confirm the project's Tailwind actually generates these arbitrary-property classes (content globs include `src`, Tailwind version supports `[--x:y]`). If it does not, use one small rule in the existing global stylesheet instead (a class `.video-cap` with the variable and a `@media (min-width: 768px)` override) and say so in the PR body.

## Tests (RED FIRST on the current head, keep the failing output for the PR body)
Update `src/lib/__tests__/videoFrame.test.ts` and `src/components/__tests__/VideoFrame.test.tsx`:
1. `frameStyle` for 9:16 and 480x848 returns the new `min(100%, calc(var(--video-cap) * ...))` width; landscape still returns `undefined`.
2. An adaptive `VideoFrame` and an adaptive `VenueVideoEmbed` frame carry both tokens of `VIDEO_CAP_CLASS`; landscape frames carry neither.
3. The existing cross-surface test (event tile vs venue give the same frame) and source-guard test stay green.

## Gates
Run every CI job step you can with command and exit code: `npm run test:unit` (the first worker reported 15 failures in 4 files identical on `main`; confirm), typecheck, lint, production build `npm run build`, bundle-budget. If a browser exists in your sandbox, measure the frame of a portrait clip at a 390x844 viewport and report it (expect about 261 wide); otherwise say "not verified in a browser: the orchestrator re-walks". Report the new head's GitHub check state.

## Boundaries
Plain git only; NEVER `gh api`; shell commands without variables, loops or `$(...)` where a plain command works. Never merge or approve, never `--no-verify`, PR stays bot-authored. Push ONCE (Vercel deploy cap). Context: at 25% start nothing new; by 30% push and append to the handover with a last commit subject ending `PARTIAL [worker-done <ticket>]`. Stop after the push and report: head SHA, per-job checks, Verified / Not verified.
