/**
 * Diagnostic: capture what the event page actually renders and what network
 * calls it makes, so we can fix the proof selectors.
 */
import { test, expect } from '@playwright/test';

const EVENT_ID = 'cfee4831-e188-4862-b845-c1e4bd48e18d';

test('DIAG: capture event page state and network activity', async ({ page }) => {
  const networkLog: string[] = [];
  let rpcResponse: unknown = null;
  let rpcStatus: number | null = null;

  page.on('request',  (req)  => networkLog.push(`REQ  ${req.method()} ${req.url()}`));
  page.on('response', async (resp) => {
    networkLog.push(`RESP ${resp.status()} ${resp.url()}`);
    if (resp.url().includes('get_event_page_snapshot')) {
      rpcStatus = resp.status();
      try { rpcResponse = await resp.json(); } catch { /* ignore */ }
    }
  });

  await page.goto(`http://127.0.0.1:4173/event/${EVENT_ID}`);
  await page.waitForTimeout(6000);

  // Screenshot
  await page.screenshot({ path: 'test-results/diag-event-page.png', fullPage: true });

  // Page title and URL (detect redirect)
  console.log('\nFinal URL:', page.url());
  console.log('Page title:', await page.title());

  // What text is visible?
  const body = await page.locator('body').textContent();
  console.log('\n── Visible text (first 600 chars) ──────────────────────────────');
  console.log((body ?? '').slice(0, 600));
  console.log('\n── RPC call ──────────────────────────────────────────────────');
  if (rpcResponse) {
    const snap = rpcResponse as Record<string, unknown>;
    const occ = snap.occurrence_effective as Record<string, unknown> | null;
    console.log('RPC status:', rpcStatus);
    console.log('occurrence_effective keys:', occ ? Object.keys(occ).join(', ') : 'null');
    console.log('is_cancelled:', occ?.is_cancelled);
    console.log('event keys:', snap.event ? Object.keys(snap.event as object).join(', ') : 'null');
  } else {
    console.log('RPC was NOT called');
  }

  // Log only the first 15 relevant network entries
  console.log('\n── Network log (first 15) ───────────────────────────────────');
  networkLog.slice(0, 15).forEach(l => console.log(l));

  // Confirm page at least loaded something
  expect(body?.length ?? 0).toBeGreaterThan(0);
});
