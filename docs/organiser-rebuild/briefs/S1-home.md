# Brief S1 -- Home and Switch page

Repo `123constante/bachata-website`, branch `claude/org-r1-home`, base `feat/organiser-r1` (wave 2, after S0a + S0b are merged there). READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` applies with `<X>` = S1; plan = `docs/organiser-rebuild/R1-PLAN.md`. Sections: 4.1 (Home jobs, One-event organiser), 4.3 #3 #2, 4.4 (S1 row), 4.5 Home matrix (consumer side), 3.12 D33-D37, 3.14 D38, 4.12 R3-4, D22, D24, D28, D32.

## Owns (4.4 row)
`home/index.tsx`, `home/homeView.ts`, `home/useHomeData.ts`, `home/OrganiserStatusCard.tsx` (DELETE), `switch/**` (move `profile/OrganiserSwitcher.tsx` + `profile/useOrganiserChoice.ts` here as `switch/index.tsx` + `switch/useOrganiserChoice.ts`; `git mv`, keep behaviour), tests. NOT `home/onboarding/**` (S9's). Reads S0a `shell/paths.ts`, S0b `jobs/homeJobs.ts`, `shared/homeModel.ts`, `shared/support.ts`.

## Boards (3.14 C0 group; 3.12 D36/D37)
- **C1 Home, running page** (D37): the page name as a 44px link to Switch (`/switch`) when the login has more than one page; a numbered list of the day's jobs from `homeJobs()` in its order (1 Change a date, 2 Add a date, 3 Cancel a date, then every problem row as a further numbered row, tone `problem`); gold "New event" button under it (`/new/what`); then two rows of two small buttons: Team - My page, My events - More (D38). No Tonight card (D37), no section labels (D22), no sentences (D28); nothing when all is fine beyond the three jobs.
- **C1b Home, brand-new page** (D36, Home 10): the four first-steps jobs as the numbered list (`create_first_event` -> `/new/what`, `add_cover` -> `/cover/:seriesId`, `show_whatsapp` -> `/page`, `add_manager` -> `/team/add`), gold New event, the same four small buttons. Support rows (D7) from `supportLinks()`, hidden when null.
- **C35 Switch page**: the login's pages as rows (name, role, Live chip), tap = choose, back = Home. Reuses the moved switcher + `useOrganiserChoice`.
- **C34 stale-link refusal**: a Home link to a date that has passed shows the `eventState.ts:75` text verbatim with one button Home (the shared refusal shape; S2/S3 reuse it by import from `home/StaleLink.tsx`, yours).

## Rules
- Every fact on Home comes from `homeJobs()` / `seriesChip()` (one mapping); Home never computes a count itself. `useHomeData` keeps `organiser_home_v1` + the access-request read through `selfServeApi.ts`, filters with `isListedSeries` (R3-4), and exposes `today` from `ui/londonDate.ts`.
- One-event organiser (D34): the `change`/`add`/`cancel` job `to` already points past "which event" when exactly one series qualifies (S0b computes it; you render what it gives).
- Every tap target >= 44px; the numbered list rows are buttons, not links styled as text.

## Tests (RED first on the pre-slice tree)
Table-driven render over the S0b fixture shapes: each row's text equals the `Job.title` and the tap navigates to `Job.to` (rpc + router spies); the 45/40-archived page renders 5 series rows; the no-series page renders C1b with exactly four numbered rows + New event; support rows absent when env vars are absent; the Switch link renders only with 2+ pages; no `SectionLabel`/`StatusTag` import under `home/` or `switch/` (D22); clock frozen. `tests/e2e/organiser-home.spec.ts` keeps passing with updated expectations (S8 rewrites it for the full matrix).
