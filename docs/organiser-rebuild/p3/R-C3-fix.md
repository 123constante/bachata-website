# C3 fix pass (one pass, then the owner sees it)

Lane: NORMAL (mockup only, no app code, no DB). Branch `claude/er-p3-mock-c3` (head `5c52b54f`). Edit ONLY
`docs/organiser-rebuild/p3/mockups/C3.html` and `C3.md` (+ your self-check script if you keep one in the repo). ONE push.

Read first: the independent critique `origin/claude/er-p3-critique-c3:docs/organiser-rebuild/p3/CRITIQUE-C3.md` (the work
list), then `M-C3.md`, `M-C2.md`, `DESIGN-COMMON.md` on this brief branch, and C3.html in full. This is NOT a redesign:
C2's look, tokens, tabs, Home and date strip stay.

## Do (binding)
1. Every **MUST** item in CRITIQUE-C3.md section 2 (#1-#23), using the critique's exact fix unless a decision below says otherwise.
2. Section 3 "Lost from C2": restore the event page "Pause this event" (via #13's Status row), the public preview Line-up
   block, and the empty line-up copy "Nobody yet. Search below to add a teacher or DJ."
3. Section 4: correct C3.md's GAP table so nothing is overclaimed: each listed number is either fixed by this pass or moved
   to an honest "Open / phase 4" list (#71 grouping-by-kind = a recorded deviation for the owner, not "done").
4. LATER items #24-#30: do #29 (polish) and #30 (desktop leftovers) if they fit; leave the rest listed as open in C3.md.

## Decisions (orchestrator, overriding the critique)
- **#14 town vs city:** the brief pins "Ask us to change the city" (M-C3.md line 50). Use **"City"** everywhere (row labels
  "Town" -> "City", profile, festival). All other #14 words as the critique says ("Line-up", "Party", "Finished", "Dates I
  pick", one level list, "How many classes", "Last date it ran").
- **#2 roles:** use the noun map: "Marco & Sofia, teachers" / "DJ Kizzy, DJ" / "Pao Pao Army, performers".
- **#4:** a date has no time of its own. Move = another day only, Add a date = date only, every time shown comes from
  `span(dsess(e, x))`. The date sheet time control is "Change the time on this date" (moves every session).
- **#13 / #12 density:** apply the critique's smallest cuts. Every MUST row stays reachable; say in C3.md where each one moved.

## Gates (prove them, measured)
- Red first: for #4, #5, #6, #15, #17, #18 add a logic probe that FAILS on 5c52b54f and PASSES after (say so per probe).
- Re-run C3's full self-check: every state x 390x844, 360x640, 1280x800 x light/dark + keyboard states: contrast >= 4.5
  (3 at >= 24px), taps >= 44, no sideways scroll (the date strip excepted), nothing under a bar, 0 console errors, and a new
  check: no `.ses` row whose title and detail sit on one line (K1). On desktop, the toast must be inside the viewport.
- All previous logic probes (52) still pass.
- Update C3.md: what changed (critique # -> done), the 5-step Owner tour (still works, re-run it), measured numbers,
  Verified / Not verified.

## Output
Commit + push `claude/er-p3-mock-c3` once; final subject ends with the done marker. No PR.
