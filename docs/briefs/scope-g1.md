# Scope G1: Website write-door check (read-only docs job) - ticket scope-g1

Repo 123constante/bachata-website. Docs only: write ONE file `docs/scoping/g1-write-door-check.md` on branch `claude/scope-g1-write-door`, push, stop. No src, no scripts, no workflow edits. End the last commit message with `[worker-done scope-g1]`.

## Background
Compulsory organiser onboarding (plan: `docs/plans/onboarding-arc.md` on origin/main, section 4.3 and the confirmed decisions; also `~/.claude` is NOT available, use the repo). Server half is applied on prod: S1 schema, S2 status RPC and a guard over six write doors (6 doors gated, 0 violations), S6 go-live. The server gate flag stays OFF until a 14-day grace after the screens ship. The Website half is a CI check (a `scripts/check-*.mjs` guard, hard tier: scripts/** needs owner Approve at PR head) that fails when a Website write path to one of the six gated doors is added or changed without going through the onboarding gate, so a new write door cannot ship ungated.

## Question
Write the design for that check so a builder can implement it in one slice:
1. The six doors: name them from the live guard (read-only prod query of the guard/helper, project stsdtacfauprzrdebmzg, counts and names only) and list every Website call site of each (grep src for the RPC names / supabase calls).
2. What "goes through the gate" means in code (which Website helper or error handling, and what the user sees when the server refuses with the onboarding error).
3. The check's algorithm (scrape vs AST vs call-graph), its fail-open spellings, and the scripts convention it must satisfy: read `docs/ci-guard-notes.md` (the six rules `check-script-conventions.mjs` enforces) and `docs/testing-doctrine.md` (canary/self-test, mutation proof).
4. Mutants the self-test must catch, the workflow step to add (name it, where in db-contract-check.yml or another workflow), and how to prove it red-first.
5. Open product questions, if any (plain words).

## Rules
Docs only, one round, no code. State what you could not check.
