# Handover: organiser area v2, slice 1a (strip, switcher, badge)

Branch `claude/organiser-area-v2-shell`. Ticket dt_8beaef7bf06b.

## Done
- `src/modules/organiser/p3/model/strip.ts` (new, ONE mapping): role word (Owner/Manager only; contributor -> nothing), strip facts, per-page to-dos (Home's Needs you, cancelled events excluded), Switch badge (other organiser pages only), other pages from my_roles_v1.
  Not in the brief's file list: added so the shell does not import the lazy Switch page chunk. Declared here and in the PR.
- `P3Shell.tsx`: `P3RoleStrip` above every screen inside the shell (role-coloured, role word, page name, 44px Switch link with `switch-todo-badge`). No organiser page = no strip.
- `switch/index.tsx`: P3 only (`kind === 'p3'`) -- per-row badge on OTHER organiser pages with to-dos; "Your other pages" lists teacher/DJ/dancer from my_roles_v1, never badged. R1 Switch (flag off) unchanged.
- `labels.ts`: `L.strip` words.
- Tests: strip.matrix (21) + switcher.matrix (9); red against main (strip import fails; 8 switcher cells fail), green after.
- INVENTORY.md at repo root; 17/17 Tests cells anchored.

## Left / next steps
1. Admin column of INVENTORY.md is NOT anchored: this cloud session cannot reach `bachata-admin-11april` (add_repo refused). The lead should fill the two admin rows (brief: "any cell without an anchor is a stop" -- the Tests cells are 17/17; the admin rows are the gap).
2. Walks 1-6 at 390x844 NOT run (no seeded login in the cloud sandbox; context budget). Needed before the owner sees it.
3. Door scanner (`events/:id/door`), `start` and `you/details` are full-screen routes OUTSIDE P3Shell: no strip there. Adding it means editing DoorScreen/OnboardingFlow (not in this brief's file list). Journey 2 "scanner placeholder" is therefore open.
4. "What main lacks" bullet 2 (Tickets/Team tabs, People tab named You) is recorded but NOT changed: the brief's Goal/Boundary do not include renaming tabs, and P3Shell.test pins the four tabs. Lead to decide (likely 1b).
5. Independent review by a different worker (brief gate) not yet done.

## Checks run locally on 5df53af
tsc run on 5df53af: 0 errors in branch files (0 overall). npm run lint: exit 0. check:mojibake, rpc-typing, wallclock-brand, integrity, lint:architecture, legacy-tables, legacy-program-rpcs, check:images (AUDIT_STRICT=1), bom-check: all exit 0.
test:unit: 15 failures in 4 files (eventViewCompat/occurrenceProgram/publicEventPageLineup contract tests, integrityCouldNotRun) -- the same 15 fail on unchanged origin/main in this sandbox (live-DB / environment), none touch this diff.

## PR
#1510 (opened by the repo bot on first push; body updated, both body checkers exit 0). Not ready for owner: walks 1-6 and independent review outstanding.
