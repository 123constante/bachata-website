import { expect, test } from '@playwright/test';
import { classifyConsole } from './lib/pageGuard';
import {
  checkControlRefs, checkDisabledReasons, checkOverflow, checkTapTargets, checkAxe, extractControlRefs,
} from './lib/pageChecks';
import { isBaselined, routeTemplate } from './lib/visit';

// CANARIES: a check that cannot fail proves nothing. Each detector the live
// specs rely on is run here against a known-BAD page it exists to catch (it
// must fire) and a known-GOOD twin (it must stay quiet). Offline: setContent
// only, no network, so these run anywhere and in the daily job before the
// live results are trusted.

const shell = (body: string) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>t</title></head><body style="margin:0">${body}</body></html>`;

test.describe('detector canaries (offline)', () => {
  test('overflow: fires on a 600px-wide block at 390px, quiet when it fits', async ({ page }) => {
    await page.setContent(shell('<main><div style="width:600px;height:10px">wide</div></main>'));
    expect(await checkOverflow(page)).toHaveLength(1);
    await page.setContent(shell('<main><div style="width:100%;height:10px">fits</div></main>'));
    expect(await checkOverflow(page)).toHaveLength(0);
  });

  test('tap targets: fires on a 24px button, quiet at 44px and on an inline link in a sentence', async ({ page }) => {
    await page.setContent(shell('<main><button style="width:24px;height:24px;padding:0">x</button></main>'));
    const bad = await checkTapTargets(page);
    expect(bad).toHaveLength(1);
    expect(bad[0].detail).toContain('24x24');
    await page.setContent(shell('<main><button style="width:44px;height:44px">ok</button><p>Read the <a href="/faq">FAQ</a> before you go to the party tonight.</p></main>'));
    expect(await checkTapTargets(page)).toHaveLength(0);
  });

  test('axe: fires (serious/critical) on an image with no alt and an unlabelled button, quiet when fixed', async ({ page }) => {
    await page.setContent(shell('<main><h1>t</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10"><button></button></main>'));
    const ids = (await checkAxe(page)).map((f) => f.sig).sort();
    expect(ids).toEqual(expect.arrayContaining(['button-name', 'image-alt']));
    await page.setContent(shell('<main><h1>t</h1><img alt="logo" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10"><button>Save</button></main>'));
    expect(await checkAxe(page)).toHaveLength(0);
  });

  test('copy pointing at a missing control: fires when the named control is absent, quiet when it is on screen', async ({ page }) => {
    expect(extractControlRefs('Tap the Send for review button when done.')).toEqual(['Send for review']);
    expect(extractControlRefs('Press "Share" to tell a friend.')).toEqual(['Share']);
    expect(extractControlRefs('Use Instagram to follow us.')).toEqual([]);
    await page.setContent(shell('<main><p>Tap the Publish button to go live.</p><button>Save</button></main>'));
    const bad = await checkControlRefs(page);
    expect(bad.map((f) => f.sig)).toEqual(['ref:publish']);
    await page.setContent(shell('<main><p>Tap the Publish button to go live.</p><button>Publish</button></main>'));
    expect(await checkControlRefs(page)).toHaveLength(0);
  });

  test('disabled without a reason: fires on a bare disabled button, quiet with a title or a visible reason', async ({ page }) => {
    await page.setContent(shell('<main><div><button disabled>Send</button></div></main>'));
    expect(await checkDisabledReasons(page)).toHaveLength(1);
    await page.setContent(shell('<main><div><button disabled title="Add a cover image first">Send</button></div><div><button disabled>Go</button><span>Pick a date first.</span></div></main>'));
    expect(await checkDisabledReasons(page)).toHaveLength(0);
  });

  test('console classifier: hydration errors are caught in prod AND dev form; network noise and dev warnings are not errors', () => {
    expect(classifyConsole('Uncaught Error: Minified React error #418; visit https://react.dev/errors/418')).toBe('hydration');
    expect(classifyConsole('Minified React error #421')).toBe('hydration');
    expect(classifyConsole('Minified React error #423')).toBe('hydration');
    expect(classifyConsole('Warning: Text content did not match. Server: "a" Client: "b"')).toBe('hydration');
    expect(classifyConsole('Error: Hydration failed because the initial UI does not match')).toBe('hydration');
    expect(classifyConsole('TypeError: Cannot read properties of null')).toBe('error');
    expect(classifyConsole('Failed to load resource: the server responded with a status of 404 ()')).toBe('ignore');
    expect(classifyConsole('Warning: React does not recognize the `fetchPriority` prop')).toBe('ignore');
  });

  test('baseline: a recorded finding is excused on its route template only, and a new one is not', () => {
    const b = { '/event/:slug': { 'tap-target': ['button.a.b'] } };
    expect(routeTemplate('/event/mojito-club?occurrenceId=x')).toBe('/event/:slug');
    expect(routeTemplate('/organisers/ritmo-latino')).toBe('/organisers/:slug');
    expect(isBaselined('/event/:slug', { rule: 'tap-target', sig: 'button.a.b', detail: '' }, b)).toBe(true);
    expect(isBaselined('/event/:slug', { rule: 'tap-target', sig: 'button.a.c', detail: '' }, b)).toBe(false);
    expect(isBaselined('/organisers/:slug', { rule: 'tap-target', sig: 'button.a.b', detail: '' }, b)).toBe(false);
  });
});
