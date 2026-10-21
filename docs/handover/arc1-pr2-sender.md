# Arc 1 PR 2, slice B: invite sender + admin request lists (handover)

Branch `claude/arc1-pr2-sender` (from `main` 817a4dd). Brief: admin repo
`brief/arc1-organiser-onboarding-2026-10-21`, `docs/briefs/arc1/arc1-pr2-invite-sender.md`
(read with `arc1-common.md` and `arc1-as-built.md`; as-built wins). No PR is opened from
this sub-branch: the orchestrator merges it into the PR 2 branch.

## Done

- `senderModel.ts` (NEW, pure): chip labels per mockups 5a-5f (`Link ran out` replaces
  `Invite expired`), detail line, the ONE primary button per status (`Invite` / `Copy new link` /
  `Send a new link` / `Add another person`) with its disabled reason, Withdraw only beside a live
  link, the three Invite choices (5b), link-form rules, every RETURNED refusal of
  `admin_issue_organiser_invite_v1` (`invalid_email`, `invalid_first_name`, `city_not_found`)
  mapped to one field + one sentence, parsers for both request lists and both resolve answers,
  empty-state copy.
- `adminApi.ts`: `adminIssueOrganiserInvite({organiserId, email?, firstName?, cityId?})` (switches
  on `ok`/`reason`, raised errors still go to `adminErrorMessage`); the 1-arg
  `issueOrganiserInvite` is gone. Wrappers for `admin_list_invite_requests_v1`,
  `admin_resolve_invite_request_v1`, `admin_list_signup_access_requests_v1`,
  `admin_resolve_signup_access_request_v1`.
- `AdminOrganisersPage.tsx`: one primary button per row -> Invite sheet (Send a link / They already
  have an account / Invite by email) or straight to the link form (Copy new link, Send a new link).
  Link form: email (helper "Check the spelling: this address can then sign up."; empty = unbound
  link, says so), optional first name, optional city (`CityPicker`). Refusals show under their
  field. One-time link: Copy is the primary, shorter text, names the bound address.
- `InviteRequests.tsx` (NEW): "New link requests" and "Access requests" on `/admin/organisers`,
  collapsed with a waiting count. Link request -> "Send a new link" opens that organiser's link form
  (search set to its name), "Mark done" resolves. Access request -> Approve / Dismiss; handled
  ones show their status only. Refusals (`already_handled`, `not_found`, `invalid_action`) in words.
- `InvitePerson.tsx`: optional `fixedOrganiser` (the row's "Invite by email" choice).
- `scripts/lint-runtime-architecture.mjs`: the sender model and its two specs join the
  `organiser_id` allow-list (the Arc 1 RPCs answer with that key; same pattern as `inviteModel.ts`).
- Tests: `senderModel.test.ts` (status x button x disabled reason x Withdraw x chip x detail;
  every issue refusal x field; request parsers; every resolve refusal), `senderPage.test.tsx`
  (sheet, link form, every refusal on screen, both lists), old specs moved to the new controls.
  Red-first: both new files fail on `main` (module absent), pass here.
- Build walk spec `tests/e2e-build/admin-sender.build.spec.ts` (production build, 390x844,
  seeded fixtures for every status + refusals + both lists, no side scroll, no page errors).

## Decisions / deviations to flag

- 5b "Invite by email" hint reads "A ready message for one address." (mockup: "We email the link
  to one address."): `admin_invite_person_v1` sends no email, so the approved wording was fitted
  to the real server behaviour.
- 5f "Owner: Marta" is not shown: `organiser_ownership_v1` returns no owner name. The row says
  "Has an owner. Joined <date>" from the used invite instead.
- "Copy new link" goes through the link form (which says it replaces the live link) rather than a
  separate confirm, so a re-issued link can still be bound to an email.
- No join-notification UI (as-built: no channel was built; "Managed" chip is the signal).
- `inviteModel.ts` (slice A's file) is NOT touched. Its `ACCESS_LABEL`, `rowActions`,
  `statusDetail` are no longer used by the page; slice A or the merge may delete them (their own
  tests still cover them).

## Merge order

The Website calls the 4-arg issue RPC and the request lists. Prod has neither table yet
(checked 2026-10-21). Admin PR 1 (#912) must be applied first, otherwise Make link fails and both
lists show "This list did not load".

## Left / next steps

- Orchestrator: merge into the PR 2 branch with slice A; resolve nothing in `inviteModel.ts`
  (B did not edit it). Re-run `npx vitest run src/modules/admin-organisers` after the merge.
- Reviewer pass + one fix pass per the arc plan.

## CI steps run locally (sandbox, 2026-10-21)

| Workflow / job | Command | Exit |
|---|---|---|
| architecture-guard | `bin/check-integrity.sh` (after `chmod +x`, as CI does) | 0 |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0 |
| architecture-guard | `lint:architecture` | 0 (after the allow-list line) |
| architecture-guard | `AUDIT_STRICT=1 check:images`, `check:image-widths` (+self-test) | 0, 0 |
| architecture-guard | `check:plan-hygiene:self-test`, `check:workflow-artifact-policy` (+self-test) | 0, 0 |
| architecture-guard | `check:mojibake:self-test`, mojibake `git grep` | 0, 0 |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| typecheck (extra) | `tsc -p tsconfig.app.json --noEmit` filtered to touched files | 0 errors (repo has pre-existing `app/` errors; the job is message-scoped) |
| unit-tests | `test:unit:offline` | 1: 5 tests in `tests/integrityCouldNotRun.test.ts` fail identically on untouched `main` in this sandbox (environmental); the 1 picker-registry failure this change caused is fixed; touched suites 292/292 |
| unit-tests | `check:dancer-area-isolation` (+self-test) | 0 |
| lint chain | `npm run lint` | 19/20 links green; the red link is `check:integrity` exit 126 (no exec bit in this clone; passes when run as CI does) |
| perf-budget | build, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` (+self-tests) | 0 |
| perf-budget | `check:doc-weight` | cannot run here: needs GITHUB_REPOSITORY + a preview URL |
| db-contract-check | `check-migration-stamps.mjs` | 0 (other contract steps need live DB secrets: not run) |
| workflow-lint | masking, notification (+self-test), no-preview-prefixes (+self-test) | 0 |
| ci-budget-guard | `check-ci-budget.mjs --self-test` / guard | self-test pass; guard exit 2: needs CI_BUDGET_GITHUB_TOKEN |
| e2e-smoke | `npm run test:e2e` | 157 passed, 1 failed: `organiser-home.spec.ts` "a load failure shows the error state" fails identically on untouched `main` (not this slice) |
| phone-qa build smoke | `playwright --config playwright.build.config.ts tests/e2e-build/admin-sender.build.spec.ts` | pass (new spec) |

## Verified on real data

- Shapes surveyed (prod, read-only counts): `organiser_invites` 2 sent / 3 used / 1 revoked /
  1 expired; 5 organisers with invites (2 have two); 49 organisers, all `live`, no name over 40
  chars; 9 with an owner. `organiser_invite_requests` / `signup_access_requests` do not exist on
  prod yet (PR 1 not applied).
- Checks run: table-driven `senderModel.test.ts` (every status x button x disabled reason;
  every issue refusal x field; every resolve refusal) red on `main`, green here; page specs;
  production-build walk at 390x844 with seeded fixtures for unclaimed / revoked / invited /
  expired / managed / draft, a returned refusal, a bound link, both lists, no side scroll, no
  page errors (screens 5a-5f, link form, lists).
- NOT verified: against the real PR 1 RPCs (mocked at the RPC boundary per the brief); real
  WhatsApp hand-off and clipboard on a phone; real phone keyboard; the CityPicker search
  against live cities; Vercel preview (no push yet at writing; VERCEL_TOKEN not used).
- Not reviewed yet: `/code-review` is the next worker's job per the arc plan.

## Phone QA

- Sizes checked: 390x844 (production build, Playwright Pixel 7 profile).
- Walked: /admin/organisers list, rows in every status, Invite sheet, link form (refusal, bound
  link), one-time link, Copy new link (replace note), both request lists, request -> link form.
- Not verified: real phone, 360x640.
