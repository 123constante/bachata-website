import { describe, expect, it } from 'vitest';
import { parseEventWorkspace, type EventWorkspace } from '../../../events/eventModel';
import { LINK_PROBLEM } from '../../../shared/linkRules';
import { SHAPES, wsRaw } from '../../screens/__tests__/wsFixtures';
import { L } from '../../model/labels';
import { attemptFor, changedElsewhere, pendingLines, saveButton, stepLanded } from '../../model/saveModel';
import { DETAILS_SPECS, detailsBlocker, detailsDraftOf, detailsPlan, instagramToSend, type DetailsDraft } from '../details';
import { PRICES_SPECS, payChoices, pricesBlocker, pricesDraftOf, pricesLockOf, pricesPlan, setFree, type PricesDraft } from '../prices';

/*
 * W3a matrix: every lifecycle x kind shape the prod survey met (2026-10-27, counts only) x every
 * field x {untouched, one field, several, invalid URL, long description, passes invalid}. Each
 * row pins the EXACT commands a save sends, or none.
 */

const ws = (raw: unknown): EventWorkspace => parseEventWorkspace(raw);
const UUID1 = '11111111-1111-4111-8111-111111111111';
const UUID2 = '22222222-2222-4222-8222-222222222222';
const LONG = 'x'.repeat(5662); // the longest stored description on prod (a live festival)

/** The shapes: prod lifecycle x kind, plus the field shapes the survey counted. */
const DETAIL_SHAPES: Record<string, EventWorkspace> = {
  'live weekly': ws(SHAPES.weekly),
  'paused weekly': ws(SHAPES.paused),
  'draft one-off, empty': ws(SHAPES.draft),
  'draft ready': ws(SHAPES.draftReady),
  'live one-off': ws(SHAPES.oneoff),
  'live festival, long description': ws(wsRaw({ name: 'Winter Festival', format: 'festival', default_description: LONG, recurrence_rule: null }, [], [])),
  'live course': ws(SHAPES.course),
  'stored ticket link breaks the rule': ws(wsRaw({ default_ticket_url: 'www.tickets.example.test/x y' }, [], [])),
  'chat link set, videos set': ws(wsRaw({ group_chat_url: 'https://chat.whatsapp.com/abc', video_urls: ['https://youtu.be/a'] }, [], [])),
  'no venue (draft)': ws(wsRaw({ default_venue_id: null, lifecycle_status: 'draft' }, [], [])),
};

type Edit = { name: string; patch: Partial<DetailsDraft>; send: (w: EventWorkspace) => unknown[] | null; why?: string };
const nameOf = (w: EventWorkspace) => w.series.name.trim();
const up = (w: EventWorkspace, p: Record<string, unknown>, name = nameOf(w)) => ({ kind: 'series.upsert', payload: { name, ...p } });

const EDITS: Edit[] = [
  { name: 'untouched', patch: {}, send: () => [] },
  { name: 'name', patch: { name: 'Friday Social' }, send: (w) => [up(w, {}, 'Friday Social')] },
  { name: 'about', patch: { description: 'No partner needed.' }, send: (w) => [up(w, { default_description: 'No partner needed.' })] },
  { name: 'music', patch: { music: ['Salsa'] }, send: (w) => [up(w, { default_music_styles: ['Salsa'] })] },
  { name: 'ticket', patch: { ticket: ' https://t.example.test/new ' }, send: (w) => [up(w, { default_ticket_url: 'https://t.example.test/new' })] },
  { name: 'ticket cleared', patch: { ticket: '' }, send: (w) => (w.series.default_ticket_url ? [up(w, { default_ticket_url: '' })] : []) },
  { name: 'cover', patch: { cover: 'https://cdn.example.test/c.webp' }, send: (w) => [up(w, { default_cover_image_url: 'https://cdn.example.test/c.webp' })] },
  { name: 'instagram handle', patch: { instagram: '@ritmoleeds' }, send: (w) => [up(w, { instagram_url: 'https://www.instagram.com/ritmoleeds' })] },
  { name: 'videos', patch: { videos: 'https://youtu.be/b\n\n' }, send: (w) => [up(w, { default_video_urls: ['https://youtu.be/b'] })] },
  { name: 'chat link', patch: { chat: 'https://chat.whatsapp.com/new' }, send: () => [{ kind: 'series.set_group_chat', payload: { url: 'https://chat.whatsapp.com/new' } }] },
  {
    name: 'several (name, about, chat)', patch: { name: 'Friday Social', description: 'Hi', chat: 'https://chat.whatsapp.com/z' },
    send: () => [up({ series: { name: '' } } as EventWorkspace, { default_description: 'Hi' }, 'Friday Social'), { kind: 'series.set_group_chat', payload: { url: 'https://chat.whatsapp.com/z' } }],
  },
  { name: 'invalid ticket URL', patch: { ticket: 'tickets please' }, send: () => null, why: LINK_PROBLEM.ticket },
  { name: 'http chat link', patch: { chat: 'http://chat.whatsapp.com/x' }, send: () => null, why: L.detailsChatBad },
  { name: 'invalid video', patch: { videos: 'youtube' }, send: () => null, why: LINK_PROBLEM.video },
  { name: 'eleven videos', patch: { videos: Array.from({ length: 11 }, (_, i) => `https://youtu.be/${i}`).join('\n') }, send: () => null, why: L.detailsTooManyVideos(10) },
  { name: 'long description', patch: { description: LONG }, send: () => null, why: L.detailsTooLong(4000) },
  { name: 'blank name', patch: { name: '   ' }, send: () => null, why: L.detailsNameNeeded },
];

describe('Name and details: shape x edit -> the exact commands', () => {
  for (const [shape, w] of Object.entries(DETAIL_SHAPES)) {
    for (const e of EDITS) {
      it(`${shape} | ${e.name}`, () => {
        const base = detailsDraftOf(w);
        const draft = { ...base, ...e.patch };
        const plan = detailsPlan(base, draft);
        const blocker = detailsBlocker(base, draft);
        const lines = pendingLines(DETAILS_SPECS, base, draft);
        // a draft with no name yet: any change still needs one (the handler requires it on every upsert)
        if (!nameOf(w) && e.name !== 'name' && e.name !== 'several (name, about, chat)' && lines.length) {
          expect(blocker).toBe(L.detailsNameNeeded);
          expect(plan).toEqual([]);
          return;
        }
        // an edit that equals what is stored is no change: nothing is pending, nothing goes
        const expected = e.send(w);
        if (expected === null) {
          if (lines.length) expect(blocker).toBe(e.why);
          expect(plan).toEqual([]);
          return;
        }
        if (e.name === 'several (name, about, chat)') {
          expect(plan).toEqual(w.series.default_description === 'Hi' ? [expected[0], expected[1]] : expected);
        } else if (!lines.length) {
          expect(plan).toEqual([]);
        } else {
          expect(blocker).toBeNull();
          expect(plan).toEqual(expected);
        }
        // the untouched save sends NOTHING and the button says so
        if (e.name === 'untouched') {
          expect(lines).toEqual([]);
          expect(saveButton({ changed: 0, problem: null, lock: null, busy: false, labels: { save: L.saveAll, nothing: L.nothingChanged } }))
            .toEqual({ label: L.nothingChanged, enabled: false, why: null });
        }
      });
    }
  }

  it('a stored link that breaks the rule never blocks saving another field, and is never resent', () => {
    const w = DETAIL_SHAPES['stored ticket link breaks the rule'];
    const base = detailsDraftOf(w);
    expect(detailsPlan(base, { ...base, name: 'New name' })).toEqual([up(w, {}, 'New name')]);
  });

  it('a long stored description stays as it is when only the name changes', () => {
    const w = DETAIL_SHAPES['live festival, long description'];
    const base = detailsDraftOf(w);
    expect(detailsPlan(base, { ...base, name: 'Winter Fest' })).toEqual([up(w, {}, 'Winter Fest')]);
  });

  it('a new place carries its city; a place cannot be cleared', () => {
    const w = DETAIL_SHAPES['live weekly'];
    const base = detailsDraftOf(w);
    expect(detailsPlan(base, { ...base, venueId: 'v2' }, 'city-9')).toEqual([up(w, { default_venue_id: 'v2', default_city_id: 'city-9' })]);
    expect(detailsPlan(base, { ...base, venueId: 'v2' }, null)).toEqual([up(w, { default_venue_id: 'v2' })]);
    expect(detailsBlocker(base, { ...base, venueId: null })).toBe(L.detailsWhereNeeded);
  });

  it('clearing the chat link sends url null', () => {
    const w = DETAIL_SHAPES['chat link set, videos set'];
    const base = detailsDraftOf(w);
    expect(base.chat).toBe('https://chat.whatsapp.com/abc');
    expect(detailsPlan(base, { ...base, chat: ' ' })).toEqual([{ kind: 'series.set_group_chat', payload: { url: null } }]);
  });

  it('Instagram: a link goes as typed, a handle becomes its address, blank clears', () => {
    expect(instagramToSend('https://instagram.com/x')).toBe('https://instagram.com/x');
    expect(instagramToSend('instagram.com/x')).toBe('https://instagram.com/x');
    expect(instagramToSend('ritmo.leeds')).toBe('https://www.instagram.com/ritmo.leeds');
    expect(instagramToSend('  ')).toBe('');
  });

  it('the tray names each change once, in screen order', () => {
    const base = detailsDraftOf(DETAIL_SHAPES['live weekly']);
    expect(pendingLines(DETAILS_SPECS, base, { ...base, chat: 'https://chat.whatsapp.com/q', name: 'X' }))
      .toEqual([`${L.detailsName}: X`, L.detailsChat]);
    // typing a value back to what is stored is no change
    expect(pendingLines(DETAILS_SPECS, base, { ...base, name: `${base.name} ` })).toEqual([]);
  });
});

const p = (id: string, name: string, price: number | string | null, extra: Record<string, unknown> = {}) => ({ id, name, price, currency: 'GBP', ...extra });
const PRICE_SHAPES: Record<string, { w: EventWorkspace; locked: boolean }> = {
  'no list (758 prod rows: [] or null)': { w: ws(wsRaw({ passes: [] }, [], [])), locked: false },
  'owner list': { w: ws(wsRaw({ passes: [p(UUID1, 'Class and party', 15), p(UUID2, 'Party only', 10)] }, [], [])), locked: false },
  'team list (all 7 prod lists)': { w: ws(wsRaw({ passes: [p(UUID1, 'Early bird', 30, { tier: 1, quantity: 50 })] }, [], [])), locked: true },
  'string price (1 prod list)': { w: ws(wsRaw({ passes: [p(UUID1, 'Full pass', '45.00')] }, [], [])), locked: true },
  'eleven prices': { w: ws(wsRaw({ passes: Array.from({ length: 11 }, (_, i) => p(`${UUID1.slice(0, -2)}${String(i).padStart(2, '0')}`, `P${i}`, i)) }, [], [])), locked: true },
  festival: { w: ws(wsRaw({ format: 'festival', recurrence_rule: null, passes: [], payment_methods: 'ticket_link,door' }, [], [])), locked: false },
  'ended weekly': { w: ws(wsRaw({ lifecycle_status: 'ended', passes: [] }, [], [])), locked: false },
};

describe('Prices: shape x edit -> the exact command', () => {
  for (const [shape, { w, locked }] of Object.entries(PRICE_SHAPES)) {
    const base = pricesDraftOf(w);
    const plan = (d: PricesDraft) => pricesPlan(w, base, d);
    it(`${shape} | untouched sends nothing`, () => {
      expect(plan(base)).toEqual([]);
      expect(pendingLines(PRICES_SPECS, base, base)).toEqual([]);
    });
    it(`${shape} | the lock is ${locked ? 'shown with what to do' : 'off'}`, () => {
      expect(!!pricesLockOf(w)).toBe(locked);
      if (locked) expect(pricesLockOf(w)).toMatch(/Ask the Bachata Calendar team/);
    });
    it(`${shape} | how to pay changes alone`, () => {
      const pick = payChoices(w)[0];
      const draft = { ...base, methods: base.methods.includes(pick) ? base.methods.filter((m) => m !== pick) : [...base.methods, pick] };
      const sent = plan(draft);
      expect(sent).toHaveLength(1);
      expect(Object.keys(sent[0].payload).sort()).toEqual(['name', 'payment_methods']);
    });
    if (!locked) {
      it(`${shape} | one new price goes with the whole list`, () => {
        const row = { id: UUID2.replace('2222-4', '3333-4'), name: 'Door', price: '12.50', currency: 'GBP' as const };
        const sent = plan({ ...base, rows: [...base.rows, row] });
        expect(sent).toHaveLength(1);
        expect((sent[0].payload.default_passes as unknown[]).at(-1)).toEqual({ id: row.id, name: 'Door', price: 12.5, currency: 'GBP' });
      });
      it(`${shape} | a price row with no name or a bad price blocks the save with the reason`, () => {
        const noName = { ...base, rows: [...base.rows, { id: UUID2, name: '', price: '5', currency: 'GBP' as const }] };
        expect(pricesBlocker(base, noName)).toBe('Give every price a name');
        expect(plan(noName)).toEqual([]);
        const bad = { ...base, rows: [...base.rows, { id: UUID2, name: 'X', price: '12.345', currency: 'GBP' as const }] };
        expect(pricesBlocker(base, bad)).toBe('Use a price like 12 or 12.50');
      });
    }
  }

  it('"It\'s free" is the free payment code, and a festival never offers it', () => {
    const w = PRICE_SHAPES['no list (758 prod rows: [] or null)'].w;
    const base = pricesDraftOf(w);
    expect(pricesPlan(w, base, setFree(base, true))).toEqual([{ kind: 'series.upsert', payload: { name: 'Sensual Fridays', payment_methods: 'free' } }]);
    expect(payChoices(PRICE_SHAPES.festival.w)).toEqual(['ticket_link']);
  });

  it('a locked list is never resent when how to pay changes', () => {
    const w = PRICE_SHAPES['team list (all 7 prod lists)'].w;
    const base = pricesDraftOf(w);
    expect(base.rows).toEqual([]);
    const sent = pricesPlan(w, base, { ...base, methods: ['door'] });
    expect(sent[0].payload).toEqual({ name: 'Sensual Fridays', payment_methods: 'door' });
  });
});

describe('the save model: one key per command, a retry is the same write', () => {
  const plan = [{ kind: 'series.upsert' as const, payload: { name: 'A' } }, { kind: 'series.set_group_chat' as const, payload: { url: null } }];
  let n = 0;
  const key = () => `k${(n += 1)}`;
  it('a retry of the same plan keeps every key and version, and skips a step that landed', () => {
    const a = attemptFor(null, plan, 7, key);
    expect(a.steps.map((s) => [s.key, s.version])).toEqual([['k1', 7], ['k2', null]]);
    const landed = stepLanded(a, 0, 8);
    expect(landed.steps[1].version).toBe(8);
    const retry = attemptFor(landed, plan, 9, key);
    expect(retry).toBe(landed);
    expect(retry.done).toBe(1);
  });
  it('a different plan is a fresh attempt with fresh keys', () => {
    const a = attemptFor(null, plan, 7, key);
    const b = attemptFor(a, [plan[0]], 7, key);
    expect(b.steps[0].key).not.toBe(a.steps[0].key);
  });
  it('someone else\'s version is "changed elsewhere"; this screen\'s own is not', () => {
    expect(changedElsewhere(7, 7, new Set())).toBe(false);
    expect(changedElsewhere(7, 8, new Set([8]))).toBe(false);
    expect(changedElsewhere(7, 9, new Set([8]))).toBe(true);
  });
  it('the Save button: a lock wins, then nothing changed, then the problem', () => {
    const labels = { save: 'Save', nothing: 'Nothing' };
    expect(saveButton({ changed: 2, problem: 'P', lock: 'Locked', busy: false, labels })).toEqual({ label: 'Nothing', enabled: false, why: 'Locked' });
    expect(saveButton({ changed: 2, problem: 'P', lock: null, busy: false, labels })).toEqual({ label: 'Save', enabled: false, why: 'P' });
    expect(saveButton({ changed: 2, problem: null, lock: null, busy: true, labels }).enabled).toBe(false);
    expect(saveButton({ changed: 2, problem: null, lock: null, busy: false, labels }).enabled).toBe(true);
  });
});
