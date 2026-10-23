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
probe('F13', '#13 event page: status row + Pause this event under the hero', async () => {
  await open('fri'); const t = await txt(on('event') + ' .ev2 > div:first-child'); return [/Live · Pause or end it/.test(t) && /Pause this event/.test(t), t.slice(0, 200).replace(/\n/g, ' / ')];
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
probe('#10', 'keyboard: bars hide while typing', async () => { await B({ 'data-tab-go': 'home' }); await tap('[data-lineup-next]'); await page.focus('#psearch'); const r = await ev(() => [getComputedStyle(document.querySelector('#bb')).display, getComputedStyle(document.querySelector('#tabs')).display]); return [r[0] === 'none' && r[1] === 'none', r.join()]; });
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
probe('S8', 'later applies forward only', async () => { await open('fri'); const c = await sid('fri', 0); await B({ 'data-date': '4' }); await B({ 'data-dsess': c }); await setVal('#sss', '20:15'); await tap('[data-sssave]'); await tap('[data-sscope="later"]'); await tap('[data-sscope-go]'); const r = await ev((c) => window.__c2.EV.fri.dates.map((x) => (x.so && x.so[c] && x.so[c].s) || ''), c); return [r[3] === '' && r[4] === '20:15' && r[6] === '20:15' && r[0] === '', r.slice(0, 7).join(',')]; });
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
