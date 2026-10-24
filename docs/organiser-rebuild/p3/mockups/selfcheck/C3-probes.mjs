// C3 logic probes. Usage: node probes.mjs <C3.html> [--only=ids]
// Drives the mockup by clicking (real or synthetic data-* buttons: every handler is
// delegated on document), then reads the DOM or window.__c2.EV.
import { chromium } from 'playwright';
import path from 'node:path';

const file = path.resolve(process.argv[2]);
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const fresh = async () => { await page.goto('file://' + file); await page.waitForTimeout(30); };
/* click a real element, or a synthetic button carrying the attrs */
const tap = (sel, attrs) => page.evaluate(([sel, attrs]) => {
  let el = sel && document.querySelector(sel);
  if (!el && attrs) { el = document.createElement('button'); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.body.appendChild(el); el.click(); el.remove(); return true; }
  if (!el) return false; el.click(); return true;
}, [sel, attrs || null]);
const B = (attrs) => tap(null, attrs);
const txt = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const all = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.innerText), sel);
const on = (id) => `#s-${id}.on`;
const sheet = () => txt('#sheet.on #sheetbody');
const toastT = () => txt('#toast.on');
const ev = (fn, arg) => page.evaluate(fn, arg);
const setVal = (sel, v) => page.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
const open = async (k) => { await B({ 'data-tab-go': 'events' }); await B({ 'data-open': k }); };
const sid = (k, i) => ev(([k, i]) => window.__c2.EV[k].sess[i].id, [k, i]);

const P = [];
const probe = (id, what, fn, red) => P.push({ id, what, fn, red });

/* ---------- red-first probes for this pass (fail on 5c52b54, pass after) ---------- */
probe('R4a', '#4 preview header of Fri 30 Oct (extra 7pm masterclass) says 7PM', async () => {
  await open('fri'); await B({ 'data-preview': 'fri', 'data-pi': '1' });
  const k = await txt(on('preview') + ' .pub .k'); return [/7PM/.test(k), k];
}, 1);
probe('R4b', '#4 preview header of Fri 6 Nov (class not running) says 9PM', async () => {
  await open('fri'); await B({ 'data-preview': 'fri', 'data-pi': '2' });
  const k = await txt(on('preview') + ' .pub .k'); return [/9PM/.test(k), k];
}, 1);
probe('R4c', '#4 Move (one date) has no time input; the hint takes the time from the sessions', async () => {
  await open('fri'); await B({ 'data-date': '1' }); await B({ 'data-act': 'move' }); await tap('[data-scope="one"]'); await tap('[data-scope-go]');
  const has = await ev(() => !!document.querySelector('#movetime')); const h = await txt('#movehint');
  return [!has && /7pm/.test(h), 'time input: ' + has + ' | ' + h];
}, 1);
probe('R4d', '#4 Add a date asks for the date only', async () => {
  await open('fri'); await B({ 'data-sheet': 'adddate' });
  const has = await ev(() => !!document.querySelector('#atime')); return [!has, 'time input: ' + has];
}, 1);
probe('R4e', '#4 Move this and later never writes the event start time', async () => {
  await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-act': 'move' }); await tap('[data-scope="later"]'); await tap('[data-scope-go]');
  await ev(() => { const i = document.querySelector('#movetime'); if (i) { i.value = '21:30'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  await tap('[data-mwd="4"]'); await tap('#domove');
  const t = await ev(() => window.__c2.EV.fri.time); return [t === '20:00', 'e.time=' + t];
}, 1);
probe('R5', '#5 class time "this and later" from Fri 30 Oct keeps Fri 6 Nov not running', async () => {
  await open('fri'); const c = await sid('fri', 0);
  await B({ 'data-date': '1' }); await B({ 'data-dsess': c }); await setVal('#sss', '20:30'); await setVal('#sse', '21:30');
  await tap('[data-sssave]'); await tap('[data-sscope="later"]'); const cons = await txt('#sscons'); await tap('[data-sscope-go]');
  const cx = await ev((c) => !!(window.__c2.EV.fri.dates[2].so && window.__c2.EV.fri.dates[2].so[c] && window.__c2.EV.fri.dates[2].so[c].cx), c);
  return [cx && /Fri 6 Nov: Class stays not running/.test(cons), 'cx kept: ' + cx + ' | ' + cons.replace(/\n/g, ' / ')];
}, 1);
probe('R6', '#6 Pick dates > line-up on these dates saves to all 3 picked dates', async () => {
  await open('fri'); await B({ 'data-go': 'alldates' }); await tap('[data-pickmode]');
  for (const i of [4, 5, 6]) await tap(`[data-pk="${i}"]`);
  await tap('[data-bulk="more"]'); await tap('[data-bulk="lineup"]');
  await setVal('#psearch', 'Sofia R'); await tap('#presults [data-add]'); await tap('#savelineup');
  const n = await ev(() => [4, 5, 6].filter((i) => { const x = window.__c2.EV.fri.dates[i]; return x.so && Object.values(x.so).some((o) => (o.ppl || []).some((p) => /Sofia Ramos/.test(p[0]))); }).length);
  return [n === 3, n + ' of 3 dates have Sofia Ramos'];
}, 1);
probe('R15', '#15 long course: legend, Repeats row and All dates all say 8 classes', async () => {
  await open('long'); const leg = await txt(on('event') + ' .legend'); const rep = await txt(on('event') + ' [data-go="repeat"]');
  await B({ 'data-go': 'alldates' }); const cls = (await txt(on('alldates'))).match(/Class \d+ of \d+/g) || [];
  const ok = /8 classes/.test(leg) && /8 classes/.test(rep) && cls.length === 8 && cls.every((c) => / of 8$/.test(c)) && cls[7] === 'Class 8 of 8';
  return [ok, leg + ' | ' + rep.replace(/\n/g, ' ') + ' | ' + cls.join(',')];
}, 1);
probe('R17', '#17 Needs you "Add the teachers" ticks done after adding one', async () => {
  await B({ 'data-tab-go': 'home' }); await tap('[data-lineup-all="wedc"]');
  await setVal('#psearch', 'Sofia R'); await tap('#presults [data-add]'); await tap('#savelineup');
  await B({ 'data-tab-go': 'home' }); const open0 = await ev(() => [...document.querySelectorAll('#s-home .todo:not(.done)')].some((b) => /Add the teachers/.test(b.innerText)));
  return [!open0, 'still open: ' + open0];
}, 1);
probe('R18', '#18 Repeats: adding Saturday to Fridays shows no "removes" warning', async () => {
  await open('fri'); await B({ 'data-go': 'repeat' }); await tap('[data-rpday="6"]');
  const bad = await all(on('repeat') + ' .note.bad'); return [!bad.some((b) => /removes/.test(b)), bad.join(' | ') || 'no warning'];
}, 1);

/* ---------- other fixes in this pass ---------- */
probe('F1', '#1 session title and detail sit on separate lines', async () => {
  await open('fri'); const r = await ev(() => [...document.querySelectorAll('#s-event .ses')].every((s) => { const t = s.querySelector('.t').getBoundingClientRect(), d = s.querySelector('.s').getBoundingClientRect(); return d.top >= t.bottom - 1; }));
  return [r, String(r)];
});
probe('F2', '#2 roles read as nouns: "Marco & Sofia, teachers", "DJ Kizzy, DJ"', async () => {
  await open('fri'); const t = await txt(on('event') + ' .tl'); return [/Marco & Sofia, teachers/.test(t) && /DJ Kizzy, DJ/.test(t) && !/\(djs\)|\(teaches\)/.test(t), t.replace(/\n/g, ' / ').slice(0, 160)];
});
probe('F3', '#3 Where does not repeat the place name', async () => {
  await open('fri'); const t = await txt(on('event') + ' [data-edit="where"]'); return [!/Colab Tower[\s\S]*Colab Tower/.test(t), t.replace(/\n/g, ' / ')];
});
probe('F7', '#7 festival preview: teachers only as headliners, live date line, style labels', async () => {
  await B({ 'data-open': 'fest' }); await B({ 'data-go': 'fpreview' }); const t = await txt(on('fpreview'));
  return [!/DJ Kizzy/.test(t.split('PROGRAMME')[0]) && /Fri 5 – Sun 7 February 2027/i.test(t) && /3 Acts/i.test(t) && /Dominican/i.test(t), t.replace(/\n/g, ' / ').slice(0, 220)];
});
probe('F7b', '#7 festival with no ticket link shows Tickets TBA', async () => {
  await B({ 'data-open': 'fest' }); await ev(() => { window.__c2.EV.fest.ticket = ''; }); await B({ 'data-go': 'fpreview' }); const t = await txt(on('fpreview'));
  return [/Tickets TBA/i.test(t) && !/Get Tickets/i.test(t), t.slice(0, 120).replace(/\n/g, ' / ')];
});
probe('F8', '#8 event preview shows Prices, About, Music and Line-up', async () => {
  await open('fri'); await B({ 'data-preview': 'fri', 'data-pi': '0' }); const t = await txt(on('preview'));
  return [/Prices[\s\S]*Class and party/.test(t) && /About[\s\S]*No partner needed/.test(t) && /Music/.test(t) && /Line-up[\s\S]*DJ Kizzy, DJ/.test(t), 'ok?'];
});
probe('F9', '#9 remove from every date: strip and toast agree', async () => {
  await open('fri'); const p = await sid('fri', 1); await B({ 'data-sess': p }); await tap('[data-sheet="removeall"]'); await tap('[data-ssremoveall]');
  const n = await txt(on('event') + ' .note.warn'); return [/Removed from every date/.test(n) && !/not saved/.test(n), n];
});
probe('F10', '#10 skipping a course week adds a class at the end', async () => {
  await open('long'); const n0 = await ev(() => window.__c2.EV.long.dates.length); await B({ 'data-date': '2' }); await B({ 'data-sheet': 'skip' }); await tap('[data-doskip]');
  const n1 = await ev(() => window.__c2.EV.long.dates.length); const t = await toastT(); return [n1 === n0 + 1 && /Course now ends Wed 13 Jan 2027/.test(t), n0 + '->' + n1 + ' | ' + t];
});
probe('F11', '#11 move scope sheet says the consequence before the tap', async () => {
  await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-act': 'move' }); await tap('[data-scope="later"]'); const t = await txt('#sscons');
  return [/Moves from Fri 20 Nov onwards/.test(t), t];
});
probe('F12', '#12 date sheet: 2 choices up front, the rest in "More for this date"', async () => {
  await open('fri'); await B({ 'data-date': '4' }); const r = await ev(() => { const s = document.querySelector('#sheetbody'); const top = [...s.querySelectorAll(':scope > .stack .choice')].length; const fold = [...s.querySelectorAll('details.fold .choice')].map((c) => c.innerText.split('\n')[0]); return [top, fold]; });
  return [r[0] === 2 && r[1].length === 4, JSON.stringify(r)];
});
probe('F13', '#13 event page: ONE status row "Live · Pause or end it" (no second Pause row, sim fix 9)', async () => {
  await open('fri'); const t = await txt(on('event') + ' .ev2 > div:first-child'); return [/Live · Pause or end it/.test(t) && !/Pause this event/.test(t), t.slice(0, 200).replace(/\n/g, ' / ')];
});
probe('F19', '#19 first day screen counts the 9 real events', async () => {
  await fresh(); const t = await txt(on('welcome')); return [/We found your 9 events/.test(t), (t.match(/We found your \d+ events/) || [''])[0]];
});
probe('F23', '#23 no Rooms row at a 1-room venue, shown at Mambo', async () => {
  const tc = (s) => ev((s) => document.querySelector(s).textContent, s); await open('fri'); const a = await tc(on('event') + ' details.fold'); await open('mambo'); const b = await tc(on('event') + ' details.fold');
  return [!/Rooms/.test(a) && /Rooms/.test(b), 'fri:' + /Rooms/.test(a) + ' mambo:' + /Rooms/.test(b)];
});

probe('F14', '#14 one word per thing: old words gone', async () => { const src = await ev(() => document.documentElement.outerHTML); const bad = ['Party (social)', '(djs)', 'Last night<', 'Who&rsquo;s on?', 'Dates you add yourself', 'How many weeks', 'Move every session', '>Town<', 'Social with classes']; return [!bad.some((b) => src.includes(b)), bad.filter((b) => src.includes(b)).join()]; });
probe('F16', '#16 Help undo promise matches History', async () => { await B({ 'data-sheet': 'help' }); const t = await sheet(); return [/For changes from today, open History/.test(t) && !/10 seconds/.test(t), 'ok?']; });
probe('F20', '#20 desktop toast is inside the viewport', async () => { await page.setViewportSize({ width: 1280, height: 800 }); await open('fri'); await B({ 'data-share': '' }); const r = await ev(() => { const b = document.querySelector('#toast').getBoundingClientRect(); return [b.top, b.bottom, innerHeight]; }); await page.setViewportSize({ width: 390, height: 844 }); return [r[0] >= 0 && r[1] <= r[2], JSON.stringify(r)]; });
/* ---------- C2's 25 probes (rebuilt: the original script was not kept in the repo) ---------- */
probe('#1a', 'long course from Wed 2 Dec: "4 classes, to Wed 6 Jan 2027"', async () => { await open('long'); await B({ 'data-date': '4' }); await B({ 'data-act': 'lineup' }); const t = await sheet(); return [/4 classes, to Wed 6 Jan 2027/.test(t), t.slice(0, 160)]; });
probe('#1b', 'weekly scope says "no end date"', async () => { await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-act': 'lineup' }); const t = await sheet(); return [/no end date/.test(t), t.slice(0, 160)]; });
probe('#2a', 'move later hint: "From Thu 12 Nov ... last Thu 7 Jan 2027"', async () => { await open('long'); await B({ 'data-date': '1' }); await B({ 'data-act': 'move' }); await tap('[data-scope="later"]'); await tap('[data-scope-go]'); await tap('[data-mwd="4"]'); const h = await txt('#movehint'); return [/From Thu 12 Nov/.test(h) && /last Thu 7 Jan 2027/.test(h), h]; });
probe('#2b', 'move later toast + Moved chips', async () => { await open('long'); await B({ 'data-date': '1' }); await B({ 'data-act': 'move' }); await tap('[data-scope="later"]'); await tap('[data-scope-go]'); await tap('[data-mwd="4"]'); await tap('#domove'); const t = await toastT(); const st = await all(on('event') + ' .date .st'); return [/last Thu 7 Jan 2027/.test(t) && st.filter((s) => s === 'Moved').length >= 3, t]; });
probe('#2c', 'move one date: "Moved to Sat 21 Nov, 8pm" (time from the sessions)', async () => { await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-act': 'move' }); await tap('[data-scope="one"]'); await tap('[data-scope-go]'); const h = await txt('#movehint'); return [/Moved to Sat 21 Nov, 8pm/.test(h), h]; });
probe('#3a', 'Home line-up header "Sensual Fridays · Fri 23 Oct only"', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-lineup-next]'); const t = await txt(on('lineup') + ' .when'); return [/Sensual Fridays · Fri 23 Oct only/i.test(t), t]; });
probe('#3b', 'course header "every class left (28 Oct)"', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-lineup-all="wedc"]'); const t = await txt(on('lineup') + ' .when'); return [/every class left \(28 Oct\)/i.test(t), t]; });
probe('#3c', 'later header "every Friday from ..."', async () => { await open('fri'); await B({ 'data-lineup-ask': 'fri' }); await tap('[data-scope="later"]'); await tap('[data-lineup-go]'); const t = await txt(on('lineup') + ' .when'); return [/every Friday from/i.test(t), t]; });
probe('#4', 'cancel this and later: "Cancel these dates?"', async () => { await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-act': 'cancel' }); await tap('[data-scope="later"]'); await tap('[data-scope-go]'); const t = await txt('#sheettitle'); return [/Cancel these dates\?/.test(t), t]; });
probe('#5', 'disabled Next says why', async () => { await B({ 'data-flow': 'weekly' }); const t = await txt('#bb'); return [/Type a name to carry on/.test(t), t]; });
probe('#8a', 'Home: Cancelled tonight card + Bring it back', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-cancelnext]'); await tap('[data-reason]'); await tap('[data-docancel]'); const t = await txt(on('home')); return [/Cancelled tonight/.test(t) && /Bring it back/.test(t), 'ok?']; });
probe('#8b', 'then Next up is the 9pm Halloween party', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-cancelnext]'); await tap('[data-reason]'); await tap('[data-docancel]'); const t = await txt(on('home') + ' .hero'); return [/Tonight, 9pm/i.test(t) && /Halloween/.test(t), t.slice(0, 120)]; });
probe('#8c', 'pause: Paused chip + Turn back on on the page', async () => { await open('fri'); await B({ 'data-sheet': 'pause' }); await tap('[data-dopause]'); const t = await txt(on('event')); const b = await txt('#bb'); return [/Paused/.test(t) && /Turn back on/.test(b), b]; });
probe('#8d', 'pause: Home shows Paused + Turn back on', async () => { await open('fri'); await B({ 'data-sheet': 'pause' }); await tap('[data-dopause]'); await B({ 'data-tab-go': 'home' }); const t = await txt(on('home')); return [/Turn back on/.test(t), 'ok?']; });
probe('#9', 'toast sits above the bottom bar, bar button clickable', async () => { await open('fri'); await B({ 'data-share': '' }); const r = await ev(() => [document.querySelector('#toast').getBoundingClientRect().bottom, document.querySelector('#bb').getBoundingClientRect().top]); return [r[0] <= r[1], JSON.stringify(r)]; });
probe('#10', 'keyboard: the tab bar hides while typing, the bottom bar NEVER does (sim fix M2)', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-lineup-next]'); await page.focus('#psearch'); const r = await ev(() => [getComputedStyle(document.querySelector('#bb')).display, getComputedStyle(document.querySelector('#tabs')).display]); return [r[0] !== 'none' && r[1] === 'none', r.join()]; });
probe('#11', 'swap the DJ: Save line-up enabled', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-lineup-next]'); await tap('[data-rm]'); const d = await ev(() => document.querySelector('#savelineup').disabled); return [!d, 'disabled=' + d]; });
probe('#12', 'Where, How to pay and Ticket link are rows on the event page', async () => { await open('fri'); const r = await ev(() => ['where', 'pay', 'ticket'].every((k) => document.querySelector('#s-event [data-edit="' + k + '"]'))); return [r, String(r)]; });
probe('#13', 'preview: empty How to pay shows the organiser-only box', async () => { await open('fri'); await B({ 'data-preview': 'fri', 'data-pi': '0' }); const t = await txt(on('preview') + ' [data-edit="pay"]'); return [/Not set yet/.test(t), t]; });
probe('#14', 'far-year chips carry 2027', async () => { await open('long'); const t = await all(on('event') + ' .date .y'); return [t.includes('2027'), t.join()]; });
probe('#15', 'Stats: views only + "Saves are coming soon"', async () => { await B({ 'data-tab-go': 'stats' }); const t = await txt(on('stats')); return [/Saves are coming soon/.test(t) && !/\d+ saves/.test(t), 'ok?']; });
probe('#17', 'delete stays "Want it gone for good? Ask us"', async () => { await open('fri'); const t = await txt(on('event')); return [/Want it gone for good\? Ask us/.test(t), 'ok?']; });
probe('#18', 'invite: waiting state with Send again / Cancel invite', async () => { await B({ 'data-go': 'team' }); await B({ 'data-sheet': 'invite' }); await setVal('#invemail', 'amy@example.com'); await tap('#sendinvite'); const t = await txt(on('team')); return [/Send again/.test(t) && /Cancel invite/.test(t), 'ok?']; });
probe('#19a', 'Back returns to the event page', async () => { await open('fri'); await B({ 'data-go': 'history' }); await tap(on('history') + ' [data-back]'); const s = await ev(() => window.__c2.state().stack.slice(-1)[0]); return [s === 'event', s]; });
probe('#19b', 'old C/C2 words gone from the file', async () => { const src = await ev(() => document.documentElement.outerHTML); const bad = ['See page', 'Take it off the calendar?', 'Jan 27', 'updates every hour']; return [!bad.some((b) => src.includes(b)), bad.filter((b) => src.includes(b)).join()]; });
probe('#22', 'Help has a real WhatsApp button', async () => { await B({ 'data-sheet': 'help' }); const h = await ev(() => document.querySelector('#sheet a.btn').href); return [/wa\.me/.test(h), h]; });
probe('#24', 'the two Sensual Wednesdays have different second lines', async () => { await B({ 'data-tab-go': 'events' }); const r = await ev(() => ['wedc', 'wedsep'].map((k) => document.querySelector('#s-events [data-open="' + k + '"] .s').innerText)); return [r[0] !== r[1], r.join(' | ')]; });
probe('B3', 'no profile: "Add their name instead"', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-lineup-next]'); await setVal('#psearch', 'Zed Nobody'); const t = await txt('#presults'); return [/Add their name instead/.test(t), 'ok?']; });

/* ---------- C3's 27 session probes (rebuilt) ---------- */
probe('S1', 'Add the next session starts at the last end', async () => { await open('fri'); await B({ 'data-addsess': 'next' }); const v = await ev(() => document.querySelector('#sss').value); return [v === '01:00', v]; });
probe('S2', 'a new event-page session goes on every date', async () => { await open('fri'); await B({ 'data-addsess': 'next' }); await setVal('#ssname', 'After party'); await tap('[data-sssave]'); const t = await toastT(); const n = await ev(() => window.__c2.EV.fri.sess.length); return [/every date/.test(t) && n === 3, t]; });
probe('S3', 'Not running: toast', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); await tap('[data-sscx]'); const t = await toastT(); return [/not running on Fri 20 Nov/.test(t), t]; });
probe('S4', 'Not running: struck on that date only', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); await tap('[data-sscx]'); const r = await ev((c) => [window.__c2.EV.fri.dates[4].so[c].cx, !!(window.__c2.EV.fri.dates[5].so && window.__c2.EV.fri.dates[5].so[c])], c); return [r[0] && !r[1], JSON.stringify(r)]; });
probe('S5', 'Not running: Bring it back', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '2' }); await B({ 'data-dsess': c }); const t = await sheet(); await tap('[data-ssundo]'); const so = await ev(() => window.__c2.EV.fri.dates[2].so); return [/Bring it back/.test(t) && !so, JSON.stringify(so)]; });
probe('S6', 'consequence line (later)', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); await setVal('#sss', '20:15'); await tap('[data-sssave]'); await tap('[data-sscope="later"]'); const t = await txt('#sscons'); return [/Changes from Fri 20 Nov onwards\. Earlier dates keep the old time\./.test(t), t]; });
probe('S7', 'consequence line (one)', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); await setVal('#sss', '20:15'); await tap('[data-sssave]'); const t = await txt('#sscons'); return [/Only Fri 20 Nov changes/.test(t), t]; });
probe('S8', 'later applies forward only (ONE forward segment from 20 Nov, no per-date copies; changed from the per-date shape of 5c52b54)', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); await setVal('#sss', '20:15'); await tap('[data-sssave]'); await tap('[data-sscope="later"]'); await tap('[data-sscope-go]'); const r = await ev((c) => { const q = window.__c2.EV.fri, g = q.sess[0].from || []; return [g.length, g[0] && +g[0].d === +q.dates[4].d, g[0] && g[0].p.s, q.dates.filter((x) => x.so && x.so[c] && x.so[c].s).length]; }, c); return [r[0] === 1 && r[1] === true && r[2] === '20:15' && r[3] === 0, r.join(',')]; });
probe('S9', 'line-up later consequence', async () => { await open('fri'); await B({ 'data-lineup-ask': 'fri' }); await tap('[data-scope="later"]'); await tap('[data-lineup-go]'); await tap('[data-rm]'); await tap('#savelineup'); const t = await toastT(); return [/Earlier dates keep the old line-up/.test(t), t]; });
probe('S10', 'extra session: "Remove (only this date)"', async () => { await open('fri'); const x = await ev(() => window.__c2.EV.fri.dates[1].extra[0].id); await B({ 'data-date': '1' }); await B({ 'data-dsess': x }); const t = await sheet(); return [/Remove \(only this date\)/.test(t), 'ok?']; });
probe('R-toast', 'this-and-later session save: toast is one line, no per-date notes, short', async () => {
  await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-dsess': await sid('fri', 0) });
  await ev(() => { const i = document.querySelector('#sheet [data-sstime], #sheet input[type=time]'); });
  const st = await ev(() => { const w = window.__c2.EV.fri; return w.sess[0].s; });
  await ev(() => { const t = [...document.querySelectorAll('#sheet input')].find((i) => /^\d\d:\d\d$/.test(i.value)); if (t) { t.value = '20:30'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); } });
  await tap('[data-sssave]'); await tap('[data-sscope="later"]'); await tap('[data-sscope-go]');
  const t = await toastT(); const h = await ev(() => document.querySelector('#toast').getBoundingClientRect().height);
  return [!/had its own/.test(t) && /Changes from Fri 20 Nov onwards/.test(t) && h <= 120, 'h=' + Math.round(h) + ' | ' + t.replace(/\n/g, ' / ').slice(0, 140)];
}, 1);
probe('R-notrun', 'this-and-later across Fri 6 Nov (class not running): scope sheet lists "stays not running" BEFORE the tap', async () => {
  await open('fri'); await B({ 'data-date': '1' }); await B({ 'data-dsess': 's1' });
  await ev(() => { const t = [...document.querySelectorAll('#sheet input')].find((i) => /^\d\d:\d\d$/.test(i.value)); if (t) { t.value = '20:30'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); } });
  await tap('[data-sssave]'); await tap('[data-sscope="later"]'); const t = await sheet(); return [/Fri 6 Nov: [^\n]*stays not running/.test(t), t.replace(/\n/g, ' / ').slice(0, 200)];
});
/* ---------- red-first: "this and later" is ONE forward change, not N per-date overrides (walk find) ---------- */
const tour3 = async () => {
  await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-dsess': await sid('fri', 0) });
  await ev(() => { const t = [...document.querySelectorAll('#sheet input')].find((i) => /^\d\d:\d\d$/.test(i.value)); if (t) { t.value = '20:30'; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); } });
  await tap('[data-sssave]'); await tap('[data-sscope="later"]'); await tap('[data-sscope-go]');
};
const classRow = async () => (await ev(() => { const r = [...document.querySelectorAll('#s-event [data-sess]')][0]; return r ? r.innerText : ''; })).replace(/\n/g, ' / ');
const legendT = () => txt('#s-event .legend');
probe('R-fwd-row', 'tour 3 then the event page: class row says "From Fri 20 Nov: 8:30pm", no "Different on" naming 20 Nov, at most the pre-save override (6 Nov)', async () => {
  await tour3(); await B({ 'data-back': '' }).catch(() => {}); const r = await classRow();
  const dif = (r.match(/Different on[^/]*/) || [''])[0];
  return [/From Fri 20 Nov: 8:30pm/.test(r) && !/20 Nov/.test(dif) && !/27 Nov/.test(dif) && (dif === '' || /^Different on 1 date: 6 Nov\s*$/.test(dif)), r.slice(0, 200)];
}, 1);
probe('R-fwd-legend', 'the legend count of changed dates is the same before and after the tour-3 save', async () => {
  await open('fri'); const a = (await legendT()).match(/(\d+) (?:dates? with|changed for)/); 
  await tour3(); const b = (await legendT()).match(/(\d+) (?:dates? with|changed for)/);
  return [!!a && !!b && a[1] === b[1], (a && a[0]) + ' -> ' + (b && b[0])];
}, 1);
probe('R-fwd-date', 'after the save Fri 27 Nov shows the class at 8:30pm with no chip dot; Fri 13 Nov still 8pm', async () => {
  await tour3();
  const dot = await ev(() => { const c = document.querySelector('#s-event [data-date="5"]'); return c ? !!c.querySelector('.cdot') : null; });
  await B({ 'data-date': '5' }); const t27 = await sheet(); await tap('[data-close]');
  await B({ 'data-date': '3' }); const t = await sheet();
  const c = await ev(() => { const q = window.__c2.EV.fri, id = q.sess[0].id; return q.dates.filter((x) => x.so && x.so[id]).length; });
  return [dot === false && /8:30pm/.test(t27) && /Fri 13 Nov, 8pm/.test(t) && c <= 1, 'dot=' + dot + ' 27Nov=' + t27.replace(/\n/g, ' / ').slice(0, 120) + ' | 13Nov=' + t.replace(/\n/g, ' / ').slice(0, 60) + ' | perDateOverrides(class)=' + c];
}, 1);
probe('R-fwd-undo', 'Undo on the toast returns the row to "8pm to 9pm" with no "From" line', async () => {
  await tour3(); const pre = await classRow(); await tap('#toast [data-undo], #toast button'); const r = await classRow();
  return [/From Fri 20 Nov/.test(pre) && /8pm/.test(r) && !/From /.test(r), 'before: ' + pre.slice(0, 90) + ' | after: ' + r.slice(0, 90)];
}, 1);
probe('R-fwd-lineup', 'line-up "This and later" from 20 Nov gives a "From Fri 20 Nov" line, not a date list', async () => {
  await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-act': 'lineup' }); await tap('[data-scope="later"]'); await tap('[data-scope-go]');
  await setVal('#psearch', 'Sofia R'); await tap('#presults [data-add]'); await tap('#savelineup');
  const r = await classRow(); const r2 = await ev(() => [...document.querySelectorAll('#s-event [data-sess]')].map((e) => e.innerText).join(' / ')).then((z) => z.replace(/\n/g, ' '));
  return [/From Fri 20 Nov/.test(r2) && !/Different on \d+ dates/.test(r2), r2.slice(0, 260)];
}, 1);

probe('S11', 'series session on the page: "Remove from every date"', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-sess': c }); const t = await sheet(); return [/Remove from every date/.test(t), 'ok?']; });
probe('S12', 'remove confirm points to Not running', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-sess': c }); await tap('[data-sheet="removeall"]'); const t = await sheet(); return [/Not running this date/.test(t), 'ok?']; });
probe('S13', 'series session on a date: "Not running this date", no delete', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); const t = await sheet(); return [/Not running this date/.test(t) && !/Remove from every date</.test(t), 'ok?']; });
probe('S14', 'skip vs cancel: different words', async () => { await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-sheet': 'skip' }); const t = await sheet(); return [/Skip Fri 20 Nov\?/.test(t) && /no .Cancelled. notice/.test(t) && /Cancel it instead/.test(t), 'ok?']; });
probe('S15', 'one-date add stays on one date', async () => { await open('fri'); await B({ 'data-date': '4' }); await B({ 'data-addsess': 'one' }); await setVal('#ssname', 'Guest class'); await tap('[data-sssave]'); const r = await ev(() => [window.__c2.EV.fri.dates[4].extra.length, !!window.__c2.EV.fri.dates[5].extra, window.__c2.EV.fri.sess.length]); return [r[0] === 1 && !r[1] && r[2] === 2, r.join()]; });
probe('S16', 'room picker only at the 2-room venue', async () => { await open('fri'); await B({ 'data-sess': await sid('fri', 0) }); const a = await sheet(); await open('mambo'); await B({ 'data-sess': await sid('mambo', 0) }); const b = await sheet(); return [!/Room\n/.test(a) && /Bachata Room/.test(b), 'ok?']; });
probe('S17', 'level hides for a party', async () => { await open('fri'); await B({ 'data-sess': await sid('fri', 1) }); const t = await sheet(); return [!/Level/.test(t), 'ok?']; });
probe('S18', 'live Sep course = "All classes done"', async () => { await B({ 'data-tab-go': 'events' }); const t = await txt('#s-events [data-open="wedsep"]'); return [/All classes done/.test(t), t.replace(/\n/g, ' / ')]; });
probe('S19', 'theme sheet has Auto / Light / Dark', async () => { await B({ 'data-sheet': 'theme' }); const t = await sheet(); return [/Auto[\s\S]*Light[\s\S]*Dark/.test(t), 'ok?']; });
probe('S20', 'Dark applies', async () => { await B({ 'data-sheet': 'theme' }); await tap('[data-theme-pick="dark"]'); const bg = await ev(() => getComputedStyle(document.querySelector('.scr.on')).backgroundColor); return [bg === 'rgb(32, 34, 38)', bg]; });
probe('S21', 'stars cap at 6 of 6', async () => { await B({ 'data-open': 'fest' }); for (let i = 0; i < 8; i++) await tap('#s-fest .star[aria-pressed="false"]:not([disabled])'); const t = await txt(on('fest')); return [/Headliners 6 of 6/.test(t) && /6 headliners is the most/.test(t), (t.match(/Headliners \d of 6/) || [''])[0]]; });
probe('S22', 'no delete / merge / featured / city controls', async () => { await open('fri'); const b = await all('#s-event button'); return [!b.some((x) => /^(Delete|Merge|Feature|Change city)/i.test(x)), 'ok?']; });
probe('S23', 'create starts with one ready session', async () => { await B({ 'data-flow': 'weekly' }); const n = await ev(() => window.__c2.state().flow.sess.length); return [n === 1, String(n)]; });
probe('S24', 'a course starts with a class', async () => { await B({ 'data-flow': 'course' }); const k = await ev(() => window.__c2.state().flow.sess[0].k); return [k === 'class', k]; });
probe('S25', 'Tour has 5 steps', async () => { await B({ 'data-tab-go': 'home' }); await B({ 'data-sheet': 'tour' }); const n = await ev(() => document.querySelectorAll('#sheet [data-tourgo]').length); return [n === 5, String(n)]; });
probe('S26', 'Who’s going opens a people list', async () => { await open('fri'); await B({ 'data-going': 'fri', 'data-gi': '0' }); const t = await sheet(); return [/going \(14\)/.test(t), t.slice(0, 40)]; });
probe('S27', 'History: Undo where possible, why where not', async () => { await open('fri'); await B({ 'data-go': 'history' }); const t = await txt(on('history')); return [/Undo/.test(t) && /Photos can.t be undone/.test(t), 'ok?']; });

/* ---------- red-first probes for the C3 sim fix pass (fail on be017c5a, pass after) ---------- */
const hdr = () => txt(on('event') + ' .ev2 > div:first-child');
const saveClassTime = async (t) => { await open('fri'); await B({ 'data-sess': await sid('fri', 0) }); await setVal('#sss', t); await tap('[data-sssave]'); await tap('[data-sswhich-go]'); };
probe('R-sim-m1-header', 'M1 after "all dates" 8:30pm: event header, Events row, Home row, Stats row all say 8:30pm', async () => {
  await saveClassTime('20:30');
  const h = await hdr(); const line = (h.split('\n').find((l) => /^Every Friday/.test(l)) || '');
  await B({ 'data-tab-go': 'events' }); const ev1 = await txt('#s-events [data-open="fri"]');
  await B({ 'data-tab-go': 'home' }); const ho = await txt('#s-home .row[data-open="fri"]');
  await B({ 'data-tab-go': 'stats' }); const st = await txt('#s-stats [data-open="fri"]');
  return [[line, ev1, ho, st].every((x) => /8:30pm/.test(x)), [line, ev1.replace(/\n/g, ' / '), ho.replace(/\n/g, ' / '), st.replace(/\n/g, ' / ')].join(' || ').slice(0, 330)];
}, 1);
probe('R-sim-m2-bar', 'M2 one keystroke in the ticket link field: the bar shows an enabled Save (same for the wizard name step)', async () => {
  await open('sat'); await B({ 'data-edit': 'ticket', 'data-k': 'sat' }); await page.focus('#tlink'); await page.keyboard.type('x');
  const a = await ev(() => { const b = document.querySelector('#bb #saveedit'); return [getComputedStyle(document.querySelector('#bb')).display, !!b && !b.disabled && /Save/.test(b.textContent)]; });
  await fresh(); await B({ 'data-flow': 'course' }); await page.focus('#fname'); await page.keyboard.type('A');
  const b2 = await ev(() => { const b = document.querySelector('#bb #fnext'); return [getComputedStyle(document.querySelector('#bb')).display, !!b && !b.disabled && /Next/.test(b.textContent)]; });
  return [a[0] !== 'none' && a[1] && b2[0] !== 'none' && b2[1], 'ticket ' + a.join() + ' | wizard ' + b2.join()];
}, 1);
const monthlyTo9pm = async () => {
  await B({ 'data-flow': 'monthly' }); await setVal('#fname', 'First Saturday Social'); await tap('#fnext'); await tap('[data-fwd="6"]'); await setVal('#ftime', '21:00');
  await tap('#fnext'); await B({ 'data-fsessadd': 'before' }); await tap('[data-sssave]'); await B({ 'data-fstep': '5' });
};
probe('R-sim-m3-review', 'M3 monthly 9pm + a class before: review "When" names Party 9pm and class from 8pm, no bare 8pm', async () => {
  await monthlyTo9pm(); const t = await txt(on('step')); const w = (t.split('\n').find((l) => /^Every month/.test(l)) || '');
  return [/Party 9pm/.test(w) && /class from 8pm/.test(w) && !/8pm/.test(w.replace('class from 8pm', '')), w];
}, 1);
probe('R-sim-m3-live', 'M3 + small 2: "Put it live" opens the new event page and its header says Party 9pm', async () => {
  await monthlyTo9pm(); await tap('#golive'); const st = await ev(() => window.__c2.state().stack); const h = await hdr();
  return [st[st.length - 1] === 'event' && /Party 9pm, class from 8pm/.test(h), st.join('>') + ' | ' + h.replace(/\n/g, ' / ').slice(0, 150)];
}, 1);
probe('R-sim-m3-heading', 'M3 wizard step 2 asks "When does the social start?" (the type\'s own word)', async () => {
  await B({ 'data-flow': 'monthly' }); await setVal('#fname', 'X'); await tap('#fnext'); const t = await txt(on('step')); return [/When does the social start\?/.test(t), t.replace(/\n/g, ' / ').slice(0, 160)];
}, 1);
probe('R-sim-m4-scope', 'M4 session sheet offers Every date / From Fri 30 Oct on / Just Fri 23 Oct; "From" leaves tonight at 8pm, changes the next date, class row shows a From line', async () => {
  await open('fri'); const c = await sid('fri', 0); await B({ 'data-sess': c }); await setVal('#sss', '20:30'); await tap('[data-sssave]');
  const n = await ev(() => document.querySelectorAll('#sheet [data-sswhich]').length); const sh = await sheet();
  const labels = /Every date/.test(sh) && /From Fri 30 Oct on/.test(sh) && /Just Fri 23 Oct/.test(sh);
  const def = await ev(() => document.querySelector('[data-sswhich="all"]').getAttribute('aria-checked'));
  await tap('[data-sswhich="later"]'); await tap('[data-sswhich-go]');
  await B({ 'data-date': '0' }); const t0 = await sheet(); await tap('[data-close]'); await B({ 'data-date': '1' }); const t1 = await sheet(); await tap('[data-close]');
  const row = await txt(on('event') + ' [data-sess="' + c + '"]');
  return [n === 3 && labels && def === 'true' && !/8:30pm/.test(t0) && /8pm/.test(t0) && /8:30pm/.test(t1) && /From Fri 30 Oct/.test(row), 'n=' + n + ' def=' + def + ' | ' + t0.slice(0, 30) + ' | ' + t1.slice(0, 30) + ' | ' + row.replace(/\n/g, ' / ').slice(0, 120)];
}, 1);
probe('R-sim-m4-just', 'M4 "Just Fri 23 Oct" changes tonight only; every other date keeps 8pm', async () => {
  await open('fri'); const c = await sid('fri', 0); await B({ 'data-sess': c }); await setVal('#sss', '20:30'); await tap('[data-sssave]'); await tap('[data-sswhich="one"]'); await tap('[data-sswhich-go]');
  await B({ 'data-date': '0' }); const t0 = await sheet(); await tap('[data-close]'); await B({ 'data-date': '1' }); const t1 = await sheet();
  return [/8:30pm/.test(t0) && !/8:30pm/.test(t1) && /8pm/.test(t1), t0.slice(0, 30) + ' | ' + t1.slice(0, 30)];
}, 1);
probe('R-sim-stats-sum', 'stats: the date-by-date rows add up to the "By event" total, for every event that has a table, and on screen', async () => {
  const r = await ev(() => Object.keys(window.__c2.STATW).map((k) => [k, window.__c2.statRows(k).reduce((a, x) => a + x.v, 0), window.__c2.EV[k].views]));
  await B({ 'data-tab-go': 'stats' });
  const dom = await ev(() => { const rows = [...document.querySelectorAll('#s-stats h2')].find((h) => /date by date/.test(h.textContent)).nextElementSibling.querySelectorAll('tbody tr'); let sum = 0; rows.forEach((tr) => { sum += +tr.children[1].textContent; }); const by = document.querySelector('#s-stats [data-open="fri"] .s').textContent.match(/(\d+) views/); return [sum, by && +by[1]]; });
  return [r.length >= 2 && r.every((x) => x[1] === x[2]) && dom[0] === dom[1], JSON.stringify(r) + ' dom=' + dom.join('/')];
}, 1);
probe('R-sim-s1-people', 'small 1: Home card names the roles: "Teaching: Marco & Sofia · DJ: Kizzy"', async () => {
  await B({ 'data-tab-go': 'home' }); const t = await txt('#s-home .hero'); return [/Teaching: Marco & Sofia · DJ: Kizzy/.test(t), t.replace(/\n/g, ' / ').slice(0, 200)];
}, 1);
probe('R-sim-s3-classname', 'small 3: a class added with "Add a class before" is named Class, never "No name yet"', async () => {
  await monthlyTo9pm(); await B({ 'data-fstep': '2' }); const t = await txt(on('step')); return [/Class/.test(t) && !/No name yet/.test(t), t.replace(/\n/g, ' / ').slice(0, 220)];
}, 1);
probe('R-sim-s4-tile', 'small 4: the big Stats tile says "views, all your events"', async () => {
  await B({ 'data-tab-go': 'stats' }); const t = await txt('#s-stats .pair .stat'); return [/893/.test(t) && /all your events/.test(t), t.replace(/\n/g, ' / ')];
}, 1);
probe('R-sim-s6-taps', 'small 6: the Home title opens the event; the time line opens the date sheet; the event-page time line scrolls to Sessions', async () => {
  await B({ 'data-tab-go': 'home' }); await tap('#s-home .hero [data-open]'); const a = await ev(() => window.__c2.state().stack.join('>'));
  await fresh(); await B({ 'data-tab-go': 'home' }); await tap('#s-home .hero [data-homedate]'); const sh = await sheet();
  await fresh(); await open('fri'); await tap('[data-tosess]'); const y = await ev(() => Math.round(document.querySelector('#sess-h').getBoundingClientRect().top));
  return [/event$/.test(a) && /^Fri 23 Oct/.test(sh) && y < 300, a + ' | ' + sh.slice(0, 30) + ' | y=' + y];
}, 1);
probe('R-sim-s7-toasts', 'small 7: toasts name what changed: ticket link saved; cancel carries the reason', async () => {
  await open('sat'); await B({ 'data-edit': 'ticket', 'data-k': 'sat' }); await setVal('#tlink', 'https://tickets.example/sat-new'); await tap('#saveedit'); const t1 = await toastT();
  await fresh(); await open('sat'); await B({ 'data-date': '1' }); await B({ 'data-act': 'cancel' }); await tap('[data-scope-go]'); await tap('[data-reason]'); await tap('[data-docancel]'); const t2 = await toastT();
  return [/^Ticket link saved\. Dancers see it now\./.test(t1) && /^Sat 31 Oct cancelled: .*isn.t available\. Dancers see it now\./.test(t2), t1 + ' | ' + t2];
}, 1);
probe('R-sim-s8-return', 'small 8: after saving the ticket link the event page keeps the Ticket link row in view (not the top)', async () => {
  await open('sat'); await B({ 'data-edit': 'ticket', 'data-k': 'sat' }); await setVal('#tlink', 'https://tickets.example/sat-new'); await tap('#saveedit');
  const r = await ev(() => { const e = document.querySelector('#s-event [data-edit="ticket"]').getBoundingClientRect(); return [Math.round(e.top), Math.round(e.bottom), innerHeight, document.querySelector('#s-event').scrollTop]; });
  return [r[0] >= 0 && r[1] <= r[2] && r[3] > 0, r.join()];
}, 1);
probe('R-sim-s10-words', 'small 10: "Don’t cancel", "Add a class before", "52 nights since 2024"', async () => {
  await open('sat'); await B({ 'data-date': '1' }); await B({ 'data-act': 'cancel' }); await tap('[data-scope-go]'); const a = await sheet();
  await fresh(); await B({ 'data-flow': 'weekly' }); await B({ 'data-fstep': '2' }); const b = await txt(on('step'));
  await fresh(); await B({ 'data-tab-go': 'stats' }); const c = await txt(on('stats'));
  return [/Don.t cancel/.test(a) && !/Keep it/.test(a) && /Add a class before/.test(b) && /52 nights since 2024/.test(c) && !/Ran 52/.test(c), 'cancel:' + /Don.t cancel/.test(a) + ' before:' + /Add a class before/.test(b) + ' nights:' + /52 nights since 2024/.test(c)];
}, 1);
probe('R-sim-s11-order', 'small 11: "Different on N dates" lists the date just changed first', async () => {
  await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); await setVal('#ssname', 'Foo'); await tap('[data-sssave]'); await tap('[data-sscope-go]');
  const row = await txt(on('event') + ' [data-sess="' + c + '"]'); const m = row.match(/Different on (\d+) dates?: ([^\n]*)/);
  return [!!m && /^20 Nov/.test(m[2]), m ? m[0] : row.replace(/\n/g, ' / ').slice(0, 160)];
}, 1);

let pass = 0, fail = 0;
for (const p of P) {
  if (only.length && !only.includes(p.id)) continue;
  await fresh(); errors.length = 0;
  let ok = false, d = '';
  try { [ok, d] = await p.fn(); } catch (e) { d = 'THREW ' + String(e).slice(0, 120); }
  if (errors.length) { ok = false; d += ' | pageerror: ' + errors.join(';').slice(0, 120); }
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + p.id + (p.red ? ' [red-first]' : '') + ' ' + p.what + ' :: ' + d);
}
console.log(`\n${pass} pass, ${fail} fail, ${pass + fail} total`);
await browser.close();
