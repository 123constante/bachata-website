import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { checkOverflow, frames } from './helpers';
import {
  ADD_OK, EVERY_GROUP, LONG_NAMES, MANY_ROWS, ONE_ROW, PROD_LIST, PROD_NEEDS, STATUS_MATRIX, addError, asAdmin, type Call, type Rpcs,
} from './frontDoorFake';
import { ADD_ERROR_TEXT, ADD_ERROR_FALLBACK, RUN_BY_US_WHY, RUN_BY_US_OFF_WHY } from '../../src/modules/admin-organisers/addOrganiserModel';
import * as needsModel from '../../src/modules/admin-organisers/needsYouModel';

/**
 * #1033 S4 front-door screens (Add, Organisers, Needs you) walked on a PHONE, every
 * screen x every shape, on the fake (frontDoorFake.ts: an admin session and scripted
 * answers for the six front-door RPCs; the prod shapes are the owner's 2026-10-25 phone
 * screenshots of the preview on real data). Each case: no sideways scroll, every
 * control >= 44px tall (px, not rem: the site's html font-size is ~13.5px on phones),
 * axe colour contrast (AA), every disabled control prints its reason, no copy that points
 * at a control that is missing or in the other state, and empty states offer an action.
 * SHOTS=docs/design/1033 writes the design record's screenshots (<screen>-<shape>.png).
 */

const URL = '/admin/organisers/front-door';
const SCOPE = '[data-testid="front-door"]';
const SLOW = { timeout: 30_000 }; // a failed read retries (react-query default) before the error shows

const shot = async (page: Page, name: string, fullPage = true) => {
  await frames(page);
  const path = process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage, scale: 'css', animations: 'disabled' });
};

async function screenChecks(page: Page, label: string) {
  expect(await checkOverflow(page), `${label}: no sideways scroll`).toEqual([]);
  const report = await page.evaluate((scope) => {
    const root = document.querySelector(scope)!;
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const name = (el: Element) => (el.getAttribute('data-testid') ?? el.textContent ?? el.tagName).trim().slice(0, 50);
    const controls = [...root.querySelectorAll('button, a[href], input, textarea, select, [role="combobox"]')].filter(visible)
      .filter((el) => !(el instanceof HTMLInputElement && el.type === 'hidden'));
    // A 24px switch sits inside a >= 44px label row: the label is the tap target.
    const tapBox = (el: Element) => (el instanceof HTMLInputElement && el.type === 'checkbox' && el.closest('label')) || el;
    const small = controls.map((el) => ({ el: name(el), h: Math.round(tapBox(el).getBoundingClientRect().height) })).filter((x) => x.h < 44);
    const reasonless = controls.filter((el) => (el as HTMLButtonElement).disabled).filter((el) => {
      const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      return !ids.some((id) => { const r = document.getElementById(id); return r && visible(r) && (r.textContent ?? '').trim().length > 0; });
    }).map(name);
    // Copy that names the Run by us switch must match the switch it sits beside.
    const wrongSwitch: string[] = [];
    for (const li of root.querySelectorAll('[data-testid="fd-row"]')) {
      const sw = li.querySelector<HTMLInputElement>('[data-testid="fd-run-by-us"]');
      const text = li.textContent ?? '';
      if (/Switch Run by us off/.test(text) && !(sw && sw.checked && !sw.disabled)) wrongSwitch.push(`${name(li.querySelector('a')!)}: says switch off, switch is ${sw?.checked ? 'on' : 'off'}`);
      if (/Switch Run by us on/.test(text) && !(sw && !sw.checked && !sw.disabled)) wrongSwitch.push(`${name(li.querySelector('a')!)}: says switch on, switch is ${sw?.checked ? 'on' : 'off'}`);
    }
    const text = root.textContent ?? '';
    const has = (sel: string) => [...root.querySelectorAll(sel)].some(visible);
    const pointers: [RegExp, string][] = [
      [/switch on Run by us/i, '[data-testid="add-run-by-us"]:not([disabled])'],
      [/open the organisers list/i, '[data-testid="fd-tab-list"], [data-testid="add-open-list"]'],
      [/tap Send invite on this organiser/i, '[data-testid="add-open-list"]'],
      [/Add one|add an organiser/i, '[data-testid="fd-tab-add"]'],
      [/open the existing page/i, '[data-testid="add-open-organiser"]'],
      [/try again/i, 'button'],
    ];
    const dangling = pointers.filter(([re, sel]) => re.test(text) && !has(sel)).map(([re]) => String(re));
    // Text wider than its own box is cut off or runs under its neighbour (a long unbroken name).
    const clipped = [...root.querySelectorAll('a, p, h1, h2, span, button')].filter(visible)
      .filter((el) => getComputedStyle(el).display !== 'inline' && el.scrollWidth > el.clientWidth + 1).map(name);
    // A greyed control must not look like the live one beside it (#1033 critique C1): no fill,
    // a dashed edge and muted words; a switch that cannot change has muted words next to it.
    const looksLive = controls.filter((el) => el instanceof HTMLButtonElement && el.disabled).filter((el) => {
      const s = getComputedStyle(el);
      return s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.borderStyle !== 'dashed' || Number(s.opacity) < 1;
    }).map(name);
    const liveText = getComputedStyle(root).color;
    const loudLabels = [...root.querySelectorAll<HTMLInputElement>('label input[type="checkbox"]:disabled')]
      .filter((el) => getComputedStyle(el.closest('label')!).color === liveText).map(name);
    return { small, reasonless, wrongSwitch, dangling, clipped, looksLive, loudLabels };
  }, SCOPE);
  expect(report.looksLive, `${label}: a greyed button does not look tappable`).toEqual([]);
  expect(report.loudLabels, `${label}: a locked switch's words are greyed too`).toEqual([]);
  expect(report.clipped, `${label}: no text wider than its box`).toEqual([]);
  expect(report.small, `${label}: taps >= 44px`).toEqual([]);
  expect(report.reasonless, `${label}: every disabled control says why`).toEqual([]);
  expect(report.wrongSwitch, `${label}: copy matches the Run by us switch`).toEqual([]);
  expect(report.dangling, `${label}: copy points only at controls on screen`).toEqual([]);
  const axe = await new AxeBuilder({ page }).include(SCOPE).withRules(['color-contrast']).analyze();
  expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${(n.failureSummary ?? '').split('\n').pop()}`)), `${label}: contrast >= 4.5`).toEqual([]);
}

async function open(page: Page, rpcs: Rpcs, tab: 'add' | 'list' | 'needs' = 'add'): Promise<Call[]> {
  const calls = await asAdmin(page, rpcs);
  await page.goto(URL);
  await expect(page.getByTestId('front-door')).toBeVisible();
  if (tab !== 'add') await page.getByTestId(`fd-tab-${tab}`).click();
  return calls;
}

const only390 = (name: string) => test.skip(test.info().project.name !== 'phone-390x844' && name !== 'main', 'main three at 360x640 too');
const size = () => (test.info().project.name === 'phone-360x640' ? '-360' : '');

// ---- Organisers ---------------------------------------------------------------------------------

test.describe('Organisers list', () => {
  test('prod: All 48 = Run by us 42, Invited 0, Joined 2, Live 4', async ({ page }) => {
    only390('main');
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
    });
    await open(page, { list: PROD_LIST, needs: PROD_NEEDS }, 'list');
    await expect(page.getByTestId('fd-filter-all')).toHaveText('All 48');
    await expect(page.getByTestId('fd-filter-run_by_us')).toHaveText('Run by us 42');
    await expect(page.getByTestId('fd-filter-invited')).toHaveText('Invited 0');
    await expect(page.getByTestId('fd-filter-joined')).toHaveText('Joined 2');
    await expect(page.getByTestId('fd-filter-live')).toHaveText('Live 4');
    const a2b = page.getByTestId('fd-row').filter({ hasText: 'a2b Dance Academy' });
    await expect(a2b.getByTestId('fd-send')).toBeDisabled();
    await expect(a2b.getByTestId('fd-send-reason')).toHaveText('Already joined, so there is nothing to send.');
    await expect(a2b.getByTestId('fd-run-by-us')).toBeDisabled();
    const agapi = page.getByTestId('fd-row').filter({ hasText: 'Agapi Musicality Dance Project' });
    await expect(agapi.getByTestId('fd-send')).toBeDisabled();
    await expect(agapi.getByTestId('fd-send-reason')).toHaveText('We run this page, so there is no invite. Switch Run by us off first to prepare one.');
    await expect(page.getByTestId('fd-row')).toHaveCount(48);
    // The way back says where it goes, and the crumbs name this page (#1033 critique C2, C3).
    await expect(page.getByTestId('fd-back')).toHaveAccessibleName('Back to Organiser access');
    await expect(page.getByTestId('fd-back')).toHaveAttribute('href', '/admin/organisers');
    const crumbs = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(crumbs.getByRole('link', { name: 'Organiser access' })).toHaveAttribute('href', '/admin/organisers');
    await expect(crumbs).toContainText('Add and manage organisers');
    await screenChecks(page, 'list prod');
    // Late data (the list, then the Needs you badge) must not push the page about: CLS, logged for the record.
    await expect(page.getByTestId('needs-badge')).toHaveText('23');
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`[1033] layout shift after the list and badge arrive (${test.info().project.name}): ${cls.toFixed(4)}`);
    expect(cls, 'layout shift < 0.1').toBeLessThan(0.1);
    await shot(page, `organisers-prod${size()}`, false);
  });

  test('prod, Invited chip: an empty group says what to do', async ({ page }) => {
    only390('');
    await open(page, { list: PROD_LIST }, 'list');
    await page.getByTestId('fd-filter-invited').click();
    await expect(page.getByTestId('fd-empty')).toContainText('Pick another group, or add an organiser.');
    await expect(page.getByTestId('fd-empty').getByRole('button', { name: 'Add an organiser' })).toBeVisible();
    await screenChecks(page, 'list invited empty');
    await shot(page, 'organisers-filter-empty');
  });

  for (const [shape, list, count] of [['empty', [], 0], ['one-row', ONE_ROW, 1], ['150-rows', MANY_ROWS, 150], ['long-names', LONG_NAMES, 4]] as const) {
    test(`shape: ${shape}`, async ({ page }) => {
      only390('');
      await open(page, { list: [...list] }, 'list');
      await expect(page.getByTestId('fd-filter-all')).toHaveText(`All ${count}`);
      await expect(page.getByTestId('fd-row')).toHaveCount(count);
      if (count === 0) {
        await expect(page.getByTestId('fd-empty')).toContainText('No organisers yet.');
        await page.getByTestId('fd-empty').getByRole('button', { name: 'Add an organiser' }).click();
        await expect(page.getByTestId('add-organiser')).toBeVisible();
        await page.getByTestId('fd-tab-list').click();
      }
      if (shape === 'long-names') await expect(page.getByTestId('fd-row').filter({ hasText: 'Unnamed organiser' })).toHaveCount(2);
      await screenChecks(page, `list ${shape}`);
      await shot(page, `organisers-${shape}`, count < 100);
    });
  }

  for (const chip of ['run_by_us', 'invited', 'joined', 'live'] as const) {
    test(`every invite status on the ${chip} chip`, async ({ page }) => {
      only390('');
      await open(page, { list: STATUS_MATRIX }, 'list');
      await page.getByTestId(`fd-filter-${chip}`).click();
      await expect(page.getByTestId('fd-row')).toHaveCount(6);
      await screenChecks(page, `matrix ${chip}`);
      await shot(page, `organisers-status-${chip}`);
    });
  }

  test('send and Run by us answers show under the row', async ({ page }) => {
    only390('');
    const calls = await open(page, { list: STATUS_MATRIX, send: { success: true, retried: true }, runByUs: { success: false, code: 'PERMISSION_DENIED' } }, 'list');
    await page.getByTestId('fd-filter-invited').click();
    const failed = page.getByTestId('fd-row').filter({ hasText: 'invited / failed' });
    await failed.getByTestId('fd-send').click();
    await expect(failed.getByTestId('fd-note')).toContainText('queued again');
    const queued = page.getByTestId('fd-row').filter({ hasText: 'invited / queued' }).first();
    await queued.getByTestId('fd-run-by-us').click();
    await expect(queued.getByTestId('fd-note')).toHaveText('Only admins can change this. Sign in with an admin account.');
    expect(calls.filter((c) => c.name === 'admin_send_organiser_invite_v1')).toHaveLength(1);
    await screenChecks(page, 'list answers');
    await shot(page, 'organisers-answers');
  });

  for (const state of ['loading', 'error', 'network'] as const) {
    test(`state: ${state}`, async ({ page }) => {
      only390('');
      await open(page, { list: state === 'loading' ? 'hang' : state }, 'list');
      if (state === 'loading') await expect(page.getByTestId('fd-loading')).toBeVisible();
      else {
        await expect(page.getByTestId('fd-load-error')).toBeVisible(SLOW);
        await expect(page.getByTestId('fd-load-error')).toContainText('The list did not load.');
      }
      await screenChecks(page, `list ${state}`);
      await shot(page, `organisers-${state}`);
    });
  }
});

// ---- Needs you ----------------------------------------------------------------------------------

test.describe('Needs you', () => {
  test('prod: badge 23, one group Quiet for 30 days (23)', async ({ page }) => {
    only390('main');
    await open(page, { needs: PROD_NEEDS }, 'needs');
    await expect(page.getByTestId('needs-badge')).toHaveText('23');
    await expect(page.getByTestId('needs-group-quiet_30_days').getByRole('heading')).toHaveText('Quiet for 30 days (23)');
    await expect(page.getByTestId('needs-item')).toHaveCount(23);
    for (const name of ['Tropicana', 'Sparkle Up', 'Salsateca', 'Crouch End Bachata']) {
      await expect(page.getByTestId('needs-item').filter({ hasText: name }).getByTestId('needs-open')).toHaveText('Open the page');
    }
    await screenChecks(page, 'needs prod');
    await shot(page, `needs-prod${size()}`, false);
  });

  test('every group the model has, in order, with the server detail', async ({ page }) => {
    only390('');
    await open(page, { needs: EVERY_GROUP, resolve: { success: false, code: 'CLAIMANT_IS_ADMIN' } }, 'needs');
    const order = await page.locator('[data-testid^="needs-group-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(order).toEqual(['needs-group-email_mismatch_claim', 'needs-group-join_request', 'needs-group-access_request', 'needs-group-quiet_30_days']);
    await expect(page.getByTestId('needs-approve')).toHaveCount(2);
    const orphan = page.getByTestId('needs-item').filter({ hasText: 'Unnamed organiser' });
    await expect(orphan.getByTestId('needs-open')).toHaveCount(0);
    await expect(orphan.getByTestId('needs-no-page')).toHaveText(needsModel.NO_PAGE_TEXT); // #1033 critique C6
    await screenChecks(page, 'needs every group');
    await shot(page, 'needs-every-group');
    await page.getByTestId('needs-approve').first().click();
    await expect(page.getByTestId('needs-note').first()).toContainText('This person is an admin');
    await screenChecks(page, 'needs resolve refused');
    await shot(page, 'needs-resolve-refused', false);
  });

  test('empty: says what the person can do', async ({ page }) => {
    only390('');
    await open(page, { needs: [] }, 'needs');
    await expect(page.getByTestId('needs-empty')).toContainText('Nothing needs you right now');
    await expect(page.getByTestId('needs-badge')).toHaveCount(0);
    await screenChecks(page, 'needs empty');
    await shot(page, 'needs-empty');
    await page.getByTestId('needs-empty').getByRole('button', { name: 'Add an organiser' }).click();
    await expect(page.getByTestId('add-organiser')).toBeVisible();
  });

  for (const state of ['loading', 'error', 'network'] as const) {
    test(`state: ${state}`, async ({ page }) => {
      only390('');
      await open(page, { needs: state === 'loading' ? 'hang' : state }, 'needs');
      if (state === 'loading') await expect(page.getByTestId('needs-loading')).toBeVisible();
      else await expect(page.getByTestId('needs-load-error')).toBeVisible(SLOW);
      await expect(page.getByTestId('needs-badge')).toHaveCount(0); // never a wrong number
      await screenChecks(page, `needs ${state}`);
      await shot(page, `needs-${state}`);
    });
  }
});

// ---- Add ----------------------------------------------------------------------------------------

async function fill(page: Page, f: { runByUs?: boolean; email?: string; name?: string } = {}) {
  await page.getByTestId('add-organiser-name').fill(f.name ?? 'Agapi Musicality Dance Project');
  await page.getByTestId('add-contact-name').fill('Agapi Rossi');
  await page.locator('#add-city').click();
  await page.getByPlaceholder('Search city...').fill('Lon');
  await page.getByRole('option', { name: /London/ }).first().click();
  await expect(page.locator('#add-city')).toContainText('London');
  if (f.runByUs) await page.getByTestId('add-run-by-us').check();
  if (f.email) await page.getByTestId('add-contact-email').fill(f.email);
}

test.describe('Add', () => {
  test('untouched: submit is off with a reason and sends nothing', async ({ page }) => {
    only390('main');
    const calls = await open(page, {});
    await expect(page.getByTestId('add-submit')).toBeDisabled();
    await expect(page.getByTestId('add-blocked')).toHaveText('Fill in the organiser name, a contact person and a city to add one.');
    await expect(page.getByTestId('add-rbu-why')).toHaveText(RUN_BY_US_OFF_WHY);
    await page.getByTestId('add-organiser-name').press('Enter');
    await page.getByTestId('add-submit').click({ force: true });
    await page.waitForTimeout(500);
    expect(calls.filter((c) => c.name === 'admin_add_organiser_v1')).toEqual([]);
    await screenChecks(page, 'add untouched');
    await shot(page, `add-untouched${size()}`);
  });

  test('the hint under Run by us follows the switch; on sends no email', async ({ page }) => {
    only390('');
    const calls = await open(page, { add: ADD_OK.run_by_us });
    await fill(page, { email: 'hello@agapi.example' });
    await expect(page.getByTestId('add-rbu-why')).toHaveText(RUN_BY_US_OFF_WHY);
    await page.getByTestId('add-run-by-us').check();
    await expect(page.getByTestId('add-rbu-why')).toHaveText(RUN_BY_US_WHY);
    await expect(page.getByTestId('add-contact-email')).toBeDisabled();
    await expect(page.getByTestId('add-contact-email')).toHaveValue('');
    await screenChecks(page, 'add run by us on');
    await shot(page, 'add-run-by-us-on');
    await page.getByTestId('add-run-by-us').uncheck();
    await expect(page.getByTestId('add-rbu-why')).toHaveText(RUN_BY_US_OFF_WHY);
    await page.getByTestId('add-run-by-us').check();
    await page.getByTestId('add-submit').click();
    await expect(page.getByTestId('add-outcome')).toBeVisible();
    const sent = calls.filter((c) => c.name === 'admin_add_organiser_v1');
    expect(sent).toHaveLength(1);
    expect(sent[0].args.p_payload).not.toHaveProperty('contact_email');
  });

  const OUTCOMES: [keyof typeof ADD_OK, string, { runByUs?: boolean; email?: string }][] = [
    ['invite_queued', 'An invite is ready; nothing is sent until you tap Send invite.', { email: 'hello@agapi.example' }],
    ['run_by_us', 'Page is live and run by us. No invite was prepared.', { runByUs: true }],
    ['no_email', 'Page is live.', {}],
    ['already_exists', 'Nothing was changed. You can open the existing page below.', { email: 'hello@agapi.example' }],
    ['person_reused', 'An existing person with this email was used as the contact', { email: 'ana.ruiz@gmail.example' }],
    ['email_has_login', 'This email already has a login', { email: 'ana.ruiz@gmail.example' }],
  ];
  for (const [kind, words, f] of OUTCOMES) {
    test(`outcome: ${kind}`, async ({ page }) => {
      only390('');
      await open(page, { add: ADD_OK[kind], list: PROD_LIST });
      await fill(page, f);
      await page.getByTestId('add-submit').click();
      await expect(page.getByTestId('add-outcome')).toContainText(words);
      await expect(page.getByTestId('add-open-organiser')).toBeVisible();
      // Done means done: the form empties so a second tap cannot add it again (#1033 critique C4).
      await expect(page.getByTestId('add-organiser-name')).toHaveValue('');
      await expect(page.getByTestId('add-submit')).toBeDisabled();
      await screenChecks(page, `add ${kind}`);
      await shot(page, `add-outcome-${kind.replace(/_/g, '-')}`);
    });
  }

  const ERRORS: [string, string | null, string][] = [
    ...Object.entries(ADD_ERROR_TEXT).map(([code, e]) => [code, e.field, e.text] as [string, string | null, string]),
    ['SOMETHING_NEW', null, ADD_ERROR_FALLBACK],
    ['NETWORK', null, ADD_ERROR_FALLBACK],
  ];
  for (const [code, field, text] of ERRORS) {
    test(`server error: ${code}`, async ({ page }) => {
      only390('');
      await open(page, { add: code === 'NETWORK' ? 'network' : addError(code, field) });
      await fill(page, { email: code === 'EMAIL_INVALID' ? 'agapi@' : undefined });
      await page.getByTestId('add-submit').click();
      await expect(page.getByTestId(`add-error-${field ?? 'form'}`)).toHaveText(text);
      await expect(page.getByTestId('add-outcome')).toHaveCount(0);
      await screenChecks(page, `add ${code}`);
      await shot(page, `add-error-${code.toLowerCase().replace(/_/g, '-')}`);
    });
  }
});

test('entry point on /admin/organisers carries the Needs you count', async ({ page }) => {
  only390('');
  await asAdmin(page, { needs: PROD_NEEDS });
  await page.goto('/admin/organisers');
  await expect(page.getByTestId('entry-badge')).toHaveText('23');
  await expect(page.getByTestId('front-door-entry')).toContainText('Add and manage organisers'); // same name as the page it opens
  expect(await checkOverflow(page), 'entry: no sideways scroll').toEqual([]);
  const h = await page.getByTestId('front-door-entry').evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(44);
  await shot(page, 'entry-badge', false);
});
