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

## Fix 2 (2026-10-27, ticket dt_767e21953edc; brief `p3-w4a-fix2.md`)
Done:
1. **bundle-budget green** without touching any budget, puller or chunk allowance. `/app/*` loads the
   catch-all's `AnimatedRoutes` chunk, whose `__vite__mapDeps` list names every chunk P3Routes imports
   statically. The You hub (`YouScreen`), one event's page (`EventPage`) and All dates (`AllDatesScreen`)
   now load lazily in `P3Routes.tsx` (W3a's pattern from `46e4efc`: `lazyWithRetry` + `<Suspense>`).
   dancer-app is 374.1 KB on main and was 374.1 KB here before; now it is **373.9 KB** (budget 374).
   `check:chunk-cycles` passes. Heads-up: W3a (#1082) changes the same `P3Routes.tsx` imports, so
   whichever lands second gets a small merge conflict there.
2. **Walk defects** (tests red first: 6 of 6 failed on the unfixed code; `you.matrix.test.tsx`, "W4a fix 2"):
   a. Page name invisible: `src/index.css` `h2 { color: hsl(var(--foreground)) }` (the site's near-white)
      beat the card's inherited `--fg`. The P3 `page-name` now carries `text-[var(--fg)]`, and a computed
      contrast check (from `p3.css`, light and dark) covers it.
   b. First card under the bar: pushed screens' `<main>` gets `.p3-main-pushed` (16px top padding).
      **Could not reproduce the clip** on the fake-Supabase organiser at 390x844: card top was 68px and the
      bar ends at 56px. With the fix it is 72px. Needs a re-walk on real data.
   c. "Add a page" (Switch) uses `--gold-fg` in P3 (#a8461a light, #f5865a dark), 44px tall. R1 keeps `--gold`.
3. `contract-check`: same failure as main (og-render bake pipeline: 2 of 5 recent errors are HTTP 403
   bake-transport failures). Not this PR's.

Left: orchestrator re-walk on real data (item b especially); the Done-screen (R1 look) item stays queued;
`/code-review` not run by this worker.
