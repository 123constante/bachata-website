# Handover: portrait video (web)

Status: DONE (single PR). Shared mapping in `src/lib/videoFrame.ts`; `VideoFrame` wraps `VideoEmbed`
(event tile, festival aftermovie); `VenueVideoEmbed` keeps its inline `<video>` and uses the same
`frameFor`/`frameStyle`. Shorts => `portrait: true` from `parseVenueVideoUrl`.
Left: phone checks (iPhone .mov rotated, real autoplay, Vercel preview). 15 unit failures and 97 tsc errors
exist on `main` unchanged (not from this branch).
