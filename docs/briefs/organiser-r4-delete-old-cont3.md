# Brief: #1816 (branch r4-delete-old) fix 2 CI reds. ONE round, small.

Branch r4-delete-old, PR #1816 exists. Do NOT rewrite anything else. First `git merge origin/main`.

## Red 1: phone-qa (2), tests/e2e-phone/invite-w2-golive.phone.spec.ts
Fails twice (rerun) on `roles-no` and `roles-dj-yes` ("contrast >= 4.5"). Offender axe target:
`.rounded-[var(--r-ctl,12px)] > .gap-[8px].inline-flex.items-center` (a Chip on the "Do you also teach or DJ?" screen,
src/modules/organiser/home/onboarding/golive/RoleQuestionScreen.tsx, Chip uses var(--gold-fg,#ffa600), var(--line-strong), var(--fg)).
Passes on other PRs, so this PR caused it. Suspect: go-live relied on a CSS side effect (e.g. `import '../theme/p3.css'` or v2.css/ember.css)
from a file this PR deleted (P3Shell.tsx, V2Shell.tsx), so --gold-fg/--fg fall back to a low-contrast default.
Steps: run that one spec locally (npx playwright test -c playwright.phone.config.ts tests/e2e-phone/invite-w2-golive.phone.spec.ts -g roles),
find which var is undefined, fix by giving the go-live path its token source (smallest change), re-run the spec green.

## Red 2: live-preview (/city/london-gb, CSP og-image)
Check if red on main / other open PRs first (`gh run list`). If unrelated/flaky, say so in the handover, change nothing.
If caused by this PR, fix at the cause.

## Then
Run `npm run pre-ship`, fix only what this PR broke, push ONCE, update the PR body "Verified" block. Stop; do not merge.
Handover: docs/handover/organiser-r4-delete-old.md (append 6 lines max).
