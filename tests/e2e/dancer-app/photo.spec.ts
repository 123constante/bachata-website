import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json, refuse } from '../helpers/organiserFake';

// /app/me/photo at 390x844 (W2d): pick -> crop -> preview -> upload -> save -> delete, with the
// gate, the profile read, the save RPC and the two storage functions mocked at the network layer.
// Asserts the ORDER of the network calls and takes a screenshot of every state.

const SHOTS = 'docs/handover/dancer-rebuild-w2d';
// The person's OWN upload (under avatars/u/<uid>/): the only kind the flow deletes (W2d fix d515401).
const UID = '11111111-1111-4111-8111-111111111111';
const OLD_KEY = `avatars/u/${UID}/old.jpg`;
const OLD = `https://img.example/${OLD_KEY}`;
// A legacy / admin-uploaded photo outside the own prefix: replaced, never deleted.
const LEGACY = 'https://img.example/old.jpg';
const NEW = 'https://img.example/new.jpg';

const profile = (avatar: string | null) => ({
  profile_id: 'b1000000-0000-4000-8000-000000000001', user_id: UID,
  display_name: null, first_name: 'Ana', surname: null, hide_surname_publicly: false,
  based_city_id: 'c1000000-0000-4000-8000-000000000001', city_name: 'London', dance_role: 'Follower',
  nationality: null, languages: [], bio: null, instagram: null, facebook: null, website_url: null, whatsapp: null,
  show_whatsapp_publicly: true, avatar_url: avatar, dance_started_year: null, favorite_styles: [], favorite_songs: [],
  achievements: [], other_roles: [], is_active: true, erase_requested_at: null, linked_from_admin: false,
  complete: avatar !== null, strength: { pct: avatar ? 70 : 55, next_step: avatar ? 'started_year' : 'photo', missing: avatar ? ['started_year'] : ['photo'] },
});

async function setup(page: Page, opts: { avatar?: string | null; uploadFails?: number; saveFails?: boolean } = {}) {
  const order: string[] = [];
  let uploads = 0;
  const avatar = opts.avatar === undefined ? OLD : opts.avatar;
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: false, allowed: true }));
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1', (r) => json(r, profile(avatar)));
  await page.route('**/rest/v1/rpc/save_my_dancer_profile_v2', (r) => {
    order.push(`save:${JSON.stringify(r.request().postDataJSON())}`);
    return opts.saveFails ? refuse(r, 'rate_limited') : json(r, profile(NEW));
  });
  await page.route('**/functions/v1/storage-sign-upload', (r) => {
    uploads += 1;
    order.push('upload');
    if (uploads <= (opts.uploadFails ?? 0)) return r.fulfill({ status: 500, body: 'x' });
    return json(r, { ok: true, publicUrl: NEW, key: 'avatars/u/x.jpg' });
  });
  await page.route('**/functions/v1/storage-delete-object', (r) => {
    order.push(`delete:${JSON.stringify(r.request().postDataJSON())}`);
    return json(r, { ok: true });
  });
  return { order };
}

/** A real JPEG made in the page (a 600x800 portrait gradient), as bytes. */
async function makeJpeg(page: Page, w = 600, h = 800) {
  const b64 = await page.evaluate(([W, H]) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#d58be6'); grad.addColorStop(1, '#ff7a66');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(W / 2, H * 0.38, W * 0.17, H * 0.2, 0, 0, 7); g.fill();
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, [w, h]);
  return Buffer.from(b64, 'base64');
}

test.describe('photo screen 390x844', () => {
  test.use({ viewport: PHONE });

  test('replace: pick, crop, preview, upload -> save -> delete old, then back to Me', async ({ page }) => {
    const { order } = await setup(page);
    await page.goto('/app/me/photo');
    await expect(page.getByTestId('photo-pick')).toBeVisible();
    await expect(page.getByTestId('photo-input-camera')).toHaveAttribute('capture', 'user');
    await page.screenshot({ path: `${SHOTS}/1-pick.png` });
    await page.getByTestId('photo-input-library').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
    await expect(page.getByTestId('photo-crop')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${SHOTS}/2-crop.png` });
    await page.getByTestId('photo-crop-box').focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowLeft');
    await page.getByTestId('photo-crop-done').click();
    await expect(page.getByTestId('photo-preview')).toBeVisible();
    await expect(page.getByText('This is how people will see you.')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/3-preview.png` });
    await page.getByTestId('photo-use').click();
    await expect(page).toHaveURL(/\/app\/me$/);
    expect(order).toEqual(['upload', `save:${JSON.stringify({ p_payload: { avatar_url: NEW } })}`, `delete:${JSON.stringify({ keys: [OLD_KEY] })}`]);
  });

  test('replace a legacy foreign photo: upload -> save, and NO delete', async ({ page }) => {
    const { order } = await setup(page, { avatar: LEGACY });
    await page.goto('/app/me/photo');
    await page.getByTestId('photo-input-library').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
    await page.getByTestId('photo-crop-done').click();
    await page.getByTestId('photo-use').click();
    await expect(page).toHaveURL(/\/app\/me$/);
    expect(order).toEqual(['upload', `save:${JSON.stringify({ p_payload: { avatar_url: NEW } })}`]);
  });

  test('refused file: reason shown, pick again', async ({ page }) => {
    await setup(page);
    await page.goto('/app/me/photo');
    await page.getByTestId('photo-input-library').setInputFiles({ name: 'a.heic', mimeType: 'image/heic', buffer: Buffer.from('x') });
    await expect(page.getByTestId('photo-refusal')).toContainText('Pick another photo');
    await page.screenshot({ path: `${SHOTS}/4-refused.png` });
  });

  test('upload fails then retry keeps the crop; no save, no delete before success', async ({ page }) => {
    const { order } = await setup(page, { uploadFails: 1 });
    await page.goto('/app/me/photo');
    await page.getByTestId('photo-input-library').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
    await page.getByTestId('photo-crop-done').click();
    await page.getByTestId('photo-use').click();
    await expect(page.getByTestId('photo-failure')).toBeVisible();
    expect(order).toEqual(['upload']);
    await page.screenshot({ path: `${SHOTS}/5-upload-failed.png` });
    await page.getByTestId('photo-use').click();
    await expect(page).toHaveURL(/\/app\/me$/);
    expect(order.map((o) => o.split(':')[0])).toEqual(['upload', 'upload', 'save', 'delete']);
  });

  test('save fails: INTERFACE copy, old photo never deleted', async ({ page }) => {
    const { order } = await setup(page, { saveFails: true });
    await page.goto('/app/me/photo');
    await page.getByTestId('photo-input-library').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
    await page.getByTestId('photo-crop-done').click();
    await page.getByTestId('photo-use').click();
    await expect(page.getByTestId('photo-failure')).toContainText('Wait a few minutes');
    await page.screenshot({ path: `${SHOTS}/6-save-failed.png` });
    expect(order.some((o) => o === 'delete')).toBe(false);
  });

  test('first photo: no delete call; offline disables Use this photo', async ({ page, context }) => {
    const { order } = await setup(page, { avatar: null });
    await page.goto('/app/me/photo?return=/app/home');
    await page.getByTestId('photo-input-library').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page, 800, 600) });
    await page.getByTestId('photo-crop-done').click();
    await context.setOffline(true);
    await expect(page.getByTestId('photo-use')).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/7-offline.png` });
    await context.setOffline(false);
    await page.getByTestId('photo-use').click();
    await expect(page).toHaveURL(/\/app\/home$/);
    expect(order.map((o) => o.split(':')[0])).toEqual(['upload', 'save']);
  });
});
