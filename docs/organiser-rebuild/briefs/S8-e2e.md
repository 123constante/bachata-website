# Brief S8 -- the consistency matrix and the E2E specs (last slice)

Repo `123constante/bachata-website`, branch `claude/org-r1-e2e`, base `feat/organiser-r1` (wave 6, after S0-S7 + S9 are merged there). READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` applies with `<X>` = S8; plan = `docs/organiser-rebuild/R1-PLAN.md`. Sections: 4.4 (S8 row), 4.5 Consistency matrix + E2E, 4.11 (the 13 specs / 9 gated; `e2e-smoke.yml` mocks the network; the real-RPC split; `SectionLabel` grep), 4.12 R3-7, R3-18, D22, D28, D31, D40, D49, D61.

## Owns (4.4 row)
`tests/e2e/organiser-*.spec.ts` (rewrite the 9 GATED specs for rule 2: onboarding, home, events, date, team, profile, legacy-redirects, layout, loop -- delete `organiser-loop.spec.ts` only if its subject, the tab loop, is gone and remove it from the list by name), NEW `tests/e2e/organiser-tap-targets.spec.ts` (390x844, every interactive element >= 44px on every R1 screen), NEW `tests/e2e/fixtures/organiser-r1/**` (table-driven `organiser_home_v1` + team + workspace payloads shaped from 2.4 + 4.12), ONE ungated `tests/e2e/organiser-r1.real-rpc.spec.ts` against the E2E project, `scripts/e2e/seed-organiser-real-rpc.mjs` extended with the A0 shapes (keep its prod refusal), `src/modules/organiser/__tests__/consistency.matrix.test.tsx`, the `test:e2e` list in `package.json` updated BY NAME. Leave the 4 ungated specs (launch-walk, real-rpc, two `.real-supabase`) untouched.

## Consistency matrix (4.5, every screen x every shape)
- No copy names a control that is not on screen (string scan of every rendered R1 screen for "tab", "swipe", "menu", "Undo").
- Every empty state has exactly one action.
- A disabled control carries a reason (`aria-disabled` + a visible sub-line) -- table over: owner Leave, course Stop repeating, capped add-days, full team, untouched Save/Next everywhere.
- The time/venue/name screens' Save/Next is disabled until the value differs from the current one, and an untouched save sends NO command (spy on `supabase.rpc`).
- The past-date refusal text equals `eventState.ts:75` verbatim on every screen that can show it.
- `WARN_DATE` is imported by exactly ONE file (cancel confirm), `handOverWarning` by exactly one (hand-over confirm), `WARN_END` by exactly one (end confirm); D14 copy verbatim.
- No `SectionLabel`/`StatusTag` import under `flows/`, `home/`, `events/`, `team/`, `page/`, `more/`, `switch/` (D22); no `useSendForReview`/`ReviewCard`/`reviewModel` import and no "Send for review" string in the module.
- `version_conflict` on every write screen -> the R3-7 Done variant with one button to the event.
- Fixtures: every 2.4 + 4.12 shape (0 series; 1 live; 4-7; 0 scheduled upcoming; all upcoming cancelled; 45/40 archived; 2 organisers; draft 2 d / 9 d; no cover; open request; manager vs owner; course; festival; 14+ dates straddling 2026-10-25). Clock frozen in every test; never a literal date.

## E2E (4.11 split)
(a) Gated smoke specs against the Vite preview with MOCKED network (the fixtures above), one spec per job from Home: home, change, add, cancel, new, events, team, page-more, legacy-redirects, tap-targets, each at 390x844. (b) ONE ungated real-RPC spec against the E2E project (seeded by the extended seed script after A0 + A1a + A1b are applied there): the inverse of every R1 command reachable from Home (cancel <-> put it back, add <-> take it off, time <-> change time, pause <-> resume, move across 2026-10-25 keeps 20:00 wall-clock), run in your sandbox and reported in the per-job table.

## Tests first
Run the matrix against the merged tree BEFORE adding it and paste every red row in the handover (a matrix that cannot fail proves nothing); each red becomes either a fix in the OWNING slice's files (push PARTIAL with the file list for the orchestrator: you own tests, specs, fixtures and the seed only) or a documented exemption with its D-number.
