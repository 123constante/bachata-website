// Shared substrate for CI checks that must load a Vercel PREVIEW deployment.
//
// Historically every "hit a deployed URL" check either ran only against
// production (post-deploy) or, like the Lighthouse job, tried to hit a preview
// and silently 401'd forever behind Vercel Deployment Protection while
// `continue-on-error` masked it green. This module solves "reach a protected
// preview and prove you measured" ONCE, so no check re-implements (or forgets)
// any of it:
//
//   resolvePreviewUrl()  first-party preview-URL resolution via the GitHub
//                        Deployments API using the built-in GITHUB_TOKEN — the
//                        Vercel bot publishes each preview as a GitHub Deployment.
//                        No third-party action, no extra Vercel secret.
//   bypassHeaders()      the Vercel Protection-Bypass-for-Automation headers,
//                        from VERCEL_AUTOMATION_BYPASS_SECRET. Throws in CI when
//                        absent: a check meant to hit a protected preview must
//                        never silently run unauthenticated.
//   probe()              a fetch that injects the bypass and THROWS on 401/403
//                        (couldn't get past protection) instead of returning a
//                        body a check would misread as "measured nothing".
//   assertMeasured()     fail-loud contract: a check declares how many targets it
//                        must have measured; a shortfall throws (non-zero exit).
//
// The point of the last two is anti-masking: an unreachable / unauthenticated /
// zero-metric run becomes a LOUD failure, not a green check that measured nothing.

import { readFileSync } from 'node:fs';

const GH_API = 'https://api.github.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The commit the preview was built from. On pull_request that's the PR HEAD sha
 *  (GITHUB_SHA is the merge commit Vercel did NOT build), read from the event
 *  payload; otherwise GITHUB_SHA. */
export function getPreviewSha() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const ev = JSON.parse(readFileSync(eventPath, 'utf8'));
      const headSha = ev?.pull_request?.head?.sha;
      if (headSha) return headSha;
    } catch {
      /* fall through */
    }
  }
  return process.env.GITHUB_SHA ?? null;
}

/** The Vercel Protection-Bypass headers, or null when no secret is configured.
 *  In CI, a missing secret THROWS (unless required:false) — a protected-preview
 *  check that ran unauthenticated would 401 and look like it measured nothing. */
export function bypassHeaders({ required = true } = {}) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '';
  if (!secret) {
    if (required && process.env.CI) {
      throw new Error(
        'previewProbe: VERCEL_AUTOMATION_BYPASS_SECRET is not set. A protected-preview ' +
          'check cannot run unauthenticated. Generate it in Vercel (Settings → Deployment ' +
          'Protection → Protection Bypass for Automation) and add it as a GitHub Actions secret.',
      );
    }
    return null;
  }
  // set-bypass-cookie makes redirected/subsequent requests carry the bypass too.
  return { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' };
}

async function ghJson(path, token) {
  const res = await fetch(`${GH_API}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} -> HTTP ${res.status}`);
  return res.json();
}

/**
 * Resolve the ready Vercel preview URL for a commit via the GitHub Deployments
 * API. Polls until a Preview deployment reports a `success` status with an
 * `environment_url`, or throws on timeout (fail-loud — never returns null).
 */
export async function resolvePreviewUrl({
  sha = getPreviewSha(),
  token = process.env.GITHUB_TOKEN,
  repo = process.env.GITHUB_REPOSITORY,
  timeoutMs = 600_000,
  intervalMs = 5_000,
  log = console.log,
} = {}) {
  if (!repo) throw new Error('previewProbe: GITHUB_REPOSITORY is not set.');
  if (!sha) throw new Error('previewProbe: could not determine the preview commit sha.');

  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const deployments = await ghJson(
        `/repos/${repo}/deployments?sha=${sha}&per_page=30`,
        token,
      );
      // Vercel labels the environment "Preview" (sometimes "Preview – <project>").
      const previews = deployments.filter((d) => /preview/i.test(d.environment ?? ''));
      for (const d of previews) {
        const statuses = await ghJson(`/repos/${repo}/deployments/${d.id}/statuses?per_page=30`, token);
        const ready = statuses.find((s) => s.state === 'success' && s.environment_url);
        if (ready) {
          const url = ready.environment_url.replace(/\/$/, '');
          log(`previewProbe: preview ready at ${url} (deployment ${d.id}, attempt ${attempt})`);
          return url;
        }
      }
      log(`previewProbe: waiting for a ready Preview deployment for ${sha.slice(0, 8)} (attempt ${attempt})`);
    } catch (e) {
      log(`previewProbe: poll error (attempt ${attempt}): ${e.message}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `previewProbe: no ready Vercel preview for ${sha} within ${Math.round(timeoutMs / 1000)}s.`,
  );
}

/**
 * Fetch a preview URL with the bypass headers injected. THROWS on 401/403 so a
 * protection misconfiguration is loud rather than a silent zero-metric run.
 */
export async function probe(url, opts = {}) {
  const headers = { ...(bypassHeaders() ?? {}), ...(opts.headers ?? {}) };
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `previewProbe: ${url} -> HTTP ${res.status}. The Vercel protection bypass did not apply ` +
        '(bad/missing VERCEL_AUTOMATION_BYPASS_SECRET, or protection changed).',
    );
  }
  return res;
}

/** True when `base` is a Vercel preview host (*.vercel.app). Prod is public, so
 *  callers gate the walled-preview skip on this first. */
export function isPreviewHost(base) {
  try {
    return /\.vercel\.app$/i.test(new URL(base).hostname);
  } catch {
    return false;
  }
}

/**
 * Is `base` a preview sitting behind Deployment Protection with the bypass absent
 * or rejected? Such a preview bounces through vercel.com/login -> /sso-api and,
 * followed, dies with "redirect count exceeded" — an AUTH failure, not a check
 * failure. We probe with the same follow semantics the real fetches use, so we
 * observe the same outcome: a throw (redirect loop / network death) or a final URL
 * parked on the auth wall both read as walled. A working bypass lands 200 on the
 * real host -> not walled -> the real check runs. Lets a preview-gated guard SKIP
 * (green, with a ::warning:: annotation) instead of failing red on a wall it
 * cannot see past; production coverage stays with the scheduled run.
 */
export async function previewIsWalled(base, { bypass = null, ua = 'Mozilla/5.0', timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(base, {
      headers: { 'user-agent': ua, ...(bypass ?? {}) },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    return /vercel\.com\/(login|sso-api)|\/sso-api/i.test(r.url ?? '');
  } catch {
    return true;
  } finally {
    clearTimeout(t);
  }
}

/** Fail-loud measurement contract. A check that measured fewer targets than it
 *  promised is a failure, not a pass — this is what stops "green but measured
 *  nothing" from ever recurring. */
export function assertMeasured(actual, expected, label = 'targets') {
  if (actual < expected) {
    throw new Error(
      `previewProbe: measured ${actual}/${expected} ${label} — treating as failure ` +
        '(a check must not report success without measuring what it promised).',
    );
  }
}
