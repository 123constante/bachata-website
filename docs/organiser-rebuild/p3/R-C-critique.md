# P3 independent critique of the CHOSEN mockup C (read-only review, Design Gate stage 5)

The owner picked mockup C "Today first" on 2026-10-23 over A (calm) and B (photo-led). You are the independent reviewer. You did NOT build it. Your critique feeds a v2 of C (not a redesign).

Read, in this order:
1. `docs/organiser-rebuild/p3/DESIGN-COMMON.md` and `M-C-today.md` on this brief branch (the brief C was built to; binding).
2. The mockup: `git fetch origin claude/er-p3-mock-c` then `git show FETCH_HEAD:docs/organiser-rebuild/p3/mockups/C.html` and `C.md`. Read the WHOLE html.
3. For comparison only: A and B on `origin/claude/er-p3-mock-a` / `origin/claude/er-p3-mock-b` (`mockups/A.html`, `B.html`). Note anything A or B did better that C should borrow WITHOUT changing C's structure.
4. Production Ember tokens: `origin/main:src/modules/organiser/ui/ember.css`. Gaps: `docs/organiser-rebuild/p2/AUDIT-foundation.md` (G-numbers), `p2/BENCHMARK.md`.

Look at it for real: serve the file (e.g. `npx http-server`) and drive it with Playwright/Chromium at 390x844 in light AND dark; tap every button. Measure, do not guess: text contrast (>= 4.5:1), tap targets (>= 44px), clipping, sideways scroll, console errors.

## Output (ONE file, ONE push, no PR, no source edits)
Branch `claude/er-p3-critique-c` from `origin/main`. File `docs/organiser-rebuild/p3/CRITIQUE-C.md`:
1. **Verdict** (3 lines): is C a sound base; the top 3 must-fix items.
2. **Ordered fix list** (most material first, max 25). Each: screen + html line, what is wrong, the exact fix, and why it matters to a low-tech organiser on a phone. Cover: one primary action per screen and hierarchy; wording and jargon (same word for the same thing everywhere); contrast, taps, clipping in both themes; every empty / loading / error state says what the person CAN do; flows the brief requires that C stubs or omits (e.g. "weekly social" and "one-off party" create say "shown in A and B"; how to pay; where/venue; invite journey first screen); anything that could put WRONG info on the public page; the tab bar on small phones (360x640) and with the keyboard open.
3. **Borrow from A/B** (max 6): pattern, where it goes in C, why.
4. **Measured table**: screen x theme -> contrast fails, small taps, overflow, console errors.
5. **Verified / Not verified**.
