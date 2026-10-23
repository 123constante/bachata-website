# People arc S3 -- the DJ world -- handover

- Branch: `claude/people-dj-world` (from `main` 7cfedc6). Brief: `briefs/PEOPLE-S3-dj-world-brief.md` on
  `brief/people-arc` (sha 0a8eb15f). PR: **#984**.
- Content commit: `b69f547`. The head is the handover commit right after it (`git log -1 origin/claude/people-dj-world`).
- Design record (shape table, Gate 4 self-checks, screenshots): [`docs/design/people-s3-dj-world.md`](../../design/people-s3-dj-world.md).
- Behind `flags.personWorlds`. Flag OFF = today's `/djs/:id`, unchanged (tested over every shape). The `/people/:id` tab is unchanged too.

## Turning the flag on for the preview

Set `VITE_ENABLE_PERSON_WORLDS=true` in Vercel, Project -> Settings -> Environment Variables, Preview, scoped
to branch `claude/people-dj-world`, then redeploy that branch's latest preview. It is a build-time `VITE_` var, so
an existing deployment does not pick it up. **Needs owner:** api.vercel.com is refused by this sandbox's proxy,
so the worker could not set it or check the preview.

Local equivalent: `VITE_SUPABASE_URL=<prod>`, `VITE_SUPABASE_PUBLISHABLE_KEY=<prod anon>` and
`VITE_ENABLE_PERSON_WORLDS=true` (the sandbox shell exports a NON-prod Supabase URL, which wins over `.env.local`:
export them in the shell), then `npm run build`, then
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/_serve-build.mjs --port 4173`.
The walks are `docs/people-arc/s3/walk.mjs` (shots + checks) and `walk-back.mjs` (Back via the dancer page). Copy
them under `node_modules/.cache/` to run, so `playwright` resolves.

## Shapes (prod survey 2026-10-23, read-only, counts only; screenshots flag ON, prod data)

| Shape | Prod count | Slug walked | 390x844 | 360x800 |
|---|---|---|---|---|
| 0 upcoming | 23 of 40 | brito, chong, dj-chino-bzuk26 | [brito](shots/brito-390.png) | [brito](shots/brito-360.png) |
| 1 upcoming | 10 | nico, bobby-blanco, carlos-de-la-cruz | [nico](shots/nico-390.png) | [nico](shots/nico-360.png) |
| 2+ upcoming (max 4) | 7 | papacito, ramiro-zapata, jeff | [jeff](shots/jeff-390.png) | [jeff](shots/jeff-360.png) |
| played at, yes | 11 | papacito, chong | [chong](shots/chong-390.png) | [chong](shots/chong-360.png) |
| DJ name differs from the public name | 12 | papacito (Morcilla / Papacito), nico | [papacito](shots/papacito-390.png) | [papacito](shots/papacito-360.png) |
| no DJ name | 28 | jeff, ramiro-zapata | [ramiro](shots/ramiro-zapata-390.png) | [ramiro](shots/ramiro-zapata-360.png) |
| "DJ " prefix (cut; equal to the public name, so no small line) | 5 | carlos-de-la-cruz | [carlos](shots/carlos-de-la-cruz-390.png) | [carlos](shots/carlos-de-la-cruz-360.png) |
| no photo / no city | 5 / 5 | bobby-blanco, carlos-de-la-cruz | [bobby](shots/bobby-blanco-390.png) | [bobby](shots/bobby-blanco-360.png) |
| no name at all (h1 "DJ") | 2 | dj-chino-bzuk26 | [chino](shots/dj-chino-bzuk26-390.png) | [chino](shots/dj-chino-bzuk26-360.png) |
| other roles (tabs) | DJ + dancer seen | papacito, ramiro-zapata, nico, ... | tabs at y=163 | tabs at y=163 |
| languages | 10 | - | not shown on the DJ world (approved design) | |
| longest name (20) | 1 | carlos-de-la-cruz | one line, no clipping | |

Every render: lowest contrast >= 5.91, taps >= 44 px, no clipping, no sideways scroll, no page errors.

## API changes for S2 to adopt after merge (all additive)

`facts/`:

| Function | Rule |
|---|---|
| `wallDayOf(raw)` | the day of a stored gig stamp, as written ("2026-10-23 23:30:00+00" -> "2026-10-23"). Event times are a London wall clock stamped +00: **use this, not `londonDayOf`, for RPC event times** (`londonDayOf` converts, and a 23:30 BST gig moves to the next day) |
| `gigDateLabel(raw)` | "Friday 23 October" = `dateLabel(wallDayOf(raw))` |
| `dayNumber(raw)` | "23" (no leading zero) |
| `timeLabel(raw)` | "19:30" as stored; midnight on the dot = no time = `null` |
| `monthLabel(raw)` | "October 2026" (Played at) |

`frame/`:

| Export | Contract |
|---|---|
| `PersonFrame` | same props. Back now goes back in history when the previous page was on this site, else to `backHref`. The `href` stays `backHref`, and a modified click is left to the browser |
| `backGoesToHistory(key, idx?)` | the rule: a numeric `history.state.idx` decides (> 0); otherwise the location key (not `"default"`) decides |
| `currentHistoryIdx()` | React Router's idx from `window.history.state` (undefined on the server) |

`worlds/dj/`: `DjWorld`, `djWorldView` (pure view model), `linkText`.

S3 did not switch the old DJ copies (`djFormat` month names, `djRoleModel` counts, `DjTiles` initials, the
upcoming split in `DJProfile.tsx`) on the flag-OFF path: they still serve today's page, so none could be deleted.
The flag-ON path uses only facts/frame. Delete the old copies when the flag is removed.

## Not verified

- Real photos: the image host is blocked from the sandbox, so every face rendered the initials fallback.
- The Vercel preview (api.vercel.com refused). Share on a real phone.
- The flag-OFF page in a browser: it is unit-tested only, and the code path is unchanged.
- The `/code-review` pass: the owner types it. Not run in this unattended session; the diff was self-reviewed
  adversarially, which led to the Back idx hardening (a client `replace` redirect on the first page).
- On a thin page the site-wide `GlobalLayout` `min-h-screen` leaves DJ ground above the footer; the approved
  design lifted the footer. That layout is not S3's file.
- The local CI run is on b69f547 (per-job table in the PR body). The unit failures (15) are the same as main's in
  this sandbox. The 2 phone-suite failures passed when rerun alone.
