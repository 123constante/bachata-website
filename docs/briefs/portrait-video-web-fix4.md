# Brief: fix pass 4 for Website PR #843 (portrait video): phone cap 35svh, ONE push

Repo: 123constante/bachata-website. Branch: `claude/portrait-video-web` (PR #843 open, bot-authored, head 91c4bca3). Read `docs/handover-portrait-video-web.md` on the work branch first. Do NOT open a new PR. Push ONCE to the same branch, then add a "Fix pass 4" section to the PR body. Final commit subject ends with `[worker-done <your ticket>]`.

## Owner decision (click answer, 2026-10-20)
After fix pass 3 (phone cap 55svh) the owner said "still too big" and chose a phone cap of 35% of the screen height: about 167x295 px for a 9:16 clip on a 390x844 phone. Desktop (768px and up) stays at 75svh. Landscape output stays byte-identical. Nothing else changes.

## Change (one number)
- `src/lib/videoFrame.ts`: `VIDEO_CAP_CLASS` becomes `'[--video-cap:35svh] md:[--video-cap:75svh]'` (keep it a literal string so Tailwind's content scan still generates both classes). Update the comment above it and the comment in `src/components/VideoFrame.tsx` that says 55svh.
- Update every test, comment and doc line that says `55svh` or 55% (grep the repo for `55svh` and `55%`, including `docs/handover-portrait-video-web.md`).

## Tests (RED FIRST on the current head, keep the failing output for the PR body)
Change the expectations in `src/lib/__tests__/videoFrame.test.ts` and `src/components/__tests__/VideoFrame.test.tsx` from 55svh to 35svh (assert the class string contains `[--video-cap:35svh]` and `md:[--video-cap:75svh]`, landscape frames carry neither). Run them first against the unchanged code to prove they fail, then change the constant.

## Gates
Same as pass 3: run every CI job step you can with command and exit code: `npm run test:unit` (the first worker reported 15 failures in 4 files identical on `main`; confirm), typecheck, lint, production build `npm run build`, bundle-budget. Report the new head's GitHub check state.

## Boundaries
Plain git only; NEVER `gh api`; shell commands without variables, loops or `$(...)` where a plain command works. Never merge or approve, never `--no-verify`, PR stays bot-authored. Push ONCE (Vercel deploy cap). Context: at 25% start nothing new; by 30% push and append to the handover with a last commit subject ending `PARTIAL [worker-done <ticket>]`. Stop after the push and report: head SHA, per-job checks, Verified / Not verified.
