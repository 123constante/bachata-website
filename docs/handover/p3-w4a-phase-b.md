# Handover: P3 W4a Phase B (build) &mdash; 2026-10-27

Branch `claude/p3-w4a-team-switch-page`, PR #1080 (draft). Ticket dt_1d082cbbafb4. Brief:
`brief/p3-w4a-team-switch-page:docs/briefs/p3-w4a-phase-b.md`. Owner pick: mockup **A** (You hub).

## How it is built (re-skin, not a rebuild)
- `shell/surface.tsx`: an `OrgSurface` context = the frame (`Shell`), the links (`paths`), the hub
  (where Team/Switch/Page go back to), hand-over's back, Add a page, and Done's way back.
  Default `R1_SURFACE` = exactly the old values, so `/account/o` is unchanged.
- The R1 screens (`team/index`, `Person`, `AddSomeone`, `flows/handover/ToWhom|Confirm`, `switch/index`,
  `switch/Welcome`, `page/index` + `useOwnPage`) read shell + paths from the surface instead of
  importing `OrganiserShell`/`ORG_PATHS`. Hooks, RPC wrappers, strings and their tests are untouched.
- `p3/you/surface.tsx`: `P3_SURFACE` + `P3PushedShell` (P3 top bar: back + title) + the `/you`
  layout route. p3.css already defines the token NAMES the R1 primitives read (`--fg`, `--card`,
  `--r-card`, `--r-ctl`, ...), so the shared screens take P3 colours/radii with no second token file.
- `p3/you/YouScreen.tsx`: the hub (page card, rows, Account and help). `p3/you/youRows.ts`: the
  row list as DATA, one entry per row. **Get paid (W-T ticketing) = one more `YOU_ROWS` entry.**
- P3-only differences (`surface.kind === 'p3'`): Contributor sees Add someone DISABLED with
  `ADD_ROLE_REASON` (owner pick; R1 still hides it); no page chips on Team (Switch page decides);
  Switch rows mark the shown page "Showing"; Welcome 7c says "Switch any time from You".
- Routes (`/account/p3/you/...`): `switch`, `welcome?o=`, `page`, `team`, `team/add`, `team/:userId`,
  `handover`, `handover/:userId`. `placeholders.tsx` deleted (You is no longer a placeholder).

## Done
- Prod shape survey (read-only counts) &mdash; table in the PR body.
- Matrix: `p3/you/__tests__/you.matrix.test.tsx` (33 tests: rows x shape, hub, Team, Person, Add,
  Hand over, Switch, Page, Welcome); `P3Shell.test.tsx` updated (pushed screen = one top bar).
- CI steps run locally: per-job table in the PR body.

## Left / next steps
1. **Walk at 390x844** as the walk account (flags organiserP3 + organiserSelfServe), light + dark,
   incl. the page editor's edit-in-place sheets inside the P3 frame (not walked here).
2. **Done screen is still R1's** after Remove / Make Manager / Hand over / Add / page Save: its primary
   returns into P3 (Team or Organiser page), but the Done page itself shows the R1 look, and its
   "Back to Home" goes to R1 Home. A P3 Done (or toast) is the follow-up.
3. Account and help, Message us, Add a page, Add an event, the profile wizard and Leave still open
   R1 screens (no P3 equivalents yet).
4. **Event flyer (`cover/:seriesId`)**: W2a's event page shows the cover but has no flyer picker;
   not built here (brief: list it). It belongs to the Events tab (W2a follow-up).
5. Independent critique + `/code-review` before merge (not run by this worker).
6. `contract-check` is red on `main` too (prod DDL drift / missing RPC / OG bake 403): admin-repo work.
