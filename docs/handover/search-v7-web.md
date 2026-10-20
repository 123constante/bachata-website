# search-v7-web handover (slice S2a)

Branch `claude/search-v7-web`. Flag `searchV7` (`VITE_ENABLE_SEARCH_V7`), default OFF.
Stays OFF until S2b ships `/people/:id` (the row links there); no dead link is user-visible.

## Done
- `featureFlags.ts`: `searchV7`. v7 implies the v6 path (level chips, `p_level`).
- `useSearchResults.ts` + `searchRpc.ts`: `search_public_v7` when on; `people` rows typed per the pinned interface; old keys optional on the raw payload. Flag off: same RPC, same envelope (the existing strict-equal v6 test still passes).
- `searchEntities.ts`: kind `person` (Person/People, round, `User` icon, `/people/:id`); teacher/dj/dancer kept.
- `searchPeople.ts`: ONE mapping for role line ("Teacher · DJ · Dancer", fixed order), aria label ("Name, Teacher, DJ"), telemetry kind.
- Header omnibox, overlay, `/search`: one row per person, role line as subtitle, no second kind badge, aria-label with roles. `/search` gets one People section + People facet and count; empty state / did-you-mean unchanged.
- Click telemetry logs the old kind of `primary_role` on `/search` and the overlay. The header omnibox logs no clicks today and still does not (not in scope).
- Tests: `tests/searchV7People.test.tsx` (red first: 20 of 23 failed on current code; now all pass).

## Not done / notes
- "11 role combinations" in COMMON.md: only the 7 non-empty subsets of the 3 public roles are visible to search; fixtures use those 7 (performing/organising-only personas are excluded by the RPC). Say if 11 means something else.
- Contrast ratio not measured (not verified). Measured: no horizontal scroll, header omnibox row 44px (mobile) / 52px (desktop), /search cards 175px+ tall.
- Header omnibox shows the first 7 results; unchanged.

## CI steps run locally (exit codes)
| command | exit |
|---|---|
| `npm run build` (flag off) | 0 |
| `npm run build` (flag on, fake Supabase env) | 0 |
| `npm run lint:architecture` | 0 |
| `npm run lint` | 1: only `check:integrity` (`bin/check-integrity.sh` Permission denied, exit 126, sandbox); 19 other links pass |
| `npm run test:unit` | 1: 15 failures in files I did not touch (eventViewCompat / occurrenceProgram / publicEventPageLineup contracts, integrityCouldNotRun, plan hygiene), need live DB or exec bit |
| `tsc -p tsconfig.app.json` | same 21 pre-existing error lines before and after my change, none new |

Not run: e2e-smoke, phone-qa, perf/seo/og jobs (need browsers/deploy/live DB).

## Walk (production build, fixtures in prod shape, Playwright)
Screenshots and `measurements.json` in `docs/screenshots/search-v7-web/` (390x844, 360x640, 1280x800, plus omnibox 390 and 1280).
