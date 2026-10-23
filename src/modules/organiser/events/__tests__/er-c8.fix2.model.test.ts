// ER-FIX2-S5: the event page's model after the audit (EP-1, EP-2, EP-3, EP-6, EP-7, EP-13).
import { describe, expect, it } from 'vitest';
import { changedFields, draftFromWorkspace, parseEventWorkspace } from '../eventModel';
import * as model from '../eventPageModel';
import { OWNER_CREATE_KEYS, OWNER_UPSERT_KEYS } from '@/modules/organiser/shared/seriesCommands';
import { parseTree } from '../programmeSeriesModel';
import { TODAY, rawWorkspace } from './fixtures';

const { draftChecklist, pageActions, paymentOf, pendingParts, publishBlocker, sessionsOf } = model;
type PageDraft = model.PageDraft;

const item = (id: string, start: string, end: string) => ({ item: { id, type: 'party', title: 'Party', start_time: start, end_time: end, level_keys: [] }, people: [] });
const PROGRAM = [{ day: { id: 'd1', day_index: 0 }, sections: [{ section: { id: 's1', kind: 'party' }, items: [item('i1', '21:00', '23:30')] }] }];
const dateRows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, occurrence_date: `2026-11-${String(i + 1).padStart(2, '0')}`, lifecycle_status: 'scheduled', version: 1 }));

function make(over: Record<string, unknown> = {}, occurrences: unknown[] = dateRows(3)) {
  const raw = rawWorkspace(over, occurrences);
  (raw.series as { program: unknown }).program = PROGRAM;
  const ws = parseEventWorkspace(raw);
  const tree = parseTree(ws.program);
  const base: PageDraft = { fields: draftFromWorkspace(ws, TODAY), payment: paymentOf(ws), sessions: sessionsOf(tree) };
  return { ws, tree, base };
}

describe('EP-1: everyone on the event gets the same actions (owner decision 4)', () => {
  it.each([
    ['draft', 'recurring', true, ['delete']],
    ['live', 'recurring', true, ['pause', 'stop']],
    ['live', 'one_off', false, ['pause', 'end']],
    ['live', 'course', true, ['pause', 'end']],
    ['paused', 'recurring', true, ['end']],
    ['ended', 'recurring', true, []],
  ] as const)('%s %s repeats=%s', (status, format, repeats, expected) => {
    // No owner argument: the screen never asks who is looking.
    expect((pageActions as (...a: unknown[]) => unknown)(status, format, repeats)).toEqual(expected);
  });
});

describe('EP-2: a refetch rebases the draft instead of throwing it away', () => {
  it('a field the person changed survives a new base; untouched fields take the new base', () => {
    const { base } = make();
    const draft: PageDraft = { ...base, fields: { ...base.fields, name: 'My rename' } };
    const fresh: PageDraft = { ...base, fields: { ...base.fields, description: 'Someone else wrote this' } };
    const next = model.rebaseDraft(base, fresh, draft);
    expect(next.fields.name).toBe('My rename');
    expect(next.fields.description).toBe('Someone else wrote this');
  });

  it('a half-failed save: the part that landed drops out of pending, the part that failed stays', () => {
    const { base, tree } = make();
    const draft: PageDraft = { ...base, fields: { ...base.fields, name: 'Saved name' }, payment: ['cash'] };
    // Command 1 (the name) landed; the payment did not.
    const fresh: PageDraft = { ...base, fields: { ...base.fields, name: 'Saved name' } };
    const next = model.rebaseDraft(base, fresh, draft);
    expect(next.payment).toEqual(['cash']);
    expect(pendingParts(fresh, next, tree, changedFields)).toEqual(['payment']);
  });

  it('nothing pending: the draft is the new base', () => {
    const { base } = make();
    const fresh: PageDraft = { ...base, payment: ['door'] };
    expect(model.rebaseDraft(base, fresh, base)).toEqual(fresh);
  });
});

describe('EP-3: a ticket link picked as the way to pay needs the link', () => {
  it.each([
    [['ticket_link'], '', 'Add the ticket link'],
    [['ticket_link'], 'not a link', 'Add the ticket link'],
    [['ticket_link'], 'https://t.example/x', null],
    [['cash'], '', null],
  ] as const)('pay %j url %j -> %s', (payment, url, expected) => {
    const { base } = make();
    expect(model.ticketGap({ ...base, payment: [...payment], fields: { ...base.fields, ticketUrl: url } })).toBe(expected);
  });
});

describe('EP-6: payment_methods is an owner upsert key', () => {
  it('in the upsert and the create keys', () => {
    expect(OWNER_UPSERT_KEYS as readonly string[]).toContain('payment_methods');
    expect(OWNER_CREATE_KEYS as readonly string[]).toContain('payment_methods');
  });
});

describe('EP-7: one-off says Cancel the event and is off until the server command lands', () => {
  it.each([
    ['one_off', 'Cancel the event', 'Not available yet'],
    ['recurring', 'End event', null],
    ['course', 'End event', null],
    ['festival', 'End event', null],
  ] as const)('%s', (format, label, off) => {
    expect(model.endLabel(format)).toBe(label);
    expect(model.endOffReason(format)).toBe(off);
  });
});

describe('EP-13: the checklist also reads the server go-live check', () => {
  const ready = () => make({ lifecycle_status: 'draft', default_ticket_url: 'https://t.example/x', default_cover_image_url: 'https://cdn.example/f.webp', payment_methods: 'ticket_link' });

  it('no server answer yet: the client rule alone (offline fallback)', () => {
    const { ws, tree } = ready();
    expect(publishBlocker(draftChecklist(ws, TODAY, tree))).toBeNull();
  });

  it.each([
    ['no_flyer', 'flyer'],
    ['cover', 'flyer'],
    ['venue', 'venue'],
    ['upcoming_date', 'date'],
    ['no_session_first_date', 'session'],
    ['bad_session_times', 'session'],
    ['no_payment', 'pay'],
  ])('server code %s turns the %s row undone', (code, key) => {
    const { ws, tree } = ready();
    const items = draftChecklist(ws, TODAY, tree, [code]);
    expect(items.find((i) => i.key === key)?.done).toBe(false);
    expect(publishBlocker(items)?.key).toBe(key);
  });

  it('a code with no row of its own still blocks Publish, in plain words', () => {
    const { ws, tree } = ready();
    const items = draftChecklist(ws, TODAY, tree, ['description']);
    expect(publishBlocker(items)?.fix).toBe('Write a description');
    expect(publishBlocker(draftChecklist(ws, TODAY, tree, ['something_new']))?.fix).toBe('Something else on the event');
  });

  it('an empty server list keeps the client rows (union, never looser)', () => {
    const { ws, tree } = make({ lifecycle_status: 'draft', default_venue_id: null });
    expect(publishBlocker(draftChecklist(ws, TODAY, tree, []))?.key).toBe('venue');
  });
});
