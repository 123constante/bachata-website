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
//   bypassHeaders()      the Vercel Protection-Bypass-for-Automation header,
//                        from VERCEL_AUTOMATION_BYPASS_SECRET. Throws in CI when
//                        absent (unless required:false): a check meant to hit a
//                        protected preview must never silently run unauthenticated.
//   probe()              a fetch that injects the bypass and THROWS on 401/403
//                        (couldn't get past protection) instead of returning a
//                        body a check would misread as "measured nothing".
//   isPreviewHost()      is this base a *.vercel.app preview (vs public prod)?
//   previewIsWalled()    POSITIVE wall detection (401/403 or parked on Vercel's
//                        login/sso surface). Preview checks may skip green — with
//                        a ::warning:: — on a PROVEN wall only; anything else
//                        (timeout, DNS, broken preview) must still fail loud.
//   assertMeasured()     fail-loud contract: a check declares how many targets it
//                        must have measured; a shortfall throws (non-zero exit).
//
// The anti-masking rule, amended for the wall: an unreachable / unauthenticated /
// zero-metric run is a LOUD failure, not a green check that measured nothing —
// with ONE narrow exception, a positively-proven Deployment Protection wall,
// which skips green with a visible warning because no code change can open it.

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

/** The Vercel Protection-Bypass header, or null when no secret is configured.
 *  In CI, a missing secret THROWS (unless required:false) — a protected-preview
 *  check that ran unauthenticated would 401 and look like it measured nothing.
 *
 *  Deliberately does NOT send `x-vercel-set-bypass-cookie`. That header makes a
 *  VALID secret answer with a cookie-setting redirect; our clients (undici fetch,
 *  curl) have no cookie jar, so each hop re-triggers the redirect until the cap —
 *  "redirect count exceeded" — which made a WORKING secret look like a rejected
 *  one (proven on PR #135's run: doc-weight's bare-header curl got 200+br from
 *  the same preview, same secret, same minute the fetch-based checks "skipped").
 *  The bare header authenticates every request directly, no cookie needed —
 *  including Lighthouse's Chrome, where --extra-headers applies via
 *  Network.setExtraHTTPHeaders to all requests.
 *
 *  The secret is trimmed: a trailing newline (gh secret set from a file /
 *  clipboard paste) would make undici reject the header before any network I/O.
 */
export function bypassHeaders({ required = true } = {}) {
  const secret = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '').trim();
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
  return { 'x-vercel-protection-bypass': secret };
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
 * Is `base` a preview sitting behind Deployment Protection that our bypass does
 * not open? POSITIVE detection only — walled means the probe PROVED the wall:
 *   - the redirect chain parked on Vercel's auth surface (vercel.com/login or
 *     /sso-api on vercel.com), or
 *   - the preview itself answered 401/403 (Password Protection / non-browser
 *     SSO modes serve the wall on the preview host with no redirect).
 * Everything else — including a fetch THROW (DNS death, timeout, a preview the
 * PR itself broke) — is NOT walled: the real check must run and fail LOUD with
 * the real error, not be skipped green under a misdiagnosis. (The first cut
 * returned walled on any throw; combined with the set-bypass-cookie redirect
 * loop it silently green-skipped previews a WORKING secret could open.)
 * A working bypass lands 200 on the preview host -> not walled -> checks run.
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
    // Unconsumed undici bodies keep the event loop alive for minutes (measured);
    // we only need status + final URL.
    await r.body?.cancel();
    if (r.status === 401 || r.status === 403) return true;
    let host = '';
    try {
      host = new URL(r.url).hostname;
    } catch {
      return false;
    }
    return host === 'vercel.com' && /^\/(login|sso-api)/i.test(new URL(r.url).pathname);
  } catch {
    // Network death / timeout / redirect loop is NOT proof of a wall — let the
    // real check run and surface the real error loudly.
    return false;
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
