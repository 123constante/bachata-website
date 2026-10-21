# Handover: organiser onboarding prototype

Ticket dt_85e24479bc95. Brief: `bachata-admin` branch `brief/job-cards-morning-2026-10-20`, `docs/briefs/proto-organiser-onboarding.md`.
Branch `claude/proto-organiser-onboarding` (from `main` at fb91b8a). Design only: no `src/` change, no build plan, no Supabase.

## Status: DONE (awaiting owner review)

Checkpoints: brief read -> ER CSS copied byte-equal -> prototype built -> sweep + fuzz clean -> 5 mutants all caught -> docs-only CI steps run -> pushed once.

## What is in it

`docs/prototypes/organiser-onboarding-prototype.html` (47 KB, one file, no scripts from outside, ASCII only). Open it in a browser. Phone / Computer toggle at the top; jump list (phone) or side index (>= 1100 px) reaches every screen and state (22).

1. **Invite landing, signed out.** "Marta Diaz invited you to run Latin Collective London", says you become an **owner** of that organiser page, a 4-step "what happens next" list. **Create account** is the primary; "I already have an account: Sign in" is secondary.
2. **Create account / email code.** Name (prefilled from the invite) + email -> "Send me a code" -> 6 boxes with an on-screen keypad (the real one would use the phone's number pad and one-time-code autofill). Sign in is the same screen with the name field gone.
3. **Confirm join.** "You are joining as Alex Rivera at Latin Collective London", signed-in email shown, "Not you? Sign out".
4. **Wizard in two labelled sections**, preceded by a route overview.
   - Route overview lists both sections and every step, each marked "Needed to go live" or "Optional", under a tag **"Owner decision: proposed minimum"**.
   - **1 Your organisation** (3 steps): name (prefilled, tagged "From your invite") + city chips with "Other city" -> logo upload (tap to pick, progress, preview) -> category chips. Website, socials, bio are deferred with one line saying so.
   - **2 Your dancing profile** (4 steps): role chips (Organiser shown as already set), languages chips (6 common + "Other" opens 10 more as chips, no typing), style chips, nationality: 8 top-country chips + a search that returns chips (the only typing besides name/email/other city).
   - Every wizard screen: section number + name + "Step k of n", a "who sees this and why" line, a two-section progress route, **Skip for now** and **Finish later**.
   - On the computer: two panes, the flow on the left and a live "What dancers will see" preview on the right.
5. **First-win home**: the ER "home-empty" screen, "No events yet" -> **Add your first event**. After "Finish later" it also shows a "Finish your profile: N optional steps left" card with "Carry on".

## Owner decisions (flagged, not decided)

- **Proposed minimum to go live: organisation name + city.** Everything else is skippable. The name/city step is the only one that cannot be skipped; its Skip button is disabled with the reason written under it.
- Question order is organisation first, person second (as the brief says).
- Code sign-in, no password (matches "Email and a 6-digit code"); confirm this is the auth the real build will use.
- Lists (cities, categories, roles, languages, styles, top countries) are proposals; the real ones should come from the server vocabularies.

## Checks run (all local, this session)

| # | Step | Command | Exit |
|---|------|---------|------|
| 1 | CSS + tokens byte-equal to ER prototype | `git show origin/arc/briefs-organiser-r1:docs/organiser-rebuild/er/organiser-prototype.html` lines 5-206 vs prototype lines 6-207, `cmp` | 0 |
| 2 | Size < 400 KB | `wc -c` = 47214 | n/a |
| 3 | Sweep every screen at 390x844 and 1280x800 (22 x 2): 0 console errors, no horizontal scroll, tap targets >= 44 px, exactly one primary, every disabled primary followed by a reason | `node sweep.mjs docs/prototypes/organiser-onboarding-prototype.html` (script below) | 0 |
| 4 | Fuzz: 44 runs x 40 random taps/typing per size, seeded from every screen, same audit after every action; reached invite, auth, confirm, overview, all 7 wizard steps, home | same command | 0 |
| 5 | Mutant: reason line removed under disabled primary | `NO_FUZZ=1 node sweep.mjs mutant-reason.html` | 1 (caught, rolled back) |
| 6 | Mutant: chips 36 px tall | `NO_FUZZ=1 node sweep.mjs mutant-tap.html` | 1 (caught, rolled back) |
| 7 | Mutant: second primary on overview | `NO_FUZZ=1 node sweep.mjs mutant-primary.html` | 1 (caught, rolled back) |
| 8 | Mutant: console.error on home | `NO_FUZZ=1 node sweep.mjs mutant-console.html` | 1 (caught, rolled back) |
| 9 | Mutant: 600 px box on home | `NO_FUZZ=1 node sweep.mjs mutant-hscroll.html` | 1 (caught, rolled back) |
| 10 | CI: docs-only detection (architecture-guard, typecheck, unit-tests, e2e-smoke, perf-budget, workflow-lint) | `node scripts/ci/docs-only.mjs --merge HEAD` | 0, `docs_only=true` |
| 11 | CI: docs-only canary (workflow-lint) | `node scripts/ci/docs-only.mjs --self-test` | 0 |
| 12 | CI: mojibake canary (architecture-guard) | `npm run check:mojibake:self-test` | 0 |
| 13 | CI: mojibake guard (architecture-guard) | the workflow's `git grep -nE ...` | 1 = no hits = pass |
| 14 | CI: real-data-verified on the PR body, and its canary | `PR_BODY=... node scripts/check-pr-real-data-verified.mjs` (`--self-test`) | 0 (0) |
| 15 | CI: phone-qa-section on the PR body, and its canary | `PR_BODY=... PR_FILES=... node scripts/check-pr-phone-qa.mjs` (`--self-test`) | 0, "no UI path changed" (0) |

Skipped in CI by the docs-only gate on this PR: integrity, legacy tables/RPCs, architecture lint, images, typecheck, unit tests, e2e smoke, bundle budgets. `check:doc-weight` is skipped for `claude/` branches. Nothing here needs `npm ci` steps that the gate would run.

## Verified / Not verified

**Verified:** every screen and state at 390x844 and 1280x800 in headless Chromium; the five audit rules hold on every screen and after every fuzz action; each rule has a mutant that makes the check fail; CSS byte-equal to ER; docs-only CI steps green locally.

**Not verified:** real phone; real keyboard (on-screen keyboard over the footer, number pad, one-time-code autofill); real upload (the logo upload is simulated); screen readers; production data (example data only, Supabase not touched per the brief); the Vercel preview render; PR checks on GitHub (no `gh` in this worker).

## Next steps (owner)

1. Open the prototype, tap through on a phone.
2. Decide the minimum to go live (proposal: name + city) and the auth method (proposal: email code, no password).
3. Then a build brief: map each chip list to its server vocabulary and each step to the real profile/organisation fields.

## The check script (`sweep.mjs`)

Run from a folder whose `node_modules` points at this repo's (Playwright is a dev dependency):
`node sweep.mjs <file.html>`; `NO_FUZZ=1` skips the fuzz. Exit 0 = clean, 1 = findings.

```js
// Sweep + fuzz for docs/prototypes/organiser-onboarding-prototype.html.
// Usage: node sweep.mjs <html-file>. Exit 0 = clean, 1 = findings.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

const file = process.argv[2];
const url = pathToFileURL(file).href;
const SIZES = { ph: { width: 390, height: 844 }, dk: { width: 1280, height: 800 } };
const fails = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());

function audit(dev) {
  const out = [];
  const root = document.getElementById('dev');
  const se = document.scrollingElement;
  if (se.scrollWidth > se.clientWidth + 1) out.push('page horizontal scroll ' + se.scrollWidth + '>' + se.clientWidth);
  root.querySelectorAll('.scroll,.r,.grp,.foot').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1) out.push('horizontal overflow in .' + el.className.split(' ')[0]);
  });
  const vis = (el) => el.offsetParent !== null && !el.classList.contains('sr');
  root.querySelectorAll('button,input,select,textarea').forEach((el) => {
    if (!vis(el)) return;
    if (el.offsetHeight < 44 || el.offsetWidth < 44) out.push('tap target ' + el.offsetWidth + 'x' + el.offsetHeight + ' "' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"');
  });
  const prim = [...root.querySelectorAll('.primary')].filter(vis);
  if (prim.length !== 1) out.push('primary count ' + prim.length);
  prim.filter((p) => p.disabled).forEach((p) => {
    const n = p.nextElementSibling;
    if (!n || !n.classList.contains('reason') || !n.textContent.trim()) out.push('disabled primary without reason: "' + p.textContent.trim() + '"');
  });
  return out;
}

const ids = [];
const seen = new Set();
for (const dev of ['ph', 'dk']) {
  const page = await browser.newPage({ viewport: SIZES[dev] });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(url);
  if (dev === 'dk') await page.click('[data-dev="dk"]');
  const jumpIds = await page.$$eval('#jump option', (o) => o.map((x) => x.value));
  if (!ids.length) ids.push(...jumpIds);
  for (const id of jumpIds) {
    await page.evaluate((j) => jumpTo(j), id);
    for (const f of await page.evaluate(audit, dev)) fails.push(dev + ' ' + id + ': ' + f);
  }
  // Fuzz: random taps and typing from the start, auditing after each action.
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let run = 0; run < (process.env.NO_FUZZ ? 0 : jumpIds.length * 2); run++) {
    await page.evaluate((j) => jumpTo(j), jumpIds[run % jumpIds.length]);
    for (let i = 0; i < 40; i++) {
      const up = await page.evaluate(([r, txt]) => {
        const els = [...document.querySelectorAll('#dev button:not([disabled]), #dev input:not(.sr)')];
        if (!els.length) return false;
        const el = els[r % els.length];
        if (el.tagName === 'INPUT') { el.value = txt; el.dispatchEvent(new Event('input', { bubbles: true })); return false; }
        el.click();
        return el.dataset.a === 'upload';
      }, [rnd(1000), ['', 'alex@example.com', 'x', 'ven', 'Leeds', '<b>&'][rnd(6)]]);
      if (up) await page.waitForTimeout(1000);
      seen.add(await page.evaluate(() => S.scr + (S.scr === 'wizard' ? ':' + S.step : '')));
      for (const f of await page.evaluate(audit, dev)) fails.push(dev + ' fuzz run ' + run + ' step ' + i + ': ' + f);
    }
  }
  for (const e of errs) fails.push(dev + ' console: ' + e);
  await page.close();
}
await browser.close();
const uniq = [...new Set(fails)];
console.log('fuzz reached: ' + [...seen].sort().join(' '));
console.log('screens per size: ' + ids.length + ', findings: ' + uniq.length);
uniq.slice(0, 40).forEach((f) => console.log('  ' + f));
process.exit(uniq.length ? 1 : 0);
```
