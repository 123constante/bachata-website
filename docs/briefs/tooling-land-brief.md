# Brief: tooling skill `land-brief` (Node script + self-test; nothing runs against prod)
Branch: claude/tooling-land-brief (from main). Builder: Sonnet. Lane: normal. Do NOT open a merge-ready PR to main: push the branch, [skip preview] on every commit, final commit subject ends "[worker-done <ticket>]". The orchestrator copies the files into ~/.claude/bin and the skill dir; this branch is never merged. Context cap 35%.

## Problem (owner-approved, 2026-10-29)
A docs-only brief branch could not be pushed with plain git for about an hour: the Website pre-push unit gate fails on load-flaky unrelated tests. The program lead's approved route lands docs-only briefs without that gate:
1. read the main sha: gh api repos/<owner>/<name>/git/ref/heads/main -q .object.sha
2. create the branch from it: gh api -X POST repos/<owner>/<name>/git/refs -f ref=refs/heads/<branch> -f sha=<sha>
3. one PUT per file: gh api -X PUT repos/<owner>/<name>/contents/<path> --input <json> where the JSON keys are message, branch, content (base64). The JSON file lives in a temp dir OUTSIDE any repo checkout.
dispatch-one.mjs then reads the brief from GitHub (it fetches repos/<repo>/contents/<path>?ref=<branch>).

## Build: scripts/tooling/land-brief/land-brief.mjs (+ SKILL.md draft at scripts/tooling/land-brief/SKILL.md)
CLI: node land-brief.mjs <owner/name> <brief-branch> <file>... [--base main] [--message "<text>"] [--dry-run]
- Each <file> is a local path; its repo path = the path relative to the repo root given by --root (default: cwd git toplevel).
- SAFETY (the point of the tool; it must never become a way round the gate for code): every repo path must match ONLY docs/ (docs/briefs/**, docs/design/**, docs/review/**, docs/handovers/**, docs/plans/**) and end in .md or .json under docs/. Anything else (src/, tests/, scripts/, .github/, package*.json, supabase/, any dotfile, any path containing .. or starting with /) -> refuse with the offending path and exit 2, writing nothing. The branch name must start with brief/ or claude/review- or claude/done-; any other name -> refuse.
- Refuse files over 1 MB, binary files (NUL byte), and files whose text contains likely secrets (a line matching /(api[_-]?key|secret|token|password)\s*[:=]\s*\S{12,}/i or a JWT eyJ... of 3 dot-separated base64url parts): refuse, name the line number, never print the value.
- Idempotent: if the branch already exists, do NOT recreate it; for each file GET its sha on that branch (contents?ref=), PUT with sha to update, skip when the content is identical (report "unchanged").
- Prints one line per file (created/updated/unchanged + path) and finally `LANDED <branch> <head sha> <n> file(s)`; on any gh failure print `ERROR: <short reason>` and exit 1 (never a guessed success). Never run any shell with variables or loops: call gh via execFileSync with an args array. All temp JSON goes to os.tmpdir()/land-brief-<random>/ and is removed in a finally.
- --dry-run does all the checks and prints what it would do, calls no write API (reads allowed).
- Inject the gh runner so the self-test needs no network: export a function landBrief(opts, deps) with deps.gh(args)->stdout and deps.readFile.

## Self-test (node land-brief.mjs --self-test; a table of cases, each must be able to FAIL, include mutants)
Allowed docs path ok; src/x.ts refused; docs/../src/x.ts refused; /abs path refused; .github/workflows/x.yml refused; docs/briefs/x.ts refused (extension); branch main refused; branch brief/x ok; branch claude/w3c-1-repeat refused; file with a JWT refused; file with `token: abcdefghijklmnop` refused; NUL byte refused; existing branch reuses without POST; unchanged file sends no PUT; gh failure -> exit 1 with ERROR; temp dir removed after success and after failure; the refusal path writes nothing (assert zero write calls). Mutant check: with the path allow-list function replaced by `() => true`, at least 3 cases go red (assert this inside the self-test).

## Done = the branch has land-brief.mjs, SKILL.md, the passing self-test output pasted in docs/handovers/tooling-land-brief.md (Verified / Not verified; say it was never run against real GitHub). Hard limits as every worker: plain git only for pushing your own branch, no --no-verify, no merge/approve, Supabase untouched, never print secrets.
