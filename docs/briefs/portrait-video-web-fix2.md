# Brief: fix pass 2 (finishing worker) for Website PR #843 (portrait video), ONE push

Repo: 123constante/bachata-website. Branch: `claude/portrait-video-web` (PR #843 open, bot-authored, head b82b8621). Read first: `docs/briefs/portrait-video-web.md` and `docs/briefs/portrait-video-web-fix1.md` on branch `arc/briefs-portrait-video`, and `docs/handover-portrait-video-web.md` on the work branch. Do NOT open a new PR. Push ONCE to the same branch, then add a "Fix pass 2" section to the PR body. Final commit subject ends with `[worker-done <your ticket>]`.

## The failure the owner would see (found by the orchestrator walking real data at 390x844, local dev server on this branch)
- Event page `/event/femme-style`: a real uploaded PORTRAIT clip (480x848). The video tile is still the old landscape box: frame 343x193, class `aspect-video`, video `object-fit: cover` (so only about a third of the picture shows, as before the PR). The owner asked for portrait clips to show whole and centred.
- In the same page: `video.readyState` = 4, `videoWidth` = 480, `videoHeight` = 848, so the size IS known. When the orchestrator dispatched a `loadedmetadata` event by hand, the frame correctly became 343x606 `object-contain`. So the frame logic is right and only the trigger is missing.
- Cause: the page is server-rendered. The `<video>` element finishes loading its metadata BEFORE React hydrates, so `onLoadedMetadata` is attached too late and never fires. The unit tests fire `loadedmetadata` after mount, so they cannot see this. `/event/london-bachata-salsa-boat-party` (a Short) works because it needs no event; landscape clips, YouTube links and the venue YouTube link were checked and are correct.
- The same race exists in the venue player's own inline `<video>` (`VenueVideoEmbed.tsx`) and for any festival Aftermovie clip.

## Fix (smallest change)
- `src/components/VideoEmbed.tsx`: add a `useEffect` (dependency: the direct clip's `src`) that reads `videoRef.current`; if `readyState >= 1` (HAVE_METADATA) and `videoWidth > 0`, call `onVideoSize(videoWidth, videoHeight)` once. Keep the existing `onLoadedMetadata` (it covers a clip that loads after hydration).
- `src/components/venue/VenueVideoEmbed.tsx`: give the inline `<video>` a ref and the same effect, feeding the SAME `setMeasured({ src, shape: frameFor(w, h) })`. Keep the keyed-by-src rule from fix pass 1 (`resolveFrame`). No new helper beyond what is needed; if the identical effect appears twice, one small shared hook (for example `useReportVideoSize(ref, src, report)` in `src/lib/videoFrame.ts` or its own file) is allowed.
- Do not change any class names, style values or landscape output.

## Tests (RED FIRST on the current head, keep the failing output for the PR body)
Extend `src/components/__tests__/VideoFrame.test.tsx` (no new file unless needed):
1. Define `readyState` (4), `videoWidth` (480) and `videoHeight` (848) getters on `HTMLMediaElement.prototype` BEFORE render (restore them in `afterEach`), render `VideoFrame` with a direct clip and fire NO event: the frame must be adaptive (inline `aspect-ratio`, `object-contain`).
2. Same with 848x474: stays landscape. With `readyState` 0 and no event: landscape.
3. The same three for `VenueVideoEmbed` (direct clip).
4. If feasible in about 20 lines: server-render with `renderToString`, set the prototype getters, then `hydrateRoot` into the container, and assert the frame becomes adaptive without any event (this is the actual production sequence). If it is not feasible in jsdom, say so in the PR body.
5. All existing tests stay green.

## Gates
Same as the earlier briefs. Run every CI job step you can with command and exit code: `npm run test:unit` (the first worker reported 15 failures in 4 files, identical on `main`; confirm and say so), typecheck, lint, production build `npm run build`, bundle-budget. If your sandbox can launch a browser, load a page with a portrait clip served from a local file and report the frame size; if it cannot, write "not verified in a real browser: the orchestrator re-walks femme-style and the-camden-tuesdays after your push". GitHub checks on PR #843 were green on the previous head; report them for the new head.

## Boundaries
Plain git only; NEVER `gh api`; shell commands without variables, loops or `$(...)` where a plain command works. Never merge or approve, never `--no-verify`, PR stays bot-authored. Push ONCE. Context: at 25% start nothing new; by 30% push and append to the handover with a last commit subject ending `PARTIAL [worker-done <ticket>]`. This is the finishing pass: bundle everything above into this one push and stop. Report: head SHA, per-job checks, Verified / Not verified.
