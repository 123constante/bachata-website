// C3 measured sweep: every state x 390x844, 360x640, 1280x800 x light/dark, + keyboard states at 390x514.
// Checks: text contrast (4.5, or 3 at >= 24px / >= 18.66px bold), taps >= 44x44, no sideways scroll
// (date strip and day tabs excepted), nothing under a bar at scroll end, 0 console/page errors,
// theme button on screen, K1 (no .ses row with title and detail on one line), toast inside the viewport.
import { chromium } from 'playwright';
import path from 'node:path';

const file = path.resolve(process.argv[2]);
const B = (a) => ({ b: a }), T = (s) => ({ t: s }), V = (s, v) => ({ v: [s, v] }), O = (s) => ({ o: s });
const EVT = (k) => [B({ 'data-tab-go': 'events' }), B({ 'data-open': k })];
const FRI = EVT('fri');
const STATES = {
  welcome: [], welcomeMore: [B({ 'data-more': '' })], invitee: [B({ 'data-go': 'invitee' })],
  home: [B({ 'data-tab-go': 'home' })], homeLeeds: [B({ 'data-org': 'leeds' })], events: [B({ 'data-tab-go': 'events' })],
  stats: [B({ 'data-tab-go': 'stats' })], statsTable: [B({ 'data-tab-go': 'stats' }), B({ 'data-stattable': '' })], you: [B({ 'data-tab-go': 'you' })],
  profile: [B({ 'data-go': 'profile' })], team: [B({ 'data-go': 'team' })], errors: [B({ 'data-go': 'errors' })],
  homeCancelled: [B({ 'data-tab-go': 'home' }), T('[data-cancelnext]'), T('[data-reason]'), T('[data-docancel]')],
  homePaused: [...FRI, B({ 'data-sheet': 'pause' }), T('[data-dopause]'), B({ 'data-tab-go': 'home' })],
  evFri: FRI, evFriMore: [...FRI, O('#s-event details.fold')], evMambo: EVT('mambo'), evLong: EVT('long'), evCamp: EVT('camp'), evPicnic: EVT('picnic'),
  evBos: EVT('bos'), evHalloween: EVT('halloween'), evWedc: EVT('wedc'), evWedsep: EVT('wedsep'), evNye: EVT('nye'), evVibes: EVT('vibes'), evLeeds: [B({ 'data-org': 'leeds' }), B({ 'data-open': 'leeds1' })],
  allFri: [...FRI, B({ 'data-go': 'alldates' })], allLong: [...EVT('long'), B({ 'data-go': 'alldates' })],
  allPick: [...FRI, B({ 'data-go': 'alldates' }), T('[data-pickmode]'), T('[data-pk="4"]'), T('[data-pk="5"]')],
  bulkMore: [...FRI, B({ 'data-go': 'alldates' }), T('[data-pickmode]'), T('[data-pk="4"]'), T('[data-bulk="more"]')],
  bulkCancel: [...FRI, B({ 'data-go': 'alldates' }), T('[data-pickmode]'), T('[data-pk="4"]'), T('[data-bulk="cancel"]')],
  lineupNext: [B({ 'data-tab-go': 'home' }), T('[data-lineup-next]')], lineupScope: [...FRI, B({ 'data-lineup-ask': 'fri' })],
  lineupLater: [...FRI, B({ 'data-lineup-ask': 'fri' }), T('[data-scope="later"]'), T('[data-lineup-go]')],
  lineupEmpty: [...EVT('wedc'), B({ 'data-lineup-ask': 'wedc' })],
  moveOne: [...FRI, B({ 'data-date': '4' }), B({ 'data-act': 'move' }), T('[data-scope="one"]'), T('[data-scope-go]')],
  moveLater: [...FRI, B({ 'data-date': '4' }), B({ 'data-act': 'move' }), T('[data-scope="later"]'), T('[data-scope-go]'), T('[data-mwd="4"]')],
  where: [...FRI, T('#s-event [data-edit="where"]')], pay: [...FRI, T('#s-event [data-edit="pay"]')], ticket: [...FRI, T('#s-event [data-edit="ticket"]')],
  photo: [...FRI, B({ 'data-photo': 'fri' })], photoVideo: [...FRI, B({ 'data-photo': 'fri', 'data-video': '1' })], photoPicked: [...FRI, B({ 'data-photo': 'fri' }), B({ 'data-pickphoto': '' })],
  preview: [...FRI, B({ 'data-preview': 'fri', 'data-pi': '0' })], preview30: [...FRI, B({ 'data-preview': 'fri', 'data-pi': '1' })], previewPicnic: [...EVT('picnic'), B({ 'data-preview': 'picnic', 'data-pi': '0' })],
  stepName: [B({ 'data-flow': 'weekly' })], stepDay: [B({ 'data-flow': 'weekly' }), V('#fname', 'Bachata Thursdays'), T('#fnext')],
  stepSess: [B({ 'data-tourgo': 'create' })], stepWhere: [B({ 'data-tourgo': 'create' }), T('#fnext')],
  stepCheck: [B({ 'data-tourgo': 'create' }), T('#fnext'), T('[data-place]'), T('#fnext'), T('#fnext')],
  stepCourse: [B({ 'data-flow': 'course' }), V('#fname', 'Sensual Basics'), T('#fnext')],
  stepLevel: [B({ 'data-flow': 'course' }), V('#fname', 'Sensual Basics'), T('#fnext'), T('#fnext'), T('#fnext'), T('[data-place]'), T('#fnext'), T('#fnext')],
  stepCustom: [B({ 'data-flow': 'custom' }), V('#fname', 'Pop-ups'), T('#fnext'), T('[data-fmadd]')],
  stepOneoff: [B({ 'data-flow': 'oneoff' }), V('#fname', 'Xmas party'), T('#fnext')], stepMonthly: [B({ 'data-flow': 'monthly' }), V('#fname', 'First Fridays'), T('#fnext')],
  stepFest: [B({ 'data-flow': 'festival' }), V('#fname', 'Winter Weekender'), T('#fnext')],
  repeat: [...FRI, B({ 'data-go': 'repeat' })], repeatMonth: [...EVT('mambo'), B({ 'data-go': 'repeat' })], repeatCourse: [...EVT('long'), B({ 'data-go': 'repeat' }), T('[data-rpc="-1"]')],
  details: [...FRI, B({ 'data-go': 'details' })], detailsPending: [...FRI, B({ 'data-go': 'details' }), V('#dtname', 'Sensual Fridays at Colab')],
  prices: [...FRI, B({ 'data-go': 'prices' })], history: [...FRI, B({ 'data-go': 'history' })], copy: [...FRI, B({ 'data-go': 'copy' })],
  fest: [B({ 'data-open': 'fest' })], festDay2: [B({ 'data-open': 'fest' }), T('[data-fday="1"]')], fpreview: [B({ 'data-open': 'fest' }), B({ 'data-go': 'fpreview' })],
  /* sheets */
  shDate: [...FRI, B({ 'data-date': '4' })], shDateFold: [...FRI, B({ 'data-date': '4' }), O('#sheet details.fold')], shDate30: [...FRI, B({ 'data-date': '1' })],
  shDateMambo: [...EVT('mambo'), B({ 'data-date': '2' })], shDateCx: [...FRI, B({ 'data-date': '9' })],
  shDtime: [...FRI, B({ 'data-date': '4' }), B({ 'data-sheet': 'dtime' })], shSkip: [...FRI, B({ 'data-date': '4' }), B({ 'data-sheet': 'skip' })],
  shReset: [...EVT('mambo'), B({ 'data-date': '2' }), B({ 'data-sheet': 'resetdate' })], shCopyFrom: [...FRI, B({ 'data-date': '4' }), B({ 'data-sheet': 'copyfrom' })],
  shDayown: [...FRI, B({ 'data-date': '4' }), B({ 'data-sheet': 'dayown' })],
  shSess: [...FRI, { sess: 'fri:0' }], shSessMambo: [...EVT('mambo'), { sess: 'mambo:0' }], shSessDate: [...FRI, B({ 'data-date': '4' }), { dsess: 'fri:0' }],
  shSessScope: [...FRI, B({ 'data-date': '1' }), { dsess: 'fri:0' }, V('#sss', '20:30'), T('[data-sssave]'), T('[data-sscope="later"]')],
  shSessNew: [...FRI, B({ 'data-addsess': 'next' })], shRemoveAll: [...FRI, { sess: 'fri:0' }, T('[data-sheet="removeall"]')],
  shStatus: [...FRI, B({ 'data-sheet': 'status' })], shEndit: [...EVT('halloween'), B({ 'data-sheet': 'endit' })], shStoprep: [...FRI, B({ 'data-sheet': 'stoprep' })],
  shChat: [...FRI, B({ 'data-sheet': 'chat' })], shSocials: [...FRI, B({ 'data-sheet': 'socials' })], shConvert: [...FRI, B({ 'data-sheet': 'convert' }), T('[data-conv="oneoff"]')],
  shLeave: [...FRI, B({ 'data-go': 'details' }), V('#dtname', 'X'), T('#s-details [data-back]')], shTheme: [B({ 'data-tab-go': 'home' }), B({ 'data-sheet': 'theme' })],
  shGoing: [...FRI, B({ 'data-going': 'fri', 'data-gi': '0' })], shTour: [B({ 'data-tab-go': 'home' }), B({ 'data-sheet': 'tour' })], shHelp: [B({ 'data-sheet': 'help' })],
  shAddnew: [B({ 'data-sheet': 'addnew' })], shAdddate: [...FRI, B({ 'data-sheet': 'adddate' })], shAddplace: [...FRI, T('#s-event [data-edit="where"]'), B({ 'data-sheet': 'addplace' })],
  shInvite: [B({ 'data-go': 'team' }), B({ 'data-sheet': 'invite' })], shCancelNext: [B({ 'data-tab-go': 'home' }), T('[data-cancelnext]')],
  shScope: [...FRI, B({ 'data-date': '4' }), B({ 'data-act': 'cancel' })], shCancelConfirm: [...FRI, B({ 'data-date': '4' }), B({ 'data-act': 'cancel' }), T('[data-scope="later"]'), T('[data-scope-go]'), T('[data-reason]')],
  shPause: [...FRI, B({ 'data-sheet': 'pause' })], shNotmine: [T('[data-notmine]')], shGalsel: [...FRI, B({ 'data-photo': 'fri' }), T('[data-galsel]')],
  shVideoerr: [...FRI, B({ 'data-photo': 'fri', 'data-video': '1' }), B({ 'data-sheet': 'videoerr' })], shPhotoerr: [...FRI, B({ 'data-photo': 'fri' }), B({ 'data-sheet': 'photoerr' })],
  shErr: [B({ 'data-go': 'errors' }), T('[data-errk]')], shFsess: [B({ 'data-tourgo': 'create' }), T('[data-fsessadd="before"]')],
  tour3: [B({ 'data-tourgo': 'later' })]
};
const KEYS = { kbLineup: [...STATES.lineupNext, { f: '#psearch' }], kbName: [B({ 'data-flow': 'course' }), { f: '#fname' }], kbPlace: [...STATES.where, { f: '#wsearch' }],
  kbTicket: [...STATES.ticket, { f: '#tlink' }], kbDetails: [...STATES.details, { f: '#dtdesc' }], kbFind: [...STATES.allFri, { f: '#adq' }] };

async function run(page, steps) {
  for (const s of steps) {
    await page.evaluate((s) => {
      const W = window.__c2;
      const click = (el) => { el.click(); };
      if (s.b) { const el = document.createElement('button'); Object.entries(s.b).forEach(([k, v]) => el.setAttribute(k, v)); document.body.appendChild(el); click(el); el.remove(); }
      if (s.t) { const el = document.querySelector(s.t); if (!el) throw new Error('missing ' + s.t); click(el); }
      if (s.v) { const el = document.querySelector(s.v[0]); el.value = s.v[1]; el.dispatchEvent(new Event('input', { bubbles: true })); }
      if (s.o) { document.querySelector(s.o).open = true; }
      if (s.sess || s.dsess) { const [k, i] = (s.sess || s.dsess).split(':'); const el = document.createElement('button'); el.setAttribute(s.sess ? 'data-sess' : 'data-dsess', W.EV[k].sess[+i].id); document.body.appendChild(el); click(el); el.remove(); }
    }, s);
    if (s.f) await page.focus(s.f);
    await page.waitForTimeout(s.f ? 60 : 5);
  }
  await page.waitForTimeout(300); /* sheet transition + screen animation */
}

function measure(kb) {
  const out = { contrast: [], taps: [], overflow: [], under: [], k1: [], theme: true, toast: '' };
  const vis = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && el.closest('details:not([open]) > :not(summary)') === null; };
  const sheetOn = document.querySelector('#sheet.on');
  const roots = sheetOn ? [sheetOn] : [document.querySelector('.scr.on'), document.querySelector('#bb.on'), document.querySelector('#tabs:not(.hide)')].filter(Boolean);
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const blend = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  function bgOf(el) {
    const layers = []; let photo = false;
    for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none' && !n.classList.contains('bar')) photo = true; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
    let c = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) c = blend(layers[i], c); return [c, photo];
  }
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const tn = walker.currentNode; if (!tn.textContent.trim()) continue; const el = tn.parentElement; if (seen.has(el) || !vis(el)) continue; seen.add(el);
      if (el.closest('.out, .act, svg')) continue;
      const cs = getComputedStyle(el); let fg = parse(cs.color); const [bg, photo] = bgOf(el); if (photo) continue;
      if (!fg) continue; if (fg[3] < 1) fg = blend(fg, bg);
      const op = parseFloat(cs.opacity); const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const fs = parseFloat(cs.fontSize), big = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
      if (ratio < (big ? 3 : 4.5) && !el.closest('[aria-disabled="true"]')) out.contrast.push(el.textContent.trim().slice(0, 30) + ' ' + ratio.toFixed(2));
    }
    root.querySelectorAll('button, a, input, textarea, summary, [role=switch]').forEach((el) => {
      if (!vis(el)) return; if (el.closest('.strip, .daytabs') && false) return;
      const r = el.getBoundingClientRect(); if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.taps.push((el.innerText || el.id || el.className).trim().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
  }
  const scr = document.querySelector('.scr.on');
  const docW = document.documentElement.clientWidth;
  [scr, sheetOn, document.documentElement].filter(Boolean).forEach((el) => { if (el.scrollWidth > el.clientWidth + 1) out.overflow.push((el.id || el.tagName) + ' ' + el.scrollWidth + '>' + el.clientWidth); });
  (sheetOn || scr).querySelectorAll('*').forEach((el) => { if (el.closest('.strip, .daytabs, .bar') || !vis(el)) return; const r = el.getBoundingClientRect(); const box = (sheetOn || scr).getBoundingClientRect(); if (r.right > box.right + 1 && getComputedStyle(el).position !== 'absolute') out.overflow.push('clip:' + (el.className || el.tagName) + ' ' + Math.round(r.right) + '>' + Math.round(box.right)); });
  if (!sheetOn && !kb) {
    scr.scrollTop = scr.scrollHeight;
    /* the desktop rail (top 0) is beside the content, not over it: only bars that start low count */
    const bars = [document.querySelector('#bb'), document.querySelector('#tabs')].filter((b) => getComputedStyle(b).display !== 'none');
    let top = Infinity; bars.forEach((b) => { const r = b.getBoundingClientRect(); if (r.height && r.top > 100) top = Math.min(top, r.top); });
    let bottom = 0; scr.querySelectorAll('*').forEach((el) => { if (!vis(el)) return; const r = el.getBoundingClientRect(); bottom = Math.max(bottom, r.bottom); });
    if (bottom > top + 0.5) out.under.push(Math.round(bottom) + '>' + Math.round(top));
  }
  (sheetOn || scr).querySelectorAll('.ses').forEach((s) => { const t = s.querySelector('.t'), d = s.querySelector('.s'); if (!t || !d || !vis(s)) return; if (d.getBoundingClientRect().top < t.getBoundingClientRect().bottom - 1) out.k1.push(t.textContent.slice(0, 20)); });
  const thmRoot = scr.querySelector('.thm') || (sheetOn && sheetOn.querySelector('.thm'));
  out.theme = !!thmRoot;
  if (kb) { out.kb = [getComputedStyle(document.querySelector('#bb')).display, getComputedStyle(document.querySelector('#tabs')).display]; const a = document.activeElement.getBoundingClientRect(); out.kbOn = a.top >= 0 && a.bottom <= innerHeight; }
  return out;
}

const browser = await chromium.launch();
const sizes = [[390, 844], [360, 640], [1280, 800]], themes = ['light', 'dark'];
const tot = {}; let runs = 0, errs = [];
const add = (k, n, st, sz, th, items) => { if (!items.length) return; (tot[k] = tot[k] || []).push(`${st} ${sz} ${th}: ${items.slice(0, 3).join(' | ')}`); };
for (const [w, h] of sizes) for (const th of themes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: th });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test((m.location() || {}).url || '')) errs.push(m.text() + ' @' + ((m.location() || {}).url || '')); });
  for (const [st, steps] of Object.entries(STATES)) {
    await page.goto('file://' + file); runs++;
    try { await run(page, steps); } catch (e) { errs.push(st + ': ' + String(e).slice(0, 100)); continue; }
    const m = await page.evaluate(measure, false), sz = w + 'x' + h;
    add('contrast', 0, st, sz, th, m.contrast); add('taps', 0, st, sz, th, m.taps); add('overflow', 0, st, sz, th, m.overflow); add('under', 0, st, sz, th, m.under); add('k1', 0, st, sz, th, m.k1);
    if (!m.theme) add('theme', 0, st, sz, th, ['no theme button']);
  }
  /* toast inside the viewport (every size) on the event page, Home and a sheet-closing save */
  for (const st of ['evFri', 'home', 'allFri']) {
    await page.goto('file://' + file); await run(page, STATES[st]);
    await page.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-toast', 'Probe toast'); document.body.appendChild(b); b.click(); b.remove(); });
    const r = await page.evaluate(() => { const t = document.querySelector('#toast').getBoundingClientRect(); return [t.top, t.bottom, innerHeight, innerWidth, t.left, t.right]; });
    if (!(r[0] >= 0 && r[1] <= r[2] && r[4] >= 0 && r[5] <= r[3])) add('toast', 0, st, w + 'x' + h, th, [JSON.stringify(r)]);
  }
  if (w === 390) {
    await page.setViewportSize({ width: 390, height: 514 });
    for (const [st, steps] of Object.entries(KEYS)) {
      await page.goto('file://' + file); runs++;
      try { await run(page, steps); } catch (e) { errs.push(st + ': ' + String(e).slice(0, 100)); continue; }
      const m = await page.evaluate(measure, true);
      if (m.kb[0] !== 'none' || m.kb[1] !== 'none' || !m.kbOn) add('keyboard', 0, st, '390x514', th, [JSON.stringify(m.kb) + ' focusedOnScreen=' + m.kbOn]);
      add('contrast', 0, st, '390x514', th, m.contrast); add('taps', 0, st, '390x514', th, m.taps); add('overflow', 0, st, '390x514', th, m.overflow);
    }
  }
  await ctx.close();
}
await browser.close();
console.log('states:', Object.keys(STATES).length, 'keyboard states:', Object.keys(KEYS).length, 'runs:', runs);
for (const k of ['contrast', 'taps', 'overflow', 'under', 'k1', 'theme', 'toast', 'keyboard']) console.log(k + ': ' + (tot[k] ? tot[k].length + ' fails\n  ' + tot[k].slice(0, 12).join('\n  ') : '0'));
console.log('console/page errors: ' + errs.length + (errs.length ? '\n  ' + [...new Set(errs)].slice(0, 10).join('\n  ') : ''));
