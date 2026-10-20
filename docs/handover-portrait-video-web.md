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
