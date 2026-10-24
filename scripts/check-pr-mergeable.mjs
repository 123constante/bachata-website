#!/usr/bin/env node
/**
 * check-pr-mergeable.mjs -- the guard for a PR whose gates never queued.
 *
 * THE INCIDENT (2026-08-08). PR #217 showed a check board of four "skipping"
 * entries and two Vercel passes. Nothing on it was red, so it read as fine. It
 * was CONFLICTING: #216 had been squash-merged while #217's branch still
 * carried the same nine commits individually -- the stacked-squash trap, which
 * had already auto-closed #138 on 2026-07-23.
 *
 * The part that matters is what a conflict does to CI. GitHub cannot compute a
 * merge ref for a conflicting PR, and a `pull_request` workflow runs against
 * that merge ref. No merge ref means the workflow is never QUEUED -- not
 * queued-and-failed, not queued-and-cancelled, simply absent. Every real gate
 * (unit, integrity, contract-check, e2e-smoke, bundle-budget) silently stopped
 * existing. Vercel deploys through its own GitHub App off the head commit, not
 * the merge ref, so it kept reporting green and kept the board looking alive.
 *
 * The recorded evidence, still fetchable, is the fixture this guard is proven
 * against: commit b567c8a2a04cf124d74fcfc52f5dd7caebd8924d, the pre-rebase head
 * of #217, carries exactly 5 check runs -- Vercel Preview Comments plus
 * seo-preview, check, seo-check and smoke, all four SKIPPED -- and one Vercel
 * commit status. Zero gates ran, and nothing on the page said so.
 *
 * WHAT IS ASSERTED, over every open PR. Two independent halves, because in the
 * incident they had the same cause but in general they do not:
 *
 *   H1  mergeable == MERGEABLE. Anything else (CONFLICTING, or an UNKNOWN that
 *       will not resolve) means the merge ref is not there.
 *   H2  at least one non-Vercel check actually ran. "Ran" excludes SKIPPED and
 *       excludes Vercel's own contexts; a queued or in-progress gate counts,
 *       because it queued, which is the thing under test.
 *
 * H2 is not redundant with H1. A conflict is only one way to lose the gates:
 * a bad paths: filter, a disabled workflow, a runner outage or a branch
 * protection edit all produce the same empty board with mergeable perfectly
 * MERGEABLE. H1 alone would have caught THIS incident and no other; H2 is the
 * durable half.
 *
 * KNOWN LIMIT, ACCEPTED ON PURPOSE (Ricky, 2026-08-08). H2 asserts ran > 0,
 * not "these named gates ran". A board where 1 of 24 gates ran therefore
 * passes. The alternatives were weighed and declined: a named-gate list goes
 * stale on the first workflow rename and then reds every good PR, and a ratio
 * against main mistakes legitimate paths: filters for missing gates. The
 * ran-count is printed on every line so a thin board is at least VISIBLE to a
 * reader even though it is not a failure. Revisit only if a partial board ever
 * actually ships something -- an empty board is the failure that happened.
 *
 * Scope is every open PR, bots and drafts included, for the same reason: a
 * conflicting Dependabot PR really has no gates running, and excluding it would
 * be this exact blindness in a smaller costume. The fix is to rebase the PR.
 *
 * ONE EXCEPTION, OWNER-DECIDED (Ricky, 2026-10-24: "Skip docs-only, list the
 * rest"): a CONFLICTING DOCS-ONLY WORKER PR is SKIPPED. Worker means the head
 * ref starts with `claude/`; a human or Dependabot docs PR is still judged, and
 * drafts get no special case. Only a CONFLICTING one: a MERGEABLE docs PR with
 * an empty board is still a NO_GATES_RAN failure, because the docs-only
 * workflows keep their jobs running and H2 is the durable half. Docs-only means
 * EVERY changed file passes the repo's ONE docs-only definition,
 * scripts/ci/docs-only.mjs (under `docs/`, `.claude/rules/` or `plans/`, or a
 * Markdown file outside the trees that ship or drive code -- `.md` at the repo
 * root counts, `.md` under src/ scripts/ .github/ and the rest does not), or
 * lives under `briefs/`; no file was RENAMED or COPIED (GraphQL shows only the
 * new path, so moving code into docs/ would read as docs); and the whole list
 * was read (an integer totalCount equal to the paths fetched, at least one
 * file). A list longer than the page is NOT docs-only, never a guess. Files are
 * read only for conflicting claude/ PRs, in a separate query, so the detail
 * query does not grow back toward the 504. A skipped PR is never silent and
 * never OK: one `SKIPPED docs-only #N <head>` line each and a
 * `skipped docs-only: K` total; it is out of the ok tally and the pass line's
 * judged count, gets NO commit status (this script publishes only success /
 * failure / pending; there is no neutral state), and does not move the exit
 * code. Files lost to an outage leave the PR NOT JUDGED, the same as any other
 * outage; any other read error exits 2.
 *
 * WHY THIS IS NOT A pull_request WORKFLOW. It cannot be. A pull_request
 * workflow is precisely what does not queue on a conflicting PR, so a guard
 * wired that way would go silent in the exact case it exists to catch -- the
 * inert-assert failure this repo has shipped three times. It runs instead on
 * push-to-main (the event that CREATES conflicts in every sibling PR), on a
 * schedule, and on demand.
 *
 * NO BACKSLASH APPEARS IN THIS FILE, deliberately. It is authored across a
 * FUSE mount observed to silently delete literal backslashes inside heredocs,
 * which would turn an escape into an ordinary letter in a file that still
 * parses. Newlines are spelled with String.fromCharCode(10) and there are no
 * regex literals -- the same defence check-script-conventions.mjs uses.
 *
 * Local:
 *   node scripts/check-pr-mergeable.mjs                 # sweep open PRs
 *   node scripts/check-pr-mergeable.mjs --pr 138        # one PR, any state
 *   node scripts/check-pr-mergeable.mjs --sha b567c8a   # H2 against a commit
 *   node scripts/check-pr-mergeable.mjs --self-test     # both directions
 *
 * Auth: GITHUB_TOKEN or GH_TOKEN, else `gh auth token`. Read-only scope.
 *
 * Exit: 0 pass, 1 contract violated, 2 the guard could not run -- with ONE
 * owner-decided exception: GITHUB-OUTAGE (GitHub still 5xx / unreachable
 * after retries) exits 0 WITHOUT the pass line, every unjudged PR named and an
 * Actions warning raised, so an outage alone does not red main. A judged
 * conflict still exits 1 first; PR_GUARD_OUTAGE_STRICT=1 makes an outage exit
 * 2. See OUTAGE_EXIT.
 */
import { execFileSync } from 'node:child_process';
import { isDocsOnly as isDocsOnlyPaths } from './ci/docs-only.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

const API = 'https://api.github.com/graphql';
const NL = String.fromCharCode(10);

/**
 * A PR younger than this with no contexts at all has not been given time to
 * register any, so it is DEFERRED rather than failed -- named in the output,
 * never silently dropped, and judged for real on the next sweep. It applies
 * only to the empty-board case: a PR that HAS contexts is judged immediately at
 * any age, which is what makes the incident board (6 contexts, 0 gates) a
 * failure the moment it is seen.
 */
const DEFAULT_MIN_AGE_MINUTES = 15;

/** GraphQL reports mergeable lazily; the first read only triggers the job. */
const MERGEABLE_POLL_ATTEMPTS = 6;
const MERGEABLE_POLL_MS = 2500;

/**
 * The sweep is two light steps, never one heavy one. Until 2026-10-24 a single
 * query asked for every open PR WITH its rollup -- first:100 PRs x
 * contexts(first:100), ~10,100 nodes -- and GitHub answered HTTP 504 about 11 s
 * in on every hourly run. 136 PRs were open by then, so that page could not
 * have covered the board even when it answered. Now the PR list is paged on
 * numbers alone (LIST_PAGE_SIZE nodes per call, a handful of bytes each), and
 * the full fields are read DETAIL_BATCH_SIZE PRs at a time by number: ~20 x 101
 * = ~2,020 nodes per call, a fifth of what timed out, and a size that does not
 * grow with the board.
 */
const LIST_PAGE_SIZE = 100;
const DETAIL_BATCH_SIZE = 20;
/** A cursor that never ends is a bug, not a big repo: 50 x 100 PRs open. */
const MAX_LIST_PAGES = 50;

/**
 * Transient failures are retried; everything else is not. 502/503/504 and a
 * network error (including our own per-request timeout) get 3 attempts in all,
 * 2 s then 5 s apart. A 4xx or a GraphQL `errors` body is a wrong token or a
 * wrong query: retrying it only delays the same answer, so it is never retried
 * and still exits 2. FETCH_BUDGET_MS caps the retrying across the whole run, so
 * a flapping API cannot walk the job into its 6-minute timeout and lose the
 * verdict entirely -- past the budget a failure is reported at once.
 */
const RETRY_DELAYS_MS = [2000, 5000];
const TRANSIENT_HTTP = new Set([502, 503, 504]);
const REQUEST_TIMEOUT_MS = 30000;
const FETCH_BUDGET_MS = 180000;

/**
 * GitHub still unreachable after the retries is GITHUB-OUTAGE: not a verdict
 * on any PR, and not a reason to red main (owner, 2026-10-24: "make the sweep
 * lighter / retry on 504 so a real conflict still fails but an outage does not
 * red main"). pr-mergeable-guard.yml reds on ANY non-zero exit from the sweep
 * step, so 0 is the only code it maps to not-red. What keeps that from being a
 * silent pass: the PASS line is never printed, every PR not judged is NAMED,
 * nothing is published for them, an Actions ::warning:: annotation is raised,
 * and a conflict that WAS judged still exits 1 first. PR_GUARD_OUTAGE_STRICT=1
 * makes an outage exit 2 instead.
 */
const OUTAGE_EXIT = 0;
const OUTAGE_STRICT_ENV = 'PR_GUARD_OUTAGE_STRICT';

/** Contexts owned by the deploy preview, which runs off the head commit. */
const VERCEL_APP_SLUGS = new Set(['vercel']);
const VERCEL_STATUS_PREFIX = 'vercel';

/** The App that publishes our gates. See isGateContext for why this is an
 *  inclusion list and not an exclusion list. */
const GATE_APP_SLUG = 'github-actions';

/** The docs-only exception. See the header for the owner decision. */
const WORKER_HEAD_PREFIX = 'claude/';
const BRIEFS_DIR = 'briefs/';
const FILES_PAGE_SIZE = 100;
/** A rename or copy shows only its new path, so only these are judged by path. */
const PATH_ONLY_CHANGE_TYPES = new Set(['ADDED', 'MODIFIED', 'DELETED', 'CHANGED']);

export function isDocsPath(path) {
  return typeof path === 'string' && (path.startsWith(BRIEFS_DIR) || isDocsOnlyPaths([path]));
}

/** `files` is a GraphQL connection: { totalCount, nodes: [{ path, changeType }] }. */
export function isDocsOnly(files) {
  if (!files || !Array.isArray(files.nodes) || files.nodes.length === 0) return false;
  if (!Number.isInteger(files.totalCount) || files.totalCount !== files.nodes.length) return false;
  return files.nodes.every((node) => PATH_ONLY_CHANGE_TYPES.has(node.changeType) && isDocsPath(node.path));
}

// ---------------------------------------------------------------------------
// Pure evaluation. Everything below the fetch boundary is data in, verdict out,
// so the self-test drives the same code the live run does.
// ---------------------------------------------------------------------------

/**
 * True for a context published by the deploy preview rather than by CI.
 * Matched on the app slug for check runs and on the context NAME for commit
 * statuses, because a status carries no app. The name test is deliberately NOT
 * applied to check runs: a CI gate called "vercel-bundle-budget" must still
 * count as a gate.
 */
export function isVercelContext(node) {
  if (node.__typename === 'CheckRun') {
    return VERCEL_APP_SLUGS.has(node.checkSuite?.app?.slug ?? '');
  }
  const context = String(node.context ?? '').toLowerCase();
  return context.startsWith(VERCEL_STATUS_PREFIX);
}

/**
 * True when a context is one of OUR gates: a check run published by Actions.
 *
 * INCLUSION, NOT EXCLUSION, and this is the most important correction in the
 * file. The first version defined a gate as "not Vercel, not SKIPPED", so
 * anything unrecognised counted as one. Three things did.
 *
 * Dependabot publishes its own check run, so a conflicting Dependabot PR with
 * no queued workflows still looked gated. A required status in GitHub's
 * EXPECTED state means the status has NOT been posted -- the precise analogue
 * of SKIPPED -- and counted as work that ran. And fatally, the
 * pr-mergeable-guard status this script publishes ITSELF counted: sweep 1
 * writes it, sweep 2 reads it back as a gate, and from then on every empty
 * board reports "1 gate(s) ran, mergeable" forever. H2 would have switched
 * itself off within the hour, on precisely the board it exists to catch.
 *
 * That was confirmed on live data rather than inferred -- PR #180 carried the
 * status within seconds of the first publish, and the --sha canary is
 * structurally blind to it because commit mode refuses to publish.
 *
 * The cost of inclusion is real and accepted: a gate from another CI provider
 * would not count until its slug is added here. Every gate in this repo is
 * Actions, and the asymmetry decides it -- undercounting fails loudly, and
 * overcounting is what just tried to ship.
 */
export function isGateContext(node) {
  return node.__typename === 'CheckRun' && (node.checkSuite?.app?.slug ?? '') === GATE_APP_SLUG;
}

/**
 * True when one of our gates actually ran. A SKIPPED check run is the whole
 * point: the incident board was four of them, and a skipped gate gated nothing.
 */
export function contextRan(node) {
  return isGateContext(node) && node.conclusion !== 'SKIPPED';
}

/**
 * Split a rollup into the counts the two halves are judged on. `gateTotal` is
 * gates present at all, ran or skipped -- it is what the grace window keys on,
 * so that a board carrying only a Vercel status reads as "no gates yet" rather
 * than as "no contexts, so nothing to judge".
 */
export function classifyContexts(nodes) {
  const summary = { total: nodes.length, gateTotal: 0, ran: 0, skipped: 0, vercel: 0, other: 0, ranNames: [] };
  for (const node of nodes) {
    if (isGateContext(node)) {
      summary.gateTotal += 1;
      if (node.conclusion === 'SKIPPED') {
        summary.skipped += 1;
        continue;
      }
      summary.ran += 1;
      summary.ranNames.push(node.name ?? '(unnamed)');
      continue;
    }
    if (isVercelContext(node)) {
      summary.vercel += 1;
      continue;
    }
    // Everything else: Dependabot, our own published status, a third-party App,
    // an EXPECTED placeholder. Counted and printed so the board is legible, but
    // never mistaken for a gate.
    summary.other += 1;
  }
  return summary;
}

/** Minutes since the later of the PR opening and its head commit landing. */
export function ageMinutes(target, nowMs) {
  const stamps = [target.createdAt, target.headCommit?.committedDate]
    .filter(Boolean)
    .map((iso) => Date.parse(iso))
    .filter((ms) => Number.isFinite(ms));
  if (stamps.length === 0) return Infinity;
  return (nowMs - Math.max(...stamps)) / 60000;
}

/**
 * Verdict for one PR. `failures` are contract violations (exit 1); `infra` is
 * "the guard could not decide" (exit 2). They are kept apart so an unresolved
 * mergeable never masquerades as a proven conflict.
 */
export function evaluatePr(target, { nowMs, minAgeMinutes = DEFAULT_MIN_AGE_MINUTES } = {}) {
  const contexts = target.contexts ?? [];
  const checks = classifyContexts(contexts);
  const age = ageMinutes(target, nowMs);
  const verdict = {
    number: target.number,
    state: target.state,
    mergeable: target.mergeable,
    mergeStateStatus: target.mergeStateStatus,
    headOid: target.headCommit?.oid ?? '',
    ageMinutes: age,
    checks,
    deferred: false,
    failures: [],
    infra: [],
  };

  // H1 -- the merge ref exists.
  if (target.mergeable === 'CONFLICTING') {
    verdict.failures.push({
      half: 'H1',
      code: 'CONFLICTING',
      detail:
        'mergeable=CONFLICTING (mergeStateStatus=' +
        target.mergeStateStatus +
        '). GitHub cannot build a merge ref, so pull_request workflows never queue.',
    });
  } else if (target.mergeable !== 'MERGEABLE') {
    verdict.infra.push({
      half: 'H1',
      code: 'MERGEABLE_UNRESOLVED',
      detail:
        'mergeable=' +
        String(target.mergeable) +
        ' after polling. GitHub computes this lazily; a value that never resolves is not a proven conflict, but it is not a clean PR either.',
    });
  }

  // H2 -- at least one gate queued. An empty board on a very young PR is
  // deferred rather than judged, and says so.
  if (checks.ran > 0) return verdict;
  // Keyed on GATES present, not contexts present. Vercel posts its status
  // within seconds of a push while Actions check runs take longer to register,
  // so a board holding only a Vercel status is the ordinary look of a PR that
  // is thirty seconds old -- and the old `total === 0` test judged it
  // immediately and published a red onto a perfectly healthy PR. Once any gate
  // has appeared, the board is judged at once at any age, which is what keeps
  // the incident board (4 gates, all skipped) a failure the moment it is seen.
  if (checks.gateTotal === 0 && age < minAgeMinutes) {
    verdict.deferred = true;
    return verdict;
  }
  verdict.failures.push({
    half: 'H2',
    code: 'NO_GATES_RAN',
    detail:
      'zero Actions gates ran: ' +
      checks.skipped +
      ' skipped, ' +
      checks.vercel +
      ' Vercel, ' +
      checks.other +
      ' other, ' +
      checks.total +
      ' contexts total. The real gates never queued.',
  });
  return verdict;
}

/** Verdict for a bare commit -- H2 only, since a commit has no merge ref. */
export function evaluateCommit(commit) {
  const checks = classifyContexts(commit.contexts ?? []);
  const verdict = { oid: commit.oid, checks, failures: [] };
  if (checks.ran === 0) {
    verdict.failures.push({
      half: 'H2',
      code: 'NO_GATES_RAN',
      detail:
        'zero Actions gates ran: ' +
        checks.skipped +
        ' skipped, ' +
        checks.vercel +
        ' Vercel, ' +
        checks.other +
        ' other, ' +
        checks.total +
        ' contexts total.',
    });
  }
  return verdict;
}

/**
 * The verdict as a GitHub commit status, so the red lands ON the PR board next
 * to the skipped entries rather than only on a workflow run nobody opens. That
 * is the whole symptom being cured: on #217 every surface a reader looks at
 * said "fine", and the truth was one tab away in a run that was never opened.
 *
 * A success is published too, not just a failure. A guard that only ever writes
 * on failure leaves a stale red on a PR that has since been rebased, and worse,
 * its ABSENCE from a board is indistinguishable from it never having run.
 * Deferred publishes `pending`, which is the honest word for not yet judged.
 */
/**
 * Never write to a closed or merged PR. The sweep query pins states:OPEN, but
 * --pr takes any state and workflow_dispatch runs that same command with
 * --publish-status -- so dispatching against a closed PR would POST a failure
 * onto a dead head commit nobody will ever rebase. The verdict is still
 * computed and still printed; only the write is withheld.
 */
export function mayPublish(verdict) {
  return verdict.state === 'OPEN';
}

export function statusForVerdict(verdict) {
  const checks = verdict.checks;
  if (verdict.failures.length > 0) {
    const codes = verdict.failures.map((f) => f.code);
    const parts = [];
    if (codes.includes('CONFLICTING')) parts.push('CONFLICTING - no merge ref, so the gates never queue');
    if (codes.includes('NO_GATES_RAN')) {
      parts.push('no gates ran (' + checks.skipped + ' skipped, ' + checks.vercel + ' Vercel)');
    }
    return { state: 'failure', description: parts.join('; ') };
  }
  if (verdict.infra.length > 0) {
    // pending, not error. The script keeps exit 1 (violated) apart from exit 2
    // (could not decide) with some care, then used to collapse the two at the
    // one surface a reader actually looks at: GitHub renders `error` as a red X
    // indistinguishable from a proven conflict. Mergeability is computed
    // lazily, so a healthy PR that merely did not settle inside the poll budget
    // wore a red X saying nothing useful. The job still exits 2 and still goes
    // red -- nothing is hidden -- but the glyph now matches what is known.
    // Repeated cry-wolf is how a reader learns to ignore the very row this
    // change added to make the board honest.
    return { state: 'pending', description: 'mergeable=' + String(verdict.mergeable) + ' -- could not decide' };
  }
  if (verdict.deferred) {
    return { state: 'pending', description: 'no contexts yet; judged on the next sweep' };
  }
  return { state: 'success', description: checks.ran + ' gate(s) ran, mergeable' };
}

// ---------------------------------------------------------------------------
// Fetch boundary
// ---------------------------------------------------------------------------

const ROLLUP_FIELDS = `
  statusCheckRollup {
    contexts(first: 100) {
      totalCount
      nodes {
        __typename
        ... on CheckRun { name status conclusion checkSuite { app { slug } } }
        ... on StatusContext { context state description }
      }
    }
  }
`;

const PR_FIELDS = `
  number state isDraft title headRefName createdAt mergeable mergeStateStatus
  commits(last: 1) { nodes { commit { oid committedDate ${ROLLUP_FIELDS} } } }
`;

function resolveToken(env) {
  const fromEnv = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (fromEnv) return { token: fromEnv, source: 'env' };
  try {
    const out = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
    if (out) return { token: out, source: 'gh auth token' };
    return { token: '', source: '', reason: 'gh auth token printed nothing' };
  } catch (error) {
    return { token: '', source: '', reason: error.message };
  }
}

/** owner/name out of either remote spelling, without a regex literal. */
export function parseRepoSlug(remoteUrl) {
  let cleaned = String(remoteUrl).trim();
  if (cleaned.endsWith('.git')) cleaned = cleaned.slice(0, -4);
  const parts = [];
  for (const chunk of cleaned.split('/')) {
    for (const piece of chunk.split(':')) {
      if (piece) parts.push(piece);
    }
  }
  if (parts.length < 2) return null;
  return { owner: parts[parts.length - 2], name: parts[parts.length - 1] };
}

function resolveRepo(env) {
  const fromEnv = env.GITHUB_REPOSITORY;
  if (fromEnv && fromEnv.includes('/')) {
    const [owner, name] = fromEnv.split('/');
    if (owner && name) return { owner, name };
  }
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  const parsed = parseRepoSlug(url);
  if (!parsed) throw new Error('cannot parse an owner/name out of the origin remote: ' + url.trim());
  return parsed;
}

/**
 * One HTTP request, retried only when the failure is GitHub's and transient.
 * Any answer that is not transient -- a success or a 4xx -- is returned for the
 * caller to judge. A transient failure that survives the retries is thrown with
 * `outage` set, which the sweep turns into "not judged" for the PRs it
 * covered, never into a verdict. The budget counts only time spent on failed
 * attempts and the waits between them, so a long healthy sweep never spends it.
 */
async function requestWithRetry(ctx, url, init) {
  let last = '';
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const startedMs = ctx.now();
    let response = null;
    let text = '';
    try {
      response = await ctx.fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      text = await response.text();
    } catch (error) {
      response = null;
      // undici says "fetch failed" for every network fault; the cause is what
      // tells a runner-side DNS or proxy problem from a GitHub reset.
      const cause = error.cause?.code ?? error.cause?.message;
      last = 'network error: ' + error.message + (cause ? ' (' + cause + ')' : '');
    }
    if (response && !TRANSIENT_HTTP.has(response.status)) return { response, text };
    // The body of a 504 is GitHub's HTML "Unicorn!" page; the status says it all.
    if (response) last = 'GitHub API HTTP ' + response.status;
    ctx.retrySpentMs += ctx.now() - startedMs;
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) break;
    if (ctx.retrySpentMs + delay > FETCH_BUDGET_MS) {
      last += ' (retry budget of ' + FETCH_BUDGET_MS / 1000 + ' s spent)';
      break;
    }
    ctx.retrySpentMs += delay;
    console.log('  transient: ' + last + '; attempt ' + (attempt + 1) + ' in ' + delay / 1000 + ' s');
    await ctx.sleep(delay);
  }
  const error = new Error(last + ', ' + attempt + ' attempt(s)');
  error.outage = true;
  throw error;
}

/** One GraphQL call. A 4xx or an `errors` body is thrown plain: exit 2. */
async function graphql(ctx, query, variables) {
  const { response, text } = await requestWithRetry(ctx, API, {
    method: 'POST',
    headers: {
      authorization: 'bearer ' + ctx.token,
      'content-type': 'application/json',
      'user-agent': 'check-pr-mergeable',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error('GitHub API HTTP ' + response.status + ': ' + text.slice(0, 400));
  }
  const body = JSON.parse(text);
  if (body.errors) {
    throw new Error('GitHub API errors: ' + JSON.stringify(body.errors).slice(0, 400));
  }
  return body.data;
}

/** The context name the status is published under. Stable: renaming it strands
 *  the old entry on every existing PR board, where it stays green forever. */
const STATUS_CONTEXT = 'pr-mergeable-guard';

/** The Actions run this verdict came from, so the status links back to it. */
function runUrl(env) {
  const server = env.GITHUB_SERVER_URL;
  const repository = env.GITHUB_REPOSITORY;
  const runId = env.GITHUB_RUN_ID;
  if (!server || !repository || !runId) return undefined;
  return server + '/' + repository + '/actions/runs/' + runId;
}

/**
 * Write the verdict to the PR head as a commit status. Throws on refusal --
 * a guard that silently fails to publish is back to being invisible, which is
 * the defect, not a degraded mode of it.
 */
async function publishStatus(ctx, repo, sha, verdict) {
  const { state, description } = statusForVerdict(verdict);
  const { response, text } = await requestWithRetry(
    ctx,
    'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/statuses/' + sha,
    {
      method: 'POST',
      headers: {
        authorization: 'bearer ' + ctx.token,
        'content-type': 'application/json',
        accept: 'application/vnd.github+json',
        'user-agent': 'check-pr-mergeable',
      },
      // GitHub truncates description at 140 chars; do it here so the text that
      // lands is one we chose rather than one cut mid-word.
      body: JSON.stringify({
        state,
        description: description.slice(0, 140),
        context: STATUS_CONTEXT,
        target_url: runUrl(ctx.env),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      'cannot publish the status to ' + sha.slice(0, 7) + ': HTTP ' + response.status + ' ' + text.slice(0, 200),
    );
  }
  return state;
}

/**
 * A rollup we only partly fetched cannot be judged. `contexts(first: 100)` is
 * a page, and the ordering of a rollup is unspecified -- so a board whose first
 * hundred entries happened to be Vercel and SKIPPED would be judged on a
 * partial view while printing a `total` that was not the total. The PR-LIST
 * list is paged to the end for the same reason; this is the same refusal one
 * level down, which is where it was missing. Live PRs already carry 24-28 contexts.
 */
function assertWholeRollup(rollup, label) {
  if (rollup && rollup.totalCount > rollup.nodes.length) {
    throw new Error(
      'the rollup for ' + label + ' has ' + rollup.totalCount + ' contexts but only ' +
        rollup.nodes.length + ' were fetched; paginate before trusting it',
    );
  }
}

/** Flatten a GraphQL pullRequest node into the shape evaluatePr expects. */
function shapePr(node) {
  const commit = node.commits?.nodes?.[0]?.commit ?? null;
  const rollup = commit?.statusCheckRollup?.contexts ?? null;
  assertWholeRollup(rollup, '#' + node.number);
  return {
    number: node.number,
    state: node.state,
    headRefName: node.headRefName ?? '',
    createdAt: node.createdAt,
    mergeable: node.mergeable,
    mergeStateStatus: node.mergeStateStatus,
    headCommit: commit ? { oid: commit.oid, committedDate: commit.committedDate } : null,
    contexts: rollup?.nodes ?? [],
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Every open PR number, oldest first, paged by cursor. Numbers only: this is
 * the cheap half of the sweep, and the half that has to see the whole board.
 * A PR the list re-serves across a page boundary (the list shifted between
 * calls) is kept once. An outage mid-list keeps what was listed and says so --
 * those PRs are still judged, and the reader is told the rest are unknown.
 */
async function listOpenPrNumbers(ctx, repo) {
  const query =
    'query($owner:String!,$name:String!,$first:Int!,$after:String){repository(owner:$owner,name:$name){' +
    'pullRequests(states:OPEN,first:$first,after:$after,orderBy:{field:CREATED_AT,direction:ASC}){' +
    'totalCount pageInfo{hasNextPage endCursor} nodes{number}}}}';
  const numbers = [];
  const seen = new Set();
  let after = null;
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    let data;
    try {
      data = await graphql(ctx, query, { ...repo, first: ctx.listPageSize, after });
    } catch (error) {
      if (!error.outage) throw error;
      return { numbers, outage: 'listing open PRs: ' + error.message, listComplete: false };
    }
    const connection = data.repository?.pullRequests;
    if (!connection) throw new Error('the repository returned no pullRequests connection');
    for (const node of connection.nodes) {
      if (seen.has(node.number)) continue;
      seen.add(node.number);
      numbers.push(node.number);
    }
    if (!connection.pageInfo?.hasNextPage) {
      // The cursor says done; the count must agree. Fewer numbers than GitHub
      // reports open means the list moved under the cursor (a PR reopened
      // behind it): a short read, refused rather than judged as the board.
      if (numbers.length < connection.totalCount) {
        throw new Error(
          'the sweep listed ' + numbers.length + ' of ' + connection.totalCount + ' open PRs; rerun before trusting it',
        );
      }
      return { numbers, outage: null, listComplete: true };
    }
    const next = connection.pageInfo.endCursor;
    if (!next || next === after) throw new Error('the PR list did not advance past cursor ' + String(after));
    after = next;
  }
  throw new Error('the PR list ran past ' + MAX_LIST_PAGES + ' pages; refusing to trust an endless cursor');
}

/**
 * Full fields for the given PR numbers, DETAIL_BATCH_SIZE per call, each PR an
 * alias (p123: pullRequest(number:123)). Numbers are integers from GitHub or a
 * validated --pr flag, so splicing them into the query is safe. At the first
 * outage the remaining batches are not attempted -- hammering an API that has
 * just failed three times buys nothing -- and every PR not read is returned BY
 * NUMBER as unjudged.
 */
async function fetchPrDetails(ctx, repo, numbers) {
  const byNumber = new Map();
  const unjudged = [];
  let outage = null;
  for (let at = 0; at < numbers.length; at += ctx.batchSize) {
    const batch = numbers.slice(at, at + ctx.batchSize);
    if (outage) {
      unjudged.push(...batch);
      continue;
    }
    const fields = batch.map((n) => 'p' + n + ':pullRequest(number:' + n + '){' + PR_FIELDS + '}').join(' ');
    let data;
    try {
      data = await graphql(
        ctx,
        'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){' + fields + '}}',
        repo,
      );
    } catch (error) {
      if (!error.outage) throw error;
      outage = 'reading PR details: ' + error.message;
      unjudged.push(...batch);
      continue;
    }
    for (const n of batch) {
      const node = data.repository?.['p' + n];
      if (!node) throw new Error('no such pull request: #' + n);
      byNumber.set(n, shapePr(node));
    }
  }
  return { byNumber, unjudged, outage };
}

/**
 * Read PRs, re-reading any whose mergeable is still UNKNOWN. The first read is
 * what asks GitHub to compute the merge ref at all, so a single query reports
 * UNKNOWN for every PR in the repo -- measured, not assumed -- and a guard that
 * did not poll would report MERGEABLE_UNRESOLVED for the whole board forever.
 * Only the PRs still UNKNOWN are re-read, not the whole board.
 *
 * Returns the PRs it could judge plus `unjudged` (numbers) and `outage` (the
 * reason, or null). A PR still UNKNOWN when an outage cut the polling short is
 * moved to unjudged: it was never decided, and the outage is why.
 */
async function fetchPrs(ctx, repo, { number = null } = {}) {
  let numbers = [number];
  let outage = null;
  let listComplete = true;
  if (!number) {
    const listed = await listOpenPrNumbers(ctx, repo);
    numbers = listed.numbers;
    outage = listed.outage;
    listComplete = listed.listComplete;
  }
  const first = await fetchPrDetails(ctx, repo, numbers);
  const unjudged = [...first.unjudged];
  outage = outage ?? first.outage;
  const byNumber = first.byNumber;

  for (let attempt = 2; attempt <= MERGEABLE_POLL_ATTEMPTS; attempt++) {
    // A PR that closed mid-sweep stays UNKNOWN forever; polling it is waste.
    const pending = numbers.filter((n) => {
      const pr = byNumber.get(n);
      return pr?.mergeable === 'UNKNOWN' && (number || pr.state === 'OPEN');
    });
    if (pending.length === 0 || outage) break;
    await ctx.sleep(MERGEABLE_POLL_MS);
    const again = await fetchPrDetails(ctx, repo, pending);
    for (const [n, pr] of again.byNumber) byNumber.set(n, pr);
    if (again.outage) outage = again.outage;
  }
  // Whatever an outage left UNKNOWN was never decided, and the outage is why:
  // it is unjudged, not "could not decide" (exit 2) and certainly not OK.
  if (outage) {
    for (const n of numbers) {
      if (byNumber.get(n)?.mergeable !== 'UNKNOWN') continue;
      byNumber.delete(n);
      if (!unjudged.includes(n)) unjudged.push(n);
    }
  }
  let prs = numbers.filter((n) => byNumber.has(n)).map((n) => byNumber.get(n));
  if (!number) {
    // Listed as open, closed or merged before its details were read. Not a PR
    // the sweep is about, and never one to publish to.
    for (const pr of prs) {
      if (pr.state !== 'OPEN') console.log('  #' + pr.number + ' became ' + pr.state + ' during the sweep; skipped');
    }
    prs = prs.filter((pr) => pr.state === 'OPEN');
  }
  unjudged.sort((a, b) => numbers.indexOf(a) - numbers.indexOf(b));
  return { prs, unjudged, outage, listComplete };
}

/**
 * The PRs among `candidates` whose changed files are docs-only, read in the
 * same DETAIL_BATCH_SIZE batches as fetchPrDetails. At the first outage the
 * rest are returned as `unread`, the same stop fetchPrDetails makes; any other
 * error (401, a bad query) is thrown, because it is a broken guard.
 */
async function fetchDocsOnly(ctx, repo, candidates) {
  const docsOnly = new Set();
  for (let at = 0; at < candidates.length; at += ctx.batchSize) {
    const batch = candidates.slice(at, at + ctx.batchSize);
    const fields = batch
      .map(
        (n) =>
          'f' + n + ':pullRequest(number:' + n + '){files(first:' + FILES_PAGE_SIZE + '){totalCount nodes{path changeType}}}',
      )
      .join(' ');
    let data;
    try {
      data = await graphql(
        ctx,
        'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){' + fields + '}}',
        repo,
      );
    } catch (error) {
      if (!error.outage) throw error;
      return { docsOnly, unread: candidates.slice(at), outage: 'reading changed files: ' + error.message };
    }
    for (const n of batch) {
      if (isDocsOnly(data?.repository?.['f' + n]?.files)) docsOnly.add(n);
    }
  }
  return { docsOnly, unread: [], outage: null };
}

/**
 * Split off the conflicting docs-only worker PRs. Prints the SKIPPED lines and
 * the total; returns the verdicts still judged, plus the PRs an outage left
 * unread (unjudged, never OK and never a verdict).
 */
async function skipDocsOnly(ctx, repo, prs, verdicts) {
  const heads = new Map(prs.map((pr) => [pr.number, pr.headRefName]));
  const candidates = verdicts
    .filter((v) => v.mergeable === 'CONFLICTING' && heads.get(v.number).startsWith(WORKER_HEAD_PREFIX))
    .map((v) => v.number);
  const { docsOnly, unread, outage } =
    candidates.length > 0
      ? await fetchDocsOnly(ctx, repo, candidates)
      : { docsOnly: new Set(), unread: [], outage: null };
  for (const n of candidates) {
    if (docsOnly.has(n)) console.log('  SKIPPED docs-only #' + n + ' ' + heads.get(n));
  }
  console.log('  skipped docs-only: ' + docsOnly.size + ' (of ' + candidates.length + ' conflicting claude/ PR(s) checked)');
  const dropped = new Set([...docsOnly, ...unread]);
  return { verdicts: verdicts.filter((v) => !dropped.has(v.number)), skipped: docsOnly.size, unread, outage };
}

async function fetchCommit(ctx, repo, oid) {
  const query =
    'query($owner:String!,$name:String!,$oid:String!){repository(owner:$owner,name:$name){object(expression:$oid){... on Commit{oid committedDate' +
    ROLLUP_FIELDS +
    '}}}}';
  const data = await graphql(ctx, query, { ...repo, oid });
  const node = data.repository?.object;
  if (!node || !node.oid) throw new Error('no such commit in this repository: ' + oid);
  const rollup = node.statusCheckRollup?.contexts ?? null;
  assertWholeRollup(rollup, node.oid.slice(0, 7));
  return {
    oid: node.oid,
    committedDate: node.committedDate,
    contexts: rollup?.nodes ?? [],
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function describeChecks(checks) {
  return (
    'gates ran ' +
    checks.ran +
    '  (skipped ' +
    checks.skipped +
    ', vercel ' +
    checks.vercel +
    ', other ' +
    checks.other +
    ', total ' +
    checks.total +
    ')'
  );
}

function reportVerdicts(verdicts) {
  for (const verdict of verdicts) {
    const flag =
      verdict.failures.length > 0
        ? 'FAIL '
        : verdict.infra.length > 0
          ? 'INFRA'
          : verdict.deferred
            ? 'defer'
            : 'ok   ';
    console.log(
      '  ' +
        flag +
        '  #' +
        String(verdict.number).padEnd(4) +
        '  ' +
        String(verdict.mergeable).padEnd(11) +
        '  ' +
        describeChecks(verdict.checks) +
        '  head ' +
        verdict.headOid.slice(0, 7),
    );
  }

  const failing = verdicts.filter((v) => v.failures.length > 0);
  const unresolved = verdicts.filter((v) => v.failures.length === 0 && v.infra.length > 0);
  const deferred = verdicts.filter((v) => v.deferred);

  if (deferred.length > 0) {
    console.log(
      NL +
        deferred.length +
        ' PR(s) deferred: no contexts yet, and younger than the grace window. Judged on the next sweep.',
    );
  }

  if (failing.length > 0) {
    console.error(NL + 'PR mergeable guard FAILED.' + NL);
    for (const verdict of failing) {
      console.error('  #' + verdict.number + ':');
      for (const failure of verdict.failures) {
        console.error('    [' + failure.half + ' ' + failure.code + '] ' + failure.detail);
      }
    }
    console.error('');
    console.error('A conflicting PR gets no merge ref, so GitHub never queues its pull_request');
    console.error('workflows: the board goes quiet instead of red, and Vercel keeps passing off');
    console.error('the head commit. The usual cause is a squash-merge of a PR whose commits this');
    console.error('branch still carries individually. Rebase onto the current main, push, and');
    console.error('confirm the gates re-appear before reading the board as green.');
    console.error('');
  }

  if (unresolved.length > 0) {
    console.error(NL + 'PR mergeable guard could not decide:' + NL);
    for (const verdict of unresolved) {
      for (const item of verdict.infra) {
        console.error('  #' + verdict.number + '  [' + item.half + ' ' + item.code + '] ' + item.detail);
      }
    }
    console.error('');
  }

  return { failing: failing.length, unresolved: unresolved.length, deferred: deferred.length };
}

/**
 * GITHUB-OUTAGE, loud on every surface the run has: stderr (so the step
 * summary carries it), an Actions ::warning:: annotation on the run page, and
 * every PR not judged by number. It is printed AFTER the verdicts, so the PRs
 * that were judged keep their lines and a conflict among them still exits 1.
 */
function reportOutage({ outage, unjudged, listComplete, judged, env }) {
  const strict = env[OUTAGE_STRICT_ENV] === '1';
  console.error(NL + 'GITHUB-OUTAGE: GitHub stayed unreachable after retries -- ' + outage);
  console.error('NOT JUDGED (' + unjudged.length + '): ' + (unjudged.map((n) => '#' + n).join(', ') || '(none listed)'));
  if (!listComplete) {
    console.error(
      'The open-PR list itself stopped early: any PR beyond the ' +
        (judged + unjudged.length) +
        ' listed was not judged and its number is unknown.',
    );
  }
  console.error('This run says NOTHING about the PRs above: they are not OK, only unread, and no');
  console.error('status was published to them. The next sweep (hourly) judges them again.');
  console.error(
    strict
      ? OUTAGE_STRICT_ENV + '=1: exiting 2.'
      : 'Exit ' + OUTAGE_EXIT + ' so an outage alone does not red main; ' + OUTAGE_STRICT_ENV + '=1 exits 2.',
  );
  console.error('');
  annotate(
    env,
    (listComplete
      ? 'PR mergeable guard could not judge ' + unjudged.length + ' PR(s)'
      : 'PR mergeable guard could not read the open-PR list; ' + unjudged.length + ' listed PR(s) not judged, the rest unknown') +
      ' (' +
      outage.slice(0, 200) +
      ').',
  );
}

/** An Actions warning on the run page; a no-op outside Actions. */
function annotate(env, text) {
  if (env.GITHUB_ACTIONS === 'true') console.log('::warning title=GITHUB-OUTAGE::' + text + ' Not a pass. See the run summary.');
}

/**
 * The run result as an exit code: 0 pass, 1 violated, 2 could not run -- and
 * the one exception, GITHUB-OUTAGE, which is OUTAGE_EXIT (see there).
 */
export function exitCodeFor(result, env = process.env) {
  if (result.ok) return 0;
  if (result.outage) return env[OUTAGE_STRICT_ENV] === '1' ? 2 : OUTAGE_EXIT;
  return result.infra ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Self-test -- both halves proven in both directions, on the real recorded
// shape of the incident. A guard with no proof it can fail is not a guard.
// ---------------------------------------------------------------------------

/** The rollup actually recorded on b567c8a2 (#217 pre-rebase), verbatim. */
const INCIDENT_CONTEXTS = [
  { __typename: 'CheckRun', name: 'Vercel Preview Comments', conclusion: 'SUCCESS', checkSuite: { app: { slug: 'vercel' } } },
  { __typename: 'CheckRun', name: 'seo-preview', conclusion: 'SKIPPED', checkSuite: { app: { slug: 'github-actions' } } },
  { __typename: 'CheckRun', name: 'check', conclusion: 'SKIPPED', checkSuite: { app: { slug: 'github-actions' } } },
  { __typename: 'CheckRun', name: 'seo-check', conclusion: 'SKIPPED', checkSuite: { app: { slug: 'github-actions' } } },
  { __typename: 'CheckRun', name: 'smoke', conclusion: 'SKIPPED', checkSuite: { app: { slug: 'github-actions' } } },
  { __typename: 'StatusContext', context: 'Vercel', state: 'SUCCESS' },
];

/** A board with real gates on it, the shape every healthy PR shows. */
const HEALTHY_CONTEXTS = [
  ...INCIDENT_CONTEXTS,
  { __typename: 'CheckRun', name: 'unit (Europe/London, full)', conclusion: 'SUCCESS', checkSuite: { app: { slug: 'github-actions' } } },
  { __typename: 'CheckRun', name: 'contract-check', conclusion: 'SUCCESS', checkSuite: { app: { slug: 'github-actions' } } },
];

const OLD = '2026-01-01T00:00:00Z';
const NOW_MS = Date.parse('2026-01-02T00:00:00Z');

function fixturePr(overrides) {
  return {
    number: 1,
    state: 'OPEN',
    createdAt: OLD,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    headCommit: { oid: 'deadbeefdeadbeef', committedDate: OLD },
    contexts: HEALTHY_CONTEXTS,
    ...overrides,
  };
}

const codesOf = (verdict) => verdict.failures.map((f) => f.code).join(',');

async function selfTest() {
  const cases = [];
  const add = (name, fn, expected) => cases.push({ name, fn, expected });
  const evalPr = (overrides, opts) => evaluatePr(fixturePr(overrides), { nowMs: NOW_MS, ...opts });

  // --- H1 mergeable: both directions ---
  add(
    'H1 fires: CONFLICTING is a failure',
    () => codesOf(evalPr({ mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' })),
    'CONFLICTING',
  );
  add('H1 silent: MERGEABLE passes', () => codesOf(evalPr({})), '');
  add(
    'H1: an unresolved UNKNOWN is infrastructure, never a proven conflict',
    () => {
      const verdict = evalPr({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' });
      return codesOf(verdict) + '/' + verdict.infra.map((i) => i.code).join(',');
    },
    '/MERGEABLE_UNRESOLVED',
  );

  // --- H2 gates: both directions, against the recorded incident board ---
  add(
    'H2 fires: the real #217 pre-rebase board (4 skipped + 2 Vercel) has no gates',
    () => codesOf(evalPr({ contexts: INCIDENT_CONTEXTS })),
    'NO_GATES_RAN',
  );
  add(
    'H2 counts the incident board precisely: 0 ran, 4 skipped, 2 vercel, 6 total',
    () => {
      const c = classifyContexts(INCIDENT_CONTEXTS);
      return [c.ran, c.skipped, c.vercel, c.total].join('/');
    },
    '0/4/2/6',
  );

  // The halves are independent, and these are the cases that prove it: a PR can
  // conflict while its gates ran (#138 did), and can lose its gates while
  // perfectly mergeable (a bad paths: filter). One assertion cannot cover both.
  add(
    'independence: CONFLICTING with healthy gates fires H1 only',
    () => codesOf(evalPr({ mergeable: 'CONFLICTING' })),
    'CONFLICTING',
  );

  add(
    'independence: both halves fire at once -- the incident itself',
    () => codesOf(evalPr({ mergeable: 'CONFLICTING', contexts: INCIDENT_CONTEXTS })),
    'CONFLICTING,NO_GATES_RAN',
  );

  // --- REGRESSION: the guard must not count itself as a gate ---
  // This is the defect that would have switched H2 off permanently. The first
  // version counted any non-Vercel context as a gate, and this script publishes
  // a non-Vercel context onto every PR head. Sweep 1 wrote it, sweep 2 read it
  // back, and every empty board reported "1 gate(s) ran, mergeable" from then
  // on. Confirmed on live data: PR #180 carried the status within seconds.
  const OWN_STATUS = { __typename: 'StatusContext', context: STATUS_CONTEXT, state: 'SUCCESS' };
  add(
    'self-count: the guard OWN published status is not a gate',
    () => classifyContexts([...INCIDENT_CONTEXTS, OWN_STATUS]).ran,
    0,
  );
  add(
    'self-count: an incident board plus our own status still fails H2',
    () => codesOf(evalPr({ contexts: [...INCIDENT_CONTEXTS, OWN_STATUS] })),
    'NO_GATES_RAN',
  );
  add(
    'self-count: our own status is reported as other, never as a gate',
    () => {
      const c = classifyContexts([...INCIDENT_CONTEXTS, OWN_STATUS]);
      return [c.ran, c.other, c.gateTotal].join('/');
    },
    '0/1/4',
  );
  // Two more things the old exclusion rule wrongly counted.
  add(
    'gate: a Dependabot check run is not one of our gates',
    () =>
      classifyContexts([
        { __typename: 'CheckRun', name: '.github/dependabot.yml', conclusion: 'SUCCESS', checkSuite: { app: { slug: 'dependabot' } } },
      ]).ran,
    0,
  );
  add(
    'gate: an EXPECTED required status has NOT been posted, so it is not a gate',
    () => classifyContexts([{ __typename: 'StatusContext', context: 'ci/required-thing', state: 'EXPECTED' }]).ran,
    0,
  );

  // --- Vercel classification: the exclusion must not eat a real gate ---
  add('vercel: a check run from the vercel app is excluded', () => (isVercelContext(INCIDENT_CONTEXTS[0]) ? 1 : 0), 1);
  add(
    'vercel: the bare Vercel commit status is excluded',
    () => (isVercelContext({ __typename: 'StatusContext', context: 'Vercel' }) ? 1 : 0),
    1,
  );
  add(
    'vercel: a github-actions check run is NOT excluded',
    () => (isVercelContext({ __typename: 'CheckRun', name: 'unit', checkSuite: { app: { slug: 'github-actions' } } }) ? 1 : 0),
    0,
  );
  // The near-miss this guards: a CI gate whose NAME mentions vercel must still
  // count, or the exclusion silently deletes a gate and H2 goes blind.
  add(
    'vercel: a github-actions gate whose NAME mentions vercel still counts',
    () =>
      classifyContexts([
        { __typename: 'CheckRun', name: 'vercel-bundle-budget', conclusion: 'SUCCESS', checkSuite: { app: { slug: 'github-actions' } } },
      ]).ran,
    1,
  );
  add(
    'ran: a queued gate counts -- it queued, which is the thing under test',
    () =>
      classifyContexts([
        { __typename: 'CheckRun', name: 'unit', status: 'QUEUED', conclusion: null, checkSuite: { app: { slug: 'github-actions' } } },
      ]).ran,
    1,
  );
  add(
    'ran: a FAILING gate counts -- a red gate is a gate that ran',
    () =>
      classifyContexts([
        { __typename: 'CheckRun', name: 'unit', conclusion: 'FAILURE', checkSuite: { app: { slug: 'github-actions' } } },
      ]).ran,
    1,
  );

  // --- The grace window, both directions. It must never become a silent skip ---
  add(
    'grace: an empty board on a brand-new PR is deferred, not failed',
    () => {
      const verdict = evaluatePr(
        fixturePr({
          contexts: [],
          createdAt: '2026-01-01T23:55:00Z',
          headCommit: { oid: 'abc', committedDate: '2026-01-01T23:55:00Z' },
        }),
        { nowMs: NOW_MS },
      );
      return (verdict.deferred ? 'defer' : 'judge') + '/' + codesOf(verdict);
    },
    'defer/',
  );
  add('grace: the same empty board on an old PR fails', () => codesOf(evalPr({ contexts: [] })), 'NO_GATES_RAN');
  // The false-red this fixed: Vercel posts within seconds of a push, Actions
  // check runs take longer to register, so a board holding only Vercel is what
  // a thirty-second-old PR normally looks like. Keying the window on "no
  // contexts" judged it instantly and published a red onto a healthy PR.
  const VERCEL_ONLY = [{ __typename: 'StatusContext', context: 'Vercel', state: 'PENDING' }];
  add(
    'grace: a board holding only Vercel on a new PR is deferred, not failed',
    () => {
      const verdict = evaluatePr(
        fixturePr({
          contexts: VERCEL_ONLY,
          createdAt: '2026-01-01T23:55:00Z',
          headCommit: { oid: 'abc', committedDate: '2026-01-01T23:55:00Z' },
        }),
        { nowMs: NOW_MS },
      );
      return (verdict.deferred ? 'defer' : 'judge') + '/' + codesOf(verdict);
    },
    'defer/',
  );
  add(
    'grace: a board holding only Vercel on an OLD PR still fails',
    () => codesOf(evalPr({ contexts: VERCEL_ONLY })),
    'NO_GATES_RAN',
  );
  // The sharp edge. The incident PR was minutes old and DID have contexts, so a
  // grace window keyed on age alone would have excused it. It is keyed on an
  // EMPTY board as well, and this case is what holds that.
  add(
    'grace: a young PR carrying the incident board is judged NOW, not deferred',
    () => {
      const verdict = evaluatePr(
        fixturePr({
          contexts: INCIDENT_CONTEXTS,
          createdAt: '2026-01-01T23:59:00Z',
          headCommit: { oid: 'abc', committedDate: '2026-01-01T23:59:00Z' },
        }),
        { nowMs: NOW_MS },
      );
      return (verdict.deferred ? 'defer' : 'judge') + '/' + codesOf(verdict);
    },
    'judge/NO_GATES_RAN',
  );
  // Age comes from the LATER of the two stamps: a branch rebased today onto an
  // older commit must not inherit that age and be judged before its gates land.
  add(
    'grace: age comes from the later of createdAt and the head commit',
    () => Math.round(ageMinutes({ createdAt: OLD, headCommit: { committedDate: '2026-01-01T23:30:00Z' } }, NOW_MS)),
    30,
  );

  // --- The published commit status: every state reachable, and correct ---
  // This is the entry that appears ON the PR board, so a wrong mapping puts a
  // green tick next to a conflict -- the original defect with extra steps.
  const stateOf = (overrides) => statusForVerdict(evalPr(overrides)).state;
  add('status: a conflict publishes failure', () => stateOf({ mergeable: 'CONFLICTING' }), 'failure');
  add('status: an empty board publishes failure', () => stateOf({ contexts: INCIDENT_CONTEXTS }), 'failure');
  add('status: a clean PR publishes success', () => stateOf({}), 'success');
  add(
    'status: an undecidable read publishes pending, not success and not a red X',
    () => stateOf({ mergeable: 'UNKNOWN' }),
    'pending',
  );
  add('publish: an OPEN PR is written to', () => (mayPublish({ state: 'OPEN' }) ? 1 : 0), 1);
  add('publish: a CLOSED PR is never written to', () => (mayPublish({ state: 'CLOSED' }) ? 1 : 0), 0);
  add('publish: a MERGED PR is never written to', () => (mayPublish({ state: 'MERGED' }) ? 1 : 0), 0);
  add(
    'status: a deferred PR publishes pending, not success',
    () =>
      statusForVerdict(
        evaluatePr(
          fixturePr({
            contexts: [],
            createdAt: '2026-01-01T23:55:00Z',
            headCommit: { oid: 'abc', committedDate: '2026-01-01T23:55:00Z' },
          }),
          { nowMs: NOW_MS },
        ),
      ).state,
    'pending',
  );
  // GitHub truncates at 140; the description must survive its own worst case.
  add(
    'status: the description names both halves when both fire',
    () => {
      const text = statusForVerdict(evalPr({ mergeable: 'CONFLICTING', contexts: INCIDENT_CONTEXTS })).description;
      return [text.includes('CONFLICTING'), text.includes('no gates ran'), text.length <= 140].join('/');
    },
    'true/true/true',
  );

  // --- Commit mode, both directions ---
  add('commit: the incident commit fails H2', () => evaluateCommit({ oid: 'b567c8a', contexts: INCIDENT_CONTEXTS }).failures.length, 1);
  add('commit: a healthy commit passes', () => evaluateCommit({ oid: 'f08be93', contexts: HEALTHY_CONTEXTS }).failures.length, 0);

  // --- Repo slug parsing, both remote spellings ---
  add(
    'repo: https remote',
    () => JSON.stringify(parseRepoSlug('https://github.com/123constante/bachata-website.git')),
    '{"owner":"123constante","name":"bachata-website"}',
  );
  add(
    'repo: ssh remote',
    () => JSON.stringify(parseRepoSlug('git@github.com:123constante/bachata-website.git')),
    '{"owner":"123constante","name":"bachata-website"}',
  );

  // --- THE SWEEP AGAINST A FAILING GITHUB, driven through main() ---
  // 2026-10-24: every hourly run went red on "GitHub API HTTP 504" because ONE
  // query asked for 100 PRs x 100 rollup contexts (~10,100 nodes) and GitHub
  // timed it out at ~11 s -- and 136 PRs were open, so a first:100 page could
  // not have covered the board even on a good day. These cases drive the real
  // exit owner, main(), against a fake GitHub: sealed (no token, no network --
  // the global fetch is swapped too, so a code path that forgets the injected
  // one still cannot reach api.github.com), and each pins WHICH branch fired,
  // not just the code, because the outage, the 401 and the bad query must stay
  // three different answers.
  const reply = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const rollupOf = (pr) =>
    pr.empty
      ? INCIDENT_CONTEXTS
      : pr.ownStatus
      ? [...HEALTHY_CONTEXTS, { __typename: 'StatusContext', context: STATUS_CONTEXT, ...pr.ownStatus }]
      : HEALTHY_CONTEXTS;
  const prNode = (pr) => ({
    number: pr.number,
    state: pr.state ?? 'OPEN',
    isDraft: false,
    headRefName: pr.head ?? 'feature/fixture',
    title: 'fixture',
    createdAt: OLD,
    mergeable: pr.mergeable ?? 'MERGEABLE',
    mergeStateStatus: pr.mergeable === 'CONFLICTING' ? 'DIRTY' : 'CLEAN',
    commits: {
      nodes: [
        {
          commit: {
            oid: 'abc' + pr.number,
            committedDate: OLD,
            statusCheckRollup: { contexts: { totalCount: rollupOf(pr).length, nodes: rollupOf(pr) } },
          },
        },
      ],
    },
  });
  // `plan` scripts the first GraphQL calls (a reply, or 'net' for a thrown
  // network error); after it runs out the fake serves the board. `overlap`
  // re-serves the last PR of each page at the top of the next one, the shift a
  // PR opening or closing mid-sweep can cause. `latencyMs` advances the fake
  // clock per call; `extraOpen` reports PRs open that the list never serves.
  // A REST status POST is recorded in `posts` and answered 201.
  const fakeGitHub = (prs, { plan = [], overlap = false, unknownReads = {}, latencyMs = 0, extraOpen = 0 } = {}) => {
    const calls = [];
    const posts = [];
    const reads = {};
    let clock = NOW_MS;
    const fetchFake = async (url, init) => {
      clock += latencyMs;
      if (url !== API) {
        posts.push(url.split('/statuses/')[1]);
        return reply(201, {});
      }
      const request = JSON.parse(init.body);
      calls.push(request);
      const scripted = plan[calls.length - 1];
      if (scripted === 'net') throw new Error('socket hang up');
      if (scripted) return scripted;
      const query = request.query;
      const variables = request.variables ?? {};
      const repository = {};
      if (query.includes('pullRequests(')) {
        const first = variables.first ?? 100;
        let start = variables.after ? Number(variables.after.slice(1)) : 0;
        if (overlap && start > 0) start -= 1;
        const page = prs.slice(start, start + first);
        const end = start + page.length;
        repository.pullRequests = {
          totalCount: prs.length + extraOpen,
          pageInfo: { hasNextPage: end < prs.length, endCursor: 'c' + end },
          nodes: page.map(prNode),
        };
      }
      for (const pr of prs) {
        if (!query.includes('p' + pr.number + ':pullRequest(')) continue;
        reads[pr.number] = (reads[pr.number] ?? 0) + 1;
        const lazy = reads[pr.number] <= (unknownReads[pr.number] ?? 0);
        repository['p' + pr.number] = prNode(lazy ? { ...pr, mergeable: 'UNKNOWN' } : pr);
      }
      for (const pr of prs) {
        if (!query.includes('f' + pr.number + ':pullRequest(')) continue;
        const files = (pr.files ?? ['src/app.ts']).map((f) => (typeof f === 'string' ? { path: f, changeType: 'MODIFIED' } : f));
        repository['f' + pr.number] = { files: { totalCount: 'fileTotal' in pr ? pr.fileTotal : files.length, nodes: files } };
      }
      return reply(200, { data: { repository } });
    };
    return { calls, posts, fetchFake, now: () => clock };
  };
  const drive = async (argv, github, extraDeps = {}) => {
    const lines = [];
    const realLog = console.log;
    const realError = console.error;
    const realFetch = globalThis.fetch;
    console.log = (...parts) => lines.push(parts.join(' '));
    console.error = (...parts) => lines.push(parts.join(' '));
    globalThis.fetch = github.fetchFake;
    let code;
    try {
      code = await main(argv, {
        fetch: github.fetchFake,
        sleep: async () => {},
        now: github.now,
        env: { GITHUB_TOKEN: 'fixture-token', GITHUB_REPOSITORY: 'fixture/repo' },
        ...extraDeps,
      });
    } finally {
      console.log = realLog;
      console.error = realError;
      globalThis.fetch = realFetch;
    }
    return { code, out: lines.join(NL), calls: github.calls, posts: github.posts };
  };
  const board = (count, overrides = {}) =>
    Array.from({ length: count }, (_, index) => ({ number: index + 1, ...(overrides[index + 1] ?? {}) }));
  const judgedOrder = (out) =>
    out
      .split(NL)
      .filter((line) => line.startsWith('  ok') || line.startsWith('  FAIL'))
      .map((line) => line.split('#')[1].trim().split(' ')[0])
      .join(',');
  const GATEWAY_504 = reply(504, '<!DOCTYPE html><title>Unicorn! - GitHub</title>');

  add(
    'retry: one 504 then 200 passes, in exactly 2 calls',
    async () => {
      const r = await drive(['--pr', '1'], fakeGitHub(board(1), { plan: [GATEWAY_504] }));
      return [r.code, r.calls.length, r.out.includes('guard passed')].join('/');
    },
    '0/2/true',
  );
  add(
    'retry: a network error is retried like a 504',
    async () => {
      const r = await drive(['--pr', '1'], fakeGitHub(board(1), { plan: ['net'] }));
      return [r.code, r.calls.length].join('/');
    },
    '0/2',
  );
  add(
    'outage: 504 x3 on the PR list says GITHUB-OUTAGE, never passes, stops at 3 calls',
    async () => {
      const r = await drive([], fakeGitHub(board(2), { plan: [GATEWAY_504, GATEWAY_504, GATEWAY_504] }));
      return [r.code, r.calls.length, r.out.includes('GITHUB-OUTAGE'), r.out.includes('guard passed')].join('/');
    },
    '0/3/true/false',
  );
  add(
    'outage: PRs whose details never arrived are NAMED as not judged, never counted OK',
    async () => {
      const r = await drive([], fakeGitHub(board(2), { plan: [undefined, GATEWAY_504, GATEWAY_504, GATEWAY_504] }));
      const notJudged = r.out.split(NL).find((line) => line.startsWith('NOT JUDGED')) ?? '';
      return [r.code, notJudged, judgedOrder(r.out), r.out.includes('guard passed')].join('/');
    },
    '0/NOT JUDGED (2): #1, #2/' + '/false',
  );
  add(
    'outage: PR_GUARD_OUTAGE_STRICT=1 turns the outage into exit 2',
    async () => {
      const r = await drive([], fakeGitHub(board(2), { plan: [GATEWAY_504, GATEWAY_504, GATEWAY_504] }), {
        env: { GITHUB_TOKEN: 'fixture-token', GITHUB_REPOSITORY: 'fixture/repo', PR_GUARD_OUTAGE_STRICT: '1' },
      });
      return [r.code, r.out.includes('GITHUB-OUTAGE')].join('/');
    },
    '2/true',
  );
  add(
    'budget: retrying stops once failed attempts and waits pass the budget',
    async () => {
      const github = fakeGitHub(board(2), { plan: [GATEWAY_504, GATEWAY_504, GATEWAY_504], latencyMs: 100000 });
      const r = await drive([], github);
      return [r.code, r.calls.length, r.out.includes('retry budget'), r.out.includes('GITHUB-OUTAGE')].join('/');
    },
    '0/2/true/true',
  );
  add(
    'budget: a long HEALTHY sweep does not spend it -- a late 504 still gets its retry',
    async () => {
      const github = fakeGitHub(board(6), { plan: [undefined, undefined, undefined, GATEWAY_504], latencyMs: 60000 });
      const r = await drive([], github, { batchSize: 2 });
      return [r.code, r.calls.length, r.out.includes('guard passed')].join('/');
    },
    '0/5/true',
  );
  add(
    'outage: a PR still UNKNOWN when the outage hit is NOT JUDGED, not exit 2',
    async () => {
      const github = fakeGitHub(board(4), {
        plan: [undefined, undefined, GATEWAY_504, GATEWAY_504, GATEWAY_504],
        unknownReads: { 1: 9 },
      });
      const r = await drive([], github, { batchSize: 2 });
      const notJudged = r.out.split(NL).find((line) => line.startsWith('NOT JUDGED')) ?? '';
      return [r.code, notJudged, r.out.includes('MERGEABLE_UNRESOLVED')].join('/');
    },
    '0/NOT JUDGED (3): #1, #3, #4/false',
  );
  add(
    'paging: a list shorter than the open count GitHub reports is refused, exit 2',
    async () => {
      const r = await drive([], fakeGitHub(board(2), { extraOpen: 1 }));
      return [r.code, r.out.includes('listed 2 of 3')].join('/');
    },
    '2/true',
  );
  add(
    'publish: an unchanged status is not re-posted; a changed or missing one is',
    async () => {
      const prs = board(3, {
        1: { ownStatus: { state: 'SUCCESS', description: '2 gate(s) ran, mergeable' } },
        2: { ownStatus: { state: 'PENDING', description: 'no contexts yet; judged on the next sweep' } },
      });
      const r = await drive(['--publish-status'], fakeGitHub(prs));
      return [r.code, r.posts.join(',')].join('/');
    },
    '0/abc2,abc3',
  );
  add(
    'publish: a status write lost to an outage keeps the verdicts, names the PRs, never passes',
    async () => {
      const github = fakeGitHub(board(2));
      const realFetch = github.fetchFake;
      github.fetchFake = async (url, init) => (url === API ? realFetch(url, init) : GATEWAY_504);
      const r = await drive(['--publish-status'], github);
      const line = r.out.split(NL).find((l) => l.startsWith('STATUS NOT PUBLISHED')) ?? '';
      return [r.code, line, r.out.includes('guard passed')].join('/');
    },
    '0/STATUS NOT PUBLISHED (2): #1, #2/false',
  );
  add(
    'no retry: a 401 is answered once and exits 2, not as an outage',
    async () => {
      const r = await drive([], fakeGitHub(board(2), { plan: [reply(401, { message: 'Bad credentials' })] }));
      return [r.code, r.calls.length, r.out.includes('HTTP 401'), r.out.includes('GITHUB-OUTAGE')].join('/');
    },
    '2/1/true/false',
  );
  add(
    'no retry: a GraphQL errors body is answered once and exits 2, not as an outage',
    async () => {
      const r = await drive([], fakeGitHub(board(2), { plan: [reply(200, { errors: [{ message: 'Field x is unknown' }] })] }));
      return [r.code, r.calls.length, r.out.includes('GitHub API errors'), r.out.includes('GITHUB-OUTAGE')].join('/');
    },
    '2/1/true/false',
  );
  add(
    'paging: 3 list pages, cursor passed through, every PR judged once and in order',
    async () => {
      const r = await drive([], fakeGitHub(board(7)), { listPageSize: 3, batchSize: 3 });
      const cursors = r.calls.filter((c) => c.query.includes('pullRequests(')).map((c) => String(c.variables.after));
      return [r.code, cursors.join(','), judgedOrder(r.out)].join('/');
    },
    '0/null,c3,c6/1,2,3,4,5,6,7',
  );
  add(
    'paging: a PR re-served across a page boundary is judged once, not twice',
    async () => {
      const r = await drive([], fakeGitHub(board(7), { overlap: true }), { listPageSize: 3, batchSize: 3 });
      return [r.code, judgedOrder(r.out)].join('/');
    },
    '0/1,2,3,4,5,6,7',
  );
  add(
    'poll: only the PR still UNKNOWN is re-read, and it is judged once it resolves',
    async () => {
      const r = await drive([], fakeGitHub(board(3), { unknownReads: { 2: 2 } }));
      const rereads = r.calls.slice(2).map((c) => c.query.split(':pullRequest(').length - 1);
      return [r.code, r.calls.length, rereads.join(','), r.calls[3].query.includes('p2:pullRequest('), judgedOrder(r.out)].join('/');
    },
    '0/4/1,1/true/1,2,3',
  );
  add(
    'paging: a conflicting PR on page 2 still exits 1',
    async () => {
      const r = await drive([], fakeGitHub(board(7, { 5: { mergeable: 'CONFLICTING' } })), { listPageSize: 3, batchSize: 3 });
      return [r.code, r.out.includes('#5:')].join('/');
    },
    '1/true',
  );
  add(
    'outage: a conflict already judged still exits 1 when a later batch is lost, and no batch is tried after it',
    async () => {
      const github = fakeGitHub(board(6, { 1: { mergeable: 'CONFLICTING' } }), {
        plan: [undefined, undefined, GATEWAY_504, GATEWAY_504, GATEWAY_504],
      });
      const r = await drive([], github, { listPageSize: 100, batchSize: 2 });
      const notJudged = r.out.split(NL).find((line) => line.startsWith('NOT JUDGED')) ?? '';
      return [r.code, r.calls.length, notJudged].join('/');
    },
    '1/5/NOT JUDGED (4): #3, #4, #5, #6',
  );

  // --- DOCS-ONLY WORKER PRs (owner, 2026-10-24: "Skip docs-only, list the rest") ---
  // 73 open PRs were CONFLICTING, about half of them docs-only claude/ worker
  // branches. Those are skipped VISIBLY: a line each and a total, never in the
  // ok tally, never published to. Everything else stays judged.
  const DOCS = { mergeable: 'CONFLICTING', head: 'claude/docs-x', files: ['docs/a.md', 'briefs/b.md', 'plans/c.md'] };
  const skipShape = (r) =>
    [
      r.code,
      r.out.split(NL).filter((line) => line.startsWith('  SKIPPED docs-only #')).join('|'),
      (r.out.split(NL).find((line) => line.startsWith('  skipped docs-only: ')) ?? '  skipped docs-only: none').split(' ')[4],
    ].join('/');
  add(
    'docs-only: a conflicting claude/ docs PR is SKIPPED by name, exit 0, not in the ok tally, not published to',
    async () => {
      const r = await drive(['--publish-status'], fakeGitHub(board(2, { 1: DOCS })));
      return [
        skipShape(r),
        judgedOrder(r.out),
        r.posts.join(','),
        r.out.includes('guard passed: 1 PR(s) judged') && r.out.includes('1 conflicting docs-only PR(s) SKIPPED'),
      ].join('/');
    },
    '0/  SKIPPED docs-only #1 claude/docs-x/1/2/abc2/true',
  );
  add(
    'docs-only: the same PR with one src/ file is judged and FAILs',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, files: [...DOCS.files, 'src/x.tsx'] } })))),
    '1//0',
  );
  add(
    'docs-only: a docs/ Markdown file plus one .ts is not docs-only',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, files: ['docs/a.md', 'scripts/x.ts'] } })))),
    '1//0',
  );
  add(
    'docs-only: a Dependabot head is judged even when every file is docs',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, head: 'dependabot/npm_and_yarn/x' } })))),
    '1//0',
  );
  add(
    'docs-only: a human branch is judged even when every file is docs',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, head: 'ricky/notes' } })))),
    '1//0',
  );
  add(
    'docs-only: Markdown at the repo root only is docs-only',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, files: ['README.md', 'CLAUDE.md'] } })))),
    '0/  SKIPPED docs-only #1 claude/docs-x/1',
  );
  add(
    'docs-only: a non-Markdown file under docs/ is docs-only',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, files: ['docs/diagram.png'] } })))),
    '0/  SKIPPED docs-only #1 claude/docs-x/1',
  );
  add(
    'docs-only: a file list longer than the page fetched is never guessed docs-only',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, fileTotal: 150 } })))),
    '1//0',
  );
  add(
    'docs-only: a PR with no changed files is not docs-only',
    async () => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, files: [] } })))),
    '1//0',
  );
  const skipsWith = async (overrides) => skipShape(await drive([], fakeGitHub(board(1, { 1: { ...DOCS, ...overrides } }))));
  add('docs-only: a non-Markdown file under briefs/ is docs-only', () => skipsWith({ files: ['briefs/x.json'] }), '0/  SKIPPED docs-only #1 claude/docs-x/1');
  add('docs-only: a non-Markdown file under plans/ is docs-only', () => skipsWith({ files: ['plans/x.json'] }), '0/  SKIPPED docs-only #1 claude/docs-x/1');
  add('docs-only: an upper-case .MD at the root is docs-only', () => skipsWith({ files: ['NOTES.MD'] }), '0/  SKIPPED docs-only #1 claude/docs-x/1');
  add('docs-only: Markdown under src/ is code, not docs', () => skipsWith({ files: ['src/modules/event-page/CLAUDE.md'] }), '1//0');
  add('docs-only: Markdown under .github/ is code, not docs', () => skipsWith({ files: ['.github/pull_request_template.md'] }), '1//0');
  add(
    'docs-only: a RENAMED file is never judged by its new path (code moved into docs/)',
    () => skipsWith({ files: [{ path: 'docs/archive/check-foo.mjs', changeType: 'RENAMED' }] }),
    '1//0',
  );
  add('docs-only: a missing totalCount is not a whole list', () => skipsWith({ fileTotal: null }), '1//0');
  add(
    'docs-only: a MERGEABLE docs PR with an empty board still FAILs NO_GATES_RAN, files never read',
    async () => {
      const r = await drive([], fakeGitHub(board(1, { 1: { ...DOCS, mergeable: 'MERGEABLE', empty: true } })));
      return [skipShape(r), r.out.includes('NO_GATES_RAN'), r.calls.some((c) => c.query.includes('files('))].join('/');
    },
    '1//0/true/false',
  );
  add(
    'docs-only: a healthy docs PR stays ok and its files are never read',
    async () => {
      const r = await drive([], fakeGitHub(board(1, { 1: { ...DOCS, mergeable: 'MERGEABLE' } })));
      return [skipShape(r), judgedOrder(r.out), r.calls.some((c) => c.query.includes('files('))].join('/');
    },
    '0//0/1/false',
  );
  add(
    'docs-only: --pr on a skipped PR says SKIPPED, not that it is mergeable',
    async () => {
      const r = await drive(['--pr', '1'], fakeGitHub(board(1, { 1: DOCS })));
      return [skipShape(r), r.out.includes('0 PR(s) judged') && r.out.includes('1 conflicting docs-only PR(s) SKIPPED')].join('/');
    },
    '0/  SKIPPED docs-only #1 claude/docs-x/1/true',
  );
  add(
    'docs-only: files lost to an outage leave the PR NOT JUDGED, never a verdict and never a pass',
    async () => {
      const github = fakeGitHub(board(2, { 1: DOCS }), { plan: [undefined, undefined, GATEWAY_504, GATEWAY_504, GATEWAY_504] });
      const r = await drive([], github);
      const notJudged = r.out.split(NL).find((line) => line.startsWith('NOT JUDGED')) ?? '';
      return [skipShape(r), notJudged, judgedOrder(r.out), r.out.includes('guard passed')].join('/');
    },
    '0//0/NOT JUDGED (1): #1/2/false',
  );
  add(
    'docs-only: a partial outage keeps the batch already read, and only the rest go unjudged',
    async () => {
      const github = fakeGitHub(board(3, { 1: DOCS, 2: { ...DOCS, files: ['src/x.ts'] }, 3: DOCS }), {
        plan: [undefined, undefined, undefined, undefined, GATEWAY_504, GATEWAY_504, GATEWAY_504],
      });
      const r = await drive([], github, { batchSize: 2 });
      const notJudged = r.out.split(NL).find((line) => line.startsWith('NOT JUDGED')) ?? '';
      return [skipShape(r), notJudged].join('/');
    },
    '1/  SKIPPED docs-only #1 claude/docs-x/1/NOT JUDGED (1): #3',
  );
  add(
    'docs-only: a 401 on the files read is a broken guard (exit 2), not a silent judge',
    async () => {
      const github = fakeGitHub(board(1, { 1: DOCS }), { plan: [undefined, undefined, reply(401, { message: 'Bad credentials' })] });
      const r = await drive([], github);
      return [r.code, r.out.includes('cannot run')].join('/');
    },
    '2/true',
  );

  let failed = 0;
  for (const item of cases) {
    let got;
    try {
      got = await item.fn();
    } catch (error) {
      got = 'threw: ' + error.message;
    }
    const ok = got === item.expected;
    if (!ok) failed++;
    const detail = ok ? '' : '  (expected ' + JSON.stringify(item.expected) + ', got ' + JSON.stringify(got) + ')';
    console.log((ok ? 'ok  ' : 'FAIL') + '  ' + item.name + detail);
  }

  if (failed > 0) {
    console.error(NL + 'FAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  console.log(NL + 'PASS self-test -- ' + cases.length + ' cases, both halves proven in both directions.');
  return true;
}

// ---------------------------------------------------------------------------

export async function run(
  { number = null, sha = null, minAgeMinutes = DEFAULT_MIN_AGE_MINUTES, publish = false } = {},
  deps = {},
) {
  const env = deps.env ?? process.env;
  const auth = resolveToken(env);
  if (!auth.token) {
    console.error('PR mergeable guard cannot run: no GitHub credential.');
    console.error('Set GITHUB_TOKEN or GH_TOKEN, or authenticate the gh CLI.');
    if (auth.reason) console.error('gh auth token said: ' + auth.reason);
    return { ok: false, infra: true };
  }

  let repo;
  try {
    repo = resolveRepo(env);
  } catch (error) {
    console.error('PR mergeable guard cannot run: ' + error.message);
    return { ok: false, infra: true };
  }
  const label = repo.owner + '/' + repo.name;
  const now = deps.now ?? Date.now;
  const ctx = {
    token: auth.token,
    fetch: deps.fetch ?? globalThis.fetch,
    sleep: deps.sleep ?? sleep,
    now,
    retrySpentMs: 0,
    env,
    listPageSize: deps.listPageSize ?? LIST_PAGE_SIZE,
    batchSize: deps.batchSize ?? DETAIL_BATCH_SIZE,
  };

  if (sha) {
    let commit;
    try {
      // An outage here stays exit 2, never the outage code: this is the live
      // canary, and the workflow reads its 0 as "the guard has gone blind".
      commit = await fetchCommit(ctx, repo, sha);
    } catch (error) {
      console.error('PR mergeable guard cannot run: ' + error.message);
      return { ok: false, infra: true };
    }
    const verdict = evaluateCommit(commit);
    console.log('PR mergeable guard -- ' + label + ', commit ' + verdict.oid.slice(0, 7) + ', H2 only (a commit has no merge ref).');
    console.log('  ' + (verdict.failures.length > 0 ? 'FAIL ' : 'ok   ') + '  ' + describeChecks(verdict.checks));
    if (verdict.checks.ran > 0) console.log('  gates: ' + verdict.checks.ranNames.join(', '));
    if (verdict.failures.length === 0) return { ok: true };
    console.error(NL + 'PR mergeable guard FAILED.');
    for (const failure of verdict.failures) {
      console.error('  [' + failure.half + ' ' + failure.code + '] ' + failure.detail);
    }
    console.error('');
    return { ok: false };
  }

  let fetched;
  try {
    fetched = await fetchPrs(ctx, repo, { number });
  } catch (error) {
    console.error('PR mergeable guard cannot run: ' + error.message);
    return { ok: false, infra: true };
  }

  const { prs, listComplete } = fetched;
  const unjudged = [...fetched.unjudged];
  let outage = fetched.outage;
  let scope = number ? 'PR #' + number : prs.length + ' open PR(s)';
  if (outage) scope += ', ' + unjudged.length + ' NOT judged' + (listComplete ? '' : ', list incomplete');
  console.log('PR mergeable guard -- ' + label + ', ' + scope + ', credential from ' + auth.source + '.');

  const nowMs = now();
  let skip;
  try {
    skip = await skipDocsOnly(ctx, repo, prs, prs.map((each) => evaluatePr(each, { nowMs, minAgeMinutes })));
  } catch (error) {
    console.error('PR mergeable guard cannot run: ' + error.message);
    return { ok: false, infra: true };
  }
  const verdicts = skip.verdicts;
  unjudged.push(...skip.unread);
  outage = outage ?? skip.outage;
  const tally = reportVerdicts(verdicts);
  if (outage) reportOutage({ outage, unjudged, listComplete, judged: prs.length - skip.unread.length, env });
  // Publishing is opt-in, and deliberately unreachable from --sha mode: that
  // mode is the live canary, and a canary that writes to the repo it is
  // checking is not a canary.
  const publishErrors = [];
  let publishOutage = null;
  const unpublished = [];
  const prByNumber = new Map(prs.map((pr) => [pr.number, pr]));
  if (publish) {
    for (const verdict of verdicts) {
      if (publishOutage) {
        unpublished.push(verdict.number);
        continue;
      }
      if (!verdict.headOid) {
        publishErrors.push('#' + verdict.number + ': no head commit to attach a status to');
        continue;
      }
      if (!mayPublish(verdict)) {
        console.log('  not publishing to #' + verdict.number + ': state is ' + verdict.state + ', not OPEN');
        continue;
      }
      // Unchanged since the last sweep: no write. The whole board is ~136 PRs
      // swept hourly AND on every push to main, and GITHUB_TOKEN gets ~1,000
      // REST calls an hour per repo -- re-posting identical statuses would
      // spend that and red the job on a 403 that says nothing about any PR.
      const wanted = statusForVerdict(verdict);
      const current = (prByNumber.get(verdict.number)?.contexts ?? []).find(
        (c) => c.__typename === 'StatusContext' && c.context === STATUS_CONTEXT,
      );
      if (current && current.state === wanted.state.toUpperCase() && current.description === wanted.description.slice(0, 140)) {
        console.log('  unchanged ' + STATUS_CONTEXT + '=' + wanted.state + ' on #' + verdict.number + '; not re-posted');
        continue;
      }
      try {
        const state = await publishStatus(ctx, repo, verdict.headOid, verdict);
        console.log('  published ' + STATUS_CONTEXT + '=' + state + ' to #' + verdict.number);
      } catch (error) {
        if (!error.outage) {
          publishErrors.push(error.message);
          continue;
        }
        publishOutage = error.message;
        unpublished.push(verdict.number);
      }
    }
    if (publishOutage) {
      // The verdicts above stand; only the board write was lost.
      console.error(NL + 'GITHUB-OUTAGE: statuses could not be written -- ' + publishOutage);
      console.error('STATUS NOT PUBLISHED (' + unpublished.length + '): ' + unpublished.map((n) => '#' + n).join(', '));
      annotate(env, 'PR mergeable guard could not publish to ' + unpublished.length + ' PR(s) (' + publishOutage.slice(0, 200) + ').');
    }
    for (const message of publishErrors) console.error('  publish failed -- ' + message);
  }

  // Order matters: a real contract violation outranks a publish problem, so a
  // conflicting PR still exits 1 even when the status could not be written.
  if (tally.failing > 0) return { ok: false };
  if (publishErrors.length > 0) return { ok: false, infra: true };
  if (tally.unresolved > 0) return { ok: false, infra: true };
  if (outage || publishOutage) return { ok: false, outage: true };
  console.log(
    NL +
      'PR mergeable guard passed: ' +
      (verdicts.length - tally.deferred) +
      ' PR(s) judged, every one MERGEABLE with at least one gate that ran' +
      (skip.skipped > 0 ? '; ' + skip.skipped + ' conflicting docs-only PR(s) SKIPPED, not judged.' : '.'),
  );
  return { ok: true };
}

/**
 * Every path returns a code; NOTHING here calls process.exit().
 *
 * process.exit() discards whatever is still buffered on stdout/stderr when
 * those streams are pipes, which is what they are in Linux CI and are not on a
 * Windows console. This repo has already shipped that bug once -- a guard that
 * listed 904 lines locally emitted 194 in CI. The self-test is this workflow's
 * FIRST step and prints ~30 lines, so a truncated failure list would leave a
 * reader unable to tell which case broke. We develop on Windows and gate on
 * Linux, so the defect is invisible exactly where it is introduced.
 */
export async function main(argv, deps = {}) {
  const KNOWN_FLAGS = ['--pr', '--sha', '--min-age-minutes', '--self-test', '--publish-status'];
  const VALUE_FLAGS = ['--pr', '--sha', '--min-age-minutes'];
  const valueOf = (flag) => {
    const at = argv.indexOf(flag);
    return at === -1 ? null : argv[at + 1];
  };

  const unknown = argv.filter((arg, index) => {
    if (arg.startsWith('--')) return !KNOWN_FLAGS.includes(arg);
    return !VALUE_FLAGS.includes(argv[index - 1]);
  });
  if (unknown.length > 0) {
    console.error('Unknown argument(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }

  // A value flag whose value is missing or empty must be refused, never
  // ignored. `--sha` with no value made valueOf return undefined, `if (sha)`
  // fell through, and the run silently became a full SWEEP -- while the
  // workflow canary, which reads exit 1 as "the guard still detects the
  // incident", would have been satisfied by any unrelated conflicting PR the
  // sweep happened to find. The one step whose job is to prove the guard is
  // not blind could be passed by a red that had nothing to do with it.
  for (const flag of VALUE_FLAGS) {
    if (!argv.includes(flag)) continue;
    const raw = valueOf(flag);
    if (raw === null || raw === undefined || raw === '' || raw.startsWith('--')) {
      console.error(flag + ' requires a value, got: ' + JSON.stringify(raw));
      return 2;
    }
  }

  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;

  // Numeric arguments are validated rather than coerced. Number('abc') is NaN
  // and every comparison against NaN is false, so a typo in --min-age-minutes
  // would silently switch the grace window OFF. `min` is 1 for --pr because 0
  // is falsy: it passed validation and then every downstream `number ?` test
  // read it as absent, so `--pr 0 --publish-status` would have swept every open
  // PR and written a status to all of them without once mentioning that the
  // flag had been discarded.
  let invalid = false;
  const numericFlag = (name, raw, min) => {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min) {
      console.error(name + ' expects an integer >= ' + min + ', got: ' + JSON.stringify(raw));
      invalid = true;
      return null;
    }
    return value;
  };

  const prFlag = valueOf('--pr');
  const env = deps.env ?? process.env;
  const ageFlag = valueOf('--min-age-minutes') ?? env.PR_GUARD_MIN_AGE_MINUTES;
  const shaFlag = valueOf('--sha');
  const wantsPublish = argv.includes('--publish-status');

  // Refused rather than ignored. --sha is the live canary; silently dropping a
  // --publish-status alongside it would mean the operator believes statuses are
  // being written when they are not.
  if (wantsPublish && shaFlag) {
    console.error('--publish-status cannot be combined with --sha: commit mode is the canary and must not write.');
    return 2;
  }

  const number = prFlag === null || prFlag === undefined ? null : numericFlag('--pr', prFlag, 1);
  const minAgeMinutes = ageFlag ? numericFlag('--min-age-minutes', ageFlag, 0) : DEFAULT_MIN_AGE_MINUTES;
  if (invalid) return 2;

  const result = await run({ number, sha: shaFlag, minAgeMinutes, publish: wantsPublish }, deps);
  return exitCodeFor(result, env);
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs). The string compare it
// replaces mispredicted through a junction and skipped the whole guard, exit 0.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, NOT process.exit(). Calling process.exit() after the
  // async run aborted the process with a libuv assertion (UV_HANDLE_CLOSING,
  // src/win/async.c) and reported 127 instead of the 1 the guard had correctly
  // decided -- the fetch keep-alive sockets were still closing. 127 is non-zero
  // so CI would still have gone red, but the guard would have been lying about
  // WHY, and the 0/1/2 contract separating "violated" from "could not run"
  // would be gone. Draining the pool keeps the exit prompt rather than waiting
  // out the keep-alive timeout.
  process.exitCode = await main(process.argv.slice(2));
  const dispatcher = globalThis[Symbol.for('undici.globalDispatcher.1')];
  if (dispatcher && typeof dispatcher.close === 'function') await dispatcher.close();
}
