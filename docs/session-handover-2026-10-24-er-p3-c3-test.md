# Handover 2026-10-24: ER P3 C3 test page for real organisers

Branch `claude/er-p3-c3-test` (off `claude/er-p3-mock-c3` 92fc45b). Docs/mockup only, no app code, no PR.

## Files (all under `docs/organiser-rebuild/p3/usability/`)
- `C3-test.html` - the ONE self-contained page to publish (288 KB). Built, do not hand-edit.
- `C3-test.template.html` + `build-c3-test.mjs` - source of the test layer; `node build-c3-test.mjs` re-embeds `../mockups/C3.html` (unchanged, byte-for-byte after CRLF normalisation: checked).
- `selfcheck/C3-test-check.mjs` - Playwright self-check (`node selfcheck/C3-test-check.mjs`).

## How it works
C3 runs unchanged inside an iframe (`srcdoc`), so each task starts from a fresh app on Home (the "Show me my week" tap is done for them, not counted). The test bar sits in the page flow ABOVE the app (never over it), collapsible ("Hide"/"Show task"), buttons "Done" / "I'm stuck, skip" at 44px+. Light/dark follows the OS and C3's own theme button. After each Done/skip: Easy / OK / Hard + optional one-line "What got in the way?". End screen: summary, "Send by WhatsApp" (wa.me, text only, no number), "Copy results" (textarea fallback if the clipboard is blocked).
Tasks are the 8 from `R-C3-sim.md` (found on branch `brief/er-p3-c3-sim`, not on the base branch) reworded, plus task 9. Taps = clicks on buttons/links/inputs/labels inside the app; the label of each, in order, is `path`.

## Saving
`await window.claude?.use?.("db")`; null -> page works fully, end screen asks for WhatsApp. With a db: first write `db.doc("runs/<id>").set({name, startedAt, device, tasks, finishedAt:null})`, then `.update({tasks, finishedAt})` after every rating (9 writes total, none on load). All in try/catch. Publisher must declare `capabilities: {db: {}}` (write access depends on the viewer's level; signed-out visitors get null -> WhatsApp path). No localStorage.

## Real check vs self-reported
| Task | How judged |
|---|---|
| 1 Tonight's teacher + going | answer-checked: typed answer must contain "marco" and 14 |
| 2 Friday class 8:30pm | REAL (mockup state: class start 20:30 for every date, or from Fri 23 Oct on) |
| 3 Cancel Sat 31 Oct | REAL (exactly that date cancelled, with a reason) |
| 4 Sofia Ramos Fri 30 Oct only | REAL (on the Friday class that date, no other date, not the base) |
| 5 Saturdays ticket link | REAL (ticket === https://tickets.example/sat-new) |
| 6 Hide Mambo City | REAL (status hidden, dates kept) |
| 7 New monthly social | REAL (new monthly event, Saturday, party 21:00, class ending by then, place Studio 68) |
| 8 Views of Fridays | answer-checked: typed answer must contain 300 |
| 9 Where is this weekend | self-reported; first tap recorded as `path[0]` |
A check is also computed for skipped tasks (so a skip that actually worked shows). Result string: `pass` / `fail` / `self-reported` (+ typed answer for 1 and 8).

## Self-check numbers (measured)
`C3-test-check.mjs`: **639 checks, 0 failed.** Full 9-task walks: 390x844 and 360x640 x light and dark (db absent) + 390x844 light with a mocked db. Covers: embedded C3 identical; start copy; test bar never overlaps the app and no app control sits under the test layer (elementFromPoint, expanded and collapsed); taps >= 44px on start/bar/rating/end; no sideways scroll; contrast >= 4.5 (3 at >= 24px) on bar, start, rating, end; each state check FAILS before the task is done (not vacuous) and passes after; db=null: WhatsApp text has 9 rows, no contact-like text; mocked db: one doc path, 1 set + 8 updates = 9 writes, first doc has exactly the 5 fields, last has 9 tasks + finishedAt; zero page errors.
C3's own probes, unchanged file: **110 / 110 pass** (`node selfcheck/C3-probes.mjs C3.html`). C3.html not modified. The C3 sweep was not re-run (file unchanged).

## Verified / Not verified
Verified: the numbers above, plus two screenshots looked at (start and task 2 at 360x640 dark).
Not verified: the real artifact runtime (db API shape `doc().set/update` taken from the contract .d.ts, never run against a real `window.claude`); a real phone or iOS keyboard; WhatsApp opening from inside the artifact sandbox (links may need the sandbox to allow popups); clipboard inside the sandbox (fallback textarea exists); Outfit font (stubbed in checks); task 4/7 scripted walks use C3's synthetic-click handlers, not finger taps; wording of the 8 tasks is mine (rephrased from R-C3-sim.md); a real person may take longer or tap differently than the scripted walks, so `taps` numbers in the self-check are not benchmarks.
Orchestrator: publish `C3-test.html` as an Artifact with `capabilities: {db: {}}`; read `runs` with ArtifactData afterwards.
