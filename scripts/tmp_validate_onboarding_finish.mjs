import fs from 'node:fs';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment');
}

const adminlessClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const randomToken = () => Math.random().toString(36).slice(2, 10);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const storageKey = `sb-${projectRef}-auth-token`;

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn0pS8AAAAASUVORK5CYII=',
  'base64'
);

const isSupabaseUrl = (url) => url.includes('supabase.co');
const isWriteMethod = (method) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizePayload = (payload) => {
  if (Array.isArray(payload) && payload.length === 1) return payload[0];
  return payload;
};

const hasForbiddenKeys = (value, forbiddenKeys) => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKeys(item, forbiddenKeys));
  return Object.entries(value).some(([key, nested]) => forbiddenKeys.has(key) || hasForbiddenKeys(nested, forbiddenKeys));
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`App base URL not reachable: ${url} (${response.status})`);
  }
};

const resolveCity = async (client) => {
  const preferredSlugs = ['london-gb', 'world'];
  for (const slug of preferredSlugs) {
    const { data, error } = await client.from('cities').select('id,name,slug').eq('slug', slug).maybeSingle();
    if (!error && data?.id) return data;
  }

  const { data, error } = await client.from('cities').select('id,name,slug').limit(1).maybeSingle();
  if (error || !data?.id) {
    throw error || new Error('No city available for onboarding validation');
  }

  return data;
};

const makeAuthedClient = (session) =>
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  });

const createTestUser = async (city) => {
  const email = `onboarding-${Date.now()}-${randomToken()}@example.test`;
  const password = `Dev!${randomToken()}${randomToken()}`;

  const signUpResult = await adminlessClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: 'Seed',
        last_name: 'User',
        based_city_id: city.id,
        full_name: 'Seed User',
        user_type: 'dancer',
      },
    },
  });

  if (signUpResult.error) throw signUpResult.error;

  const passwordClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signInResult = await passwordClient.auth.signInWithPassword({ email, password });
  if (signInResult.error || !signInResult.data.session || !signInResult.data.user) {
    throw signInResult.error || new Error('Unable to sign in test user after sign up');
  }

  return {
    email,
    password,
    user: signInResult.data.user,
    session: signInResult.data.session,
  };
};

const seedMemberProfile = async (client, userId, cityId) => {
  const { error } = await client.from('member_profiles').upsert({
    id: userId,
    first_name: 'Seed',
    last_name: null,
    based_city_id: cityId,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
};

const selectCityIfNeeded = async (page, cityName) => {
  const finishButton = page.getByRole('button', { name: 'Finish' });
  const initiallyDisabled = await finishButton.isDisabled().catch(() => false);
  if (!initiallyDisabled) return { selected: false, reason: 'prefilled' };

  const cityCombobox = page.getByRole('combobox');
  const count = await cityCombobox.count();
  if (count === 0) return { selected: false, reason: 'no-combobox-found' };

  await cityCombobox.first().click();
  const searchInput = page.locator('input[placeholder="Search city..."]').first();
  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.fill(cityName);

  const option = page.locator('[cmdk-item]').filter({ hasText: cityName }).first();
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click();

  return { selected: true, reason: 'manual-selection' };
};

const main = async () => {
  await fetchJson(baseUrl);

  const city = await resolveCity(adminlessClient);
  const testUser = await createTestUser(city);
  const authedClient = makeAuthedClient(testUser.session);
  const seedResult = await seedMemberProfile(authedClient, testUser.user.id, city.id);

  const observed = {
    requests: [],
    responses: [],
    consoleErrors: [],
    pageErrors: [],
    finishClickAt: null,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(
    ({ storageKeyValue, session, pendingRole }) => {
      window.localStorage.setItem(storageKeyValue, JSON.stringify(session));
      window.localStorage.setItem('pending_profile_role', pendingRole);
    },
    { storageKeyValue: storageKey, session: testUser.session, pendingRole: 'dancer' }
  );

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      observed.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    observed.pageErrors.push(error.message);
  });

  page.on('request', (request) => {
    const url = request.url();
    if (!isSupabaseUrl(url) || !isWriteMethod(request.method())) return;

    observed.requests.push({
      url,
      method: request.method(),
      postData: request.postData() || null,
      startedAfterFinish: observed.finishClickAt ? Date.now() >= observed.finishClickAt : false,
    });
  });

  page.on('response', async (response) => {
    const url = response.url();
    const request = response.request();
    if (!isSupabaseUrl(url) || !isWriteMethod(request.method())) return;

    let bodyText = null;
    try {
      bodyText = await response.text();
    } catch {
      bodyText = null;
    }

    observed.responses.push({
      url,
      method: request.method(),
      status: response.status(),
      ok: response.ok(),
      bodyText,
      startedAfterFinish: observed.finishClickAt ? Date.now() >= observed.finishClickAt : false,
    });
  });

  const targetFirstName = 'Onboard';
  const targetLastName = 'Validator';
  const targetDanceRole = 'both';
  const targetMonth = '02';
  const targetYear = '2021';
  const expectedDancingStartDate = `${targetYear}-${targetMonth}-01`;

  await page.goto(`${baseUrl}/onboarding`, { waitUntil: 'networkidle' });
  await page.waitForURL(/\/onboarding/, { timeout: 15000 });

  await page.getByLabel('First name').fill(targetFirstName);
  await page.getByLabel('Last name (optional)').fill(targetLastName);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Avatar').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  });

  await page.locator('img[alt="Avatar preview"]').waitFor({ state: 'visible', timeout: 20000 });

  const citySelection = await selectCityIfNeeded(page, city.name);

  await page.getByRole('button', { name: 'Lead & Follow' }).click();
  await page.locator('select').nth(0).selectOption(targetMonth);
  await page.locator('select').nth(1).selectOption(targetYear);

  const finishButton = page.getByRole('button', { name: 'Finish' });
  await finishButton.waitFor({ state: 'visible', timeout: 10000 });
  if (await finishButton.isDisabled()) {
    throw new Error('Finish button is still disabled after valid onboarding inputs');
  }

  observed.finishClickAt = Date.now();
  await finishButton.click();
  await page.waitForURL(/\/profile$/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  await wait(2500);

  const writeRequests = observed.requests.filter((entry) => entry.startedAfterFinish);
  const writeResponses = observed.responses.filter((entry) => entry.startedAfterFinish);

  const byTarget = (fragment) => writeRequests.filter((entry) => entry.url.includes(fragment));
  const responseByTarget = (fragment) => writeResponses.filter((entry) => entry.url.includes(fragment));

  const memberWrites = byTarget('/rest/v1/member_profiles');
  const roleWrites = byTarget('/rest/v1/user_roles');
  const dancerWrites = byTarget('/rest/v1/dancers');
  const dancerProfileWrites = byTarget('/rest/v1/dancer_profiles');

  const memberPayload = normalizePayload(safeJsonParse(memberWrites[0]?.postData));
  const rolePayload = normalizePayload(safeJsonParse(roleWrites[0]?.postData));
  const dancerPayload = normalizePayload(safeJsonParse(dancerWrites[0]?.postData));

  const authReadClient = makeAuthedClient(testUser.session);

  const persisted = {};
  const persistedErrors = [];

  const readMember = await authReadClient
    .from('member_profiles')
    .select('id, first_name, last_name, based_city_id')
    .eq('id', testUser.user.id)
    .maybeSingle();
  if (readMember.error) persistedErrors.push(`member_profiles read failed: ${readMember.error.message}`);
  persisted.memberProfile = readMember.data || null;

  const readRoles = await authReadClient
    .from('user_roles')
    .select('user_id, role')
    .eq('user_id', testUser.user.id);
  if (readRoles.error) persistedErrors.push(`user_roles read failed: ${readRoles.error.message}`);
  persisted.userRoles = readRoles.data || [];

  const readDancer = await authReadClient
    .from('dancers')
    .select('id, user_id, city_id, dancing_start_date, partner_role, photo_url, first_name, surname')
    .eq('user_id', testUser.user.id)
    .maybeSingle();
  if (readDancer.error) persistedErrors.push(`dancers read failed: ${readDancer.error.message}`);
  persisted.dancer = readDancer.data || null;

  const forbiddenKeySet = new Set(['years_dancing', 'is_public']);
  const schemaCacheSignals = [
    ...observed.consoleErrors,
    ...observed.pageErrors,
    ...writeResponses.map((entry) => entry.bodyText || ''),
  ].filter(Boolean);

  const approvedDancerKeys = [
    'id',
    'user_id',
    'city_id',
    'dancing_start_date',
    'partner_role',
    'photo_url',
    'first_name',
    'surname',
  ].sort();

  const actualDancerKeys = dancerPayload && typeof dancerPayload === 'object'
    ? Object.keys(dancerPayload).sort()
    : [];

  const persistedDancingStartDate = typeof persisted.dancer?.dancing_start_date === 'string'
    ? persisted.dancer.dancing_start_date.slice(0, 10)
    : null;

  const result = {
    baseUrl,
    testUser: {
      id: testUser.user.id,
      email: testUser.email,
    },
    browserResult: {
      finalUrl: page.url(),
      reachedProfile: /\/profile$/.test(new URL(page.url()).pathname),
      citySelection,
      seedMemberProfile: seedResult,
    },
    networkWriteTargetsObserved: writeRequests.map((entry) => ({
      method: entry.method,
      url: entry.url,
    })),
    writeResponsesObserved: writeResponses.map((entry) => ({
      method: entry.method,
      url: entry.url,
      status: entry.status,
      ok: entry.ok,
      bodySnippet: entry.bodyText ? entry.bodyText.slice(0, 300) : null,
    })),
    requestPayloads: {
      member_profiles: memberPayload,
      user_roles: rolePayload,
      dancers: dancerPayload,
      dancer_profiles_attempts: dancerProfileWrites.length,
    },
    finalPersistedPayload: persisted.dancer,
    persistedSupportRows: {
      memberProfile: persisted.memberProfile,
      userRoles: persisted.userRoles,
    },
    remainingErrors: {
      consoleErrors: observed.consoleErrors,
      pageErrors: observed.pageErrors,
      persistedReadErrors: persistedErrors,
      nonOkWriteResponses: writeResponses.filter((entry) => !entry.ok).map((entry) => ({
        url: entry.url,
        status: entry.status,
        body: entry.bodyText,
      })),
    },
    checks: {
      finishSucceeded: /\/profile$/.test(new URL(page.url()).pathname),
      noSchemaCacheError: !schemaCacheSignals.some((entry) => String(entry).toLowerCase().includes('schema cache')),
      noDancerProfilesWriteAttempt: dancerProfileWrites.length === 0,
      dancersPayloadApprovedOnly:
        JSON.stringify(actualDancerKeys) === JSON.stringify(approvedDancerKeys),
      dancingStartDatePersistedAsYYYYMM01: persistedDancingStartDate === expectedDancingStartDate,
      postFinishDestinationReached: /\/profile$/.test(new URL(page.url()).pathname),
      memberProfilesWriteObserved: memberWrites.length > 0,
      userRolesWriteObserved: roleWrites.length > 0,
      memberProfilesPersisted:
        persisted.memberProfile?.first_name === targetFirstName &&
        persisted.memberProfile?.last_name === targetLastName &&
        persisted.memberProfile?.based_city_id === city.id,
      userRolesPersisted:
        Array.isArray(persisted.userRoles) && persisted.userRoles.some((row) => row.role === 'dancer'),
      noForbiddenYearsOrIsPublicWrites:
        !hasForbiddenKeys(memberPayload, forbiddenKeySet) &&
        !hasForbiddenKeys(rolePayload, forbiddenKeySet) &&
        !hasForbiddenKeys(dancerPayload, forbiddenKeySet) &&
        !writeRequests.some((entry) => hasForbiddenKeys(safeJsonParse(entry.postData), forbiddenKeySet)),
    },
  };

  result.pass = Object.values(result.checks).every(Boolean) &&
    result.remainingErrors.consoleErrors.length === 0 &&
    result.remainingErrors.pageErrors.length === 0 &&
    result.remainingErrors.nonOkWriteResponses.length === 0;

  await browser.close();
  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(JSON.stringify({
    pass: false,
    fatal: error?.message || String(error),
    stack: error?.stack || null,
  }, null, 2));
  process.exit(1);
});
