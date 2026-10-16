# Handover: "TypeError: le is not a function" on the #746 preview

Brief: `docs/briefs/surname-screens-typeerror.md` (branch `arc/briefs-account-lifecycle`).

## Result: NOT reproduced, cause NOT found

Measured in the worker sandbox (Chromium 390x844, `pageerror` + `console` captured, 3 s settle after networkidle):

| Build | Routes | pageerror / console.error |
|---|---|---|
| `claude/surname-screens` @ c249e96, `npm run build`, static prerendered pages | `/faq`, `/parties`, `/classes` (both `vendor-ui` and `vendor-ui-modal` loaded) | none |
| same build, real SSR handler on `build/server` | `/auth`, `/dancers`, `/faq` | none (only 404 resource lines: favicons, and `get_public_dancer_names_v1` PGRST202, expected until admin #794) |
| same build | `/city/*`, `/dancers/<slug>` | SSR 404 in the sandbox (no loader env), so NOT walked |

Facts that narrow it:
- `vendor-ui-DhDEy8r5.js` and `vendor-ui-modal-Afd33XxC.js` have identical names on `origin/main` (bc43fb6) and on this branch, so the branch does not change those chunks. The preview's hashes (`B-AOb8sN`, `DCvdHbop`) differ from any local build: Vercel's build resolved something differently, or the report came from another deployment.
- The branch does not touch `package.json`, `package-lock.json` or `vite.chunks.ts`. `Switch` was already imported on main (`EditProfile`, `DancerDashboard`), so `HideSurnameSwitch` adds no new weight to `vendor-ui-modal`.
- The build's static chunk import graph has no cycles.

## Added
`tests/e2e/console-clean-smoke.spec.ts`: loads `/auth /faq /parties /classes` at 390x844, fails on any `pageerror` or non-allowlisted `console.error` (allowlist: vercel.live CSP, "Failed to load resource" status lines; reasons in the file). Green (4/4) against the local production SSR build. It was NEVER run red (no defect to catch) and not mutation-tested. Not in `test:e2e` (explicit list). Run against the preview:
`PLAYWRIGHT_BASE_URL=<preview> npx playwright test tests/e2e/console-clean-smoke.spec.ts --project=chromium`

## Next step
Run that spec against the #746 preview (the sandbox proxy blocks vercel.app). If it fails, the first stack frame names the route; resolve `le` with the deploy's sourcemaps (`sourcemap: "hidden"`). If it is clean there, the sighting was likely an extension or the vercel.live toolbar.
