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
- Portrait frame cap is now a CSS variable: `frameStyle` width `min(100%, calc(var(--video-cap) * ratio))`; `VIDEO_CAP_CLASS` (`[--video-cap:35svh] md:[--video-cap:75svh]`) is applied to the non-landscape frame in `VideoFrame.tsx` and `VenueVideoEmbed.tsx`. Landscape unchanged.
- Tailwind 3.4.19, default `md` = 768px (only `container.screens` is customised); build CSS confirmed to contain both classes.
- Gates: new tests red on prior head (5 failures), green after; `test:unit` 15 failed (same count as first worker; tests/eventViewCompat.contract + tests/integrityCouldNotRun etc.), build 0, bundle-budget 0, eslint on touched files 0, tsc has pre-existing errors in unrelated files only.
- Not verified in a browser: the orchestrator re-walks (expect ~261 wide at 390x844).

## Fix pass 4 (phone cap 35svh)
- Owner decision: phone cap 35svh (about 167x295 for 9:16 at 390x844); desktop (md+) stays 75svh; landscape unchanged. `VIDEO_CAP_CLASS` is now `'[--video-cap:35svh] md:[--video-cap:75svh]'`.
- Note: the pass 3 line above was bulk-renamed to 35svh; it read 55svh at that time.
- Tests asserting the literal tokens were red on 91c4bca (2 failures), green after.

## Fix pass 5 (tile hugs the video + #421 trace)
- Owner decision 2026-10-20 "the tile hugs the video": for portrait/square frames (and Shorts) the element that draws the tile (border, corners) is now only as wide as the video (`hugStyle` in `src/lib/videoFrame.ts`, same width formula as `frameStyle`), centred (`mx-auto`), with no black fill around the video. `VideoFrame` now renders the caller's tile itself (`boxClassName` = the old landscape wrapper verbatim, `hugClassName` = border/corners only), because only it knows the shape. Venue: the `p-2` + border shell hugs, with its chrome (`1rem + 2px`: rem because the phone root font is ~13.5px) added inside the cap so the video gets the same width as on the event tile; the festival tile passes `hugChrome="2px"` for its border. Review: 2 rounds (medium: 3 fixed -- rem chrome, festival border, one shared width formula; low: none).
- The bento Video CARD keeps its full-width grid slot and title (its own surface shows either side, not black). If the owner wants the card itself narrower, that is a BentoGrid layout change, not done here.
- Landscape: SSR HTML byte-identical to main for VideoBlock + venue (direct / YouTube watch / Vimeo); festival landscape class string carried verbatim; source guard in `VideoHug.test.tsx`.
- #421: NOT caused by the video. Prod build, 390x844, CPU x6, R2 clip delayed 0-2.5s: main build 7/10 loads; same with a 404 instead of the clip (5/8), on a NO-VIDEO event page `/event/50-50` (5/8), and with every media event stopped at window capture before React sees it (7/8). jsdom guard `VideoHydration.test.tsx` (metadata + play while the player's boundary is dehydrated) is green on main and on this branch. No video fix shipped. Next step for someone: trace the page-wide #421 on `/event/*` under slow CPU with a dev SSR build (component stack); suspects are updates from above a route-level Suspense boundary during hydration (see `useAuth.tsx` precedent).
- Not verified: venue and festival portrait in a browser (no prod venue/festival has a direct portrait clip; unit-tested), a real phone, real R2 clips (blocked here; local VP9 clips of 480x848 / 720x1280 / 848x474 were served in place of R2).
