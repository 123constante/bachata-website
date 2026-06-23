import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:8083';

const results = [];

const makeResult = (name) => ({
  name,
  consoleErrors: [],
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
      current.consoleErrors.push(msg.text());
    }
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
    if (!url.includes('supabase.co')) return;

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

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },          // mobile - ~95% of real users
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 '
      + '(KHTML, like Gecko) Mobile/15E148 bachatacalendar-smoke-bot/1.0',  // 'bot' => server view-tracking RPCs skip it
  });
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
        if (!page.url().includes('/organisers/')) throw new Error(`Expected organiser detail URL, got ${page.url()}`);
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
      sampleSupabaseFailures: r.supabaseFailures.slice(0, 5),
    })),
  };

  console.log(JSON.stringify(report, null, 2));

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`SMOKE_FAILED: ${failed.map((r) => r.name).join('; ')}`);
    process.exit(1);
  }
};

run().catch((error) => {
  console.error('SMOKE_RUN_FAILED', error);
  process.exit(1);
});
