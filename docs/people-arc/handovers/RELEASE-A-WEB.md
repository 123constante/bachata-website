# RELEASE-A-WEB handover (integration + D55/D56/D72)

Branch `claude/people-release-a-web`, from `origin/main` 03f37b45. One push, no PR (D73: the orchestrator opens it;
#846, #863, #865 close as superseded).

## Done

### 1. Integration (recipe from the brief, heads did NOT move)
| slice | branch | head merged |
|---|---|---|
| A-WEB2 | `claude/people-a-web2-invites` | 70966afc |
| A-WEB1a | `claude/people-a-web1a-golive` | 78d94164 |
| A-WEB1b | `claude/people-a-web1b-wizard` | a4f430c4 |

web2 and 1a merged clean. 1b had the ONE expected conflict, `src/modules/organiser/shell/__tests__/noHandBuiltLinks.test.ts`
(both sides add `KNOWN['shared/profileProgress.ts']`): kept A-WEB1a's side (`git checkout --ours`), one entry.

### 2a. `email_unproven` on the invite landing (D56)
- Redeem caller: `InviteRedeemPage.tsx` -> `interpretRedeemWithMismatch` (`redeemMismatch.ts`), A-WEB2's wrapper over
  R1's `interpretRedeem`/`REDEEM_COPY`. The new reason goes in that wrapper, NOT in R1's `inviteModel.ts` (the file's own
  header says inviteModel belongs to organiser R1; same reason A-WEB2 put `email_mismatch` there). One place reads it.
- `redeemMismatch.ts`: `EMAIL_UNPROVEN_REASON`, `EMAIL_UNPROVEN_COPY` {title "Use the email link", body "Sign in with the
  email link to accept this invite." (D56 words), not terminal: the link stays usable}, `SIGN_IN_AGAIN_REASONS`
  (mismatch + unproven). Checked before the mismatch branch; no hint is ever read for it.
- `InviteRedeemPage.tsx`: the sign-out control now shows for both reasons (state holds the reason, not a boolean); for
  `email_unproven` it reads "Sign in with the email link" (it signs out, then opens THIS invite's sign-in, link unused);
  for `email_mismatch` it still reads "Sign out". The body names no control.
- `src/lib/claimMyDancerProfile.ts` uses the same word `email_unproven` (dancer self-claim status). It shows NO copy
  (silent by design), so there is no second copy map to share or drift.
- Test `src/modules/admin-organisers/__tests__/redeemUnproven.test.tsx` (table: unproven, unproven + stray hint,
  mismatch without hint; interpreter + landing render + button -> `/auth?mode=signin&returnTo=/invite/<token>`, sign-out
  once, redeem called once). **Red first** on the merged tree: `Tests 4 failed | 2 passed` (`expected 'failed' to be
  'refused'`: the person saw "Something went wrong"). Green after.

### 2b. Go live labels, all nine codes (D55)
- A-WEB1a ALREADY carried the three new labels (`name` "An event name", `country` "A city with a country on file",
  `organiser` "An active organiser") and the `basics`/`organisers` sections in `goLiveFixHref`; words checked identical
  to admin `lib/goLiveCheck.ts` on `claude/people-release-a-admin`. So no product change was needed here.
- New table in `src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx` ("D55: ..."): the nine codes in server
  order; each renders its label, links to its screen with `returnTo` this event, and a TAP on it lands on a screen that
  shows the named control (`org-detail-name`, `org-detail-venue`, the about editor input, programme/dates/cover/
  organisers screens); all nine at once keep server order; an unknown code+section shows "Something else on the event",
  no link, never the raw code.
- **Red first: NOT possible on the merged tree** (green on first run; A-WEB1a had done it). Non-vacuity shown by mutation
  instead: deleting the `name` label, deleting the `organisers` section link and making unknown codes show the code ->
  `Tests 3 failed | 9 passed` (name, organiser, unknown rows). Restored, green.

### 3. D72 country copy pin
`src/modules/organiser/wizard/__tests__/wizardCountries.pin.test.ts`: `wizardCountries()` equals `loadCountries()` (codes and
names, same order, > 190 entries). Mutations: dropping the `unMember` filter (250 vs 195) and renaming Palestine both
red. Note: removing the Vatican override line does NOT red it: world-countries already marks VA as a UN member entry,
so both copies' VA override is currently a no-op (harmless; not changed).

### 4. A branch-only red, fixed
`check:images` (AUDIT_STRICT=1) failed on A-WEB1b's `src/modules/organiser/wizard/stepKinds.tsx:271` (img without
`loading`). The file does not exist on main, so red only here: added `loading="eager"` (the just-uploaded photo preview,
above the fold). Re-run: 0 missing.

## CI table (sandbox, merged tree)
| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity | `bin/check-integrity.sh` (via bash) | 0 |
| architecture-guard | legacy-tables / legacy-program-rpcs | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | image audit | `AUDIT_STRICT=1 npm run check:images` | 1 -> fixed (above) -> 0 |
| architecture-guard | image widths, plan hygiene canary, artifact policy, mojibake canary + guard, entry-point | as in the workflow | all 0 |
| typecheck | rpc typing / wallclock brand | `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| (pre-ship ratchet) | tsc | `npm run typecheck` | 2: 99 errors; clean origin/main also 99 (same files, line shifts only): ratchet holds |
| workflow-lint | masking, notification (+canary), no-preview (+canary) | as in the workflow | all 0 |
| lint chain | `npm run lint` | | 1: only `check:integrity` exit 126 (known sandbox missing exec bit); after `chmod +x bin/*.sh .githooks/*`, `npm run check:integrity` = 0 (modes restored, not committed). Every other link PASS |
| unit-tests | offline | `npm run test:unit:offline` | 1: 7 failed; same files red on clean main (`integrityCouldNotRun` x5 sandbox TS-helper, `SurnameSwitchReachable` x2) + `auth.today` snapshot that is red on main and passes alone here |
| unit-tests | unit | `npm run test:unit` | 1: 17 failed: the above + live-DB `*.contract` suites (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`: 10 red on clean main too, CI gates them on secrets) + `dancerPage.today` (passes alone: 50/50) |
| unit-tests | timing | `npm run test:unit:timing` | 0 |
| perf-budget | canaries | bundle-budget / first-load-requests / chunk-cycles self-tests | 0 |
| perf-budget | PRODUCTION build | `npm run build` | 0 |
| perf-budget | bundle budget / first-load pin / chunk cycles | `npm run check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 |
| db-contract | migration authority | `node scripts/check-migration-stamps.mjs` | 0 |
| e2e-smoke | curated smoke | `npm run test:e2e` | 1: 155 passed, 3 failed, 1 skipped (see E2E below) |
| phone-qa | full phone suite, build smoke | `playwright.phone.config.ts`, `playwright.build.config.ts` | NOT RUN in full (time; only the temporary screenshot spec ran: 2 passed) |
| db-contract live steps, types-drift, og/seo, real-data/phone-qa-section (PR body) | | | NOT RUN: need secrets / a deploy / a PR |

E2E (`npm run test:e2e`, 10.1 min): 3 failed in the full run. Re-run alone on this branch: `dancer-app/home-nights.spec.ts:75` and
`organiser-layout.spec.ts:171` PASS (load under the full run); `organiser-home.spec.ts:55` ("a load failure shows the error
state and Retry recovers") still fails, and fails identically on clean `origin/main` 03f37b45: not this branch's.

## Screens (`docs/people-arc/screens/RELEASE-A-WEB/`, 390x844, phone harness with a fake Supabase, temporary spec not committed)
- `golive-three-new-codes.png`: draft event, Go live list "An event name", "A city with a country on file", "An active
  organiser" (each 336x52 px row with a chevron link) + "A ticket link / Recommended".
- `invite-email-unproven.png`: "Use the email link" / "Sign in with the email link to accept this invite." Button
  "Sign in with the email link" 353x44 px; `elementFromPoint` at its centre hits it.
- frontend-design skill: not loaded (no new screens or primitives; one copy row and one button label inside existing
  ones).

## Verified
- Merge recipe, one conflict resolved as specified; all three heads as the brief expected.
- D56 red -> green; D55 nine-code table + mutation proof; D72 pin + mutation proof.
- Production build + bundle budget + first-load pin + chunk cycles green; tsc count equal to main.

## Not verified
- No real-data walk: `email_unproven` and the D55 codes are on the E2E path only, not prod (admin #877); everything is
  against fakes at the boundary.
- 360x640 screenshots, full phone suite, Vercel preview (no push before this one).
- Supabase not queried (no shape survey needed for copy/label mapping; nothing written).

## Next steps
Independent review, then ONE fix pass. Orchestrator opens the single Website PR from this branch (fill the PR's
"Verified on real data" and Phone QA sections).
