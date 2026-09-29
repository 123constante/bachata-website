import { test, expect, type Page, type Route } from '@playwright/test';

type DancerRow = {
  id: string;
  user_id: string;
  first_name: string;
  surname: string | null;
  // Real columns only. `city`, `city_id`, `dancing_start_date`, `years_dancing`,
  // `partner_role` and `verified` used to sit here too, none of them columns,
  // kept alive only by the direct-to-table write. A fixture carrying a field the
  // schema does not have is a fixture that can agree with a payload the database
  // would reject -- which is exactly what this spec did before the reroute.
  based_city_id: string | null;
  dance_role: string | null;
  dance_started_year: number | null;
  cities: { name: string } | null;
  avatar_url: string | null;
  photo_url: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  website: string | null;
  looking_for_partner: boolean;
  favorite_styles: string[] | null;
  favorite_songs: string[] | null;
  achievements: string[] | null;
  partner_search_role: string | null;
  partner_search_level: string[] | null;
  partner_practice_goals: string[] | null;
  partner_details: unknown;
  gallery_urls: string[] | null;
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
    // The owning link is dancer_profiles.id = auth.users.id, so the row's id IS
    // the user id. It used to be a third, unrelated uuid.
    id: userId,
    user_id: userId,
    first_name: 'Maya',
    surname: 'Flow',
    based_city_id: londonCityId,
    dance_role: 'Follower',
    dance_started_year: 2020,
    cities: { name: 'London' },
    // avatar_url is the writable column; photo_url is its MIRROR, and the
    // dashboard stores it as a display value. They are deliberately DIFFERENT
    // here so the fixture can tell them apart: seeding the identity form from the
    // mirror sends the stale one back into the authoritative column, and with
    // photo_url null (as it was first written) that mistake would merely drop the
    // key, so the case would have passed for the wrong reason.
    avatar_url: 'dancers/maya.jpg',
    photo_url: 'https://cdn.example/stale-mirror.jpg',

    instagram: null,
    facebook: null,
    whatsapp: null,
    website: null,
    looking_for_partner: false,
    favorite_styles: ['Sensual'],
    favorite_songs: ['Song A'],
    achievements: null,
    // Stored partner answers the user has NOT re-entered this session. The tile
    // switch lives OUTSIDE the editor and saves the whole partner section, so an
    // unhydrated form sends blanks for these -- and an empty list is what CLEARS
    // a sidecar list. They were all null here before, which is why the spec could
    // not tell a hydrated save from a wipe.
    // Deliberately OUTSIDE the role codec's map. partner_search_role is free text
    // on the sidecar with no CHECK and no DB normaliser, so hydrating it through
    // dancerRoleFromStored maps anything unrecognised to "" -- and "" now clears.
    // 'Leader' round-tripped through the codec unharmed and could not catch it.
    partner_search_role: 'Any',
    partner_search_level: ['Improver'],
    partner_practice_goals: ['Socials'],
    partner_details: 'Weeknights in Angel',
    gallery_urls: null,
    meta_data: { onboarding_status: 'completed' },
  };

  const savePayloads: Record<string, unknown>[] = [];
  /** Flipped at the end of the test to exercise the optimistic-rollback path. */
  let failSaves = false;
  /** Counts ATTEMPTS, including the failed ones savePayloads never sees. */
  let saveAttempts = 0;

  await setupMockAuth(page);

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path.endsWith('/rest/v1/dancer_profiles')) {
      if (method === 'GET') {
        // Honour the filter. Returning the row unconditionally meant a revert to
        // `.eq('created_by', ...)` -- the regression this arc exists to prevent --
        // still went green here while the real database returned nothing.
        if (!queryValue(url, 'id').includes(userId)) return json(route, null);
        return json(route, dancer);
      }

      // No PATCH arm on purpose. `authenticated` holds no UPDATE grant on this
      // table, so a client PATCH reaching here at all is the regression.
      if (method === 'PATCH' || method === 'POST') {
        return json(route, { message: 'permission denied for table dancer_profiles' }, 403);
      }
    }

    if (path.endsWith('/rest/v1/entities') || path.endsWith('/rest/v1/teacher_profiles') || path.endsWith('/rest/v1/videographers')) {
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

    if (rpcName === 'save_my_dancer_profile_v1') {
      saveAttempts += 1;
      if (failSaves) return json(route, { message: 'permission denied' }, 403);
      const payload = (route.request().postDataJSON() as { p_payload: Record<string, unknown> }).p_payload;
      savePayloads.push(payload);
      const details = (payload.dancer_details || {}) as Record<string, unknown>;
      // The real function returns the canonical row, and the screen repaints from
      // it rather than from a locally assembled guess.
      dancer = {
        ...dancer,
        first_name: (payload.first_name as string) || dancer.first_name,
        based_city_id: (payload.based_city_id as string) || dancer.based_city_id,
        looking_for_partner:
          typeof details.looking_for_partner === 'boolean' ? details.looking_for_partner : dancer.looking_for_partner,
      };
      // dancer_profiles COLUMNS ONLY. The live function ends
      // `RETURN (SELECT to_jsonb(dp.*) ...)`, so it can carry neither the `cities`
      // join nor `user_id` -- and applySavedProfile exists precisely BECAUSE the
      // join is absent. Handing back the whole fixture made the mocked response
      // richer than production, so a regression that started reading saved.cities,
      // or that dropped the explicit carry-forward, would have passed here and
      // blanked the city label on the real site.
      const { cities: _cities, user_id: _userId, ...columnsOnly } = dancer;
      return json(route, columnsOnly);
    }

    return json(route, null);
  });

  await page.goto('/profile');

  await expect(page.getByRole('button', { name: 'Dancer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vendor' })).toBeVisible();

  await expect(page.getByText('Concept B command center')).toBeVisible();

  // The partner toggle goes FIRST, with no editor ever opened, because that is
  // the state in which the form has never been hydrated -- and this switch saves
  // the whole partner section.
  const searchingLabel = page.getByText('Searching').first();
  const partnerSwitch = searchingLabel.locator('..').getByRole('switch');
  await partnerSwitch.click();

  await expect(page.getByText('Looking for role').first()).toBeVisible();

  await expect.poll(() => savePayloads.length).toBeGreaterThan(0);
  const partnerPayload = savePayloads[0];
  const partnerDetails = (partnerPayload.dancer_details || {}) as Record<string, unknown>;
  expect(partnerDetails.looking_for_partner).toBe(true);
  // The stored answers must survive a toggle the user never typed into.
  expect(partnerDetails.partner_search_level).toEqual(['Improver']);
  expect(partnerDetails.partner_practice_goals).toEqual(['Socials']);
  expect(partnerDetails.partner_search_role).toBe('Any');
  // TEXT, not the serialised { text: ... } object.
  expect(partnerDetails.partner_details).toBe('Weeknights in Angel');
  // A section save must not carry fields its editor never showed.
  expect(partnerPayload).not.toHaveProperty('first_name');
  // The function's return value carries no `cities` join, so the city label can
  // only still be on screen because applySavedProfile carried it forward. It
  // renders 'City missing' the moment that stops being true.
  await expect(page.getByText('City missing')).toHaveCount(0);

  // Type a blurb, then open an editor INSIDE the 600ms debounce window.
  // openEditor is the one place that throws editForm away, so without a
  // flush-and-carry the pending text is written and then reverted: the next
  // partner save rebuilds from the reverted form and puts the old text back.
  await page.getByPlaceholder('Availability', { exact: false }).fill('Tuesdays at Angel');
  await page.getByRole('button', { name: 'Edit identity' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit identity' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Edit identity' })).toBeHidden();

  // Deselect a stored level, which forces ANOTHER partner save built from the
  // editForm openEditor just rewrote. Waiting on the payload COUNT first is the
  // point: the first draft polled only the last payload, so when the badge click
  // silently missed its target the debounce timer's own save satisfied the
  // assertion and the case passed against the very mutation it was written for.
  const beforeBadge = savePayloads.length;
  await page.getByText('Improver', { exact: true }).first().click();
  await expect.poll(() => savePayloads.length).toBeGreaterThan(beforeBadge);

  const badgeSave = (savePayloads[savePayloads.length - 1].dancer_details || {}) as Record<string, unknown>;
  expect(badgeSave.partner_search_level).toEqual([]);
  expect(badgeSave.partner_details).toBe('Tuesdays at Angel');

  await page.getByRole('button', { name: 'Edit identity' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit identity' })).toBeVisible();

  await page.getByPlaceholder('First name').fill('Maya Updated');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect.poll(() => savePayloads.some((payload) => Object.prototype.hasOwnProperty.call(payload, 'first_name'))).toBeTruthy();
  const identityPayload = savePayloads.find((payload) => Object.prototype.hasOwnProperty.call(payload, 'first_name'));
  expect(identityPayload).toBeTruthy();
  expect(identityPayload?.first_name).toBe('Maya Updated');
  // `based_city_id` is the column. `city_id` -- which this spec used to assert --
  // is not one, so the old expectation agreed with a payload the database would
  // have rejected outright.
  expect(identityPayload?.based_city_id).toBe(londonCityId);
  expect(identityPayload).not.toHaveProperty('city_id');
  expect(identityPayload).not.toHaveProperty('dancing_start_date');
  // The WRITABLE column goes back exactly as stored. Seeded from the mirror it
  // would come back as 'https://cdn.example/stale-mirror.jpg' instead.
  expect(identityPayload?.avatar_url).toBe('dancers/maya.jpg');

  // The switch and the inline editor render OPTIMISTICALLY. A failed save used to
  // fire its toast and leave them showing the new state anyway, so the switch sat
  // ON over a row that still said false, every later badge tap saved against a
  // state the server never accepted, and a reload silently undid all of it.
  await expect(partnerSwitch).toBeChecked();
  failSaves = true;
  const attemptsBeforeRollback = saveAttempts;
  await partnerSwitch.click();

  // The final state is the SAME state the switch was already in, so on its own
  // `toBeChecked()` would pass if the click never landed or the handler bailed --
  // the vacuous shape the badge assertion above was rewritten to avoid. Pin that
  // a save was attempted and that it visibly failed, THEN that the switch came
  // back, so the assertion can only be satisfied by an actual rollback.
  await expect.poll(() => saveAttempts).toBeGreaterThan(attemptsBeforeRollback);
  await expect(page.getByText('Error saving').first()).toBeVisible();
  await expect(partnerSwitch).toBeChecked();
});
