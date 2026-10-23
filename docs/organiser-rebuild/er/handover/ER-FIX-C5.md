# ER-FIX-C5: venue picker, wave 1 review fix pass

Branch `claude/er-c5-venue`. Brief: ER-FIX-W1.md Section C5. Findings: ER-W1.md (ER-C5 block). Ticket dt_9c7efeeb4bfa.

## Per finding
| # | Result | What changed | Red first |
|---|---|---|---|
| C5-1 | fixed | `venueApi.ts toError`: AS BUILT match. `rate_limited` anchored (`/^rate_limited\b/` on the message; AS BUILT code 54000); PGRST202 stays `unavailable`; any other error with a code (P0001 `permission_denied: ...` / `invalid_payload: ...`) goes through `shared/selfServeErrors.ts` `isServerRefusal` to the NEW kind `refused` ("That venue could not be added. Pick an existing venue, or ask the Bachata Calendar team."). Code-less errors (real network, `TypeError: Failed to fetch`) keep "Check your connection". The old substring row `rate limit exceeded` now expects `failed` | yes: 3 `refused` rows + screen row red |
| C5-2 | fixed | after create (and after picking a similar venue) the venue goes into `['organiser-venue-options']` with no duplicate; if that cache is not loaded yet it is invalidated instead | yes |
| C5-3 | fixed | rate-limit text = "You can add 5 venues a day. Try again tomorrow, or pick an existing venue." (exact string tested) | yes |
| C5-4 | fixed | reason "Full UK postcode needed" | yes |
| C5-5 | fixed | `existing:true` for a venue not in the list takes the stored name from the similar-check rows (the create result carries no name), else the typed name | yes |
| C5-6 | fixed | `' · '` and `/[̀-ͯ]/g`; a test fails on any char > 127 in the 4 venue source files, plus an accent-fold row ("Café Tango") | yes |
| C5-7 | fixed | focus moves to the name field (details), the step heading (`h3 tabIndex=-1`: "Is it one of these?", the confirm name), the search field (back to search); Back added on "Is it one of these?" | yes |
| park | parked | `get_organiser_venue_options_v1` returns other people's drafts: parked/ER-C5.md | n/a |

Red-first proof: the new `ER-FIX-C5` block (11 rows) ran on the unfixed code: 10 failed, 33 passed; the 2 passing rows are the keep-as-is "network -> Check your connection" rows. After the fix: 44/44 pass.

Public exports: names unchanged. ADDED only: kind `'refused'` in `VenueApiError['kind']`.

## Checks (sandbox, exit codes)
| Job | Command | Exit |
|---|---|---|
| typecheck | check:rpc-typing / check:wallclock-brand | 0 / 0 |
| (info) | `tsc -p tsconfig.app.json` | 2: 99 pre-existing errors, none in venue/ (job is message-scoped, does not run tsc) |
| architecture-guard | bin/check-integrity.sh, check:legacy-tables, check:legacy-program-rpcs, lint:architecture, check:images (AUDIT_STRICT=1), check:image-widths(+self-test), check:plan-hygiene:self-test, check:workflow-artifact-policy(+self-test), check:mojibake:self-test | all 0 |
| architecture-guard | prove:entry-point(+self-test) | 2: PRE-EXISTING, same on the unchanged head: `scripts/check-event-rules-mirror.mjs` (from ER-S1 / C3, commit de7d0b4) dispatches via isEntryPoint with no TARGETS row. C3's to fix, not this slice |
| unit-tests | test:unit:offline | 1: 5 failures in `tests/integrityCouldNotRun.test.ts`, same 5 on the unchanged head (sandbox env); 10216 pass |
| unit-tests | test:unit:timing / dancer-area-isolation(+self-test) | 0 / 0 |
| lint | npm run lint | 1: only link red is check:integrity exit 126 (bin/*.sh not executable in sandbox; CI chmods first; run via bash = 0). eslint on venue/ = 0 |
| perf-budget | bundle-budget, first-load-requests, chunk-cycles (+self-tests), build | all 0 |
| perf-budget | check:doc-weight | cannot run: needs a preview URL |
| e2e-smoke | test:e2e | 1 on full run (3 timing fails in auth-magic-link, dancer-home, organiser-home); those 3 specs re-run: 22/22 pass. VenuePicker has no importer outside venue/ |

## Shape survey (read-only, counts, prod stsdtacfauprzrdebmzg)
66 venues; 1 with no postcode; 1 with a non-ASCII name (accent fold covered); 11 drafts; 36 with no neighbourhood (subtitle falls back to city); 0 duplicate-name groups. `owner_create_venue_draft_v1` and `owner_similar_venues_v1`: absent (server not landed).

## Verified
- Error mapping for the AS BUILT shapes (54000 rate_limited, P0001 permission_denied / invalid_payload, code-less network), each with its own screen text.
- Cache update, stored name on existing:true, postcode reason, ASCII-only source, focus per step and Back: jsdom tests.
- Production build and perf budgets.

## Not verified
- End to end against the real RPCs (server not landed; faked in tests).
- 390x844 browser walk: the picker is not mounted on any screen yet (integrating slice mounts it). Real phone: not run.
- `/code-review` before commit: not run (unattended routine; self-review only). Ricky to run it.
- check:doc-weight (needs a live preview).
