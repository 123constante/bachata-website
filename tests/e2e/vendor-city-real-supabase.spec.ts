import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

type SessionLike = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  token_type?: string;
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null };
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const TEST_EMAIL = process.env.E2E_SUPABASE_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.E2E_SUPABASE_TEST_PASSWORD || '';
const TEST_CITY_A = process.env.E2E_VENDOR_TEST_CITY_A || 'London';
const TEST_CITY_B = process.env.E2E_VENDOR_TEST_CITY_B || 'Madrid';

const projectRefFromUrl = (url: string) => {
  try {
    const host = new URL(url).host;
    return host.split('.')[0] || '';
  } catch {
    return '';
  }
};

const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBApWl9i0AAAAASUVORK5CYII=';

test('real supabase: vendor create -> edit city -> detail uses city_id + cities(name) without RPC fallback', async ({ page }) => {
  test.setTimeout(120000);

  const missingVars = [
    ['VITE_SUPABASE_URL', SUPABASE_URL],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', SUPABASE_ANON_KEY],
    ['E2E_SUPABASE_TEST_EMAIL', TEST_EMAIL],
    ['E2E_SUPABASE_TEST_PASSWORD', TEST_PASSWORD],
  ]
    .filter(([, value]) => !value || value.trim().length === 0)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    test.skip(true, `Missing required env vars: ${missingVars.join(', ')}`);
  }

  expect(
    missingVars,
    `Missing required env vars: ${missingVars.join(', ')}. Set them in .env.e2e or shell environment.`,
  ).toEqual([]);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  expect(authError?.message || 'ok').toBe('ok');
  expect(authData.session).toBeTruthy();
  expect(authData.user).toBeTruthy();

  const session = authData.session as SessionLike;
  const userId = authData.user!.id;

  const { data: cityA, error: cityAError } = await supabase
    .from('cities')
    .select('id, name, slug')
    .ilike('name', TEST_CITY_A)
    .limit(1)
    .maybeSingle();

  const { data: cityB, error: cityBError } = await supabase
    .from('cities')
    .select('id, name, slug')
    .ilike('name', TEST_CITY_B)
    .limit(1)
    .maybeSingle();

  expect(cityAError?.message || 'ok').toBe('ok');
  expect(cityBError?.message || 'ok').toBe('ok');
  expect(cityA?.id).toBeTruthy();
  expect(cityB?.id).toBeTruthy();

  const cityAId = cityA!.id;
  const cityBId = cityB!.id;

  const { data: existingDancer, error: existingDancerError } = await supabase
    .from('dancers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  expect(existingDancerError?.message || 'ok').toBe('ok');

  if (existingDancer?.id) {
    const { error: updateDancerError } = await supabase
      .from('dancers')
      .update({
        first_name: 'Vendor',
        surname: 'E2E',
        city: cityA?.name || TEST_CITY_A,
        city_id: cityAId,
      })
      .eq('id', existingDancer.id);
    expect(updateDancerError?.message || 'ok').toBe('ok');
  } else {
    const { error: insertDancerError } = await supabase.from('dancers').insert({
      user_id: userId,
      first_name: 'Vendor',
      surname: 'E2E',
      city: cityA?.name || TEST_CITY_A,
      city_id: cityAId,
      verified: false,
      is_public: false,
      hide_surname: false,
    });
    expect(insertDancerError?.message || 'ok').toBe('ok');
  }

  const { error: cleanupBeforeError } = await supabase.from('vendors').delete().eq('user_id', userId);
  expect(cleanupBeforeError?.message || 'ok').toBe('ok');

  const projectRef = projectRefFromUrl(SUPABASE_URL);
  expect(projectRef).toBeTruthy();

  await page.addInitScript(
    ({ ref, sessionValue }) => {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sessionValue));
    },
    { ref: projectRef, sessionValue: session },
  );

  const fallbackRpcCalls: string[] = [];
  const legacyVendorWrites: Array<Record<string, unknown>> = [];
  const legacyVendorEmailWrites: Array<Record<string, unknown>> = [];
  const missingPublicEmailWrites: Array<Record<string, unknown>> = [];

  page.on('request', (request) => {
    const url = request.url();

    if (url.includes('/rest/v1/rpc/resolve_city_id')) {
      fallbackRpcCalls.push(url);
    }

    if (url.includes('/rest/v1/vendors') && (request.method() === 'POST' || request.method() === 'PATCH')) {
      try {
        const body = request.postDataJSON() as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(body, 'city')) {
          legacyVendorWrites.push(body);
        }
        if (Object.prototype.hasOwnProperty.call(body, 'email')) {
          legacyVendorEmailWrites.push(body);
        }
        if (!Object.prototype.hasOwnProperty.call(body, 'public_email')) {
          missingPublicEmailWrites.push(body);
        }
      } catch {
        // ignore non-JSON bodies
      }
    }
  });

  let vendorId: string | null = null;

  try {
    await page.goto('/create-vendor-profile');
    await expect(page.getByText('Storefront + Team setup')).toBeVisible();

    await page.fill('#vendor-storefront-name', `E2E Vendor ${Date.now()}`);
    await expect(page.getByText('Vendor E2E')).toBeVisible();
    await page.getByRole('button', { name: 'Continue to categories' }).click();

    await page.click('#vendor-first-category');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('button', { name: 'Use sample' }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'product.png',
      mimeType: 'image/png',
      buffer: Buffer.from(tinyPngBase64, 'base64'),
    });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('Trust and publish')).toBeVisible();
    await page.getByRole('button', { name: 'Edit Markdown' }).click();
    await page.fill('#vendor-faq-markdown', '## FAQ\n\n### Shipping\nYes, we ship worldwide.');
    await page.fill('#vendor-website', 'https://vendor-e2e.example.com');
    await page.getByRole('button', { name: 'Publish storefront' }).click();

    await expect(page).toHaveURL(/\/profile/);

    const { data: createdVendor, error: createdVendorError } = await supabase
      .from('vendors')
      .select('id, city, city_id, cities(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(createdVendorError?.message || 'ok').toBe('ok');
    expect(createdVendor?.id).toBeTruthy();

    vendorId = createdVendor!.id;

    await page.goto('/vendor-dashboard/edit');
    await expect(page.getByText('Vendor Dashboard')).toBeVisible();

    const cityCombobox = page.locator('#dashboard-section-profile button[role="combobox"]').first();
    await cityCombobox.click();
    await page.getByPlaceholder('Search city...').fill(cityB?.name || TEST_CITY_B);
    await page.getByRole('option', { name: new RegExp(cityB?.name || TEST_CITY_B, 'i') }).first().click();

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Vendor profile updated')).toBeVisible();

    const { data: editedVendor, error: editedVendorError } = await supabase
      .from('vendors')
      .select('id, city, city_id, cities(name)')
      .eq('id', vendorId)
      .single();

    expect(editedVendorError?.message || 'ok').toBe('ok');
    expect(editedVendor?.city_id).toBe(cityBId);
    expect(editedVendor?.city ?? null).toBeNull();
    const editedCityName = Array.isArray(editedVendor?.cities)
      ? editedVendor?.cities?.[0]?.name
      : (editedVendor?.cities as { name?: string } | null | undefined)?.name;
    expect(editedCityName).toBe(cityB?.name || TEST_CITY_B);

    await page.goto(`/vendors/${vendorId}`);
    await expect(page.getByText(cityB?.name || TEST_CITY_B)).toBeVisible();

    expect(fallbackRpcCalls).toEqual([]);
    expect(legacyVendorWrites).toEqual([]);
    expect(legacyVendorEmailWrites).toEqual([]);
    expect(missingPublicEmailWrites).toEqual([]);
  } finally {
    if (vendorId) {
      await supabase.from('vendors').delete().eq('id', vendorId);
    } else {
      await supabase.from('vendors').delete().eq('user_id', userId);
    }
  }
});
