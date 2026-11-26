import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ciBypassHeaders, isProductionUrl } from './lib/ciBypassHeader.mjs';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:8083';

const results = [];

const makeResult = (name) => ({
  name,
  consoleErrors: [],
  // 'Failed to load resource: ... 404' console text carries no URL; these do.
  failedResources: [],
  supabaseStatuses: [],
  supabaseFailures: [],
  eventRowsObserved: 0,
  eventLinksObserved: 0,
  notes: [],
  ok: true,
});

const summarizeSupabase = (result) => {
  const uniqueStatuses = Array.from(new Set(result.supabaseStatuses)).sort((a, b) => a - b);
  const failing = uniqueStatuses.filter((s) => s >= 400);
  if (failing.length > 0) {
    result.ok = false;
    result.notes.push(`Supabase non-2xx/3xx statuses: ${failing.join(', ')}`);
  }
};

const attachObservers = (page, getCurrent) => {
  page.on('console', (msg) => {
    const current = getCurrent();
    if (!current) return;
    if (msg.type() === 'error') {
      const where = msg.location()?.url;
      current.consoleErrors.push(where ? `${msg.text()} [${where}]` : msg.text());
    }
  });

  page.on('requestfailed', (request) => {
    const current = getCurrent();
    if (!current) return;
    current.failedResources.push(`FAILED ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
  });

  page.on('pageerror', (err) => {
    const current = getCurrent();
    if (!current) return;
    current.consoleErrors.push(`pageerror: ${err.message}`);
  });

  page.on('response', async (response) => {
    const current = getCurrent();
    if (!current) return;

    const url = response.url();
    if (!url.includes('supabase.co')) {
      if (response.status() >= 400) current.failedResources.push(`${response.status()} ${url}`);
      return;
    }

    const status = response.status();
    current.supabaseStatuses.push(status);

    if (status >= 400) {
      current.supabaseFailures.push({ status, url });
    }

    if (url.includes('/rest/v1/events') && response.request().method() === 'GET') {
      try {
        const body = await response.json();
        if (Array.isArray(body)) {
          current.eventRowsObserved += body.length;
        } else if (body && typeof body === 'object') {
          current.eventRowsObserved += 1;
        }
      } catch {
        // Ignore non-JSON responses
      }
    }
  });
};

const waitForSettled = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
};

const collectEventLinks = async (page, result) => {
  const count = await page.locator('a[href^="/event/"]').count();
  result.eventLinksObserved += count;
  return count;
};

// ---- Deploy-swap tolerance -------------------------------------------------
// Vercel takes ~1 minute to switch to a new deploy; during it the entry
// assets can 404. Wait for them before scenarios; retry once if the ONLY
// failures are /assets/ loads.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isAssetPath = (u) => {
  try { return new URL(u, 'http://x').pathname.startsWith('/assets/'); } catch { return false; }
};
const OK_NOTE = /^(Console errors:|Failing resources:|map markers\/clusters painted:|No event rows observed|No event links visible|.* not detected$|No \w+ (detail )?link found)/;

// Pure: is this failed result set swap-shaped (asset-only 404 / ERR_ABORTED)?
export const shouldRetryAssetOnly = (rs, retried = false) => {
  if (retried) return false;
  const failed = rs.filter((r) => !r.ok);
  if (failed.length === 0) return false;
  return failed.every((r) => {
    const res = r.failedResources || [];
    if (res.length === 0) return false;
    if ((r.supabaseFailures || []).length > 0) return false;
    if ((r.supabaseStatuses || []).some((s) => s >= 400)) return false;
    if (!(r.notes || []).every((n) => OK_NOTE.test(n))) return false;
    const resOk = res.every((s) => {
      const a = /^404 (\S+)$/.exec(s);
      if (a) return isAssetPath(a[1]);
      const b = /^FAILED (\S+) \(net::ERR_ABORTED\)$/.exec(s);
      return !!b && isAssetPath(b[1]);
    });
    const consoleOk = (r.consoleErrors || []).every((s) => {
      const m = /^Failed to load resource: .* \[(\S+)\]$/.exec(s);
      return !!m && isAssetPath(m[1]);
    });
    return resOk && consoleOk;
  });
};

const waitForDeploySwap = async ({ tries = 12, delayMs = 10000 } = {}) => {
  const headers = isProductionUrl(baseUrl) ? ciBypassHeaders() : {};
  for (let i = 1; i <= tries; i += 1) {
    let status = '';
    let bad = [];
    try {
      const res = await fetch(`${baseUrl}/?smoke_wait=${Date.now()}`, { redirect: 'follow', headers });
      const html = await res.text();
      const paths = Array.from(new Set(html.match(/\/assets\/(?:entry\.client|manifest)-[\w.-]+\.js/g) || []));
      for (const p of paths) {
        const a = await fetch(new URL(p, res.url).href, { redirect: 'follow', headers });
        if (a.status === 404) bad.push(p);
      }
      status = `${paths.length} assets, ${bad.length} 404`;
    } catch (error) {
      status = `fetch error: ${error?.message || error}`;
      bad = ['fetch'];
    }
    console.error(`SMOKE_WAIT: try ${i}/${tries}: ${status}`);
    if (bad.length === 0) return;
    if (i < tries) await sleep(delayMs);
  }
  console.error('SMOKE_WAIT: gave up after 2 min, running scenarios anyway');
};

const selfTest = () => {
  const assetOnly = () => ({
    ok: false, notes: ['Console errors: 1', 'Failing resources: 404 https://x.co.uk/assets/entry.client-a.js'],
    consoleErrors: ['Failed to load resource: the server responded with a status of 404 () [https://x.co.uk/assets/entry.client-a.js]'],
    failedResources: ['404 https://x.co.uk/assets/entry.client-a.js', 'FAILED https://x.co.uk/assets/manifest-b.js (net::ERR_ABORTED)'],
    supabaseStatuses: [200], supabaseFailures: [],
  });
  const cases = [
    ['asset-only 404 retries', shouldRetryAssetOnly([assetOnly()]), true],
    ['already retried', shouldRetryAssetOnly([assetOnly()], true), false],
    ['extra console error', shouldRetryAssetOnly([{ ...assetOnly(), consoleErrors: [...assetOnly().consoleErrors, 'TypeError boom'] }]), false],
    ['page error', shouldRetryAssetOnly([{ ...assetOnly(), consoleErrors: ['pageerror: x'] }]), false],
    ['supabase failure', shouldRetryAssetOnly([{ ...assetOnly(), supabaseFailures: [{ status: 500, url: 'u' }], supabaseStatuses: [500] }]), false],
    ['non-asset 404', shouldRetryAssetOnly([{ ...assetOnly(), failedResources: ['404 https://x.co.uk/api/y'] }]), false],
    ['runtime exception', shouldRetryAssetOnly([{ ...assetOnly(), notes: ['Runtime exception: x'] }]), false],
    ['no failures', shouldRetryAssetOnly([{ ...assetOnly(), ok: true }]), false],
  ];
  let bad = 0;
  for (const [name, got, want] of cases) {
    if (got !== want) { bad += 1; console.error(`SELF_TEST FAIL: ${name} (got ${got})`); }
  }
  console.error(bad ? `SELF_TEST: ${bad} failed` : `SELF_TEST: ${cases.length} ok`);
  process.exit(bad ? 1 : 0);
};

const run = async () => {
  await waitForDeploySwap();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },          // mobile - ~95% of real users
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 '
      + '(KHTML, like Gecko) Mobile/15E148 bachatacalendar-smoke-bot/1.0',  // 'bot' => server view-tracking RPCs skip it
  });
  // Cloudflare WAF bypass: attached per request, production host ONLY (never
  // Supabase, fonts, analytics or a preview). No route is registered when the
  // secret is absent, so requests are unchanged then.
  const ciHeaders = ciBypassHeaders();
  if (Object.keys(ciHeaders).length) {
    await context.route('**/*', (route) => {
      const req = route.request();
      return isProductionUrl(req.url())
        ? route.continue({ headers: { ...req.headers(), ...ciHeaders } })
        : route.continue();
    });
  }
  const page = await context.newPage();

  let current = null;
  attachObservers(page, () => current);

  const runScenario = async (name, fn) => {
    const result = makeResult(name);
    current = result;
    try {
      await fn(result);
      await waitForSettled(page);
      await collectEventLinks(page, result);
      summarizeSupabase(result);
      if (result.consoleErrors.length > 0) {
        result.ok = false;
        result.notes.push(`Console errors: ${result.consoleErrors.length}`);
        const urls = Array.from(new Set(result.failedResources));
        if (urls.length > 0) result.notes.push(`Failing resources: ${urls.slice(0, 5).join(' | ')}`);
      }
      if (result.eventRowsObserved === 0) {
        result.notes.push('No event rows observed from events endpoint during this scenario');
      }
    } catch (error) {
      result.ok = false;
      result.notes.push(`Runtime exception: ${error?.message || String(error)}`);
    }
    results.push(result);
    current = null;
  };

  let selectedEventPath = null;
  let selectedFestivalPath = null;
  let selectedOrganiserPath = null;
  let selectedVenuePath = null;

  await runScenario('0) Homepage map paints markers', async () => {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    // map is lazy-loaded; give the container + RPC-driven pins time to paint
    const mounted = await page.locator('.home-map').first()
      .waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
    if (!mounted) {
      current.ok = false;
      current.notes.push('home-map container never mounted (homepage map missing)');
      return;
    }
    await page.waitForTimeout(2500);
    const markers = await page.locator('.home-map .leaflet-marker-icon, .home-map .marker-cluster').count();
    current.notes.push(`map markers/clusters painted: ${markers}`);
    if (markers === 0) {
      current.ok = false;
      current.notes.push('No Leaflet markers/clusters on homepage map (RPC ok but nothing rendered)');
    }
  });

  await runScenario('1) Calendar month view', async () => {
    await page.goto(`${baseUrl}/parties`, { waitUntil: 'networkidle' });
    const hasCalendarHeading = await page.locator('text=What\'s On').first().isVisible().catch(() => false);
    if (!hasCalendarHeading) {
      current.notes.push('Calendar heading not detected on page');
    }
  });

  await runScenario('2) Event detail renders (list/sitemap/direct URL)', async () => {
    // Source a real event URL robustly. On prod the listing routes
    // client-redirect to /city/..., so fall back to the live sitemap.
    let eventPath = null;
    await page.goto(`${baseUrl}/parties`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    if ((await page.locator('a[href^="/event/"]').count()) > 0) {
      eventPath = await page.locator('a[href^="/event/"]').first().getAttribute('href');
    } else {
      try {
        const res = await page.request.get(`${baseUrl}/sitemap.xml`);
        if (res.ok()) {
          const mm = (await res.text()).match(/<loc>([^<]*\/event\/[^<]+)<\/loc>/);
          if (mm) eventPath = new URL(mm[1]).pathname;
        }
      } catch {
        // sitemap unavailable (e.g. dev server) - skipped below
      }
    }
    if (!eventPath) {
      current.notes.push('No event URL discoverable from /parties or sitemap - detail check skipped');
      return;
    }
    selectedEventPath = eventPath;
    await page.goto(`${baseUrl}${eventPath}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // exercise the cold direct-hydration path in a fresh tab
    const directPage = await context.newPage();
    let directErrors = 0;
    directPage.on('console', (msg) => { if (msg.type() === 'error') directErrors += 1; });
    directPage.on('pageerror', () => { directErrors += 1; });
    await directPage.goto(`${baseUrl}${eventPath}`, { waitUntil: 'networkidle' });
    await directPage.waitForTimeout(1500);
    await directPage.close();
    if (directErrors > 0) {
      current.ok = false;
      current.notes.push(`Direct URL open had ${directErrors} console/page errors`);
    }

    const notFoundVisible = await page.locator('text=Event Not Found').first().isVisible().catch(() => false);
    if (notFoundVisible) {
      current.ok = false;
      current.notes.push(`Event detail rendered NotFound for ${eventPath}`);
    }
  });

  await runScenario('3) Parties page', async () => {
    await page.goto(`${baseUrl}/parties`, { waitUntil: 'networkidle' });
    const visible = await page.locator('text=Find Your').first().isVisible().catch(() => false);
    if (!visible) current.notes.push('Parties hero text not detected');
  });

  await runScenario('4) Classes page', async () => {
    await page.goto(`${baseUrl}/classes`, { waitUntil: 'networkidle' });
    const visible = await page.locator('text=Class').first().isVisible().catch(() => false);
    if (!visible) current.notes.push('Classes heading text not detected');
  });

  await runScenario('5) Tonight section', async () => {
    await page.goto(`${baseUrl}/tonight`, { waitUntil: 'networkidle' });
    const liveVisible = await page.locator('text=Tonight').first().isVisible().catch(() => false);
    if (!liveVisible) current.notes.push('Tonight header not detected');
  });

  await runScenario('6) Festival detail', async () => {
    await page.goto(`${baseUrl}/festivals`, { waitUntil: 'networkidle' });
    const link = page.locator('a[href^="/festival/"]').first();
    const count = await page.locator('a[href^="/festival/"]').count();
    if (count > 0) {
      const href = await link.getAttribute('href');
      if (href) selectedFestivalPath = href;
      await link.click();
      await page.waitForURL(/\/festival\//, { timeout: 15000 });
    } else if (selectedFestivalPath) {
      await page.goto(`${baseUrl}${selectedFestivalPath}`, { waitUntil: 'networkidle' });
    } else {
      current.notes.push('No festival link found to enter detail page');
    }
  });

  await runScenario('7) Organiser detail events', async () => {
    await page.goto(`${baseUrl}/organisers`, { waitUntil: 'networkidle' });
    const count = await page.locator('a[href^="/organisers/"]').count();
    // Use getAttribute + goto rather than click: the desktop sidebar layout
    // hides organiser links at mobile viewport (hidden lg:flex), so click
    // times out even though the href is present in the DOM.
    if (count > 0) {
      const href = await page.locator('a[href^="/organisers/"]').first().getAttribute('href');
      if (href) {
        selectedOrganiserPath = href;
        await page.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle' });
        // ORGANISER_SUBDOMAIN_LINKS (on since 2026-11-26) 301s a one-label slug to
        // https://<slug>.bachatacalendar.co.uk/ -- that IS the organiser detail page.
        const landed = new URL(page.url());
        const onSubdomain = /^[a-z0-9-]+\.bachatacalendar\.co\.uk$/.test(landed.hostname)
          && !/^(www|admin)\./.test(landed.hostname);
        if (!landed.pathname.includes('/organisers/') && !onSubdomain) throw new Error(`Expected organiser detail URL, got ${page.url()}`);
      }
    } else if (selectedOrganiserPath) {
      await page.goto(`${baseUrl}${selectedOrganiserPath}`, { waitUntil: 'networkidle' });
    } else {
      current.notes.push('No organiser detail link found');
    }

    const eventLinkCount = await page.locator('a[href^="/event/"]').count();
    if (eventLinkCount === 0) {
      current.notes.push('No event links visible on organiser detail page');
    }
  });

  await runScenario('8) Venue detail events', async () => {
    await page.goto(`${baseUrl}/venues`, { waitUntil: 'networkidle' });
    const link = page.locator('a[href^="/venue-entity/"]').first();
    const count = await page.locator('a[href^="/venue-entity/"]').count();
    if (count > 0) {
      const href = await link.getAttribute('href');
      if (href) selectedVenuePath = href;
      await link.click();
      await page.waitForURL(/\/venue-entity\//, { timeout: 15000 });
    } else if (selectedVenuePath) {
      await page.goto(`${baseUrl}${selectedVenuePath}`, { waitUntil: 'networkidle' });
    } else {
      current.notes.push('No venue detail link found');
    }

    const eventLinkCount = await page.locator('a[href^="/event/"]').count();
    if (eventLinkCount === 0) {
      current.notes.push('No event links visible on venue detail page');
    }
  });

  // Post-merge quick check: SMOKE_EXTRA_PATHS is a comma-separated list of
  // paths ("/start-organiser") or full https URLs on bachatacalendar.co.uk
  // (event subdomains included). Each page loads signed out with the same
  // observers as above (page errors, console errors, failed requests,
  // Supabase 4xx/5xx), plus a 4xx/5xx document status and the app's
  // error-boundary text. Set via the workflow_dispatch input extra_paths.
  //
  // SMOKE_FORBID_TEXT (workflow input forbid_text): a '|'-separated list of
  // words that must NOT appear on any extra page (case-insensitive, the
  // rendered text). It proves a removal reached the live page: after
  // retiring "Level", run with forbid_text=Level: and the check fails while
  // the word still shows. '|' not ',' because the words may hold commas.
  const extraPaths = (process.env.SMOKE_EXTRA_PATHS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const forbidText = (process.env.SMOKE_FORBID_TEXT || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (forbidText.length > 0 && extraPaths.length === 0) {
    console.error('SMOKE_FAILED: forbid_text needs extra_paths (no page to read the words on)');
    process.exit(1);
  }
  for (const extra of extraPaths) {
    await runScenario(`Extra page ${extra}`, async () => {
      const url = new URL(extra, baseUrl);
      const local = url.hostname === 'localhost';
      const ours = url.protocol === 'https:' && /(^|\.)bachatacalendar\.co\.uk$/.test(url.hostname);
      if (!local && !ours) throw new Error(`Refused host: ${url.href}`);
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      if (!response) throw new Error('No document response');
      if (response.status() >= 400) throw new Error(`Document status ${response.status()}`);
      await page.waitForTimeout(3000);
      const crashed = await page.getByText('Something went wrong', { exact: false }).count();
      if (crashed > 0) throw new Error('Error text "Something went wrong" on page');
      if (forbidText.length > 0) {
        const bodyText = (await page.locator('body').innerText()).toLowerCase();
        const found = forbidText.filter((word) => bodyText.includes(word.toLowerCase()));
        if (found.length > 0) throw new Error(`Removed text still on page: ${found.map((w) => `"${w}"`).join(', ')}`);
      }
    });
  }

  await browser.close();

  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    results: results.map((r) => ({
      name: r.name,
      ok: r.ok,
      consoleErrorCount: r.consoleErrors.length,
      supabaseStatuses: Array.from(new Set(r.supabaseStatuses)).sort((a, b) => a - b),
      supabaseFailureCount: r.supabaseFailures.length,
      eventRowsObserved: r.eventRowsObserved,
      eventLinksObserved: r.eventLinksObserved,
      notes: r.notes,
      sampleConsoleErrors: r.consoleErrors.slice(0, 5),
      sampleFailedResources: Array.from(new Set(r.failedResources)).slice(0, 10),
      sampleSupabaseFailures: r.supabaseFailures.slice(0, 5),
    })),
  };

  const retried = process.env.SMOKE_RETRIED === '1';
  const willRetry = shouldRetryAssetOnly(results, retried);
  // On retry the child's report is the one that counts: keep stdout clean.
  (willRetry ? console.error : console.log)(JSON.stringify(report, null, 2));

  const failed = results.filter((r) => !r.ok);
  if (willRetry) {
    console.error('SMOKE_RETRY: asset-only failures, retrying once in 60s');
    await sleep(60000);
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, SMOKE_RETRIED: '1' },
      stdio: 'inherit',
    });
    process.exit(child.status ?? 1);
  }
  if (failed.length > 0) {
    console.error(`SMOKE_FAILED: ${failed.map((r) => r.name).join('; ')}`);
    for (const r of failed) {
      const urls = Array.from(new Set(r.failedResources));
      if (urls.length > 0) console.error(`  ${r.name} -- failing resources: ${urls.slice(0, 5).join(' | ')}`);
    }
    process.exit(1);
  }
};

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  // No "is main module" guard: a path mismatch there would skip run() and exit 0 (false green).
  run().catch((error) => {
    console.error('SMOKE_RUN_FAILED', error);
    process.exit(1);
  });
}
