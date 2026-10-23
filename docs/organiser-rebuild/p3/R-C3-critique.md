# P3 independent critique of mockup C3 (read-only review, Design Gate stage 5)

C3 = the owner's chosen C2 look, kept exactly, plus parity with the admin event editor (sessions, per-date changes, status, repeat, stats, history, bulk, copy, organiser page, festivals). You are the independent reviewer: you did NOT build it. Your critique feeds ONE fix pass on C3. It is not a redesign: C2's look, tokens, tabs, Home, date strip and wording stay.

Read, in this order:
1. On this brief branch: `docs/organiser-rebuild/p3/DESIGN-COMMON.md`, `M-C2.md` (the look the owner picked), `M-C3.md` (the brief C3 was built to; binding), `FIELD-INVENTORY.md` (section 5b GAP LIST + the MUST rows; every GAP # must be covered or honestly marked phase 4).
2. The mockup: `git fetch origin claude/er-p3-mock-c3` then `git show FETCH_HEAD:docs/organiser-rebuild/p3/mockups/C3.html` and `C3.md`. Read the WHOLE html (2,200 lines).
3. For comparison: C2 at `origin/claude/er-p3-mock-c2` (`mockups/C2.html`). C3 must not have lost anything C2 had or changed its look.
4. The festival preview must match the current public festival page: `origin/main:src/pages/FestivalDetail.tsx`.
5. Production Ember tokens: `origin/main:src/modules/organiser/ui/ember.css`.

Look at it for real: serve the file (e.g. `npx http-server`) and drive it with Playwright/Chromium at 390x844, 360x640 and 1280x800, light AND dark; tap every button, open every sheet, run the 5-step Tour (Tour link on each tab screen). Measure, do not guess: text contrast (>= 4.5:1, 3:1 at >= 24px), tap targets (>= 44px), clipping, sideways scroll (the date strip scrolls sideways on purpose), console errors, text running together.

## Already found by the orchestrator's walk (put them in the fix list as given; do not re-litigate)
- K1 Session rows (`sessRow`, html ~888-896; event page, date sheet, create step, festival): title and the detail line render on ONE line with no space, e.g. "ClassAll levels · Marco & Sofia (teaches)", "PartyDJ Kizzy (djs)". `.ses .t` / `.ses .s` are inline spans.
- K2 Role in brackets is lower-cased: "(djs)", "(teaches)". Reads badly.
- K3 Event page "Where" repeats the place name: "Colab Tower / Colab Tower, 8 Pipers Close, SE1 7PF".

## Questions to answer, with evidence
- Does each screen have one clear primary action? Is anything an organiser must do hidden under "More options"?
- One word for one thing everywhere (the `L` list): find every place a screen says it differently.
- "This date only" / "This and later ones" / "every date": is the scope always clear BEFORE the save, and does the consequence line match what the save actually did?
- Every empty / loading / error state says what the person CAN do; every disabled control says why.
- Anything that could put WRONG information on the public page (preview vs what the rows hold; cancelled / not running / break; festival preview).
- Is C3 too dense for a low-tech organiser on a phone? Name the screens where it is and the smallest cut that fixes it, without losing a MUST row.
- Desktop (>= 1024px): rail, two-column event page, centred sheets: anything broken or awkward.

## Output (ONE file, ONE push, no PR, no source edits)
Branch `claude/er-p3-critique-c3` from `origin/main`. File `docs/organiser-rebuild/p3/CRITIQUE-C3.md`:
1. **Verdict** (3 lines): is C3 ready for the owner's tour after one fix pass; the top 3 must-fix items.
2. **Ordered fix list** (most material first, max 30, K1-K3 included). Each: screen + html line, what is wrong, the exact fix (CSS/JS/wording), and why it matters to a low-tech organiser on a phone. Mark each MUST (before the owner sees it) or LATER.
3. **Lost from C2** (anything C2 had that C3 dropped or changed), or "none".
4. **GAP LIST check**: GAP numbers C3.md claims as covered but the html does not actually cover.
5. **Measured table**: screen x width x theme -> contrast fails, small taps, overflow, text run-together, console errors.
6. **Verified / Not verified**.
