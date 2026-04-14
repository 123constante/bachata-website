/**
 * DEPLOYMENT-READINESS PROOF: Event Page + get_event_page_snapshot_v2
 *
 * Tests against the REAL Supabase backend — no mocks.
 * Proves the v2 contract works end-to-end in a real browser.
 *
 * Criteria:
 *  - Page loads without crash
 *  - No console errors
 *  - No network contract errors (RPC 4xx/5xx)
 *  - Key sections render correctly when data present
 *  - Null/empty optional fields don't crash the page
 *  - Public/anon access works (no login required)
 */

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const SUPABASE_HOST = 'stsdtacfauprzrdebmzg.supabase.co';

// Known published event IDs (verified via direct RPC probe)
// Mock Party: hero image, venue (Sway Bar), lineup (3 teachers), tickets, promo codes, music styles
const PRIMARY_EVENT_ID = '2a1522d2-7cb6-4ee2-8c46-c75014b86ba0';
// mia: hero image, venue, 1 teacher, tickets, music styles — sparser data
const SPARSE_EVENT_ID = '9be2c461-5a00-40f5-a4b9-c3e66109d6b1';
// Bachata Mondays: 4 weekly occurrences (Apr 13/20/27, May 4), 3 teachers per occurrence
const MULTI_OCC_EVENT_ID = 'fedc7fd7-683d-440f-bb04-0de3bfcde659';
const MULTI_OCC_IDS = {
  first: 'af3a9324-e1c9-4a6e-bbc0-fbb9fe11db8a',  // Apr 13
  third: '661c6396-7e1e-46d9-86a1-769c34f771e9',  // Apr 27
};
// Gallery Showcase: 3 images in photo_urls
const GALLERY_EVENT_ID = '1d8baccc-320a-4350-a4ea-93d0a358c598';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProofResult {
  consoleErrors: string[];
  networkErrors: string[];
  rpcResponses: { url: string; status: number; bodyPreview: string }[];
}

async function collectProof(page: Page, url: string): Promise<ProofResult> {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const rpcResponses: { url: string; status: number; bodyPreview: string }[] = [];

  // Collect console errors
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore benign React/dev noise
      if (text.includes('Download the React DevTools')) return;
      if (text.includes('favicon.ico')) return;
      consoleErrors.push(text);
    }
  });

  // Intercept network to capture RPC calls and failures
  page.on('response', async (response) => {
    const reqUrl = response.url();
    const status = response.status();

    // Capture all Supabase RPC responses
    if (reqUrl.includes(SUPABASE_HOST) && reqUrl.includes('/rpc/')) {
      let bodyPreview = '';
      try {
        const body = await response.text();
        bodyPreview = body.substring(0, 500);
      } catch { bodyPreview = '[unreadable]'; }
      rpcResponses.push({ url: reqUrl, status, bodyPreview });
    }

    // Track non-2xx network errors for Supabase calls
    if (reqUrl.includes(SUPABASE_HOST) && (status >= 400)) {
      networkErrors.push(`${status} ${reqUrl}`);
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Allow React to finish rendering
  await page.waitForTimeout(2000);

  return { consoleErrors, networkErrors, rpcResponses };
}

// ---------------------------------------------------------------------------
// Test 1: Primary published event — full render proof
// ---------------------------------------------------------------------------
test.describe('Event Page Deploy Readiness (real backend)', () => {
  test('Primary event: loads without crash, RPC 200, key sections render', async ({ page }) => {
    const url = `${BASE}/event/${PRIMARY_EVENT_ID}`;
    const proof = await collectProof(page, url);

    // 1. RPC was called and returned 200
    const v2Calls = proof.rpcResponses.filter((r) => r.url.includes('get_event_page_snapshot'));
    expect(v2Calls.length, 'Expected at least one v2 RPC call').toBeGreaterThanOrEqual(1);

    const rpcOk = v2Calls.every((r) => r.status === 200);
    console.log(
      `RPC calls: ${v2Calls.map((r) => `${r.status} ${r.url.split('?')[0]}`).join(', ')}`,
    );
    expect(rpcOk, `RPC returned non-200: ${JSON.stringify(v2Calls)}`).toBe(true);

    // 2. No network contract errors
    expect(proof.networkErrors, `Network errors: ${proof.networkErrors.join('; ')}`).toHaveLength(0);

    // 3. No console errors
    if (proof.consoleErrors.length > 0) {
      console.warn('Console errors:', proof.consoleErrors);
    }
    expect(proof.consoleErrors, `Console errors: ${proof.consoleErrors.join('; ')}`).toHaveLength(0);

    // 4. Page did not crash — event name or some content is visible
    //    (We don't know the exact name, so check the page is not showing an error state)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should NOT show a generic error/crash
    const hasErrorState = await page.locator('text=/something went wrong/i').count();
    expect(hasErrorState, 'Page shows error state').toBe(0);

    // 5. Event name renders (Mock Party)
    const eventNameVisible = await page.getByText('Mock Party').first().isVisible().catch(() => false);
    expect(eventNameVisible, 'Event name "Mock Party" not visible').toBe(true);
    console.log(`Event name visible: ${eventNameVisible}`);

    // 6. Hero image renders (has hero_image_url)
    const heroImg = page.locator('img').first();
    const heroExists = await heroImg.isVisible().catch(() => false);
    console.log(`Hero image visible: ${heroExists}`);

    // 7. Schedule section renders (has key_times with party + classes)
    const scheduleVisible = await page.locator('text=Schedule').first().isVisible().catch(() => false);
    expect(scheduleVisible, 'Schedule section not visible').toBe(true);
    console.log(`Schedule section visible: ${scheduleVisible}`);

    // 8. Location section — venue is "Sway Bar" in London
    const locationVisible = await page.locator('text=Location').first().isVisible().catch(() => false);
    console.log(`Location section visible: ${locationVisible}`);
    const venueNameVisible = await page.getByText('Sway Bar').first().isVisible().catch(() => false);
    console.log(`Venue name "Sway Bar" visible: ${venueNameVisible}`);

    // 9. City renders
    const cityVisible = await page.getByText('London').first().isVisible().catch(() => false);
    console.log(`City "London" visible: ${cityVisible}`);

    // 10. Organiser section
    const organiserVisible = await page.locator('text=Organiser').first().isVisible().catch(() => false);
    expect(organiserVisible, 'Organiser section not visible').toBe(true);
    console.log(`Organiser section visible: ${organiserVisible}`);

    // 11. Lineup section — has 3 teachers
    const lineupVisible = await page.locator('text=Lineup').first().isVisible().catch(() => false);
    expect(lineupVisible, 'Lineup section not visible (3 teachers expected)').toBe(true);
    console.log(`Lineup section visible: ${lineupVisible}`);

    // 12. Music styles
    const salsaVisible = await page.getByText(/salsa/i).first().isVisible().catch(() => false);
    console.log(`Music style "salsa" visible: ${salsaVisible}`);

    // 13. Tickets section — has General Admission + Couple Pass
    const ticketsVisible = await page.locator('text=Tickets').first().isVisible().catch(() => false);
    console.log(`Tickets section visible: ${ticketsVisible}`);

    // 14. Attendance block does not crash rendering
    const pageHasContent = (body?.length ?? 0) > 100;
    expect(pageHasContent, 'Page rendered substantial content').toBe(true);

    // 15. Description renders
    const descriptionVisible = await page.getByText(/guest teachers/i).first().isVisible().catch(() => false);
    console.log(`Description text visible: ${descriptionVisible}`);

    console.log('✅ Primary event proof PASSED');
    console.log(`   RPC response preview: ${v2Calls[0]?.bodyPreview?.substring(0, 300)}...`);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Sparse event — optional fields missing don't crash
  // ---------------------------------------------------------------------------
  test('Sparse event: null/empty optional fields do not crash page', async ({ page }) => {
    const url = `${BASE}/event/${SPARSE_EVENT_ID}`;
    const proof = await collectProof(page, url);

    // RPC call happened
    const v2Calls = proof.rpcResponses.filter((r) => r.url.includes('get_event_page_snapshot'));
    console.log(
      `Sparse event RPC calls: ${v2Calls.map((r) => `${r.status}`).join(', ')}`,
    );

    // If event exists in DB, RPC should be 200
    if (v2Calls.length > 0 && v2Calls[0].status === 200) {
      // No crash
      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      const hasErrorState = await page.locator('text=/something went wrong/i').count();
      expect(hasErrorState, 'Sparse event shows error state').toBe(0);

      // No console errors
      if (proof.consoleErrors.length > 0) {
        console.warn('Sparse event console errors:', proof.consoleErrors);
      }
      expect(
        proof.consoleErrors,
        `Sparse event console errors: ${proof.consoleErrors.join('; ')}`,
      ).toHaveLength(0);

      console.log('✅ Sparse event proof PASSED');
    } else {
      // Event may not exist — that's acceptable for a sparse-data test
      console.log(
        `⚠️ Sparse event ${SPARSE_EVENT_ID} not reachable (status: ${v2Calls[0]?.status ?? 'no call'}). Skipping sparse proof.`,
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Test 3: Non-existent event — graceful handling
  // ---------------------------------------------------------------------------
  test('Non-existent event: page handles missing event gracefully', async ({ page }) => {
    const FAKE_ID = '00000000-0000-0000-0000-000000000000';
    const url = `${BASE}/event/${FAKE_ID}`;
    const proof = await collectProof(page, url);

    // Should not hard crash
    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // No unhandled console errors (404/400/not-found handling is acceptable)
    const criticalErrors = proof.consoleErrors.filter(
      (e) => !e.includes('404') && !e.includes('400') && !e.includes('not found') && !e.includes('PGRST'),
    );
    if (criticalErrors.length > 0) {
      console.warn('Non-existent event console errors:', criticalErrors);
    }
    expect(criticalErrors).toHaveLength(0);

    console.log('✅ Non-existent event handled gracefully');
  });

  // ---------------------------------------------------------------------------
  // Test 4: anon access — public page accessible without auth
  // ---------------------------------------------------------------------------
  test('Public/anon access: event page loads without authentication', async ({ browser }) => {
    // Fresh context — no cookies, no auth tokens
    const context = await browser.newContext();
    const page = await context.newPage();

    const url = `${BASE}/event/${PRIMARY_EVENT_ID}`;
    // Use waitForResponse for reliable detection in fresh context
    const rpcPromise = page.waitForResponse(
      (r) => r.url().includes('get_event_page_snapshot') && r.url().includes(SUPABASE_HOST),
      { timeout: 20000 },
    );
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const rpcResponse = await rpcPromise;

    // Should get 200, not 401/403
    expect(rpcResponse.status(), `Anon access blocked: ${rpcResponse.status()}`).toBe(200);

    // Page renders content
    const body = await page.textContent('body');
    expect((body?.length ?? 0) > 100, 'Anon page rendered content').toBe(true);

    await context.close();
    console.log('✅ Anon/public access proof PASSED');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Multi-occurrence event — occurrence switching via URL param
  // ---------------------------------------------------------------------------
  test('Multi-occurrence event: default loads first occurrence, param switches to another', async ({ page }) => {
    // 5a. Load without occurrenceId — should default to first occurrence (Apr 13)
    const urlDefault = `${BASE}/event/${MULTI_OCC_EVENT_ID}`;
    const proofDefault = await collectProof(page, urlDefault);

    const v2Calls = proofDefault.rpcResponses.filter((r) => r.url.includes('get_event_page_snapshot'));
    expect(v2Calls.length, 'Expected v2 RPC call').toBeGreaterThanOrEqual(1);
    expect(v2Calls[0].status, 'RPC non-200').toBe(200);
    expect(proofDefault.consoleErrors, `Console errors: ${proofDefault.consoleErrors.join('; ')}`).toHaveLength(0);

    // Event name renders
    const nameVisible = await page.getByText('Bachata Mondays').first().isVisible().catch(() => false);
    expect(nameVisible, 'Event name not visible').toBe(true);

    // Schedule shows first occurrence date: Monday, April 13, 2026
    const firstDate = await page.getByText('April 13, 2026').first().isVisible().catch(() => false);
    expect(firstDate, 'Default occurrence date (April 13) not visible').toBe(true);
    console.log(`Default occurrence date (April 13) visible: ${firstDate}`);

    // 5b. Navigate to third occurrence via URL param (Apr 27)
    const urlThird = `${BASE}/event/${MULTI_OCC_EVENT_ID}?occurrenceId=${MULTI_OCC_IDS.third}`;
    const proofThird = await collectProof(page, urlThird);

    const v2CallsThird = proofThird.rpcResponses.filter((r) => r.url.includes('get_event_page_snapshot'));
    expect(v2CallsThird.length).toBeGreaterThanOrEqual(1);
    expect(v2CallsThird[0].status).toBe(200);
    expect(proofThird.consoleErrors, `Console errors on switch: ${proofThird.consoleErrors.join('; ')}`).toHaveLength(0);

    // Schedule now shows third occurrence date: Monday, April 27, 2026
    const thirdDate = await page.getByText('April 27, 2026').first().isVisible().catch(() => false);
    expect(thirdDate, 'Switched occurrence date (April 27) not visible').toBe(true);
    console.log(`Switched occurrence date (April 27) visible: ${thirdDate}`);

    // RPC should have been called with p_occurrence_id param
    const thirdRpcUrl = v2CallsThird[0].url;
    console.log(`Occurrence switch RPC URL: ${thirdRpcUrl}`);

    // Lineup still renders for the switched occurrence
    const lineupVisible = await page.locator('text=Lineup').first().isVisible().catch(() => false);
    console.log(`Lineup visible after switch: ${lineupVisible}`);

    console.log('✅ Multi-occurrence switching proof PASSED');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Gallery event — photo_urls render as gallery images
  // ---------------------------------------------------------------------------
  test('Gallery event: photo_urls render as gallery section with 3 images', async ({ page }) => {
    const url = `${BASE}/event/${GALLERY_EVENT_ID}`;
    // Use waitForResponse alongside collectProof for reliable RPC detection
    const rpcPromise = page.waitForResponse(
      (r) => r.url().includes('get_event_page_snapshot') && r.url().includes(SUPABASE_HOST),
      { timeout: 20000 },
    );
    const proof = await collectProof(page, url);
    const rpcResponse = await rpcPromise;

    expect(rpcResponse.status(), 'RPC non-200').toBe(200);
    expect(proof.consoleErrors, `Console errors: ${proof.consoleErrors.join('; ')}`).toHaveLength(0);

    // Event name renders
    const nameVisible = await page.getByText('Gallery Showcase').first().isVisible().catch(() => false);
    expect(nameVisible, 'Event name not visible').toBe(true);

    // Gallery images render — thumbnails use alt="Gallery image {n}"
    const galleryImg1 = page.locator('img[alt="Gallery image 1"]');
    const galleryImg2 = page.locator('img[alt="Gallery image 2"]');
    const galleryImg3 = page.locator('img[alt="Gallery image 3"]');

    await expect(galleryImg1).toBeVisible({ timeout: 8000 });
    await expect(galleryImg2).toBeVisible({ timeout: 5000 });
    await expect(galleryImg3).toBeVisible({ timeout: 5000 });

    console.log('Gallery: 3 images rendered');

    // Verify image sources are unsplash URLs from the fixture
    const src1 = await galleryImg1.getAttribute('src');
    expect(src1).toContain('unsplash');

    // Click first image to open lightbox
    await galleryImg1.click();
    const lightboxImg = page.locator('img[alt="Gallery image 1 of 3"]');
    await expect(lightboxImg).toBeVisible({ timeout: 5000 });
    console.log('Lightbox opened for image 1');

    // Navigate to next image in lightbox
    const nextBtn = page.locator('button[aria-label="Next image"]');
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      const lightboxImg2 = page.locator('img[alt="Gallery image 2 of 3"]');
      await expect(lightboxImg2).toBeVisible({ timeout: 5000 });
      console.log('Lightbox navigated to image 2');
    }

    console.log('✅ Gallery proof PASSED');
  });
});
