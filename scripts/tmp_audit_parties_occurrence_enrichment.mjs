import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

page.on('request', (request) => {
  const url = request.url();
  if (!url.includes('/rest/v1/calendar_occurrences') && !url.includes('/rest/v1/rpc/get_calendar_events')) return;
  results.push({ kind: 'request', url, method: request.method() });
});

page.on('response', async (response) => {
  const url = response.url();
  if (!url.includes('/rest/v1/calendar_occurrences') && !url.includes('/rest/v1/rpc/get_calendar_events')) return;
  let body = null;
  try {
    body = await response.text();
  } catch {
    body = null;
  }
  results.push({ kind: 'response', url, status: response.status(), ok: response.ok(), body });
});

page.on('console', (msg) => {
  results.push({ kind: 'console', type: msg.type(), text: msg.text() });
});

await page.goto('http://localhost:8090/parties', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await browser.close();
console.log(JSON.stringify(results, null, 2));
