# Handover: og-media-host

Brief: `briefs/og-media-host.md` on branch `brief/og-media-host`. Branch `claude/og-media-host`.

## Done
- `app/sameHostImage.ts`: one dependency-free leaf (Edge-safe, like `app/truncate.ts`) holding
  `sameHostImage()`. It moves an image URL onto the request host only when its hostname is the
  request host, `bachatacalendar.co.uk` or `www.bachatacalendar.co.uk`. Every other host, including
  `media.bachatacalendar.co.uk` (the R2 custom domain), is returned unchanged.
- `app/detailLoader.ts` and `middleware.ts` import it; both hand-copies are deleted.
- `app/ogImageHost.test.ts`: `resolveOgCardImage` with a stubbed `get_og_image_v1`, `normalizeOgImage`,
  and a table for `sameHostImage`. Red on main (4 failures: the media baked card comes back as
  `www.../events/og/...`), green after.
- Host-check sweep: listed in the PR body.
- Shape survey (read-only): `og_render` has 372 `ready` rows, all on `media.bachatacalendar.co.uk/events/og/`,
  and 23 `error` rows with no image URL.

## Left
- After merge + deploy: `curl -A "WhatsApp/2.23" https://www.bachatacalendar.co.uk/event/el-grande`
  should show og:image on `https://media.bachatacalendar.co.uk/events/og/...`, and that URL should return 200.
  The sandbox could not reach prod (proxy 403), so this was not run.
- Optional: re-scrape a few shared links in the Facebook Sharing Debugger so cached previews refresh.

## Next
- `scripts/check-origin-consumers.mjs` `isFirstPartyUrl` still counts any `*.bachatacalendar.co.uk` as
  first-party. That is only a classification in an inventory guard (no SQL posts to the media host
  today), so it was left as is. If a DB function ever calls the media host, narrow it there.
