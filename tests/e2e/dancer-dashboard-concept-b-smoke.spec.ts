import { test, expect, type Page, type Route } from '@playwright/test';

type DancerRow = {
  id: string;
  user_id: string;
  first_name: string;
  surname: string | null;
  city: string | null;
  city_id: string | null;
  dancing_start_date: string | null;
  years_dancing: string | null;
  photo_url: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  website: string | null;
  looking_for_partner: boolean;
  partner_role: string | null;
  favorite_styles: string[] | null;
  favorite_songs: string[] | null;
  achievements: string[] | null;
  partner_search_role: string | null;
  partner_search_level: string[] | null;
  partner_practice_goals: string[] | null;
  partner_details: unknown;
  gallery_urls: string[] | null;
  verified: boolean;
  meta_data: Record<string, unknown>;
};

const projectRef = 'stsdtacfauprzrdebmzg';
const userId = '99999999-1111-2222-3333-444444444444';
const dancerId = '88888888-1111-2222-3333-444444444444';
const vendorId = '77777777-1111-2222-3333-444444444444';
const londonCityId = '33333333-3333-3333-3333-333333333333';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const queryValue = (url: URL, key: string) => url.searchParams.get(key) || '';

const setupMockAuth = async (page: Page) => {
  const authSession = {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: 'mock-refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'dancer@example.com',
      user_metadata: {
        first_name: 'Maya',
        surname: 'Flow',
      },
    },
  };

  await page.addInitScript(
    ({ session, ref }) => {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
      localStorage.setItem('profile_entry_role', 'dancer');
    },
    { session: authSession, ref: projectRef },
  );

  await page.route('**/auth/v1/**', async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (method === 'GET' && url.pathname.endsWith('/auth/v1/user')) {
      return json(route, authSession.user);
    }

    if (method === 'POST' && url.pathname.endsWith('/auth/v1/token')) {
      return json(route, {
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
        token_type: 'bearer',
        expires_in: 3600,
        user: authSession.user,
      });
    }

    if (method === 'PUT' && url.pathname.endsWith('/auth/v1/user')) {
      return json(route, authSession.user);
    }

    return json(route, {});
  });
};

test('concept-b dancer dashboard: role strip visible, identity modal saves, and tile partner toggle persists', async ({ page }) => {
  let dancer: DancerRow = {
    id: dancerId,
    user_id: userId,
    first_name: 'Maya',
    surname: 'Flow',
    city: 'London',
    city_id: londonCityId,
    dancing_start_date: '2020-01-01',
    years_dancing: '4',
    photo_url: null,
    instagram: null,
    facebook: null,
    whatsapp: null,
    website: null,
    looking_for_partner: false,
    partner_role: 'Follower',
    favorite_styles: ['Sensual'],
    favorite_songs: ['Song A'],
    achievements: null,
    partner_search_role: null,
    partner_search_level: null,
    partner_practice_goals: null,
    partner_details: null,
    gallery_urls: null,
    verified: true,
    meta_data: { onboarding_status: 'completed' },
  };

  const patchPayloads: Record<string, unknown>[] = [];

  await setupMockAuth(page);

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path.endsWith('/rest/v1/dancers')) {
      if (method === 'GET') {
        return json(route, dancer);
      }

      if (method === 'PATCH') {
        const payload = req.postDataJSON() as Record<string, unknown>;
        patchPayloads.push(payload);
        dancer = {
          ...dancer,
          ...payload,
          city: payload.city_id ? 'London' : dancer.city,
        };
        return json(route, [dancer]);
      }
    }

    if (path.endsWith('/rest/v1/organisers') || path.endsWith('/rest/v1/dj_profiles') || path.endsWith('/rest/v1/teacher_profiles') || path.endsWith('/rest/v1/videographers')) {
      if (method === 'GET') return json(route, null);
    }

    if (path.endsWith('/rest/v1/vendors')) {
      if (method === 'GET') {
        if (queryValue(url, 'user_id').includes(userId)) {
          return json(route, { id: vendorId, city_id: londonCityId, cities: { name: 'London' } });
        }
        return json(route, null);
      }
    }

    if (path.endsWith('/rest/v1/cities')) {
      if (method === 'GET') {
        if (queryValue(url, 'id').includes(londonCityId)) {
          return json(route, { id: londonCityId, name: 'London', slug: 'london' });
        }
        return json(route, null);
      }
    }

    return route.continue();
  });

  await page.route('**/rest/v1/rpc/**', async (route) => {
    const url = new URL(route.request().url());
    const rpcName = url.pathname.split('/').pop() || '';

    if (rpcName === 'get_user_participant_events') {
      return json(route, [
        {
          event_id: 'e1',
          event_name: 'Bachata Friday',
          event_date: '2099-05-20',
          status: 'going',
        },
      ]);
    }

    if (rpcName === 'resolve_city_id') {
      return json(route, londonCityId);
    }

    if (rpcName === 'claim_vendor_profile_for_current_user') {
      return json(route, vendorId);
    }

    return json(route, null);
  });

  await page.goto('/profile');

  await expect(page.getByRole('button', { name: 'Dancer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vendor' })).toBeVisible();

  await expect(page.getByText('Concept B command center')).toBeVisible();
  await page.getByRole('button', { name: 'Edit identity' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit identity' })).toBeVisible();

  await page.getByPlaceholder('First name').fill('Maya Updated');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect.poll(() => patchPayloads.length).toBeGreaterThan(0);
  const identityPayload = patchPayloads.find((payload) => Object.prototype.hasOwnProperty.call(payload, 'first_name'));
  expect(identityPayload).toBeTruthy();
  expect(identityPayload?.first_name).toBe('Maya Updated');
  expect(identityPayload?.city_id).toBe(londonCityId);

  const searchingLabel = page.getByText('Searching').first();
  const partnerSwitch = searchingLabel.locator('..').getByRole('switch');
  await partnerSwitch.click();

  await expect(page.getByText('Looking for role').first()).toBeVisible();

  await expect.poll(() => patchPayloads.some((payload) => Object.prototype.hasOwnProperty.call(payload, 'looking_for_partner'))).toBeTruthy();
  const togglePayload = patchPayloads.find((payload) => Object.prototype.hasOwnProperty.call(payload, 'looking_for_partner'));
  expect(togglePayload?.looking_for_partner).toBe(true);
});
