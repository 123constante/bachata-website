# Handover -- Bristol ambassador shared link landing (W1, ticket dt_0eddba136eff)

Branch `claude/bristol-ambassador-landing`. Design record: `docs/design/bristol-ambassador-landing.md` (inventory first, decisions, walk results, screenshots in `docs/design/bristol-ambassador-landing/`).

## Done
- Route `/join/a/:code` (`src/components/AnimatedRoutes.tsx`, beside `/invite`), lazy page `src/modules/ambassador/link/AmbassadorLinkPage.tsx`.
- ONE mapping `linkLandingModel.ts`: loading / ok (named or "You are invited to") / not_found (+ Contact us) / signed-out (Create account + Sign in, both return here) / signed-in (Join <city>) / joined + already_joined (next step `/app`) / error (Try again). Anonymous, own-link, link-switched-off and failed-join each render one plain sentence.
- `linkApi.ts`: the two RPCs (typed: entries added to `src/integrations/supabase/types.ts` matching prod `p_code text -> jsonb`) and the fixed city chip read from `cities` by slug. Never `search_cities`.
- Breadcrumb id `ambassador.link` ("Your invite") in `src/lib/breadcrumbs/siteIa.ts`.
- Tests `src/modules/ambassador/link/__tests__/`: viewer x shape matrix (3x4), join-once / never-on-render / disabled-with-reason, refusals, model invariants, a no-`search_cities` grep test, and a CitySheetBody test (current inactive city shown first from `currentName`; a search that cannot find it lists only results).
- Walk at 390x844 with mocked RPCs on a stand-in active city: 12 states, all taps 44px, no h-scroll, 0 page errors.

## Left / owner questions
- Done button opens `/app` as the brief says; `/app` is the dancer area and organiser onboarding sits under `/account`. Owner to confirm.
- `already_joined` returns the city of the user's FIRST join (one join per user); the done screen names that city, which can differ from this link's.
- Real link walk: impossible until an ambassador row exists (0 on prod 2026-11-06) and Jan has an account.

## Checks (local, this branch)
- `npm run lint` 34/34 links green; `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:mojibake`: all exit 0.
- tsc (`-p tsconfig.app.json`) run on the final tree: 0 errors in branch files (187 pre-existing lines elsewhere).
- `npm run test:unit`: 26904 passed; 16 failed in 9 files, all environmental in the sandbox: tickets tests (`qrcode-generator` missing from the sandbox node_modules), `*.contract.test.ts` (live DB key: "Invalid API key"), `integrityCouldNotRun` (sandbox has a global typescript in /opt/node-tools). The one real failure (`catchallClientPaths`) was fixed by adding `/join/a/:code`.
- Not run locally: e2e smoke (`test:e2e`, `test:e2e:p3`), db-contract-check (live DB), Vercel preview.

## Next steps
1. Owner answers the `/app` vs `/account` question; adjust `NEXT_STEP_HREF` in `linkLandingModel.ts` if needed.
2. Once Jan is an ambassador, walk the real link signed out -> sign up -> back -> Join on a phone.
