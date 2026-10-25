# Brief: P3 slice W1 (Website) -- Home + Events + Stats read screens

Lane: normal (no DB change, no SQL in this repo). Repo 123constante/bachata-website. Branch claude/p3-w1-home-events-stats, base = current main (W0 #1041 is merged). One slice = one branch = one push.

## Spec
Fill the three W0 placeholders under `/account/p3` (flag `organiserP3`, stays OFF) with the C3 read screens: Home (Next up, Needs you, views), Events (list), Stats. Mockup behaviour spec: `docs/organiser-rebuild/p3/mockups/C3.md` and `C3.html` (read on the Website repo; if absent, on PR #989). Contract: `docs/organiser-rebuild/p3/CONTRACT.md` section 2 (screen -> RPC map) and section 1 (shapes).
- Reads only: `organiser_home_v1` (next_dates <=3, has_own_changes), the going RPCs on main (switch off), views as CONTRACT says (the views total source was NOT verified in A0: find it read-only, state it, or show nothing and say why).
- Use the W0 model only (`src/modules/organiser/p3/model/`): `daySessions`, one `startPhrase`, one `classCount`, label list `L`, role nouns, `kindOf` via `eventCategory`. No second copy of any mapping. Tokens from `p3/theme/p3.css`. px sizes, 44px taps, no colour seams.
- Every empty / loading / error state says what the person CAN do. A control that cannot work is disabled with a reason. C3 deviation #71: kind chip per row, no grouping by kind (owner accepted).
- Prod shapes (CONTRACT section 1): weekly, one-off, course, monthly, dates-I-pick, festival; cancelled, past, ended series, >100 dates (one series has 131), 223 items with no start time. Table-driven vitest: every screen x every shape (red first on any bug). Port the relevant C3 probes (`selfcheck/C3-probes.mjs`) to vitest.
- Design Gate: record `docs/design/<pr>.md` linked in the PR body; stage 4 self-running checks (contrast >= 4.5, taps >= 44, no clipping, no sideways scroll); say stage 5/6 are the orchestrator's.
- HTML entities not raw Unicode punctuation; files over 2 KB through scripts/safe-edit.py / safe-write.py. Phone QA + Verified on real data sections in the PR body. Do NOT touch the old `/account/o` flows.

## Done =
PR with the screens, tests, per-job CI table (run every CI job step in your sandbox), 8+ screenshots at 390x844 (light + dark, each shape that matters) under `docs/handover/p3-w1-walk/`, Verified / Not verified. Stop at 50% context with a PARTIAL marker.
