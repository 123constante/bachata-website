# Handover: portrait video (web)

Status: DONE (single PR). Shared mapping in `src/lib/videoFrame.ts`; `VideoFrame` wraps `VideoEmbed`
(event tile, festival aftermovie); `VenueVideoEmbed` keeps its inline `<video>` and uses the same
`frameFor`/`frameStyle`. Shorts => `portrait: true` from `parseVenueVideoUrl`.
Left: phone checks (iPhone .mov rotated, real autoplay, Vercel preview). 15 unit failures and 97 tsc errors
exist on `main` unchanged (not from this branch).

## Fix pass 1

Measured frame shape is now stored with the clip src it came from
(`MeasuredFrame`, `resolveFrame` in `src/lib/videoFrame.ts`, used by
`VideoFrame` and `VenueVideoEmbed`). A reused instance no longer carries clip
A's portrait shape onto clip B / a YouTube watch / Vimeo embed. Four new tests
in `VideoFrame.test.tsx` (red on 65363a7, green now). Done; nothing left.

## Fix pass 2

SSR race: the server-rendered `<video>` loads metadata before hydration, so
`onLoadedMetadata` never fired and portrait clips kept the landscape box.
`useReportVideoSize` (in `src/lib/videoFrame.ts`) reads `readyState >= 1` and
`videoWidth > 0` on mount per src and reports the size; used by `VideoEmbed`
and `VenueVideoEmbed`. `onLoadedMetadata` kept for late loads. Tests (jsdom
prototype getters, plus a real `renderToString` -> `hydrateRoot` sequence) red
on b82b862 (3 failures), green now. Note: `videoWidth/Height` live on
`HTMLVideoElement.prototype` in jsdom, so the tests define them there.
Left: orchestrator re-walks femme-style and the-camden-tuesdays in a browser.

## Fix pass 3 (portrait size)
- Portrait frame cap is now a CSS variable: `frameStyle` width `min(100%, calc(var(--video-cap) * ratio))`; `VIDEO_CAP_CLASS` (`[--video-cap:55svh] md:[--video-cap:75svh]`) is applied to the non-landscape frame in `VideoFrame.tsx` and `VenueVideoEmbed.tsx`. Landscape unchanged.
- Tailwind 3.4.19, default `md` = 768px (only `container.screens` is customised); build CSS confirmed to contain both classes.
- Gates: new tests red on prior head (5 failures), green after; `test:unit` 15 failed (same count as first worker; tests/eventViewCompat.contract + tests/integrityCouldNotRun etc.), build 0, bundle-budget 0, eslint on touched files 0, tsc has pre-existing errors in unrelated files only.
- Not verified in a browser: the orchestrator re-walks (expect ~261 wide at 390x844).
