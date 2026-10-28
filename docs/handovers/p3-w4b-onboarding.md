# Handover: P3 W4b build 1 - onboarding + claim states in the P3 look

Branch `claude/p3-w4b-onboarding` (from `main` at `48087d5`). Brief: `docs/briefs/p3-w4b-onboarding.md`
on `brief/p3-w4b-onboarding`. Design record: `docs/design/p3-w4b-onboarding.md`. Flag `organiserP3`
stays OFF; R1 (`/account/o`) keeps today's behaviour, proven by tests.

## Done

- Data source proven on prod (read-only): the gate is `_require_complete_dancer_profile_v1` ->
  `profile_complete_v1` over `dancer_profiles.first_name / based_city_id / dance_role / avatar_url`
  of the persona `_dancer_profile_id_for_account_v1(auth.uid())`; the client fact reads the same.
  Counts re-run: 42 / 30 no page / 10 unfinished (8 row + 2 no row) / 28 brand new / 2 open.
- RED FIRST commit `9192246`: gate matrix (7 completeness shapes x Claim / Ask to join / Create, plus R1
  unchanged), 9 red on the unfixed code, then green.
- P3 Welcome / Add a page at `/account/p3/you/add`; P3 Home with no page redirects there; You and
  Switch "Add a page" point there. Same OnboardingView / OrganiserSheet / SignOutLine with a `look`;
  portalled sheets in P3 tokens (`ui/sheetLook.ts`), focus with preventScroll; the tap gate
  (`onboarding/profileGate.ts`); claim / create land on P3 Home with the confirmation (`p3-ok`);
  ask to join ends on P3 Done whose "Go back" returns to Welcome.
- Walk `tests/e2e/walk-p3-w4b-onboarding.spec.ts` (in the `test:e2e` list): 12 tests, light + dark,
  green twice in a row with both flags on. It found and fixed: a 23px "create it as a new organiser"
  link (now 44px in P3), and a race where P3 Home bounced a fresh claim back to Welcome (unit test red
  on the unfixed Home, then green).

## Left / next

- The walk SKIPS in the e2e gate today: e2e-smoke's dev server has `organiserP3` off, so
  `/account/p3` is not mounted. Turning it on there (or a second server) is a separate call.
- Orchestrator walk on the Vercel preview; one independent review + one fix round (brief's stopping rule).
- Not built (owner decisions): return task-carry through `returnTo`; server auto-create of a missing
  dancer row; go-live, role question, Dancer4 (next cluster).

## State at hand-off

- PR #1118 (bot-opened, body rewritten with the literal "Verified on real data" / "Phone QA" lines
  and the per-job table). Not docs-only, so no automerge label. Never merged or approved here.
- Sandbox CI: every step green except 17 unit tests in 5 files that fail identically on `main` here
  (integrity temp-repo + live-DB contract suites, environment). `/app/*` first load 373.6 KB on both.
- Next steps: the orchestrator walk on the preview with `organiserP3` on, one independent review,
  one fix round.
