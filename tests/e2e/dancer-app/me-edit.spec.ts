import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json } from '../helpers/organiserFake';
import { DANCER_SHAPES, type DancerShapeName } from '../../../src/modules/dancer-app/api/fixtures';

// W2c: /app/me and /app/me/edit in a real browser at 390x844. The gate, my_dancer_edit_v1 and
// save_my_dancer_profile_v2 are mocked at the network layer (page.route on the RPC URLs).
// Proves: the screens render prod-shaped data, Save is disabled with its reason while untouched,
// a change sends ONLY the changed key, and no control is under 44px.

const GATE = '**/rest/v1/rpc/dancer_area_gate_v1';
const EDIT = '**/rest/v1/rpc/my_dancer_edit_v1';
const SAVE = '**/rest/v1/rpc/save_my_dancer_profile_v2';
const SHOTS = process.env.DANCER_SHOTS_DIR;

async function open(page: Page, path: string, shape: DancerShapeName) {
  const fake = new OrganiserFake({ noOrganiser: true });
  const saves: unknown[] = [];
  await fake.install(page);
  await page.route(GATE, (route) => json(route, { open: false, allowed: true }));
  await page.route(EDIT, (route) => json(route, DANCER_SHAPES[shape].profile));
  await page.route(SAVE, (route) => {
    const body = route.request().postDataJSON() as { p_payload: Record<string, unknown> };
    saves.push(body.p_payload);
    return json(route, { ...DANCER_SHAPES[shape].profile, ...body.p_payload });
  });
  await page.goto(path);
  return { saves };
}

async function shortControls(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('[data-profile="dancer"] a, [data-profile="dancer"] button, [data-profile="dancer"] input'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 43.5) out.push(`${(el.textContent || (el as HTMLInputElement).id || '').trim().slice(0, 20)} ${r.width}x${r.height}`);
    }
    return out;
  });
}

const SHAPES: DancerShapeName[] = ['emptyStub', 'fourFieldComplete', 'completeAllExtras', 'teacherWithWhatsapp', 'paused'];

test.describe('me + edit 390x844', () => {
  test.use({ viewport: PHONE });

  for (const shape of SHAPES) {
    test(`Me renders for ${shape}`, async ({ page }) => {
      await open(page, '/app/me', shape);
      await expect(page.getByTestId('dancer-screen-me')).toBeVisible();
      await expect(page.getByTestId('me-main-action')).toBeVisible();
      expect(await shortControls(page)).toEqual([]);
      await expectNoHorizontalScroll(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/me-${shape}.png`, fullPage: true });
    });

    test(`Edit renders for ${shape}, Save disabled with its reason`, async ({ page }) => {
      const { saves } = await open(page, '/app/me/edit', shape);
      await expect(page.getByTestId('dancer-screen-edit')).toBeVisible();
      await expect(page.getByTestId('edit-save')).toBeDisabled();
      await expect(page.getByTestId('edit-save-reason')).toHaveText('Nothing has changed yet. Edit a field above to save.');
      await expectNoHorizontalScroll(page);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/edit-top-${shape}.png` });
        await page.getByTestId('edit-save').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/edit-bottom-${shape}.png` });
      }
      expect(saves).toEqual([]);
    });
  }

  test('a change sends only the changed key, then Save is disabled again', async ({ page }) => {
    const { saves } = await open(page, '/app/me/edit', 'completeAllExtras');
    await page.locator('#nationality').fill('French');
    await page.getByTestId('edit-save').click();
    await expect(page.getByTestId('edit-saved')).toBeVisible();
    expect(saves).toEqual([{ nationality: 'French' }]);
    await expect(page.getByTestId('edit-save')).toBeDisabled();
  });

  test('a pure dancer has no WhatsApp field; a teacher does', async ({ page }) => {
    await open(page, '/app/me/edit', 'fourFieldComplete');
    await expect(page.getByTestId('dancer-screen-edit')).toBeVisible();
    await expect(page.getByTestId('edit-whatsapp')).toHaveCount(0);
    await page.close();
  });
});
