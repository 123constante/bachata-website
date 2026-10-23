# R-C3-toast: one bug found in the orchestrator walk of C3 after the fix pass

Repo: Website. Branch: `claude/er-p3-mock-c3` (no PR). Base: 494b2db4. Lane: normal. Mockup only, no product code.

## The failure (found by the orchestrator at 390x844, owner tour step 3)
Tour > 3 opens Fri 20 Nov. Tap the 8pm class, change Starts to 8:30pm, Save, pick "This and later ones",
tap "Save for these dates". The scope sheet before the tap correctly says only
"Changes from Fri 20 Nov onwards. Earlier dates keep the old time." But the toast AFTER the tap says that
plus ten lines "Fri 27 Nov had its own Class change: it changes too." ... "Fri 5 Feb 2027 had its own Class
change: it changes too." It is about 495px tall at 390x844 and covers the page.

Cause: `ssSave()` in `docs/organiser-rebuild/p3/mockups/C3.html` (around line 1419-1422) calls
`setSessOn(...)` FIRST and then builds the toast with `consLine(e, ss.di, what, 'later', ss.sid)`. After the
write every later date carries an override for that session, so `laterNotes` lists all of them.

## Decision (made, do not reopen)
Work the message out BEFORE `setSessOn`; the toast carries only the one consequence sentence:
`laterLine(e, ss.di, what)` for 'later', unchanged text for 'one' and 'all'. The per-date notes stay on the
scope sheet (before the tap), where they already show correctly. Exact replacement:

```js
    var what = ssWhat();
    /* the message is worked out BEFORE the write: after it every later date carries the change; the per-date notes were on the scope sheet before the tap */
    var msg = sc === 'later' ? laterLine(e, ss.di, what) : sc === 'one' ? fmt(x.d) + ' only: ' + what + ' changed.' : 'Saved for every date.';
    setSessOn(e, ss.di, ss.sid, patch, sc);
    closeSheet(); refreshUnder();
    toast(msg + ' Dancers see it now.', function () { restore2(e, sn); });
```

Then sweep C3.html for the same SHAPE (a message built from state AFTER the write it describes):
`saveLineup` (laterLine), `doCancel`, `applyMove` (moveHint after the move is applied), `dodtime`,
`dobulkcancel`, bulk `shift`. Fix any that report post-write state as the consequence; list each one
checked in the handover with "ok" or "fixed".

## The check that would have caught it (add it, red first)
In `docs/organiser-rebuild/p3/mockups/selfcheck/C3-probes.mjs` add probe `R-toast`: run tour step 3 exactly as
above at 390x844 and assert (a) the toast text has no "had its own", (b) it contains
"Changes from Fri 20 Nov onwards", (c) the toast is no taller than 120px. It must FAIL on 494b2db4
(`git show 494b2db4:<path>`) and PASS after. Add one more probe: "This and later" from a date whose class is
not running (Fri 6 Nov) still lists "stays not running" on the scope sheet BEFORE the tap.

## Gates
- `node docs/organiser-rebuild/p3/mockups/selfcheck/C3-probes.mjs docs/organiser-rebuild/p3/mockups/C3.html`: all pass.
- `node docs/organiser-rebuild/p3/mockups/selfcheck/C3-sweep.mjs docs/organiser-rebuild/p3/mockups/C3.html`: still 0 everywhere, incl. toast inside the viewport.
- C3.md: add a line under the fix-pass table ("Walk find: this-and-later toast") and update the probe count.

## Output
One commit, one push to `claude/er-p3-mock-c3`, handover note `docs/session-handover-2026-10-23-er-p3-c3-toast.md`
with: the diff summary, the sweep list (each site ok/fixed), probe counts, red-first proof (fail on 494b2db4, pass after).
