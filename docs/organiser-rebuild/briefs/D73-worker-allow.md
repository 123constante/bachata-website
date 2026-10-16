# Brief D73 -- commit worker allow rules to `.claude/settings.json` (owner click 2026-10-16: yes, both repos)

ONE repo per worker: the dispatch names it (website `123constante/bachata-website` or admin `123constante/bachata-admin`); branch `claude/worker-allow-rules`, base `main`. READ FIRST: `00-COMMON.md` next to this file with `<X>` = D73. Plain git only, no `gh api`. Write shell commands without variables, loops or `$(...)`.

## Why (owner's words, 2026-10-13)
Cloud workers stall on prompts like "A variable in this command can't be checked" and wait for the owner. The Anthropic docs document NO API field for auto-accept on the routine-create call. They DO say: a cloud session with ONE repository reads that repository's committed `.claude/settings.json` (shared project settings); `~/.claude/settings.json` and `.claude/settings.local.json` are NOT read. So the rules must be committed in the repo.

## What
Edit ONLY `.claude/settings.json` in each repo:
- Keep EVERY existing key (`hooks`, `ask`, `deny`, `additionalDirectories`, `env`, ...) exactly as is. Do not touch hooks.
- Add to `permissions.allow` (dedupe against what is there) generic, non-machine-specific rules: `Bash(git *)`, `Bash(node *)`, `Bash(npm *)`, `Bash(npx *)`, `Bash(python3 *)`, `Bash(cat *)`, `Bash(ls *)`, `Bash(grep *)`, `Bash(sed *)`, `Bash(head *)`, `Bash(tail *)`, `Bash(wc *)`, `Bash(sort *)`, `Bash(find *)`, `Bash(mkdir *)`, `Bash(cp *)`, `Bash(mv *)`, `Bash(echo *)`, `Bash(test *)`, `Bash(sleep *)`, `Bash(until *)`, `Bash(for *)`, `Bash(while *)`, `Bash(if *)`. Do NOT add `Bash(*)`, `Bash(rm *)`, `Bash(gh *)`, `Bash(curl *)`, or anything that widens network, secrets or deletion.
- The existing `ask` and `deny` lists STAY and still win (they subtract; allows union). Confirm `gh api *`, `gh secret set *`, `gh repo delete *` are still in `ask`/`deny`. If `permissions.defaultMode` is present, leave it.
- Do not add absolute Windows or `/c/dev` paths.

## Tests (must be shown)
1. `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"` exits 0 (valid JSON), before and after.
2. A diff check: `git diff origin/main -- .claude/settings.json` shows ONLY added lines inside `permissions.allow` (paste the diff). Any removed line = fail.
3. The repo's own settings guards still pass (read `package.json` for a `check:*` that touches `.claude/settings.json` and run it; if none, say so).
4. Honest "Not verified": whether the stalls actually stop. That is only known when the NEXT worker runs; say so in the handover.

## Output
PR via the bot path (`claude/**` branch). Handover `docs/organiser-rebuild/handovers/D73-<repo>.md` with the diff and the check results. Last commit subject ends `[worker-done <ticket>]`.
