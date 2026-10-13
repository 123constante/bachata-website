# Brief: "TypeError: le is not a function" on every page of the #746 preview (Website)

Repo 123constante/bachata-website. Read CLAUDE.md, `docs/briefs/surname-screens-handover.md` and the fail-closed handover on branch claude/surname-screens first. Never merge, never --no-verify, push once. Push ONLY on `claude/surname-screens` (PR #746, head c249e96); you are the only worker on it.

## CI rule (owner decision 2026-10-13)
GitHub minutes are capped (owner budget): workers push ONCE, no duplicate triggers. Run every CI job step (read .github/workflows) in your sandbox and put a per-job table (command, exit code) in the PR body and handover. Nobody runs anything on the owner's PC.

## Problem (measured by another session walking the preview signed out at 390x844)
On the #746 Vercel preview https://bachata-website-6zj1m9zvz-rixz-4372s-projects.vercel.app EVERY page logs in the browser console: `TypeError: le is not a function`, stack in `vendor-ui-modal-B-AOb8sN.js` -> `vendor-ui-DCvdHbop.js`. The #743 preview (dd8c130) and production log only the vercel.live CSP noise, so it is introduced by a commit on claude/surname-screens (c249e96 and its parents since main). Pages still render. Cause unknown. No automated check caught it.

## Task
1. Reproduce: build the branch (`npm run build`, read the workflow for the exact command/env), serve it, and load /, a dancer page, /auth with the console captured (Playwright `page.on('console'|'pageerror')`), also on main for comparison. Identify the minified symbol `le` by building with sourcemaps or by bisecting the branch's commits (`git bisect` on the build + console check; the diff since main is small: list it first).
2. Likely suspects (check, do not assume): a changed import of a UI component / icon / `lucide-react` named export that does not exist; a default vs named import mix-up; a new dependency or lockfile change that altered the `vendor-ui` chunk (compare package.json/package-lock.json to main); the new toggle/switch component import from a modal/dialog module.
3. Fix at the cause. Add a regression check that FAILS on the unfixed branch: a Playwright (or vitest+happy-dom) smoke that loads a few routes from the production build and fails on any `pageerror` / `console.error` that is not on a short, explicit, documented allowlist (the vercel.live CSP noise). Run it red first, then green. Wire it into the existing e2e smoke run only if that is cheap; otherwise leave it as a spec file and say so.
4. Run all CI job steps in your sandbox, push once, update the PR body per-job table (`## Verified on real data` exact heading with `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:`).

## Output
New head SHA, the cause in one sentence, per-job table, honest Verified / Not verified. Stop after the push.
