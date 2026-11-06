# Brief: Confirm step before "Add someone" makes a person a Manager

Brief-version: 2
Repo: Website. Branch: claude/team-add-confirm. Lane: normal, Sonnet. No database change.

NOTE: #1412 (team screens name the page) is MERGED on main (2026-11-06); build on it. PR #1412 (branch claude/team-page-name-requests-error) is open (checked 2026-11-06) and edits src/modules/organiser/team/index.tsx, AddSomeone.tsx and p3TeamBits.tsx. Do not start, and do not branch, until `gh pr list --state merged` shows #1412. Then branch from fresh origin/main and re-read these files: the line numbers below are from main before #1412.

## What main lacks
- A confirmation before the add. In AddSomeone.tsx one tap on a face (`tap`, ~line 104, `add.mutate` with role 'manager') or on a search result (~line 144, same `tap`) calls `addTeamMemberByProfile` at once and goes to Done "<name> is a Manager". The only hint is the face's aria-label "Add <name> as Manager" -- grep: add-confirm
- The question's words: "Add <name> as Manager of <page>?" with Add and Cancel -- grep: addConfirmTitle
- A table test over who is shown and what each tap does -- src/modules/organiser/team/__tests__/AddConfirm.matrix.test.tsx
- extends: Already on main, keep: who may add (`allowed` = owner or manager), `canAdd === false` faces share an invite and write nothing, team-full disabling, `addErrorMessage`, the Done screen -- extends: src/modules/organiser/team/AddSomeone.tsx

## Files
src/modules/organiser/team/AddSomeone.tsx (edit, after #1412), src/modules/organiser/team/AddConfirm.tsx (new, small), src/modules/organiser/team/__tests__/AddConfirm.matrix.test.tsx (new), src/modules/organiser/team/__tests__/Team.test.tsx and TeamFixPass.test.tsx (edit ONLY where they assume one tap = one add), docs/design/team-add-confirm.md (new design record).
Do NOT touch the calendar density-exclusion files in CLAUDE.md. HTML entities in JSX, no raw Unicode punctuation.

## What to build
0. Write INVENTORY.md first (docs/design/team-add-confirm-INVENTORY.md): every field, state and option of the Add someone flow from the admin app, the current Website and the public page, each with file:line, GAPs listed. Build only after it exists, and end the PR body with the coverage count.
1. A confirm sheet or inline panel opened by a tap on an addable face or search result (only when `canAdd !== false`; the Invite path is unchanged and needs no confirm). Title `Add <name> as Manager of <page name>?`, two buttons: Add (calls the existing mutation with the same args) and Cancel (closes, writes nothing, focus returns to the tapped face). Both buttons min-h 44px with explicit px sizes (the site's root font is ~13.5px on phones), compact per .claude/rules/design-density.md. Add shows a pending label and is disabled while the mutation runs; Escape and backdrop tap = Cancel.
2. Failure and state handling. A failed add closes the panel and shows the existing `add-error` line (including `team_full`, which keeps Add disabled); the person stays on the wall, so a retry needs a fresh tap. If the team becomes full while the panel is open, Add is disabled with the existing full reason. Page name missing: say "this page".
3. No change to who may add, to the RPC, to the Done message or to the Invite path. Open-then-Cancel sends nothing.
4. Design record docs/design/team-add-confirm.md: brief (4 lines), ONE chosen design with why (suggested: a bottom sheet using the existing sheet primitive if `../ui` has one, so it matches other confirms; the lead may overrule), and two rejected alternatives in two lines each (inline confirm row under the face; a browser confirm()).
Tests, RED FIRST (run on the code before the change and show them fail): table of person state x viewer role. Viewer owner or manager (confirm shows); member or no role (read-only line, no faces). Person states: addable face; addable search result; `canAdd === false` face (invite, no confirm); person already on the team (filtered from wall and results, typing their name shows "No one found"); team full; short or empty name; page name missing. Actions: Add (exactly one `addTeamMemberByProfile` call, role manager, then Done); Cancel (zero calls); Escape (zero calls); failed add (error line, panel closed, no Done); `team_full` failure (Add stays disabled). Assert both buttons are at least 44px high the way the repo's other tests do.

## Out of scope
No database change. No change to roles offered (Manager only). No change to Team index or Person screens. Walk at 390x844 on a prod-shaped team (owner + managers + member, near the team cap, and a page with a very long name).
Hand-off: Verified / Not verified block, design record linked in the PR body.
