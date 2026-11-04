# Brief: owner-summary-web (WEBSITE, SLICE 14 of full automation, Website half, PART A: pure tested parts, disarmed). Branch claude/owner-summary-web. Repo 123constante/bachata-website.

Brief-version: 2
Lane: normal (no migration, no DB, no prod write, no live send; pure code plus tests with injected clients, nothing scheduled). The contract row for slice 14 says "Sonnet, normal".
Model: Sonnet (contract table, slice 14)
Tier: HARD-TIER (`scripts/**` is hard-tier in this repo). It needs the OWNER's Approve at head; you never approve, never merge, never self-certify.

START NOW. Slice 2 (foundations, branch claude/foundations-web, secrets register) is in flight and NOT on main. This brief builds only parts that do not need the register. Do not read, copy or recreate anything from claude/foundations-web.

Branch `claude/owner-summary-web` (push ONLY here, ONE push, final subject ends `[worker-done <ticket>]`). Under 30% context; at 25% start nothing new; push + handover by 30%. Never merge/approve/--no-verify. Plain git only (never `gh api`). No Supabase. Never add `run-ci` yourself.

Source: acceptance contract for full automation rev 3.1, slice 14, sections 1.1(3), 5, 6.1 (PUSH row), drills N1-N3. Condensed rules:
- At most ONE owner message per (arc id, head sha, kind), kind in finish|stop. Key `arc:<id>|head:<sha>|kind:<kind>`. Honest wording: at-most-once, not exactly-once.
- A marker comment on the arc's pinned issue, state `pending`, is written BEFORE the send and read before every send; after the publish returns, the same marker is edited to `sent` with a proof string. `sent` means only "ntfy server accepted (HTTP 200 with a message id)", never "phone received it". The issue comment is the system of record; ntfy is a best-effort nudge.
- A crash between marker and send leaves zero pushes; a heartbeat finds `pending` markers older than 15 min and raises ONE separate `undelivered` notice (its own kind, at most one per key).
- The ntfy topic is access-controlled; the publish token is publish-only; the topic name is not a secret. Messages carry no secret, no token, no PII beyond arc id, PR number, link.
- The daily digest is a comment (not a push) listing every open stop and every marker not `sent`. The hard-tier approval list is ONE message at set times, no per-PR pings.
- If the push fails: the arc is marked paused and the pinned issue carries the message (case w).

## What main lacks
(Verified by the orchestrator on origin/main of this repo, commit 0b8762c87, 2026-11-04: `git grep -i` over scripts, .github and tests for each token returns nothing, except where noted.)
- no owner-message formatter producing finish/stop/undelivered text with the key and link -- grep: owner-summary (no hit)
- no ntfy sender -- grep: ntfy (no hit in scripts, .github, tests)
- no dedupe store with pending/sent markers and no 15-minute `undelivered` heartbeat -- grep: undelivered (no hit); the only "dedupe" hits are unrelated image/storage scripts
- no daily digest builder -- grep: daily digest (no hit)
- no hard-tier approval list builder -- grep: hard-tier approval (no hit)
- no pinned-issue comment writer for markers -- scripts/lib/owner-summary-issue.mjs
- no drill tests N1, N2, N3 -- tests/owner-summary.test.ts
- extends: PRESENT and to be REUSED, not rewritten: `scripts/lib/automation-pause.mjs` (exports `readPause`, `assertNotPaused`, `PausedError`, `postPauseNotice`, `noticeMarker`) -- scripts/lib/automation-pause.mjs
- LEFT FOR AFTER slice 2 merges (do NOT do these here): the ntfy token entry in `.github/automation/secrets-register.json` (with `acts_as`, not the owner login), the `check-secrets-register.mjs` coverage of it, and the `notify.yml` schedule/dispatch workflow. Also left: the owner-side ntfy account/ACL setup (baby-step sheet) and any live send. -- grep: notify.yml

## Do
1. `scripts/lib/owner-summary.mjs` (pure, no I/O): `makeKey({arc,head,kind})`; `formatMessage({kind,arc,pr,link,what,next,undone})` (plain text, length-capped, refuses text matching token/secret patterns, refuses missing arc or link); `buildDigest({stops,markers,now})` (open stops plus every marker not `sent`, sorted; empty digest says "nothing open"); `buildApprovalList({prs})` (hard-tier PRs awaiting owner Approve at head: number, title, short head sha, link; one body, never per-PR).
2. `scripts/lib/owner-summary-store.mjs`: dedupe store over an injected issue client `{list, create, edit}`. `begin(key)` returns `GO` only when no marker exists for the key and writes `pending` first (hidden `<!-- owner-summary key=... -->` token, found-or-edited); an existing `pending` or `sent` returns `SKIP`. `commit(key,{proof})` edits to `sent`. `heartbeat({now})` lists `pending` older than 15 min with no `undelivered` marker for that key, writes ONE `undelivered` marker, returns the list so the caller sends the single notice; ceiling one per key.
3. `scripts/lib/ntfy-send.mjs`: `sendNtfy({url,topic,tokenEnvName,title,body,fetch,env})`. The token is read from `env[tokenEnvName]` at call time; the NAME is only referenced (default `NTFY_PUBLISH_TOKEN`), never created, never logged, never a value in any file. Missing token returns a refusal result with no network call. Success requires HTTP 200 and a message id in the body; anything else returns `failed` with the status only. Timeout via AbortSignal.
4. `scripts/lib/owner-summary-issue.mjs`: comment writer to the pinned issue via an injected client (found-or-edited marker comments; plain comment for digest and approval list). No `gh`, no network inside the module.
5. `scripts/owner-summary.mjs` (CLI, DISARMED): modes `send|digest|approvals|heartbeat`. Default is `--dry-run`: prints what it would do, exit 0, no I/O besides reads. A live send needs `--live` AND env `OWNER_SUMMARY_ARMED=1`, and first calls `assertNotPaused` from `scripts/lib/automation-pause.mjs`; on `PausedError` it exits 0 with "paused: nothing sent". No workflow, no cron, no schedule added.
6. Failure path (case w): if `sendNtfy` fails after the marker exists, the issue comment stays (system of record), the marker stays `pending` for the heartbeat, and the result tells the caller to set the pause; the pause call is an injected function here, not wired.
7. Tests `tests/owner-summary.test.ts` (vitest; show each drill fails against a deliberately broken store, then restore):
   - N1 dedupe: same (arc,head,kind) twice -> exactly one send, second is `SKIP`; throw between `begin` and `sendNtfy` then re-run -> `SKIP` (zero pushes), `heartbeat` at 16 min yields exactly one `undelivered` marker, a second heartbeat yields none; different kind or head -> separate sends.
   - N2 notifier failure: fetch rejects / returns 500 / returns 200 without message id -> marker stays `pending`, issue comment exists, result flags pause; never reports `sent`.
   - N3 (pure half only): no token in env -> refusal with zero fetch calls; the token value never appears in any returned string, thrown error or captured log; `Authorization` exists only on the request handed to fetch. The live ACL half of N3 (wrong token, no token, subscribe with no token) waits for slice 2 and the owner's ntfy setup; list it as Not verified.
   - Paused: with `readPause` reporting paused, live mode sends and writes nothing.
   - Table-driven: formatter x kinds x empty/long/secret-looking input; digest x (no stops, only stops, only unsent markers, both); approval list x (0, 1, 30 PRs).
8. Run every CI job step that applies (read `.github/workflows`; script rules in `docs/ci-guard-notes.md`, the six rules of `check-script-conventions.mjs`), `npm run test:unit`, `npm run lint`. Put the per-job table in the PR body with a Verified / Not verified block; Not verified must list: live ntfy publish, topic ACL, register entry, workflow schedule, the pinned issue itself.
9. Handover in the final commit message: parts done; parts left (register entry, `notify.yml`, live N1 run, live half of N3).

## Files
scripts/lib/owner-summary.mjs
scripts/lib/owner-summary-store.mjs
scripts/lib/ntfy-send.mjs
scripts/lib/owner-summary-issue.mjs
scripts/owner-summary.mjs
tests/owner-summary.test.ts
