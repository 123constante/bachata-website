## Summary

Arc 1 PR 2, slice B (invite sender): one Invite button per organiser row, a link form that can bind a link to an email, and the two admin request lists ("New link requests", "Access requests") on `/admin/organisers`. Fix pass after the independent review (F6, F7, F8).

Merge order: admin PR 1 (#912) must be applied first. The Website calls the 4-arg issue RPC and both request lists, and prod has neither table yet.

Fix pass:
- F6: "Send a new link" on a link request now starts the form with that request's email, so the new link stays bound.
- F7: first name and city are disabled while the email is empty, with the visible reason "Add their email to pre-fill these".
- F8: wording not changed. Two drifts are owner decisions (below).

## Owner decisions needed (F8, wording drift)

1. 5b third choice hint: mockup says "We email the link to one address."; built says "A ready message for one address." because `admin_invite_person_v1` sends no email. Keep the built wording, or change the mockup/server?
2. 5f detail: mockup says "Owner: Marta. Joined 21 Oct."; built says "Has an owner. Joined 21 Oct." because no RPC returns the owner's name here. Keep, or add the name to an RPC?

## Verified on real data

Shapes surveyed: prod, read-only counts. `organiser_invites`: 2 sent / 3 used / 1 revoked / 1 expired; 5 organisers with invites (2 have two); 49 organisers, all `live`, no name over 40 chars; 9 with an owner. `organiser_invite_requests` and `signup_access_requests` do not exist on prod yet (PR 1 not applied).
Checks run: table-driven `senderModel.test.ts` (every status x button x disabled reason; every issue refusal x field; every resolve refusal) and `senderPage.test.tsx`, including the new F6 table (bound / unbound request) and F7 table (empty / blank / filled email), both red before the fix. `npx vitest run src/modules/admin-organisers` 271/271. Typecheck clean for touched files. CI steps per job in the table below.
NOT verified: against the real PR 1 RPCs (mocked at the RPC boundary); real WhatsApp hand-off and clipboard on a phone; real phone keyboard; CityPicker search against live cities; Vercel preview.

## Phone QA

Sizes checked: 390x844 (production build, Playwright Pixel 7 profile).
Walked: /admin/organisers list, rows in every status, Invite sheet, link form (refusal, bound link, request-prefilled email, disabled first name/city with reason), one-time link, Copy new link, both request lists, request -> link form.
Not verified: real phone, 360x640.

## CI steps run locally (sandbox, 2026-10-21)

| Workflow / job | Command | Exit |
|---|---|---|
| architecture-guard | `bin/check-integrity.sh` (after `chmod +x`, as CI does) | 0 |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0 |
| architecture-guard | `lint:architecture` | 0 |
| architecture-guard | `AUDIT_STRICT=1 check:images`, `check:image-widths` (+self-test) | 0, 0 |
| architecture-guard | `check:plan-hygiene:self-test`, `check:workflow-artifact-policy` (+self-test) | 0, 0 |
| architecture-guard | `check:mojibake:self-test`, mojibake `git grep` | 0, 0 |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| typecheck (extra) | `tsc -p tsconfig.app.json --noEmit` filtered to touched files | 0 errors (pre-existing `app/` errors) |
| unit-tests | `test:unit:offline` | 5 environmental failures in `tests/integrityCouldNotRun.test.ts`, identical on untouched `main`; touched suites green |
| lint chain | `npm run lint` | 19/20; red link is `check:integrity` exit 126 (no exec bit; passes as CI runs it) |
| perf-budget | build, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | see fix-pass results in the handover |
| perf-budget | `check:doc-weight` | cannot run here (needs preview URL) |
| db-contract-check | `check-migration-stamps.mjs` | 0 (live-DB steps not run) |
| e2e-smoke | `npm run test:e2e` | 157 pass, 1 fail on untouched `main` too (`organiser-home.spec.ts`) |
| phone-qa build smoke | `admin-sender.build.spec.ts` | pass |
