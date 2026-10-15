# Brief: preview-only branch with the home banner ON (Website, do NOT open a PR)

Repo `123constante/bachata-website`. The owner wants to see the home announcement banner (PR #765, branch
`claude/home-announce-banner`, shipped OFF) on their phone before merging. Plain git only, never `gh api`.
Commands without variables, loops or `$(...)`.

1. `git fetch origin claude/home-announce-banner`, create branch `claude/home-banner-preview` from
   `origin/claude/home-announce-banner`.
2. Change ONLY the constant `HOME_ANNOUNCE_BANNER_ON` from `false` to `true` (find it with
   `git grep -n "HOME_ANNOUNCE_BANNER_ON ="`). If a unit test pins it to false, update that one assertion so the
   pre-push hook passes; touch nothing else.
3. Run `npm run build` once (production build must pass). Commit with subject
   `preview only: home banner ON for the owner's phone look, never merge [worker-done <ticket>]`, push
   `claude/home-banner-preview`. Never push any other branch, never open a PR, never `--no-verify`.
4. Report the head SHA. Then stop.
