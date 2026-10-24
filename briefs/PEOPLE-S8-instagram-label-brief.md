# People arc S8 -- website links that are really Instagram

Orchestrator 2026-10-24. Branch `claude/people-instagram-label` (new, from origin/main). Lane: normal (no SQL, no migration). Its own PR on purpose: the file is shared with the flag-OFF dancer page.

## Why (S6 critique finding 3; owner chose a separate PR)
A dancer whose stored "website" is an Instagram URL shows a row labelled WEBSITE with the raw URL, tracking query and all: `WEBSITE www.instagram.com/ben_bachatero/?hl=en` (4 of 12 walked profiles: ben, alex-boneva, john-otaran, b). At 360 it wraps inside the query string. A newcomer sees a tracking parameter and an Instagram link called "Website". Pre-existing since S2.

## Build
`src/modules/dancer-app/public-page/model.ts` around line 277 builds `contacts.push({ kind: 'website', href: links.website, label: links.website.replace(/^https?:\/\//...) })`.
1. The label never shows `?query` or `#hash` (keep host + path, drop a trailing slash, drop a leading `www.`); the href stays the stored URL.
2. A website URL whose host is instagram.com (or www. / m.) is filed as kind `instagram` with the handle label (`@name`). If the dancer ALSO has an instagram link, the same handle must not appear twice (one row). Same idea for facebook.com only where it is unambiguous; otherwise leave it as website and say so in the handover. Do not guess handles from non-profile URLs (`/p/...`, `/reel/...`, `/explore`): leave those as website with the cleaned label.
3. Find EVERY consumer of this mapping (the flag-OFF dancer page, the dancer world `WorldContact`, the DJ and teacher worlds if they share it): one shared mapping, no second copy. With the flag OFF only the label text and kind described here may change.

## Prod shapes (read-only survey first, counts only)
Count dancer / DJ / teacher profiles whose website host is instagram / facebook / other, has a query or hash, or is empty or malformed; and profiles with BOTH a website and an instagram. Walk ben, alex-boneva, john-otaran, b plus one with a real non-social website, at 390x844 and 360x800.

## Tests (red first)
Table-driven over URL shapes: plain site, www., trailing slash, `?hl=en`, `#x`, http, uppercase host, instagram profile, instagram post/reel, m.instagram.com, instagram + a separate instagram link with the same and with a different handle, facebook, empty, garbage. Assert label, kind and href. No label wraps at 360 for the walked shapes. Run the new tests against the unfixed code first.

## Checks, handover
Run every CI job step in your sandbox. The bot opens the PR with a placeholder body, so put ready-to-paste PR body text in `docs/people-arc/s8/HANDOVER.md`: sections `## Verified on real data` (heading EXACTLY that; lines starting `- Shapes surveyed: `, `- Checks run: `, `- NOT verified: `) and `## Phone QA` (`- Sizes checked: `, `- Walked: `, `- Not verified: `), plus head sha, PR, shape table, shots, per-job CI table. Visible change: short design record `docs/design/people-s8-instagram-label.md`. `laptop-walk.mjs` URL mode cannot open Vercel previews (SSO); walk on a local build. HTML entities, not raw Unicode punctuation, in JSX; source files over 2 KB through scripts/safe-edit.py / safe-write.py. Context under 50%.
