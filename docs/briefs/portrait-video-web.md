# Brief: portrait video support on the public Website (one PR)

Repo: 123constante/bachata-website. Work branch: `claude/portrait-video-web` (create from `main`). One PR, push ONCE when finished, no follow-up PR for your own mistakes. Handover file: `docs/handover-portrait-video-web.md` (a continuation worker reads it if you stop PARTIAL).

## Why (the owner's words and what we measured)
The owner pasted a YouTube Short and said it "does not want to load". Measured on the live site (2026-10-19, 390 wide):
- The event page video tile forces every video into a 16:9 box (`aspect-video` in `src/modules/event-page/bento/blocks/VideoBlock.tsx` line 24). A YouTube Short (9:16) plays as a thin strip in the middle of a wide black box (london-bachata-salsa-boat-party: iframe 394x222).
- An uploaded portrait clip (femme-style, 480x848) is cropped by `object-cover` so only about 32% of the frame shows. The dancer cannot be recognised.
- Prod has 7 uploaded clips: 5 landscape (640x360 x3, 848x474, 848x478) and 2 portrait (480x848, 720x1280). It also has 1 Shorts link, 9 YouTube watch links, 0 Vimeo, 2 series with two videos (only the first plays).

## Owner decisions (do not re-decide)
1. Orientation is MEASURED IN THE BROWSER from the video element (`videoWidth`/`videoHeight` on `loadedmetadata`). No database or RPC change, no new data field.
2. A portrait video is shown WHOLE, centred in the video tile with dark side bars, and its height is capped at about 75% of the screen height (`75svh`). Landscape looks exactly as today.
3. YouTube Shorts links get the same portrait treatment (known at once from the URL, no measuring). Vimeo and ordinary YouTube links stay 16:9.
4. The same must hold on three surfaces: the event video tile, the festival Aftermovie section, and the venue page "See the venue" player. NOT the venue top hero (`VenueMediaHero.tsx`, a fixed 16:9 photo grid): leave it alone.

## Decisions made on the owner's behalf (log them in the PR body)
- Rule: a direct clip with width/height >= 1.6 is "landscape" (today's behaviour: 16:9 box, `object-cover`). Anything below 1.6 (4:3, square, portrait) uses the adaptive frame: `aspect-ratio` = its own ratio, `object-contain`, width `min(100%, 75svh * ratio)`, centred on black. Export the threshold as `LANDSCAPE_MIN_RATIO = 1.6`.
- Until metadata loads the tile shows 16:9, then adjusts (one small jump on first paint, accepted by the owner). A video with missing or zero size stays landscape.
- Directly uploaded clips keep their controls, autoplay-muted-loop and the IntersectionObserver pause exactly as today.

## Build
ONE shared mapping, not copies (the owner's rule: the same fact reads the same on every screen).
1. New pure module `src/lib/videoFrame.ts`: `LANDSCAPE_MIN_RATIO`, `frameFor(width, height)` returning `{ landscape: boolean; ratio: number }` (guard NaN, 0, negative, undefined, Infinity -> landscape 16/9), and `frameStyle(frame)` returning the inline style for the adaptive case (`aspectRatio`, `width: min(100%, calc(75svh * ratio))`, `marginInline: auto`) or `undefined` for landscape.
2. `src/lib/parseVenueVideoUrl.ts`: the `youtube` result gains `portrait: boolean` (true only when the URL contains `youtube.com/shorts/`, case-insensitive, with or without `www.` and with query strings such as `?feature=share` or `?si=...`). Keep every existing export and behaviour.
3. `src/components/VideoEmbed.tsx`: add an optional `onVideoSize?: (w: number, h: number) => void` prop, called from the direct `<video>`'s `onLoadedMetadata`. Add a new component `src/components/VideoFrame.tsx` (props `video`, `poster`, `title`) that owns the frame: outer `w-full overflow-hidden bg-black` wrapper; inner box landscape = `aspect-video w-full`, adaptive = `frameStyle`. A Shorts embed starts adaptive at ratio 9/16. The direct `<video>` uses `object-contain` in the adaptive case and `object-cover` in the landscape case.
4. Callers: `VideoBlock.tsx` (replace the `aspect-video` div), `src/pages/FestivalDetail.tsx` around line 3101 (keep the outer `mx-auto w-full max-w-3xl ... rounded-xl border` wrapper, drop the forced `aspect-video`, use `VideoFrame`), `src/components/venue/VenueVideoEmbed.tsx` (replace the `paddingBottom: 56.25%` box). VenueVideoEmbed has its own inline `<video>` (autoplay muted loop): keep it, add `onLoadedMetadata` to feed the SAME `frameFor`/`frameStyle`; its iframe path uses the same Shorts rule.
5. No new dependency. The event page is perf-budgeted (`perf-budgets.json`): keep the added code small and check the `perf-budget` workflow.

## Tests (RED FIRST: write them, run them on the unfixed code, keep the failing output for the PR body, then implement)
Runner: vitest (`npm run test:unit`), jsdom. Put tests under `__tests__` next to the code.
- `parseVenueVideoUrl`: table of watch, youtu.be, embed, shorts, shorts with `?feature=share`, shorts with `?si=`, shorts without `www`, vimeo, player.vimeo, direct .mp4/.mov/.webm/.m4v, direct with `?x=1`, blank, junk, TikTok URL (must return null). `portrait` is true only for shorts.
- `frameFor` table: 640x360, 848x474, 848x478 (landscape); 480x848, 720x1280 (portrait); 1000x1000 and 640x480 (adaptive); ratios 1.59, 1.6, 1.61 (boundary); 0x0, NaN, undefined, Infinity (landscape fallback).
- `VideoFrame` component: render a direct video, set `videoWidth`/`videoHeight` with `Object.defineProperty` on the element, dispatch `loadedmetadata`, assert the wrapper switches from `aspect-video` to the inline `aspect-ratio` style, and back-to-landscape for 848x474. Shorts embed is adaptive immediately. Vimeo and watch links stay landscape.
- Consistency across surfaces: render `VideoBlock` and `VenueVideoEmbed` with the same portrait clip and assert the same computed `aspect-ratio` and width style. A guard test that reads `VideoBlock.tsx`, `FestivalDetail.tsx` and `VenueVideoEmbed.tsx` as text and fails if `aspect-video` or `56.25%` still wraps a video player there.
- Shapes to cover (prod-shaped): the 7 real clip sizes above, a Shorts link with `?feature=share`, a two-video series (first playable wins), a venue with a TikTok link and one with an .html link (renders nothing, unchanged).

## Gates (run EVERY CI step yourself, report per job with command and exit code)
GitHub Actions billing is intermittent: a red check whose annotation says "payments have failed / spending limit" is not a code failure; say so. Read `.github/workflows/*.yml` and run each job's steps in your sandbox: unit-tests (`npm run test:unit`), typecheck (`npm run typecheck`), lint (`npm run lint`), architecture-guard, perf-budget, e2e-smoke where your sandbox allows, and a PRODUCTION build `npm run build` (not only the dev server). Say plainly what a sandbox cannot run (real phone, Vercel preview).
PR body MUST contain the sections the workflows check: `## Phone QA` (with a filled "Sizes checked" line that has a WxH such as 390x844; read `.github/workflows/phone-qa-section.yml` for the exact lines) and `## Verified on real data` (read `.github/workflows/real-data-verified.yml`), plus `## Verified / Not verified` and the red-first failing output, and the per-job table. Not verifiable by you, say so: an iPhone `.mov` recorded rotated, real autoplay on a phone, the live Vercel preview.

## Boundaries
- Read and push with PLAIN git (`git fetch`, `git show`, `git push`). NEVER `gh api` (it stalls on a permission prompt). Write shell commands WITHOUT variables, loops or `$(...)` where a plain command works.
- Supabase is read-only and you should not need it. Never merge or approve. Never `--no-verify`. The PR must be authored by the bot (follow the dispatch prompt's PR rule).
- Another worker is changing the admin repo (not yours). Nobody else touches these Website files.
- Push ONCE at the end (Vercel Hobby deploy cap). Checkpoint progress in the PR description, not in extra pushes.
- Context: at 25% of your context start nothing new; by 30% push and leave the handover with the last commit subject ending `PARTIAL [worker-done <ticket>]`.
- Stop after the push and report: head SHA, PR number, per-job checks, Verified / Not verified.
