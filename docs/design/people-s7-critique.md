# People arc S7 critique -- roles served from the /dancers/:id loader (#1011)

Independent review of PR #1011 (head `4ac71376`) by a fresh worker. Brief: `briefs/PEOPLE-S7-critique-brief.md`
on `brief/people-arc` (sha 73714624). Base for every main-vs-branch comparison: the PR's merge base `79b7cad`
(so the only difference is S7).

**Verdict: SHIP AFTER OWNER CALL.** No blocker. The served HTML of a flag-OFF page is unchanged, headers and
`<head>` are unchanged in every mode, there are no hydration warnings, the shift is gone, and first byte is not
slower. What is left is two owner calls the brief kept out of code (cache tag, degraded TTL), both with a
recommendation below. The flag is OFF on prod, so nothing here reaches a visitor until it is flipped.

## How it was measured

Six local production builds against prod data (`stsdtacfauprzrdebmzg`, anon key, read-only), served with
`scripts/_serve-build.mjs` (the Vercel-shaped server): `79b7cad` and the branch, each with
`VITE_ENABLE_PERSON_WORLDS` off, on (teacher pages closed = prod today), and on + `VITE_ENABLE_TEACHER_DETAIL`
(teacher pages open). Chromium (Playwright) with mobile emulation. HTML diffs normalise only what changes per
request or per build: CSP nonce, hashed `/assets/*` names, the request host in `og:image`, 13-digit timestamps.

## Findings, in order

| # | Finding | Why it matters to the visitor | Severity | Verdict |
|---|---|---|---|---|
| 1 | Headers and `<head>` unchanged | an edge-cached public page with a changed header or meta is a SEO / cache regression | blocker if wrong | **not a bug**: 8 profiles x 3 modes, headers SAME 24/24, head SAME 24/24 |
| 2 | Flag OFF serves the same bytes | flag OFF is prod today | blocker if wrong | **not a bug**: 8 of 8 identical; dehydrated state guarded by a test that goes red on mutation |
| 3 | Hydration | a mismatch = white flash / console errors on every dancer page | blocker if wrong | **not a bug**: 0 console errors or warnings on every walk; seed mutation reds 9 tests. The `mounted` gate is NOT load-bearing (mutating it away stays green) -- explained below |
| 4 | Deadline / failure paths | a slow RPC must not hold the page | should (coverage) | **fixed here (test)**: new table-driven `seedPersonSnapshot.test.ts` proves settle-by-deadline, never-reject, no timer left; reds on two mutants. TTFB not slower |
| 5 | Stale tabs (page tagged `stampDancer` only) | a DJ who stops DJing can show a DJ tab for up to ~1-2 s on a page served from an old cache | should | **owner call 1** (cache tag): recommend adding `djTag(id)` and `teacherTag(id)` to the dancer stamp when the flag is ON |
| 6 | Failed / late seed cached for the full TTL | for up to 1 h (+ SWR) that page has the old 1.7 s shift back | should | **owner call 2** (TTL): recommend `degraded || seed === false` -> `DEGRADED_EDGE_TTL_SECONDS` (60 s) |
| 7 | Blast radius | other pages read the same key | blocker if wrong | **not a bug**: no other loader seeds the key; consumers unchanged; isolation check green |
| 8 | Extra reads | phone data / server load | nice | **not a bug**: on the phone 3 Supabase calls -> 1 (roles + DJ read move to the server); client navigation 1 `.data` call, no double fetch, no flash |
| 9 | CLS | the reason for S7 | -- | **reproduced exactly** (table below); the leftover 0.037 is S6 finding 2, kept by the owner |
| 10 | Shape survey | the handover table | nice | **mostly right**: DJ 14, teacher 98, both 26 exact; the dancer-only row is 29 + 24 (not 30 + 23) and its photo/city split is 31/2/6/14 (not 30/2/6/15) |
| 11 | Signed-in view | not walked | nice | **not verified** (no test account); the matrix has no signed-in case either |
| 12 | Dead code / hygiene | -- | nice | **not a bug**: every new export imported; no debug; no raw Unicode added; CRLF on all new source (safe-write's mark); `check:integrity` ok |

### 1. Headers and meta (proof)

`node tools/diff.mjs <main> <branch> brito,bobby-blanco,b,ben,kal,alex-boneva,alexa-bzuk26,florian` for each
mode (off / on / open). Every profile: `headers SAME head SAME`. The branch flag-ON page sends
`Vercel-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`,
`Vercel-Cache-Tag: dancer-<id>,dancers`, `Cache-Control: public, max-age=0, must-revalidate`, `Vary: Accept-Encoding`:
identical to main. Dancer pages carry no JSON-LD on either side (0 `ld+json` blocks), so there is none to diff.

### 2. Flag OFF byte-identical (proof)

Full served HTML, main vs branch, flag OFF: **8 of 8 identical** after normalisation. A first pass showed 3-4
"diffs"; they were turbo-stream's de-duplication of two equal timestamps (`dataUpdatedAt` == `dehydratedAt` in
the same millisecond renumbers its references). The same noise appears main vs main (6 of 8 on one run), and
every profile came out identical within 1-5 retries. Not a branch difference.

Dehydrated state with flag OFF = exactly `[['dancer-profile', id]]`: mutating `flags.personWorlds ? seed : null`
to `true ? seed : null` turns `flag OFF: no roles read and only the dancer read` red (1 failed / 18 passed).

### 3. Hydration (proof)

- Removing the seed write (`qc.setQueryData(...)`): **9 of 19 red** (every tab/reserve row, the hydration test,
  the negative control, the PGRST202 fallback).
- Removing the `mounted` gate (`enabled: mounted && !!id` -> `enabled: !!id`): **19 of 19 green.** This is
  correct, not a hole: TanStack Query never fetches during a server render, so with no seed the server and the
  first client render both have no data (`answered` false) whether or not the hook is enabled. The gate is
  belt-and-braces; nothing in the SSR/hydration path depends on it. Left as is.
- Browser console (all `error` + `warning` messages, resource-load failures from the sandbox proxy excluded):
  **0** on every render: DJ (`brito`, `kal`, `bobby-blanco`), teacher + DJ (`b`, `nickchata`), dancer only
  (`ben`, `florian`), teacher holders with pages closed and open, the long name, the no-role and archived rows.

### 4. Deadline and failure paths (proof)

- Code: the seed starts right after the dancer read is issued (beside `loadPublicPageV2`, which started just
  before) and is awaited after it. Both race the same 2.5 s `PUBLIC_PAGE_DEADLINE_MS`, so the loader waits at most
  ~2.5 s past the dancer read for the seed, the same bound the public-page read already had.
- Late answer: `Promise.race` already holds handlers on both promises, so a later rejection of the read is
  handled (no unhandled rejection); `finally { clearTimeout }` removes the deadline timer on every path. On a 404
  (no dancer) the seed is not awaited, but it never rejects and its timer is at most 2.5 s.
- New test `src/modules/person-page/seedPersonSnapshot.test.ts` (5 rows: answers / answers null / fails / never
  answers / answers after the deadline): settles by the deadline, never rejects, writes the key only on an
  answer, leaves 0 timers. Mutants: drop `clearTimeout` -> 3 red; drop the race -> 2 red. It passes on the
  unfixed code: this is coverage the brief asked to prove, not a bug.
- Existing matrix: RPC error (57014) -> no seed, page served; PGRST202 -> inferred fallback seeds, closed teacher
  dropped; null roles -> no tabs; teacher pages closed -> no teacher tab and no `/teachers/` link (also on the
  built pages: 0 `/teachers/` links on every closed-mode render; `b` with pages open has 1).
- TTFB (local build, prod data, ms, median of 5 after 1 warm-up, run with nothing else on the box):

  | Profile | OFF main / S7 | ON main / S7 | ON + teacher open main / S7 |
  |---|---|---|---|
  | `brito` | 499 / 454 | 480 / 464 (-16) | 475 / 486 (+11) |
  | `b` | 470 / 482 | 463 / 473 (+10) | 488 / 485 (-3) |
  | `ben` | 483 / 457 | 470 / 483 (+13) | 481 / 477 (-4) |

  Every delta is within the run-to-run noise (flag OFF, the SAME code path, varies by 45 ms). On the happy path
  the seed's reads run in parallel with the reads main already waits for, so first byte is not slower. (A first
  run taken while the browser walk was running showed +/-150 ms swings in both directions on all six builds;
  discarded.)

### 5. Stale tabs (owner call 1)

The page stays tagged `dancer-<id>,dancers`; a DJ / teacher write purges `dj-<id>` / `teacher-<id>`, which does
not reach `/dancers/<slug>`. Edge TTL: `s-maxage=3600, stale-while-revalidate=86400`. The client re-reads the
snapshot after mount when the seed is older than 5 min (`staleTime`), proven by the matrix row "a stale seed is
refetched after mount".

Worst case for a visitor: a page served from an edge copy up to 1 h old (or, for a page nobody opened in a
while, one stale copy up to 25 h old while the edge refreshes it):
- **tab present that should be gone** (DJ removed): the DJ tab shows for the ~1-2 s the client re-read takes,
  then disappears (a shift, and a tap in that window lands on a DJ page that no longer exists);
- **tab absent that should be there** (new DJ): the tab appears after the re-read, exactly as main does today.

Recommendation (owner call, NOT built: it changes a cache tag): when `flags.personWorlds` is on, stamp the dancer
page with `dancerTag(id), djTag(id), teacherTag(id), DANCERS`, so a DJ or teacher write purges the dancer page
too. One line in `app/routes/dancers.tsx`; check `scripts/check-cache-tag*` parity first.

### 6. Degraded TTL (owner call 2)

`degraded` comes only from `loadPublicPageV2`; a failed or late seed does NOT set it, so that page is cached for
the full `s-maxage=3600` (+ SWR). Proven by the matrix: "read fails" and "read late" both assert
`opts` equal to flag OFF (= no bound). That page is today's page (tabs read after mount), so the visitor sees
the old 1.7 s shift, for up to 1 h (+ one stale serve) after a single slow RPC.

Recommendation (owner call, NOT built: it changes a TTL): bound it like the public-page read:
`degraded || (rolesSeed && !(await rolesSeed)) ? { edgeTtlBoundSeconds: DEGRADED_EDGE_TTL_SECONDS } : undefined`.

### 7. Blast radius (proof)

`grep -rn "personSnapshotKey\|'person-snapshot'\|seedPersonSnapshot\|usePersonRoles\|usePersonSnapshot" src app`:
the key is seeded only by `app/routes/dancers.tsx`. Consumers: `useDancerLower` (dancer world),
`RoleSwitchBar`, `roleBarModel` (dancer-app public page), `TeacherWorldPage`, `DJProfile`. Their code is
unchanged (only the key moved to one export, same value). `/people/:id` still calls `loadPersonSnapshot` and does
not write the key (unchanged file). No other loader imports the seed. `person-page` imports nothing from
`dancer-app` (the only hits are comments); `npm run check:dancer-area-isolation`: OK.

### 8. Extra reads (proof)

Network log, Supabase calls made by the PHONE after load (flag ON, teacher pages closed):
main `brito` 3 (`get_public_dj_v1`, `get_public_person_roles_v1`, timeline) -> branch 1 (timeline); `ben` 2 -> 0.
Teacher pages open: `b` 5 -> 2. The server instead makes `get_public_person_roles_v1` + `get_public_dj_v1`
(+ `get_public_teacher_detail_v1` when open) once per edge-cache miss; the dancer read is shared (matrix:
exactly 1 `from('dancer_profiles')` call). Client-side navigation `ben -> brito`: one `/dancers/brito.data`
request + the timeline, tabs present from the first frame of the new page (main: 2 more RPCs and the tabs
arrive ~500 ms later). `brito -> ben`: the old page's 2 tabs stay ~20 ms while the URL changes, then 0; main does
the same (pre-existing route transition, not S7).

### 9. CLS (reproduced)

Teacher pages closed, largest session window, 6 s after load:

| Profile | main 390 | main 360 | S7 390 | S7 360 | served tabs main -> S7 |
|---|---|---|---|---|---|
| `brito` (DJ, undated) | 0.161 | 0.164 | 0.037 | 0.036 | 0 -> 2 |
| `bobby-blanco` (DJ, dated) | 0.141 | 0.143 | 0.017 | 0.015 | 0 -> 2 |
| `b` (teacher + DJ) | 0.128 | 0.132 | 0.005 | 0.005 | 0 -> 2 |
| `ben` (dancer only) | 0 | 0 | 0 | 0 | 0 -> 0 |
| `kal` (DJ, undated) | 0.161 | 0.164 | 0.037 | 0.036 | 0 -> 2 |

Teacher pages open: `b` 0.150 / 0.156 -> 0.027 / 0.029 (3 tabs served); the others as above. Flag OFF: main and
branch equal on every row (`brito` 0.032 / 0.035 both: pre-existing, not S7). The builder's numbers reproduce to
the third decimal. The remaining 0.037 is the 64 px reserve collapsing for an undated DJ: S6 finding 2, kept by
the owner, not a regression.

### 10. Shape survey (prod, read-only counts, 2026-10-24)

`dancer_profiles` with `is_active is not false` (191) x `get_public_person_roles_v1`:

| Roles | rows | photo + city | photo only | city only | neither |
|---|---|---|---|---|---|
| dancer role, no DJ / teacher (live) | 29 | 24 | 1 | 4 | 0 |
| no public role, live | 5 | 1 | 0 | 0 | 4 |
| no public role, archived | 19 | 6 | 1 | 2 | 10 |
| DJ (no teacher) | 14 | 10 | 0 | 0 | 4 |
| teacher (no DJ) | 98 | 48 | 8 | 0 | 42 |
| teacher + DJ | 26 | 25 | 0 | 0 | 1 |

The handover's DJ / teacher / both rows are exact. Its first row (53) is right in total but splits 29 + 24, not
30 + 23, and photo/city 31/2/6/14, not 30/2/6/15 (one profile off; possibly a photo added the same day).

Walked (branch, flag ON, 390x844 and 360x800; teacher pages open at 390): `brito`, `kal` (DJ, undated),
`bobby-blanco` (DJ, dated, no photo, no city), `b`, `nickchata` (teacher + DJ; `nickchata` no photo, no city),
`spyridoula` (teacher, no photo, no city), `alex-boneva`, `alexa-bzuk26`, `aitor-angelica-tbf` (teacher
holders), `ben`, `florian` (dancer only; `florian` photo, no city), `llf-malva-marina-montenegro` (longest name,
23 chars), `unclaimed-b289dee1` (live, no public role), `unclaimed-db85dd0e` (archived: 404 on main and branch
alike). Every render: served tabs == tabs after load, 0 console errors, no sideways scroll, CLS <= 0.037; teacher
pages closed: no teacher tab and no `/teachers/` link; open: teacher tab and link served. So: every shape, plus the longest name
(`llf-malva-marina-montenegro`), no photo + no city for DJ (`bobby-blanco`), teacher (`spyridoula`) and both
(`nickchata`), a live no-role row and an archived no-role row.

### 11. Signed-in view

Not walked (no test account). The matrix has no signed-in row: the seed is identical for every visitor (the
loader runs anonymously and the page is edge-cached), so a signed-in visitor gets the same served tabs; anything
signed-in-only renders after mount. Stated as NOT verified.

### 12. Hygiene (proof)

`seedPersonSnapshot` <- `app/routes/dancers.tsx`; `personSnapshotKey` <- the hook and the seed. No
`console.log` / `debugger` in the diff. No non-ASCII on any added line. New source files are CRLF (the mark of
`safe-write.py`; `.md` is unguarded); `bin/check-integrity.sh`: ok (2506 files, 0 issues).

## Raw numbers and scripts

`docs/people-arc/s7/critique/`: `walk-<build>.json` (every render: status, CLS, served / live tabs, `/teachers/`
links, sideways scroll, console errors, Supabase calls from the phone), `walk.cjs` (the walk),
`nav.cjs` (client-side navigation probe), `sd.mjs` (normalised served-HTML diff).
