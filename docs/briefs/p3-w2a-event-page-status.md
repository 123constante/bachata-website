# Brief: P3 slice W2a (Website) -- Event page + Status sheet -- DRAFT 2026-10-26, NOT DISPATCHED (owner approves the split first)

Lane: normal (no DB change). Repo 123constante/bachata-website. Base = current `main` (W0 #1041, W1 #1047 merged; flag `organiserP3` stays OFF). Branch `claude/p3-w2a-event-page`. One slice = one branch = one push. Do NOT touch `/account/o` flows or closed ER branches.

## Proposed split of the rest of C3 (for the owner)
| Slice | Content | Server | Order |
|---|---|---|---|
| W2a (this brief) | `/account/p3/events/:seriesId` read page (header, status row, sessions timeline, "Coming up" dates, About card) + Status sheet (Put live / Hide / Show / End it / Stop repeating, greyed rows say why) | all live | 1 |
| W2c (cancel) | "Cancel the event" on a one-off: `BRIEF-p3-cancel-one-off.md`. Mounts in the W2a Status sheet. | AD4 live | 2 (small) |
| W2b | Date sheet + All dates: cancel/bring back a date (recurring), move, skip week, change time, add a date, per-date details; one-off date row uses the W2c sheet | live | 3 |
| W2d | Sessions + line-up editing, scope "Every date" / "Just this date" only | live; "From X on" = admin GAP A1 | 4 |
| W3 | Name and details (save model), Prices, Repeat, History, Make a copy, create flows | Repeat=GAP A2, copy/undo=GAP A3 | later, needs admin work first |
Out of P3 per CONTRACT: change the kind, WhatsApp column, festival programme edit.

## Spec (W2a)
Mockup: `docs/organiser-rebuild/p3/mockups/C3.md` + `C3.html` (read on PR #989 / #1003 branch `claude/er-p3-c3-test` if absent). Contract: `docs/organiser-rebuild/p3/CONTRACT.md` section 2 rows "Event page", "Status sheet", "End it", "Stop repeating" (branch `claude/p3-a0-contract` if absent).
1. Route `events/:seriesId` in `p3/shell/P3Routes.tsx` + `P3_PATHS.event(id)`; Events list rows (W1) link to it. Not found / not yours / loading / error states each say what the person can do.
2. Reads only, via the EXISTING R1 workspace fetch and `parseEventWorkspace` (`events/eventModel.ts`, `shared/seriesModel.ts`); find it, never a second copy. Shapes the screen must survive (CONTRACT section 1): weekly, one-off, course, monthly, dates-I-pick, festival; live/paused/draft/ended/cancelled dates; 131-date series (workspace returns the newest 100: show "100 of N" honestly, no fake total); 0 sessions; empty line-up; no start time.
3. W0 model only (`p3/model/`): `daySessions`, `startPhrase`, `classCount`, `L`, role nouns, `kindOf`. Add to `L` / `status.ts`, never a second mapping. Tokens `p3/theme/p3.css`; px sizes, 44px taps, no colour seams.
4. Status sheet: only moves possible now, greyed ones say why, per CONTRACT: `series.set_lifecycle` (live<->paused, draft->live, ->archived), `series.end_run` (`today_session` ran / not_running; disabled "It hasn't run yet" before the first date), `series.stop_repeating` (`keep_occurrence_ids`). "Back to draft" from live is NOT an owner transition: show it greyed with the reason. Reserve a visible disabled row "Cancel the event" for a not-yet-run one-off ("Coming in the next update" is not allowed copy: state the real reason or leave the slot to W2c via a single `StatusRow` list entry).
5. Writes use existing `shared/seriesCommands.ts` builders and `envelope()` (fresh idempotency key, `expected_version`). Refusals go through `COMMAND_COPY`; no raw server text. Undo toast where the command is reversible (Hide <-> Show). An untouched sheet sends nothing.
6. Copy: British English, full weekday names, HTML entities not raw Unicode punctuation, files over 2 KB through scripts/safe-edit.py / safe-write.py.

## Tests (table-driven, red first on any bug)
Every shape x every state: header text, status chip, which Status rows are enabled/greyed with which reason, command sent (kind + payload keys), nothing sent when untouched, each refusal -> plain copy, empty states actionable. Port the relevant C3 probes (`selfcheck/C3-probes.mjs`) to vitest. Read-only prod shape survey first (counts only), stated in the PR.

## Done =
Bot-authored PR, design record `docs/design/<pr>.md` (stage 4 self-checks; 5/6 are the orchestrator's), per-job CI table (run every CI job step in the sandbox), 8+ screenshots at 390x844 light + dark under `docs/handover/p3-w2a-walk/` covering each shape that matters, Verified / Not verified. Stop at 50% context with a PARTIAL marker.
