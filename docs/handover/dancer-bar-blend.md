# Handover: dancer bar blend &mdash; one Back, no box (behind flags.personHub)

Ticket dt_b9192c70afac. Branch `claude/dancer-bar-blend` off `main` at ca75415 (#956 merged). Brief:
`brief/dancer-bar-blend:briefs/dancer-bar-blend.md`. Design Gate + numbers + pictures:
[`docs/people-arc/dancer-bar-blend.md`](../people-arc/dancer-bar-blend.md) (not `docs/design/`: see its first lines).

## Done

1. **Hard-edged box &rarr; blended.** On `/dancers/:id` (flag ON) the warm ground is its own `aria-hidden` layer
   behind the bar, faded out over 24 px at both sides (mask) and over 32 px at the bottom (fill), in over 12 px at
   the top. Text and pills are never masked. `DancerRoleBar.tsx` + `roleBarModel.ts` in
   `src/modules/dancer-app/public-page/`. Real app, 390x844 and 360x640, 5 prod dancers: colour at the screen
   edge mid-bar rgb(30,20,16) warm &rarr; rgb(7,24,30) (page teal rgb(6,25,31)); largest one-row step down 2 &rarr; 1,
   across 2; scrollWidth = viewport.
2. **Two Backs &rarr; one.** While the bar is on screen the card drops its own Back (`PublicDancerPageV2` prop
   `back`, default true = today). No bar (no public role, reads not answered yet, a /people tab) = today's Back.
3. **STYLE (and DANCER, Dancing, Level, SPEAKS) label contrast** 3.66 / 4.04 &rarr; 4.62 on the lightest hero stop
   (`#F5FDFE`), behind the flag (Owner call 1).
4. **Tests, red first:** `src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx` (52 cases). On main 14 failed.

Flag OFF: same DOM as today (the `dancerPage.today`, `embedded` and `f13` suites pass unchanged).

## Owner calls

1. Label contrast is behind `flags.personHub` because the brief also says flag OFF must be byte-for-byte. Say
   if you want it live now (one line: `labelColor` returns `LABEL_AA`).
2. `useDancerRoleBar` repeats the person-page `RoleSwitch` gate (3 lines): a dancer-area PR cannot touch
   `person-page/*` (not seams). Allow `src/modules/person-page/RoleSwitchBar.tsx` as a seam and it folds into
   one shared hook.
3. The teacher page's bar (via `AlsoRoles`) still has the #956 ground (no side fade); teacher pages are closed.
4. Labels are now a touch lighter than the values under them: any colour that clears 4.5 on `#1C7D93` is lighter
   than `#EAF7FA`. Size and weight (11 px caps vs 15 px extrabold) still carry the hierarchy.
5. Value text `#EAF7FA` reads 4.36 and the role line `#DDF6F8` 4.23 on the lightest stop (strict rule); on their
   real pixels they are far above 4.5. Not in the brief; not changed.
6. With the flag ON and v2 closed / its read failed (legacy dancer page), the bar is still the #956 one via `AlsoRoles`.

## Review

/code-review x2 (high), stopping rule: user-facing = two rounds; fixes to round 2 are unreviewed code.
Round 1 (9 findings), fixed: docs moved under an isolation-allowed prefix; the hook honours the `embedded`
prop (new test); reads only on the public-page branch; flag-OFF tests set and restore the flag; flag-OFF label
test pins today's hex, not "below 4.5". Declined: duplicate gate (Owner call 2), teacher/DJ bars (out of brief,
Owner call 3), label lighter than value (Owner call 4), the Back moving when the bar arrives after the client
reads (the #956 bar already inserts after the reads; the card's Back is the right one until then, and a
placeholder would show a Back that may not exist). Round 2 (8 findings, last round): no code change. Declined:
the Back swapping when the bar arrives (as above; a test of the sequence was not added, the two states are each
covered), "no Back to /dancers" (owner's pick: keep "Back to &lt;name&gt;", drop the page's Back), copied gate and
gradient and the call-site flag branch (Owner call 2: person-page is not a seam), values at 4.36 (Owner call 5),
`embedded` + `back` both hiding Back (two callers' facts; kept explicit).

## CI, every applicable job step run in the sandbox (final tree)

| Job (workflow) | Command | Exit | Note |
|---|---|---|---|
| typecheck | `check:rpc-typing`; `check:wallclock-brand` | 0; 0 | `tsc -p tsconfig.app.json`: 100 errors on main, 100 here (none in changed files; not a CI step) |
| unit-tests | `npm run test:unit:offline` | 1 | 12365 passed, 5 failed, all `tests/integrityCouldNotRun.test.ts` (sandbox precondition, also red in #956's runs; no file of ours). Changed-area suites on the final tree: `src/modules/dancer-app/public-page` 208/208 |
| unit-tests | `check-dancer-area-isolation --self-test`; `check:dancer-area-isolation` | 0; 0 | "dancer-area PR: rules a+b+c ... OK" |
| architecture-guard | `bash bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths` (+self-test), `check:plan-hygiene:self-test`, `check:mojibake:self-test`, `check:workflow-artifact-policy` (+self-test), `prove:entry-point` (+self-test), the inline mojibake grep | all 0 | |
| perf-budget | 3 self-tests, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all 0 | build with the prod URL + anon key (CI uses a placeholder key) |
| e2e-smoke | `npm run test:e2e` | 1 | 162 passed, 2 failed under load (magic-link returnTo fill timeout; organiser gate "execution context destroyed"); both pass alone (2/2). Neither touches the dancer page |
| phone-qa | `playwright.phone.config.ts`; phone build + `playwright.build.config.ts` | 0; 0; 0 | 272 passed / 74 skipped; 67 passed |
| workflow-lint | docs-only self-test, masking, notification (+self-test), no-preview-prefixes (+self-test) | all 0 | |
| lint chain | `npm run lint` | 1 | 19/20: `check:integrity` exit 126 (not executable in this checkout; `bash bin/check-integrity.sh` exit 0), as in #956. eslint on changed files: only pre-existing `DancerProfile.tsx` findings (4 `any`, 2 hook deps) |
| perf-budget | `check:lighthouse`, `check:doc-weight` | not run | need a live preview (CI-only) |
| real-data-verified / phone-qa-section | the two PR-body scripts on the PR body | see PR | |

The Playwright suites rewrite screenshots under `docs/handover/` and `docs/review-packs/`; those were restored, not committed.

## Left / next steps

- Orchestrator walk at 390x844, flags ON, real prod dancers (`/dancers/bisket`, a dancer-only, a thin one):
  LOOK at every edge of the bar.
- Not verified: a Vercel preview (one push), a real phone, avatars (the sandbox browser could not load the
  image CDN, so pictures show alt text), signed-in views.
