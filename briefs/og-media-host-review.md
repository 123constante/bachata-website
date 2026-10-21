# Brief: independent review of Website PR #921 (og-media-host) - quick, prod is affected

Review branch: `claude/review-og-media-host` (docs only). Repo 123constante/bachata-website.
You are NOT the author; do not change `claude/og-media-host`. Model: Opus. Aim to finish in ~20 minutes.

Read: the author brief `briefs/og-media-host.md` (same brief branch); the PR head
`git fetch origin claude/og-media-host` (head cbd17478: `app/sameHostImage.ts`, `app/detailLoader.ts`,
`middleware.ts`, `app/ogImageHost.test.ts`, `docs/handover-og-media-host.md`).

## The failure
Since 12:05Z (admin #904 moved media to `media.bachatacalendar.co.uk`), `sameHostImage()` rewrote baked
share cards onto `www.bachatacalendar.co.uk/events/og/...` = 404, so WhatsApp/Facebook previews show no picture.

## Check, with evidence
1. The new host set: is any legitimate SITE URL now left un-rewritten that used to be rewritten (an
   og:image on apex or www, the `/api/og/card` live fallback built from SITE_ORIGIN, a relative URL, a
   Vercel preview host)? Walk every caller of `sameHostImage` and `normalizeOgImage`.
2. Edge middleware: does importing `./app/sameHostImage` from `middleware.ts` bundle cleanly for the Edge
   runtime (`npm run build`; check the middleware output has no Node-only import)?
3. The test: does it fail on main and pass on the head (run it both ways)?
4. Any other place that treats `*.bachatacalendar.co.uk` as "our site" (the author's sweep table in the
   handover): spot-check two of the "fine" verdicts.
5. Run `npm run build` and the unit job from .github/workflows (command + exit code).

## Output
Write `docs/reviews/review-og-media-host.md` on `claude/review-og-media-host`: verdict SHIP / FIX FIRST,
findings with severity (blocker / should / nit), evidence, exact fix. Push ONCE with plain git, last
commit subject ending `[worker-done <ticket>]`. No PR. Never merge/approve,
never `gh api`, never `--no-verify`. Prod Supabase SELECT-only. Stop after the push and report.
