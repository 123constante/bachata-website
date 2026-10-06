import { test, expect, type Page, type Route } from '@playwright/test';

// Lever 2 W1: /account and organiser onboarding (claim, request access,
// create). Every **/auth/v1/** and **/rest/v1/** call is mocked, like the other
// smoke specs; e2e-smoke.yml turns VITE_ENABLE_ORGANISER_SELF_SERVE on for the
// dev server. The server-side rules are proved in the admin repo (D4); this
// spec proves the screen offers the right step and reacts to each answer.

const projectRef = 'stsdtacfauprzrdebmzg';
const userId = '11111111-1111-1111-1111-111111111111';
const email = 'diego@ritmo.example';

const ORGS = {
  matches: { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Ritmo Bachata London', contact_email: 'Diego@Ritmo.example', claimed_by: null },
  differs: { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Ritmo Latino Manchester', contact_email: 'priya@latino.example', claimed_by: null },
  managed: { id: 'aaaaaaaa-0000-0000-0000-000000000003', name: 'Ritmo Sundays', contact_email: email, claimed_by: '99999999-9999-9999-9999-999999999999' },
};

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const accessToken = (method: 'otp' | 'password') =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: userId, role: 'authenticated', amr: [{ method, timestamp: 1 }] })}.sig`;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const refuse = (route: Route, code: string) => json(route, { code: 'P0001', message: code, details: null, hint: null }, 400);

type Calls = {
  claim: string[];
  request: { id: string; message?: string }[];
  create: Record<string, unknown>[];
  submit: Record<string, unknown>[];
};

const CREATED_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const LONDON = { id: 'cccccccc-0000-0000-0000-000000000001', name: 'London', slug: 'london', country_name: 'United Kingdom' };

async function signIn(page: Page, method: 'otp' | 'password') {
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email, user_metadata: {} };
  const session = {
    access_token: accessToken(method),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: 'mock-refresh-token',
    user,
  };
  await page.addInitScript(
    ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
    { value: session, ref: projectRef },
  );
  await page.route('**/auth/v1/**', (route) =>
    route.request().url().includes('/auth/v1/user') ? json(route, user) : json(route, {}),
  );
}

async function mockApis(page: Page, opts: { claim?: 'ok' | string } = {}): Promise<Calls> {
  const calls: Calls = { claim: [], request: [], create: [], submit: [] };
  let claimed = false;
  // The organiser create_organiser_profile_v1 made, as organiser_home_v1 then lists it.
  let created: { lifecycle_status: string } | null = null;
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const body = route.request().postDataJSON?.() ?? null;
    if (url.pathname.endsWith('/rpc/organiser_home_v1')) {
      return json(route, {
        organisers: claimed
          ? [{ id: ORGS.matches.id, name: ORGS.matches.name, slug: 'ritmo', avatar_url: null, city_id: null,
               lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] }]
          : created
            ? [{ id: CREATED_ID, name: 'Salsa & Bachata Leeds', slug: null, avatar_url: null, city_id: LONDON.id,
                 lifecycle_status: created.lifecycle_status, role: 'owner', latest_decision: null, series: [] }]
            : [],
      });
    }
    if (url.pathname.endsWith('/rpc/search_cities')) return json(route, [LONDON]);
    if (url.pathname.endsWith('/rpc/create_organiser_profile_v1')) {
      calls.create.push(body);
      created = { lifecycle_status: 'draft' };
      return json(route, { organiser_id: CREATED_ID, slug: null, lifecycle_status: 'draft', member_role: 'owner', is_primary: true });
    }
    if (url.pathname.endsWith('/rpc/submit_organiser_profile_v1')) {
      calls.submit.push(body);
      if (created) created.lifecycle_status = 'pending_review';
      return json(route, { organiser_id: body?.p_organiser_id, from_state: 'draft', lifecycle_status: 'pending_review', audit_id: 'a1' });
    }
    if (url.pathname.endsWith('/rpc/list_organiser_access_requests_v1')) return json(route, []);
    if (url.pathname.endsWith('/rpc/claim_organiser_v1')) {
      calls.claim.push(body?.p_organiser_id);
      if (opts.claim && opts.claim !== 'ok') return refuse(route, opts.claim);
      claimed = true;
      return json(route, { organiser_id: body?.p_organiser_id, already_claimed: false, owner_seeded: true });
    }
    if (url.pathname.endsWith('/rpc/request_organiser_access_v1')) {
      calls.request.push({ id: body?.p_organiser_id, message: body?.p_message });
      return json(route, { request_id: 'r1', status: 'open' });
    }
    if (url.pathname.endsWith('/rest/v1/organiser_profiles')) {
      return json(route, Object.values(ORGS).map((o) => ({ ...o, slug: null, avatar_url: null, city_id: null })));
    }
    return json(route, []);
  });
  return calls;
}

async function search(page: Page) {
  await page.goto('/account');
  await expect(page.getByTestId('organiser-onboarding')).toBeVisible();
  await page.getByTestId('organiser-search').fill('Ritmo');
  await expect(page.getByTestId('organiser-result')).toHaveCount(3);
}

const row = (page: Page, name: string) => page.getByTestId('organiser-result').filter({ hasText: name });

for (const width of [390, 768, 1280]) {
  test.describe(`organiser onboarding @${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('offers Claim only where the listed email is yours', async ({ page }) => {
      await signIn(page, 'otp');
      await mockApis(page);
      await search(page);
      await expect(row(page, ORGS.matches.name).getByTestId('claim-open')).toBeVisible();
      await expect(row(page, ORGS.differs.name).getByTestId('claim-open')).toHaveCount(0);
      await expect(row(page, ORGS.differs.name).getByTestId('request-open')).toBeVisible();
      await expect(row(page, ORGS.managed.name).getByTestId('claim-open')).toHaveCount(0);
      await expect(row(page, ORGS.managed.name)).toContainText('Managed by someone else');
      await expect(page.getByTestId('header-account-link')).toBeVisible();
      await expect(page.getByTestId('header-sign-in-link')).toHaveCount(0);
    });

    test('claims on a mailbox-proven session and lists the organiser', async ({ page }) => {
      await signIn(page, 'otp');
      const calls = await mockApis(page, { claim: 'ok' });
      await search(page);
      await row(page, ORGS.matches.name).getByTestId('claim-open').click();
      await page.getByTestId('claim-confirm').click();
      await expect(page.getByTestId('account-confirmation')).toContainText('is yours');
      await expect(page.getByTestId('organiser-home')).toContainText(ORGS.matches.name);
      expect(calls.claim).toEqual([ORGS.matches.id]);
    });

    test('asks for an email code on a password session and does not call the claim', async ({ page }) => {
      await signIn(page, 'password');
      const calls = await mockApis(page, { claim: 'ok' });
      await search(page);
      await row(page, ORGS.matches.name).getByTestId('claim-open').click();
      await expect(page.getByTestId('email-code-proof')).toBeVisible();
      await expect(page.getByTestId('claim-confirm')).toHaveCount(0);
      expect(calls.claim).toEqual([]);
    });

    test('a refused claim turns into a request with the reason shown', async ({ page }) => {
      await signIn(page, 'otp');
      const calls = await mockApis(page, { claim: 'email_mismatch' });
      await search(page);
      await row(page, ORGS.matches.name).getByTestId('claim-open').click();
      await page.getByTestId('claim-confirm').click();
      await expect(page.getByTestId(`onboarding-error-${ORGS.matches.id}`)).toContainText('different contact email');
      await page.getByTestId('request-note').fill('I run the Tuesday classes');
      await page.getByTestId('request-send').click();
      await expect(page.getByTestId('account-confirmation')).toContainText('Request sent');
      expect(calls.request).toEqual([{ id: ORGS.matches.id, message: 'I run the Tuesday classes' }]);
    });

    test('creating an organiser lands on its home, which offers "Send for review"', async ({ page }) => {
      await signIn(page, 'otp');
      const calls = await mockApis(page);
      await page.goto('/account');
      await page.getByTestId('create-open').click();
      await page.getByTestId('create-name').fill('Salsa & Bachata Leeds');
      await page.getByTestId('create-form').getByRole('combobox').click();
      await page.getByRole('option', { name: /London/ }).click();
      await page.getByTestId('create-submit').click();

      await expect(page.getByTestId('account-confirmation')).toContainText('saved as a draft');
      await expect(page.getByTestId('organiser-home')).toContainText('Salsa & Bachata Leeds');
      await expect(page.getByTestId('organiser-status')).toHaveText('Draft');
      expect(calls.create).toHaveLength(1);
      expect(calls.submit).toEqual([]);

      await page.getByTestId('send-for-review').click();
      await expect(page.getByTestId('organiser-status')).toHaveText('In review');
      await expect(page.getByTestId('organiser-status-note')).toHaveText('The team checks new organisers within a day.');
      expect(calls.submit).toEqual([{ p_organiser_id: CREATED_ID }]);
    });
  });
}

test('signed out, /account goes to sign-in and comes back', async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => json(route, {}));
  await mockApis(page);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/auth\?mode=signin&returnTo=%2Faccount/);
  await expect(page.getByTestId('header-account-link')).toHaveCount(0);
});

// Login launch gate step 6: signed out, the header offers "Sign in" as a 44px
// target at every width (390 is where most readers are), and it comes back to
// the page the reader was on.
for (const width of [390, 768, 1280]) {
  test(`signed out @${width}, the header Sign in link returns to the current page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/auth/v1/**', (route) => json(route, {}));
    await mockApis(page);
    await page.goto('/faq?q=1');
    const link = page.getByTestId('header-sign-in-link');
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    await link.click();
    await expect(page).toHaveURL(/\/auth\?mode=signin&returnTo=%2Ffaq%3Fq%3D1$/);
    await expect(link).toHaveCount(0);
  });
}
