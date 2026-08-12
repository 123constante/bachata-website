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
 * Exit: 0 pass, 1 contract violated, 2 the guard could not run.
 */
import { execFileSync } from 'node:child_process';
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

/** Contexts owned by the deploy preview, which runs off the head commit. */
const VERCEL_APP_SLUGS = new Set(['vercel']);
const VERCEL_STATUS_PREFIX = 'vercel';

/** The App that publishes our gates. See isGateContext for why this is an
 *  inclusion list and not an exclusion list. */
const GATE_APP_SLUG = 'github-actions';

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
        ... on StatusContext { context state }
      }
    }
  }
`;

const PR_FIELDS = `
  number state isDraft title createdAt mergeable mergeStateStatus
  commits(last: 1) { nodes { commit { oid committedDate ${ROLLUP_FIELDS} } } }
`;

function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
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

function resolveRepo() {
  const fromEnv = process.env.GITHUB_REPOSITORY;
  if (fromEnv && fromEnv.includes('/')) {
    const [owner, name] = fromEnv.split('/');
    if (owner && name) return { owner, name };
  }
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  const parsed = parseRepoSlug(url);
  if (!parsed) throw new Error('cannot parse an owner/name out of the origin remote: ' + url.trim());
  return parsed;
}

async function graphql(token, query, variables) {
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      authorization: 'bearer ' + token,
      'content-type': 'application/json',
      'user-agent': 'check-pr-mergeable',
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
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
function runUrl() {
  const server = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!server || !repository || !runId) return undefined;
  return server + '/' + repository + '/actions/runs/' + runId;
}

/**
 * Write the verdict to the PR head as a commit status. Throws on refusal --
 * a guard that silently fails to publish is back to being invisible, which is
 * the defect, not a degraded mode of it.
 */
async function publishStatus(token, repo, sha, verdict) {
  const { state, description } = statusForVerdict(verdict);
  const response = await fetch(
    'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/statuses/' + sha,
    {
      method: 'POST',
      headers: {
        authorization: 'bearer ' + token,
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
        target_url: runUrl(),
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
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
 * query already refused a short page; this is the same refusal one level down,
 * which is where it was missing. Live PRs already carry 24-28 contexts.
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
    createdAt: node.createdAt,
    mergeable: node.mergeable,
    mergeStateStatus: node.mergeStateStatus,
    headCommit: commit ? { oid: commit.oid, committedDate: commit.committedDate } : null,
    contexts: rollup?.nodes ?? [],
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Read PRs, re-reading any whose mergeable is still UNKNOWN. The first read is
 * what asks GitHub to compute the merge ref at all, so a single query reports
 * UNKNOWN for every PR in the repo -- measured, not assumed -- and a guard that
 * did not poll would report MERGEABLE_UNRESOLVED for the whole board forever.
 */
async function fetchPrs(token, repo, { number = null } = {}) {
  const query = number
    ? 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){' +
      PR_FIELDS +
      '}}}'
    : 'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){pullRequests(states:OPEN,first:100){totalCount nodes{' +
      PR_FIELDS +
      '}}}}';

  let prs = [];
  for (let attempt = 1; attempt <= MERGEABLE_POLL_ATTEMPTS; attempt++) {
    const data = await graphql(token, query, { ...repo, ...(number ? { number } : {}) });
    if (number) {
      const node = data.repository?.pullRequest;
      if (!node) throw new Error('no such pull request: #' + number);
      prs = [shapePr(node)];
    } else {
      const page = data.repository?.pullRequests;
      if (!page) throw new Error('the repository returned no pullRequests connection');
      if (page.totalCount > page.nodes.length) {
        throw new Error(
          'the sweep saw ' + page.nodes.length + ' of ' + page.totalCount + ' open PRs; paginate before trusting it',
        );
      }
      prs = page.nodes.map(shapePr);
    }
    if (!prs.some((each) => each.mergeable === 'UNKNOWN')) return prs;
    if (attempt < MERGEABLE_POLL_ATTEMPTS) await sleep(MERGEABLE_POLL_MS);
  }
  return prs;
}

async function fetchCommit(token, repo, oid) {
  const query =
    'query($owner:String!,$name:String!,$oid:String!){repository(owner:$owner,name:$name){object(expression:$oid){... on Commit{oid committedDate' +
    ROLLUP_FIELDS +
    '}}}}';
  const data = await graphql(token, query, { ...repo, oid });
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

function selfTest() {
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

  let failed = 0;
  for (const item of cases) {
    let got;
    try {
      got = item.fn();
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

export async function run({
  number = null,
  sha = null,
  minAgeMinutes = DEFAULT_MIN_AGE_MINUTES,
  publish = false,
} = {}) {
  const auth = resolveToken();
  if (!auth.token) {
    console.error('PR mergeable guard cannot run: no GitHub credential.');
    console.error('Set GITHUB_TOKEN or GH_TOKEN, or authenticate the gh CLI.');
    if (auth.reason) console.error('gh auth token said: ' + auth.reason);
    return { ok: false, infra: true };
  }

  let repo;
  try {
    repo = resolveRepo();
  } catch (error) {
    console.error('PR mergeable guard cannot run: ' + error.message);
    return { ok: false, infra: true };
  }
  const label = repo.owner + '/' + repo.name;

  if (sha) {
    let commit;
    try {
      commit = await fetchCommit(auth.token, repo, sha);
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

  let prs;
  try {
    prs = await fetchPrs(auth.token, repo, { number });
  } catch (error) {
    console.error('PR mergeable guard cannot run: ' + error.message);
    return { ok: false, infra: true };
  }

  const scope = number ? 'PR #' + number : prs.length + ' open PR(s)';
  console.log('PR mergeable guard -- ' + label + ', ' + scope + ', credential from ' + auth.source + '.');

  const nowMs = Date.now();
  const verdicts = prs.map((each) => evaluatePr(each, { nowMs, minAgeMinutes }));
  const tally = reportVerdicts(verdicts);

  // Publishing is opt-in, and deliberately unreachable from --sha mode: that
  // mode is the live canary, and a canary that writes to the repo it is
  // checking is not a canary.
  const publishErrors = [];
  if (publish) {
    for (const verdict of verdicts) {
      if (!verdict.headOid) {
        publishErrors.push('#' + verdict.number + ': no head commit to attach a status to');
        continue;
      }
      if (!mayPublish(verdict)) {
        console.log('  not publishing to #' + verdict.number + ': state is ' + verdict.state + ', not OPEN');
        continue;
      }
      try {
        const state = await publishStatus(auth.token, repo, verdict.headOid, verdict);
        console.log('  published ' + STATUS_CONTEXT + '=' + state + ' to #' + verdict.number);
      } catch (error) {
        publishErrors.push(error.message);
      }
    }
    for (const message of publishErrors) console.error('  publish failed -- ' + message);
  }

  // Order matters: a real contract violation outranks a publish problem, so a
  // conflicting PR still exits 1 even when the status could not be written.
  if (tally.failing > 0) return { ok: false };
  if (publishErrors.length > 0) return { ok: false, infra: true };
  if (tally.unresolved > 0) return { ok: false, infra: true };
  console.log(
    NL +
      'PR mergeable guard passed: ' +
      (verdicts.length - tally.deferred) +
      ' PR(s) judged, every one MERGEABLE with at least one gate that ran.',
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
async function main(argv) {
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

  if (argv.includes('--self-test')) return selfTest() ? 0 : 1;

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
  const ageFlag = valueOf('--min-age-minutes') ?? process.env.PR_GUARD_MIN_AGE_MINUTES;
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

  const result = await run({ number, sha: shaFlag, minAgeMinutes, publish: wantsPublish });
  return result.ok ? 0 : result.infra ? 2 : 1;
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
