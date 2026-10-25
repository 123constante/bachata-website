# Brief: P3 slice W0 (Website) -- foundation behind flag organiserP3

Lane: careful (multi-screen rebuild foundation). Repo 123constante/bachata-website. Branch claude/p3-w0-foundation. One push. Read CLAUDE.md, .claude/rules, docs/organiser-rebuild/p3/CONTRACT.md (section 5 flag, section 2 map), and the C3 spec: branch claude/er-p3-mock-c3, docs/organiser-rebuild/p3/mockups/C3.md and C3.html (behaviour: dsess, startPhrase, classCount, cast, label list L). Design Gate applies: write docs/design/<pr>.md (brief, chosen mockup = C3, tokens, checks). No visible organiser change while the flag is off.

## Build
1. Flag `organiserP3` = `VITE_ENABLE_ORGANISER_P3`, default off, in src/lib/featureFlags.ts, same pattern as organiserSelfServe. Keep separate from parityGate AW1_APPLIED.
2. Route shell + tab bar for the new organiser area under the flag (Home, Events, Stats, You tabs as in C3), rendering placeholders only. Old routes untouched when the flag is off.
3. Shared model in one folder (src/modules/organiser/p3/model/): sessions timeline type, `startPhrase`, ONE `classCount` (no cancelled, no breaks), role nouns map (teacher, DJ, performer), the single label list `L` from C3.md "Shared labels", kind word via existing `categoryWord` / `wordForStored` from src/lib/eventCategory.ts (do not add a mapping).
4. One tokens file for the C3/C2 look (ember), no colour seams, explicit px tap sizes (html font-size trap in CLAUDE.md), contrast >= 4.5.
5. Tests: port the C3 logic probes that concern the model (startPhrase, classCount, role nouns, labels) to table-driven vitest across every shape in docs/organiser-rebuild/p3/CONTRACT.md section 1 survey (series, monthly, course, dates-I-pick, festival, one-off; empty/no-name sessions; sessions past midnight; cancelled/breaks). Red first where fixing; flag-off test proves old routes unchanged.

## Rules
HTML entities in JSX, file writes >2 KB via scripts/safe-write.py or safe-edit.py, no SQL here. Push once. Run every CI job step in the sandbox; per-job table in the PR body. Verified / Not verified block. Stop at 30% context with PARTIAL marker.
