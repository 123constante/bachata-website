# CI guard notes — the per-check record, and what each guard cannot see

Moved out of `CLAUDE.md` (2026-08-23) so it stops loading in every session.
`CLAUDE.md` §CI workflows keeps the workflow table and points here.

This is the detail you need when you are **working on one of these guards, or
reading a green you do not trust** — not on every task. Where a line here
disagrees with the code, the code wins.

---

## Key DB contract checks

All in `scripts/check-*.mjs`, enforced by CI.

- Venue / venue coords contract (#1, #16)
- Per-occurrence RPC suite (#2)
- Event-program duration contract (#3)
- Session-people display_name override (#4)
- Guest-entries contract (#5)
- Program editor schema (#6)
- Program save idempotency (#7)
- Day-rollover consistency (#8)
- Admin_list_occurrences null-venue tolerance (#9)
- Canvas consistency (#10)
- Security-hardening policy (#11)
- FK-index contract (#12)
- event_attendees FK target (#13)
- epp.display_name drift (#14)
- epp.avatar_url drift (#15)
- Teacher/DJ assignment integrity (#17)
- Migration authority arc-closeout (#18)
- Per-date program canonical / ADR-007 (#19)
- Occurrence instance_time canonical / ADR-007 (#20)
- Occurrence program format (#21)
- Per-date program sync mutation / ADR-007 (#22)
- Latest-events ordering contract (#23)
- Tracking RPC param-contract (#24)
- Tracking freshness heartbeat (#25)
- search_public_v5 contract (#26)
- Cancelled-occurrence passthrough (#27)
- Occurrence instance_END canonical (#28)
- Program-day / day_id integrity (#29)
- Occurrence integrity aggregator (#30)
- Live series occurrence-horizon guardrail (#31)
- P5 orphan-series guard (#32)
- Festival Map RPC contract (#33)
- Organiser-link contract / P5 organiser_ids vs event_entities (#34)
- Search telemetry param-contract (#35)
- Festival multi-day span / program-day-canonical (#40)
- Organiser past-events inclusion (#41)
- Occurrence time-stamping convention guardrail (#42)
- P5 occurrence materialised canonical (#43)
- Per-occurrence override identity sync (#44)
- Reverse-orphan occurrence guard (#45)
- Venue publish-state visibility gate / venue_is_public consistency (#46)
- Live image references (#65) &mdash; HEAD-checks every image URL reachable from a
  public surface via `list_public_image_refs_v1` (admin `20260729120956`). Added
  after a cover override pointed at an R2 object that was never uploaded and an
  event page served a 404 image for ~14 hours. Scoped to live/slugged/published
  records on purpose: a dead image on an archived row breaks no page and must not
  red-light CI. It shipped labelled #47, which is the Public-RPC latency budget;
  renumbered 2026-08-10. Unlike every other check it makes outbound CDN requests,
  so it runs LAST and is double-bounded &mdash; 10s per request, 120s per sweep &mdash;
  because the job is `timeout-minutes: 5` and undici would otherwise wait 300s on
  a stalled edge, killing every check behind it with no named failure.
- Occurrence delete / booking safety (#66)
- Program-day offset canonical (#67)
- Override-mirror ghost rows (#68) &mdash; `calendar_occurrences` rows still
  carrying `is_override = true` after the P5 override row emptied, with no
  override content anywhere. Hit in prod 2026-08-19. Calls
  `check_override_mirror_ghost_v1()` (admin `20260704140000`). **The symptom is
  in the ADMIN editor, not on a public page here** &mdash; an OVR/deviation
  badge that never clears; `is_override` appears in this repo only in the
  generated types. It is guarded from here because the admin migration wires it
  here. ZERO rows measured is exit **2**, not a pass &mdash; on 2026-08-21 prod
  carried 357 rows with `is_override = true` and **zero** ghosts among them, so
  a total of 0 means the read broke; that figure is a dated reading and nothing
  gates on it. A readable `ghost_count` is judged BEFORE the payload fields it
  does not depend on, so a shape drift elsewhere cannot downgrade a real
  violation to an infrastructure 2. Retires WITH the legacy mirror at Lever 1E
  &mdash; delete the step then, never relax the floor.

- OG bake-pipeline health (#69) &mdash; reads the BAKE half of
  `check_og_render_health_v1()`, which was installed and called by **no CI** until
  2026-08-22. It deliberately does **not** gate on `stuck`: measured that day,
  healthy prod reads `stuck = 1` and the 2026-08-21 incident read `stuck = 1`,
  the same permanent `card-data-unavailable` row. `_og_sweep` restamps
  `updated_at` on every POST it issues, so a row under retry is never 15 minutes
  stale and `stuck` **could not have counted the outage**. What it gates on is
  P1's error vocabulary (`bake POST failed: HTTP <code>`), `stuck - error` as a
  self-cancelling lower bound on stale PENDING rows, and a zero-`ready` ledger.
  Both directions proven against prod in rolled-back transactions; those
  payloads are the canary's fixtures. The SCRAPE half is a separate check
  (`check-og-scrape-evidence.mjs`) on purpose.
  **The transport rule does NOT clear itself, deliberately.** `_og_sweep` selects
  `attempts < 5`, and `_og_enqueue` resets `attempts` only on its
  `INSERT..ON CONFLICT` branch &mdash; reached when the row is new or the COVER
  HASH changed, never on an unrelated write. So a parked row means that entity
  will never have a baked OG image until a cover change or a deliberate repair,
  and the violation text carries the repair SQL. That is not `stuck`'s defect
  wearing a new hat: `stuck` reads 1 on a HEALTHY system, this reads 0.
  Named blind spot: `sample_errors` is `LIMIT 5 ORDER BY updated_at DESC` with no
  per-row timestamp, so five newer content errors can push parked transport
  errors out of the sample. Closing it needs a counter the RPC does not expose.

`check-og-images.mjs` validates OG image shape/size/format against the deployed site; run manually via `npm run check:og`. Not in `db-contract-check.yml` (wrong trigger context &mdash; needs a live deploy, not a DB connection).

**Read its arms before trusting a green.** The `pull_request` arm probes the
Vercel PREVIEW through `VERCEL_AUTOMATION_BYPASS_SECRET`, which exempts the
request from the WAF as well as from Deployment Protection &mdash; so it is
structurally incapable of failing on an edge-control regression, and on
2026-08-21 every run in the 14-hour outage was a green preview run. Since P5 the
guard REPORTS this per run (measured host, bypass sent or not, bot protection
exercised or not) to stdout and the run summary, on green runs as loudly as red.
The target class is decided by INCLUSION against the known production host, so a
staging alias or an unparseable base reads as UNRECOGNISED and never claims to
have exercised production edge controls.
Production is covered by the daily schedule **and**, since P5, by a
`deployment_status` arm gated to `state == success && environment == Production`
&mdash; ~24h detection latency down to minutes. Its honest limit: that event and
the production alias move are not transactionally ordered, so the arm can still
measure the previous deployment. It buys latency, not commit attribution.

`check-sitemap-fetchable.mjs` (`npm run check:sitemap-fetchable`) gates
`sitemap-submit.yml` ahead of its GSC submit. That workflow was green throughout
the incident because `sitemaps.submit` only REGISTERS a feedpath &mdash; Google
answers "noted" and fetches later, so no outcome of that call could ever go red
on an unfetchable sitemap. The guard GETs the URL with a **non-browser** UA (a
browser UA was 200 all through the outage) and asserts 200 + XML + a sitemap
root element + a floor of 50 `<loc>` entries (prod: 314, of which 26 are static
routes that render with no database at all). The floor applies to a flat
`<urlset>` ONLY &mdash; a `<sitemapindex>` lists child sitemaps and needs just
one, or the gate would false-red the day the generator is split. Gate and submit
now derive their URL from one workflow-level `SITEMAP_TARGET`, and the script
REFUSES (exit 2) if `GSC_CHECK_BASE` disagrees with what it probed: proving one
URL and announcing another is the same wrong-surface class this arc removes.
The workflow carries its own failure-notification step &mdash; without it this
would have been a brand-new unattended prod probe with no audience, and
`lint-workflow-notification.mjs` could not have caught that, because its
predicate is scoped to schedule-reachable jobs and this one is push-triggered.
**That blind spot in the P2 lint is real and queued, not fixed here.**
It cannot prove Googlebot specifically is allowed &mdash; Vercel verifies that by
reverse DNS and spoofing the UA would be less accurate, not more.
`/robots.txt` 429'd in the same incident and still has no guard.


---

## Writing a new guard &mdash; the six rules `check-script-conventions.mjs` enforces

`npm run check:script-conventions` runs **two** scans. R1&ndash;R5 cover the
`scripts/check-*.mjs` and `lint-*.mjs` files &mdash; all of them but one, since
`NOT_A_GUARD` exempts the scanner itself (it would flag its own rule patterns as
violations). That exemption is from the SCAN, not from the rules: the scanner is
held to R1&ndash;R5 by hand-written canary cases instead.

No count is pinned here on purpose. This sentence read "89 of the 90" until #240
added a 91st guard, and nothing went red &mdash; a number copied into prose has no
writer maintaining it. Count them when you need the figure:
`ls scripts/ | grep -E '^(check|lint)-.*\.mjs$' | wc -l`.

**R6 has its own, wider corpus**: every `.mjs` under `scripts/` and `bin/`,
recursively, and `NOT_A_GUARD` does not apply to it. That is deliberate &mdash; the
two worst instances of the defect it catches were `ship-gate.mjs` and
`scripts/hooks/review-stamp.mjs`, one a subdirectory away and the other not
matching the name pattern, and a rule blind to those two would have been
decoration. So a new file under `scripts/hooks/` is held to R6 even though
R1&ndash;R5 never look at it. It exists because the worst failure a CI suite has is a check that
reports green without having checked anything: a red check gets fixed, a falsely
green one is trusted for months.

| Rule | A guard fails it when |
|------|-----------------------|
| R1 silent-skip | a green exit is reachable from a missing secret, a walled URL, an undeployed RPC or an empty sample, with no escalation env and no `assertMeasured()` floor |
| R2 swallowed-error | it has an empty `catch`, or a `.catch(() => default)` &mdash; an unreadable file then scans clean |
| R3 exit-drift | it breaks 0 pass / 1 contract violated / 2 infrastructure. Missing creds are **2** |
| R4 no-canary | it carries no `--self-test` proving it can fail |
| R5 unproven-exit | its canary proves the RULES but never drives the function whose return value becomes `process.exitCode` &mdash; so the rules are measured and the CODES are merely asserted. It proves VALUE-ownership only; an exit statement inside a function body is invisible to it (the named gap, below) |
| R6 raw-entry-point | it compares `import.meta` against `process.argv[1]` by hand. Node realpaths one side and not the other, so through a junction or symlink the script exits 0 having run NOTHING &mdash; canary included. Use `isEntryPoint(import.meta.url)` from `scripts/lib/entry-point.mjs`. `npm run prove:entry-point` is the sweep that proves it, and it runs in `architecture-guard.yml` &mdash; canary first, last step in the job, separately bounded by `timeout-minutes`, no `if:`, no `continue-on-error`. Not literally every PR: that workflow's `pull_request` is filtered to `branches: [main, master]`, so a PR between two topic branches does not queue it. It was in NO caller at all from #235 until 2026-08-20, which is how an unlisted dispatcher kept it at exit 2 (&ldquo;cannot run&rdquo;) for days with nothing going red; `tests/entryPoint.test.ts` now asserts that step is present and gating, out of parsed YAML |

**It is a ratchet, not a gate you can satisfy by editing the allowlist.** Today's
violations are frozen in `scripts/script-conventions-allowlist.json`; the guard
fails on a new violation, on a count increase, and deliberately on a **stale**
entry, so the list can only shrink. Re-baseline with
`node scripts/check-script-conventions.mjs --write` **after** fixing something,
never to make a new script pass. An allowlisted script is still lying to you.

**The reference implementation is `check-ci-budget.mjs`.** It was the only
script satisfying R5 when the rule landed (`check-script-conventions.mjs` was
changed in the same commit to satisfy it too); its `main(argv, deps)` seam plus
the "THE EXIT-CODE CONTRACT ITSELF" block in its canary are the shape to copy: the
collaborators are injected so the canary can drive `main()` with no token, no
network and no filesystem (the entry-point dispatch itself stays undriven &mdash;
R5 proves the exit OWNER is driven, not the line that invokes it, which is
exactly the gap R6 and `scripts/prove-entry-point-dispatch.mjs` now close), and each case pins WHICH branch produced its code.
That last part is not decoration &mdash; four branches there return 2, so a case
asserting only "it returned 2" passes for the wrong reason.

**What R5 cannot see.** It is static: it proves the canary CALLS the exit owner,
not that it asserts anything useful about the answer. Branch-pinning is still
yours to do. And note the deliberate interaction with R4 &mdash; a script with no
canary is R4 debt only, so **fixing R4 by adding a rules-only canary turns that
script into an R5 violation**. That is the rule asking for the other half of the
job, not a bug.

**THE NAMED GAP &mdash; R5 proves value-ownership, not reachability.** It asks
who PRODUCED the value that lands in `process.exitCode` and whether the canary
calls them. It never asks whether the assigning statement RUNS, and the two come
apart the moment that statement sits inside a function body: the owner list then
holds only the inner value-producer, so a canary driving that alone passes.
Measured 2026-08-19, canary present in every row &mdash;
`process.exitCode = await main(argv)` at module scope names `main` and FIRES if
the canary skips it, while `main(){ process.exitCode = verdict() }`, the same
inside a class method, the same inside a module-scope IIFE, and
`main(){ process.exit(verdict()) }` all resolve to `[verdict]` and pass. **So
the rule asks MORE of the more testable shape** &mdash; that is an inversion, not
just a blind spot, and it is how `check-override-mirror-ghost.mjs` passed R5 with
its exit code disconnected from its own verdict.

It is documented rather than fixed, with evidence: three attempts to widen
ownership to the enclosing function were built and reverted on 2026-08-19
(`plans/queued-r5-exit-owner-widening-attempt3-reverted.md`). Each walked the
syntax tree outward from the exit site; each went blind to a wrapper it could not
name while over-firing on a callee it could. **A syntactic ancestor is not a
drivability proof.** A fix that would work is dynamic rather than static &mdash;
a canary case that SPAWNS the script and asserts the real process-level exit code
&mdash; and that is a different rule, queued for its own decision. Until it
lands, read an R5 pass as "the value-producer is driven", never as "the exit
contract is proven". The gap is pinned by a canary case named
`R5 GAP (documented, NOT desired)`; if that case ever starts firing, rewrite this
section in the same commit.

---

