# D73 handover: website (`123constante/bachata-website`): BLOCKED, PARTIAL

Ticket: dt_430b84e2d81f. Branch: `claude/worker-allow-rules` (base `origin/main` @ ecc3432).

## Done
- Read the brief D73 and `00-COMMON.md`.
- Test 1 (before): `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`, exit 0.
- Test 3: no `check:*` script in `package.json` reads `.claude/settings.json`. The only scripts that mention it are `scripts/hooks/pre-exec-guard.mjs`, `scripts/statusline-arc.mjs` and `scripts/lib/arc-state.mjs`, and they mention it only in comments or messages. There is no settings guard to run.
- Confirmed in the current `permissions.ask`: `Bash(gh api *)`, `Bash(gh secret set *)`, `Bash(gh repo delete *)` (and the PowerShell twins). There is no `deny` list and no `defaultMode`.

## Left: the edit itself (blocked)
The cloud worker's auto-mode permission classifier REFUSED the write to
`.claude/settings.json` with the reason "[Self-Modification]". An agent widening
its own permission allowlist is exactly what that classifier blocks. I did not
try to work around it. `.claude/settings.json` is UNCHANGED on this branch.

So a worker cannot land this change. The owner applies it by hand, or a session
where the owner approves the edit live does.

## Exact next step (owner, about 1 minute)
In `.claude/settings.json`, put these 24 lines straight after the line
`    "allow": [`. Each line has a trailing comma and the existing entries stay
below them, so the diff is purely added lines inside `permissions.allow`.
`Bash(git fetch *)` already exists but is narrower, and none of the 24 is
already present.

```
      "Bash(git *)",
      "Bash(node *)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(python3 *)",
      "Bash(cat *)",
      "Bash(ls *)",
      "Bash(grep *)",
      "Bash(sed *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(wc *)",
      "Bash(sort *)",
      "Bash(find *)",
      "Bash(mkdir *)",
      "Bash(cp *)",
      "Bash(mv *)",
      "Bash(echo *)",
      "Bash(test *)",
      "Bash(sleep *)",
      "Bash(until *)",
      "Bash(for *)",
      "Bash(while *)",
      "Bash(if *)",
```

Then run `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`
(it must exit 0) and `git diff origin/main -- .claude/settings.json`, where every changed line must start with `+`.

## CI per job
Not run, because there is no code change. This branch carries only this handover doc.

## Verified / Not verified
- Verified: the current settings parse as valid JSON. The ask-list entries above are present. No settings guard exists.
- Not verified: the settings edit, because it is not applied. Whether worker stalls stop once it lands is only known when the NEXT worker runs. A further risk: if the classifier refuses permission self-edits, it may also be what produces some of the stalls, which allow rules alone would not cure.
