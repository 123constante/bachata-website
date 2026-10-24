# Brief: C3 test page for REAL organisers (normal lane, docs-only, one push)

Repo 123constante/bachata-website. Branch `claude/er-p3-c3-test` off `claude/er-p3-mock-c3` (head 92fc45b7). Output ONE
self-contained file `docs/organiser-rebuild/p3/usability/C3-test.html` (plus its self-check). No app code changes.
The orchestrator publishes it as a claude.ai Artifact. The owner tries it FIRST, then real organisers do.

Read first: `docs/organiser-rebuild/p3/mockups/C3.html` + `C3.md`, `docs/organiser-rebuild/p3/usability/R-C3-sim.md`
(the 8 tasks, lines ~36-43), `C3-sim-A.md` (how a run is scored), the polish handover
`docs/session-handover-2026-10-24-er-p3-c3-polish.md` (sample names changed in polish: use the CURRENT names in C3).

## What the page is
C3 itself (copy it in, unchanged behaviour) plus a small test layer:
1. Start screen: "Help us test the new organiser app. 9 short tasks, about 10 minutes. There are no wrong answers:
   if something is hard, that is our fault." First name field (optional). Big "Start".
2. One task at a time in a slim bar that does not cover C3's own buttons (collapsible; 44px taps; works at 360 and 390
   wide, light and dark). Bar buttons: "Done", "I'm stuck, skip". Show "Task 3 of 9".
3. Tasks: the 8 from R-C3-sim.md (reword in plain organiser language, current sample names), plus task 9:
   "Where would you look to see what's on this weekend? Tap it." (record the FIRST thing they tap, then Done).
4. Per task record: seconds, taps inside the mockup (count clicks on buttons/links/inputs, not the test bar), the
   label of each tapped control in order, outcome done / skipped, and where possible a success check read from the
   mockup state (`window.__c2` or C3's own state): e.g. task 2 the Friday time is 8:30pm from the right date. Name
   which tasks have a real check and which are self-reported.
5. After each Done/skip: "Was that easy?" Easy / OK / Hard (one tap) + optional "What got in the way?" one line.
6. End screen: thanks, a short summary, and two ways to send results: (a) automatic save when the page's database is
   available, (b) always a "Send by WhatsApp" link (wa.me with the summary text, no phone number) and "Copy results".

## Saving (artifact runtime; read the contract)
`const db = await window.claude?.use?.("db")` may be `null` (signed-out visitors, public links): the page must work
fully without it and fall back to (b). When present: write ONE doc per run in collection `runs` (id = random), fields
`{name, startedAt, device: innerWidth, tasks:[{n, secs, taps, path, outcome, check, easy, note}], finishedAt}`;
write after each task (update the same doc), never on load. Never put secrets or the visitor's contact details in it.
Wrap every call in try/catch. Do not use localStorage for results (a resume convenience is fine).

## Checks (self-running, in the file's selfcheck script, Playwright)
All 9 tasks completable at 390x844 and 360x640, light + dark; test bar never covers a C3 control (bounding boxes);
taps >= 44px; no sideways scroll; contrast >= 4.5; db=null path ends with a WhatsApp link whose text has 9 rows; a
mocked db receives one doc updated 9 times. Run C3's existing probes unchanged: they must still pass.

PR: not needed; push the branch once and leave a handover `docs/session-handover-<date>-er-p3-c3-test.md` with the
probe numbers and the list of real-check vs self-reported tasks.
