# Handover: tooling land-brief

Done: `scripts/tooling/land-brief/land-brief.mjs` and `SKILL.md`. Left: orchestrator copies them into ~/.claude/bin and the skill dir. This branch is never merged.

## Verified
`node land-brief.mjs --self-test` output (injected gh runner, no network):

```
PASS  docs/briefs/x.md allowed
PASS  src/x.ts refused
PASS  docs/../src/x.ts refused
PASS  /abs path refused
PASS  .github/workflows/x.yml refused
PASS  docs/briefs/x.ts refused (extension)
PASS  dotfile under docs refused
PASS  branch main refused
PASS  branch brief/x ok
PASS  branch claude/w3c-1-repeat refused
PASS  JWT file refused
PASS  token: abcdefghijklmnop refused
PASS  NUL byte refused
PASS  over 1 MB refused
PASS  existing branch reuses without POST
PASS  new branch POSTs once
PASS  unchanged file sends no PUT
PASS  changed file PUTs with sha
PASS  gh failure -> Error (exit 1), not Refusal
PASS  temp dir removed after success
PASS  temp dir removed after failure
PASS  dry-run makes zero write calls
PASS  one bad file among good writes nothing
PASS  mutant allow=()=>true turns 7 case(s) red (need >= 3): src/x.ts refused; docs/../src/x.ts refused; /abs path refused; .github/workflows/x.yml refused; docs/briefs/x.ts refused (extension); dotfile under docs refused; one bad file among good writes nothing
SELF-TEST OK (23 cases + mutant)
```

## Not verified
- Never run against real GitHub (no live gh api call, no real branch/PUT).
- CLI arg parsing and the `--root` path mapping are only exercised by hand-reading, not by the self-test.
