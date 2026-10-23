# ER-FIX2-S3: C5 venue, "Add a new venue" as ONE sheet

Ticket `dt_68899302e8cc`. Brief `ER-FIX-W2.md` (sha d34beed), section "S3 C5 venue"; audit
`ER-AUDIT-editor-cards.md` (C5 part) on `claude/audit-er-editor-cards`.
Branch `claude/er-c5-venue` = old C5 head `d6b7e00` + `origin/main` + `origin/claude/er-s1-rules` (79459ca5), both merged clean.

## What changed

- `venue/VenuePicker.tsx`: the add view is ONE sheet (prototype v7 lines 390-394 / 588): Venue name
  (prefilled from the search) + Postcode; the postcode is looked up by itself as soon as it is whole
  (no "Look up postcode" tap); the map pin + "Name Area, POSTCODE" show inline; look-alikes show
  inline under "Is it one of these?" with "No, it&rsquo;s a new venue"; ONE primary "Add venue",
  disabled with a reason line (`aria-describedby`); "Back to search". The details / similar /
  confirm steps are gone. A late answer for an older postcode or name is dropped (keyed answers,
  no setState-in-effect).
- `venue/addVenue.ts` (new, pure): `addVenueBlock` (the reason rule), `currentLookup`, `similarKey`,
  `MIN_NAME_LETTERS = 3`, `ALREADY_LISTED`.
- `onPick(venue, info?)`: ADDED optional `info: { existing: boolean }` (old one-arg callers still
  type-check). `existing: true` when a look-alike is tapped or Add returns `existing:true`.
- `venue/index.ts`: ADDED exports `VenuePickInfo`, `addVenueBlock`, `ALREADY_LISTED`, `MIN_NAME_LETTERS`.
  Nothing renamed. `venueApi.ts`, `postcode.ts`, `venueSearch.ts` unchanged (error mapping from
  ER-FIX-W1 kept: `54000` / `rate_limited`).

Reasons on "Add venue", in order: `Type the name` (< 3 letters), `Type the postcode` (not whole, or
not found), `Looking up the postcode`, `Try the postcode lookup again` (offline; Retry shown),
`Checking the list` (look-alike check in flight), `Check the list above` (look-alikes not answered).
The first two and the last are prototype v7 `nvBlock` wording; the three waits are new because the
prototype has no network.

## Findings

| id | outcome | proof |
|---|---|---|
| F-C5-1 (major) four steps vs one sheet | FIXED | New sheet tests were RED on the unfixed code: 21 failed / 42 passed (63). Green after: 63/63. Superseded tests REWRITTEN, not deleted: the 5 step-flow tests, C5-1/C5-3, C5-2, C5-4 ("Full UK postcode needed" -> "Type the postcode"), C5-5, C5-7 (focus: open -> name, Back -> search). |
| F-C5-2 name minimum 2 vs 3 | FIXED | `Zu` row of the reason table red-first; mutation `MIN_NAME_LETTERS = 2` -> 2 red. Add a new venue still shows from 2 letters (`MIN_ADD_LETTERS`, prototype `q.length>=2`). |
| F-C5-3 `existing:true` picked silently | PARTIAL: picker side done, caller side owed | `onPick` now carries `{existing}` (true ONLY when Add matched a listed venue; a tapped look-alike sends false); `ALREADY_LISTED` holds the prototype toast "Already listed, picked it". The picker unmounts on pick, so the toast is the caller's (C7/C8 mount it): REQUIRED of them, nothing in `src` reads it yet. Red-first: `existing:true ... says so to the caller`. |
| F-C5-4 1 letter, no match, no hint | FIXED | "No venue matches "z". Type 2+ letters to add a venue." Red-first test. |
| F-C5-5 ward/district stored as address | NOT FIXED (disagree for this slice) | The brief scopes S3 to F-C5-1 and the audit says keep `postcode.ts`/`venueApi.ts` unchanged; what a draft venue's stored address should be is an owner/admin data call (prod accepts empty: `COALESCE(p_address,'')`). Queue for the owner. |
| Parked by brief | not touched | `get_organiser_venue_options_v1` returning other people's drafts (AD question). |

## Review rounds (stopping rule: user-facing, two rounds; fixes after round 2 are unreviewed)

Round 1 (10 findings): FIXED 1 (`sure` keyed to the list it answered), 2 (deps read through a ref:
inline deps no longer re-run calls), 3 (a throwing lookup reads as offline + Retry), 4 (reopening Add
clears the last session's answers), 5 (look-alike group labelled; reason line is a polite live
region), 7 (prefill capped at 60), 10 (one condition for the bold name). NOT FIXED: 6 (no "bad
postcode" field error: prototype v7 says only "Type the postcode"; an error while still typing
would be noise), 8 (one look-alike call per settled name pause: cheap, read-only, debounced),
9 (toast consumer: recorded as a caller requirement, see F-C5-3).
Round 2 (8 findings): FIXED 1+7 ("No" answers the list on screen, `askKey`; Add also needs that
list to match the name typed now, so a dismissed list never flickers back), 2 (look-alike debounce
is a fixed 250ms, not tied to `options`, so tests exercise the real race), 3 (sheet inputs and
buttons disabled while Add is saving), 4 (`existing` means only "Add matched a listed venue"),
5 partly (postcode maxLength 8 -> 10 so a pasted double space is not truncated; no bad-shape
error, as round 1). NOT FIXED: 6 (move the lookups to `useQuery`: a refactor for caching, outside
a fix slice; the keyed answers are tested). 8 covered by 2.
Red-first: R1-2/3/4/7 red on the first one-sheet build; R2-1, R2-3 and the look-alike `existing`
row red on the round-1 build. Venue suite now 69/69 (run 3 times, stable).

Mutation probes (each reverted): name min 3 -> 2: 2 red; drop `!sure` from the block: 3 red; ignore
the retry attempt in `currentLookup`: 1 red.

## Shapes (prod `stsdtacfauprzrdebmzg`, read-only SELECT, counts only, 2026-10-22)

| Shape | Count | Checked how |
|---|---|---|
| venues total | 66 (24 published, 31 dancer_ready, 11 draft) | search table tests (exact / partial / none / postcode) |
| venue name under 3 letters | 0 | the 3-letter add minimum blocks no stored name |
| postcode missing | 1 (draft) | existing-venue rows render with no postcode (`filter(Boolean)`) |
| postcode not UK-shaped | 4 (3 published, 1 draft) | only affects picking existing venues, which is unchanged |
| `owner_create_venue_draft_v1` / `owner_similar_venues_v1` | live on prod, args = pinned interface | `pg_proc` read |
| rate limit | `_member_rate_check_v1('owner_create_venue', 5, '1 day')` raises `54000` `rate_limited` | confirms the W1 mapping (audit had it NOT verified) |

Not checked: look-alike result sizes from the live similar RPC (no call made: it is owner-auth only, no writes allowed).
Seen and not fixed (outside S3): the rate check raises `42501 not_signed_in` for a signed-out caller,
which `venueApi` maps to `failed` ("Check your connection"). Signed-out users cannot reach the organiser screens, so it is left.

## CI jobs (run locally in the sandbox)

| Job / step | Result |
|---|---|
| typecheck: `check:rpc-typing`, `check:wallclock-brand` | PASS |
| architecture-guard: `bin/check-integrity.sh` | PASS via `bash` (2344 files, 0 issues); direct exec is 126 in the sandbox only (no exec bit; CI runs `chmod +x bin/*.sh` first) |
| architecture-guard: legacy-tables, legacy-program-rpcs, `lint:architecture`, `AUDIT_STRICT=1 check:images`, mojibake self-test | PASS |
| `npm run lint` chain | 19/20 links PASS; the one red link is the same check:integrity exit 126 (sandbox exec bit) |
| eslint `src/modules/organiser/venue` / tsc on `venue/` | 0 / 0 |
| unit-tests: `test:unit` | 12636 pass, 16 fail, none in this diff: 10 `*.contract.test.ts` need the live-DB secrets CI gates on (`ci-live-db-gate.mjs`); 5 `integrityCouldNotRun` (sandbox: typescript resolves from /tmp, precondition fails, same on any branch here); 1 `auth.today` 390x844 flake under load (34/34 alone). Venue suite re-run after the last edit: 69/69 x3 |
| unit-tests: `test:unit:timing`, `check:dancer-area-isolation` | PASS |
| perf-budget: build, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | PASS |
| perf-budget: `check:doc-weight` | NOT RUN: needs `GITHUB_REPOSITORY` + a preview URL (CI only) |
| e2e-smoke `test:e2e` | NOT RUN: no spec mounts `VenuePicker`; left to CI |

## Verified

- Red-first proof and mutation probes above; venue suite 63/63; eslint + tsc clean on `venue/`.
- Server names, args and the rate-limit code read from prod `pg_proc`.

## Not verified

- 390x844 browser walk: no route mounts `VenuePicker` on this branch (C7/C8 mount it), so there is no screen to walk. The OSM iframe still not seen rendered.
- A real venue create end-to-end (it would be a prod write).
- Callers showing the `ALREADY_LISTED` toast: C7/C8 own that wiring.

## Next (for the integrator / C7 / C8)

- Take this branch's side of every `venue/**` hunk (F-FAM-1).
- On `onPick(venue, info)`, toast `ALREADY_LISTED` when `info?.existing`.
- Owner: decide F-C5-5 (what to store as a new draft venue's address).
