import { test, expect } from '@playwright/test';

const authApiSegment = '/auth/v1/';

const readRedirectUrl = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;

  if (typeof record.email_redirect_to === 'string') {
    return record.email_redirect_to;
  }

  const nestedData = record.data;
  if (nestedData && typeof nestedData === 'object') {
    const nestedRecord = nestedData as Record<string, unknown>;
    if (typeof nestedRecord.email_redirect_to === 'string') {
      return nestedRecord.email_redirect_to;
    }
  }

  return null;
};

const setupAuthPayloadCapture = (page: Parameters<typeof test>[0]['page']) => {
  let lastRedirectUrl: string | null = null;

  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (!request.url().includes(authApiSegment)) return;

    const requestUrl = new URL(request.url());
    const redirectFromQuery = requestUrl.searchParams.get('redirect_to');
    if (redirectFromQuery) {
      lastRedirectUrl = redirectFromQuery;
      return;
    }

    const body = request.postData();
    if (!body) return;

    try {
      const payload = JSON.parse(body);
      const redirectFromBody = readRedirectUrl(payload);
      if (redirectFromBody) {
        lastRedirectUrl = redirectFromBody;
      }
    } catch {
      // ignore non-JSON payloads
    }
  });

  return () => lastRedirectUrl;
};

const mockAccountLookupExisting = async (page: Parameters<typeof test>[0]['page']) => {
  await page.route('**/rest/v1/rpc/account_exists_by_email*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'true',
    });
  });
};

// Stub the magic-link send. Without this, clicking "Send magic link" issues a
// REAL POST to the live project's GoTrue (`VITE_SUPABASE_URL` in e2e-smoke.yml
// is the actual Supabase project, only the anon KEY is a placeholder). Today the
// invalid key means GoTrue rejects the call before mailing anything, so nothing
// escapes -- but the request is genuinely made against production on every PR
// run, and the whole premise of that workflow, stated in its own comment, is
// that "route mocks intercept every **/auth/v1/** and **/rest/v1/** call". This
// closes the one that was not.
//
// The assertions are unaffected: they read the outgoing request via
// page.on('request'), which fires for routed requests too, so what is being
// verified -- the email_redirect_to this app SENDS -- is still observed exactly
// as before. Only the network hop is removed.
const mockMagicLinkSend = async (page: Parameters<typeof test>[0]['page']) => {
  await page.route('**/auth/v1/otp*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
};

test('signin magic link omits default returnTo when not provided', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();

  await mockAccountLookupExisting(page);
  await mockMagicLinkSend(page);
  const getRedirectUrl = setupAuthPayloadCapture(page);

  await page.goto('/auth?mode=signin');
  await page.getByPlaceholder('you@example.com').fill('existing@example.com');
  await page.getByRole('button', { name: 'Send magic link' }).click();

  await expect.poll(() => getRedirectUrl()).not.toBeNull();
  const redirectUrl = getRedirectUrl();
  expect(redirectUrl).not.toBeNull();

  const parsed = new URL(redirectUrl as string);
  expect(parsed.pathname).toBe('/auth/callback');
  expect(parsed.searchParams.get('mode')).toBe('signin');
  expect(parsed.searchParams.has('returnTo')).toBe(false);
});

test('signin magic link includes explicit safe returnTo', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();

  await mockAccountLookupExisting(page);
  await mockMagicLinkSend(page);
  const getRedirectUrl = setupAuthPayloadCapture(page);

  await page.goto('/auth?mode=signin&returnTo=%2Fprofile');
  await page.getByPlaceholder('you@example.com').fill('existing@example.com');
  await page.getByRole('button', { name: 'Send magic link' }).click();

  await expect.poll(() => getRedirectUrl()).not.toBeNull();
  const redirectUrl = getRedirectUrl();
  expect(redirectUrl).not.toBeNull();

  const parsed = new URL(redirectUrl as string);
  expect(parsed.pathname).toBe('/auth/callback');
  expect(parsed.searchParams.get('mode')).toBe('signin');
  expect(parsed.searchParams.get('returnTo')).toBe('/profile');
});