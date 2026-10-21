// ER-C8: the event page's one model, table-driven over status x format x pending state.
import { describe, expect, it } from 'vitest';
import { changedFields, draftFromWorkspace, parseEventWorkspace, wsComing } from '../eventModel';
import {
  ENDED_LINE, applySessions, draftChecklist, isClosed, lastNightChoices, pageActions, pageCommands, paymentOf, payNudge, pendingParts,
  publishBlocker, scopeLine, sessionsOf, shouldPromptLeave, stopAfterCommand, updateLabel, type PageDraft,
} from '../eventPageModel';
import { parseTree, treeKey } from '../programmeSeriesModel';
import { TODAY, rawWorkspace } from './fixtures';

const item = (id: string, type: string, title: string, start: string, end: string, extra: Record<string, unknown> = {}) => ({
  item: { id, type, title, start_time: start, end_time: end, level_keys: [], ...extra }, people: [],
});
const PROGRAM = [{ day: { id: 'd1', day_index: 0 }, sections: [{ section: { id: 's1', kind: 'party' }, items: [item('i1', 'party', 'Party', '21:00', '23:30')] }] }];

function make(over: Record<string, unknown> = {}, occurrences?: unknown[], program: unknown = PROGRAM) {
  const raw = rawWorkspace(over, occurrences);
  (raw.series as { program: unknown }).program = program;
  const ws = parseEventWorkspace(raw);
  const tree = parseTree(ws.program);
  const base: PageDraft = { fields: draftFromWorkspace(ws, TODAY), payment: paymentOf(ws), sessions: sessionsOf(tree) };
  return { ws, tree, base };
}

const dateRows = (n: number, own = 0) => Array.from({ length: n }, (_, i) => ({
  id: `o${i}`, occurrence_date: `2026-11-${String(i + 1).padStart(2, '0')}`, lifecycle_status: 'scheduled', version: 1,
  ...(i < own ? { session_overrides_count: 1 } : {}),
}));

describe('the update button and its scope line', () => {
  it.each([['live', 'Update live event'], ['paused', 'Save changes'], ['draft', 'Save changes']])('%s -> %s', (status, label) => {
    expect(updateLabel(status)).toBe(label);
  });

  it.each([
    [14, 2, 'recurring', 'Updates 12 coming dates. 2 dates with their own changes keep them.'],
    [14, 1, 'recurring', 'Updates 13 coming dates. 1 date with its own changes keeps it.'],
    [5, 0, 'recurring', 'Updates 5 coming dates.'],
    [1, 0, 'recurring', 'Updates 1 coming date.'],
    [1, 0, 'one_off', 'Updates this date.'],
    [0, 0, 'recurring', null],
  ] as const)('%i coming, %i with own changes, %s', (coming, own, format, line) => {
    const { ws } = make({ format }, dateRows(coming, own));
    expect(scopeLine(ws, TODAY)).toBe(line);
  });

  it('a read cut at 100 dates does not claim a count', () => {
    const raw = rawWorkspace({}, dateRows(3));
    (raw as unknown as { meta: unknown }).meta = { has_more: true };
    expect(scopeLine(parseEventWorkspace(raw), TODAY)).toBe('Updates your coming dates.');
  });

  it('cancelled dates are not counted as coming', () => {
    const rows = [...dateRows(3), { id: 'x', occurrence_date: '2026-12-01', lifecycle_status: 'cancelled', version: 1 }];
    expect(wsComing(make({}, rows).ws, TODAY)).toHaveLength(3);
    expect(scopeLine(make({}, rows).ws, TODAY)).toBe('Updates 3 coming dates.');
  });
});

describe('what is pending, and what a save sends', () => {
  const same = (a: PageDraft, b: PageDraft, tree: ReturnType<typeof make>['tree']) => pendingParts(a, b, tree, changedFields);

  it.each(['draft', 'live', 'paused'])('%s: an untouched page has nothing pending and sends nothing', (status) => {
    const { ws, tree, base } = make({ lifecycle_status: status });
    expect(same(base, { ...base }, tree)).toEqual([]);
    expect(pageCommands(base, { ...base, fields: { ...base.fields }, sessions: sessionsOf(tree) }, ws, TODAY, tree)).toEqual([]);
  });

  it('a draft built from the stored sessions leaves the stored tree byte-identical', () => {
    const { tree, base } = make();
    expect(treeKey(applySessions(tree, base.sessions))).toBe(treeKey(tree));
  });

  it('a rename sends ONE upsert with the name only', () => {
    const { ws, tree, base } = make();
    const draft = { ...base, fields: { ...base.fields, name: 'Friday Social' } };
    expect(same(base, draft, tree)).toEqual(['fields']);
    expect(pageCommands(base, draft, ws, TODAY, tree)).toEqual([{ kind: 'series.upsert', payload: { name: 'Friday Social' } }]);
  });

  it('how to pay rides in the same upsert as another changed field, and alone otherwise', () => {
    const { ws, tree, base } = make({ default_ticket_url: null });
    const both = { ...base, payment: ['door', 'cash'] as PageDraft['payment'], fields: { ...base.fields, description: 'Hi' } };
    expect(pageCommands(base, both, ws, TODAY, tree)).toEqual([
      { kind: 'series.upsert', payload: { name: 'Friday Party', default_description: 'Hi', payment_methods: 'door,cash' } },
    ]);
    const alone = { ...base, payment: ['free'] as PageDraft['payment'] };
    expect(same(base, alone, tree)).toEqual(['payment']);
    expect(pageCommands(base, alone, ws, TODAY, tree)).toEqual([{ kind: 'series.upsert', payload: { name: 'Friday Party', payment_methods: 'free' } }]);
  });

  it('clearing every way to pay sends null, not an empty string', () => {
    const { ws, tree, base } = make({ payment_methods: 'cash' });
    expect(base.payment).toEqual(['cash']);
    expect(pageCommands(base, { ...base, payment: [] }, ws, TODAY, tree)[0].payload.payment_methods).toBeNull();
  });

  it('a changed session end sends ONE set_program; nothing else', () => {
    const { ws, tree, base } = make();
    const sessions = base.sessions.map((s) => ({ ...s, end: '00:00' }));
    const cmds = pageCommands(base, { ...base, sessions }, ws, TODAY, tree);
    expect(cmds.map((c) => c.kind)).toEqual(['series.set_program']);
    expect(same(base, { ...base, sessions }, tree)).toEqual(['sessions']);
  });

  it('a removed session goes, a new session is added (type from its kind)', () => {
    const { tree, base } = make();
    const gone = applySessions(tree, []);
    expect(sessionsOf(gone)).toHaveLength(0);
    const added = applySessions(tree, [...base.sessions, { ...base.sessions[0], id: 'new:1', kind: 'class', name: 'Beginners', start: '20:00', end: '21:00' }]);
    expect(sessionsOf(added).map((s) => s.kind).sort()).toEqual(['class', 'party']);
  });

  it.each(['ended', 'archived'])('%s takes no command at all', (status) => {
    const { ws, tree, base } = make({ lifecycle_status: status });
    expect(isClosed(status)).toBe(true);
    expect(pageCommands(base, { ...base, fields: { ...base.fields, name: 'X' } }, ws, TODAY, tree)).toEqual([]);
  });

  it.each([
    [[], false, false],
    [['fields'], false, true],
    [['sessions', 'payment'], false, true],
    [['fields'], true, false],
  ] as const)('leave prompt: pending %j busy %s -> %s', (pending, busy, prompt) => {
    expect(shouldPromptLeave(pending as never, busy)).toBe(prompt);
  });
});

describe('the quiet actions under the page: status x format x who', () => {
  it.each([
    ['draft', 'recurring', true, ['delete']],
    ['draft', 'one_off', true, ['delete']],
    ['live', 'recurring', true, ['pause', 'stop']],
    ['live', 'one_off', false, ['pause', 'end']],
    ['live', 'course', true, ['pause', 'end']],
    ['live', 'festival', false, ['pause', 'end']],
    ['paused', 'recurring', true, ['end']],
    ['ended', 'recurring', true, []],
    ['archived', 'one_off', false, []],
  ] as const)('owner, %s %s repeats=%s', (status, format, repeats, expected) => {
    expect(pageActions(status, format, repeats, true)).toEqual(expected);
  });

  it('a live event is never deleted; only a draft is', () => {
    for (const status of ['live', 'paused', 'ended', 'archived']) expect(pageActions(status, 'recurring', true, true)).not.toContain('delete');
    expect(pageActions('draft', 'recurring', false, true)).toContain('delete');
  });

  it('a co-organiser never gets End, Stop repeating or Delete draft', () => {
    for (const status of ['draft', 'live', 'paused']) {
      const a = pageActions(status, 'recurring', true, false);
      for (const owner of ['end', 'stop', 'delete'] as const) expect(a).not.toContain(owner);
    }
  });

  it('Stop repeating asks for the last night: every coming date up to it stays', () => {
    const { ws } = make({}, dateRows(5));
    expect(lastNightChoices(ws, TODAY)).toHaveLength(5);
    expect(stopAfterCommand(ws, TODAY, '2026-11-03')).toEqual({ kind: 'series.stop_repeating', payload: { keep_occurrence_ids: ['o0', 'o1', 'o2'] } });
  });

  it('an ended event says it cannot be changed', () => {
    expect(ENDED_LINE).toBe('Ended events cannot be changed.');
  });
});

describe('the draft checklist and the pay nudge', () => {
  it('a bare draft lists what is missing, in order, and Publish is blocked by the first', () => {
    const { ws, tree } = make({ lifecycle_status: 'draft', default_venue_id: null, default_ticket_url: null }, [], []);
    const items = draftChecklist(ws, TODAY, tree);
    expect(items.map((i) => [i.key, i.done])).toEqual([['venue', false], ['date', false], ['session', false], ['flyer', false], ['pay', false]]);
    expect(publishBlocker(items)?.fix).toBe('Pick a venue');
  });

  it('a complete draft has no blocker', () => {
    const { ws, tree } = make({ lifecycle_status: 'draft', default_ticket_url: 'https://t.example/x', default_cover_image_url: 'https://cdn.example/f.webp', payment_methods: 'ticket_link' });
    expect(publishBlocker(draftChecklist(ws, TODAY, tree))).toBeNull();
  });

  it('a session with an end that is not after its start blocks (session item)', () => {
    const bad = [{ day: { id: 'd1' }, sections: [{ section: { id: 's1', kind: 'party' }, items: [item('i1', 'party', 'Party', '21:00', '21:00')] }] }];
    const { ws, tree } = make({ lifecycle_status: 'draft', default_ticket_url: 'https://t.example/x', default_cover_image_url: 'https://cdn.example/f.webp' }, undefined, bad);
    expect(draftChecklist(ws, TODAY, tree).find((i) => i.key === 'session')?.done).toBe(false);
  });

  it.each([
    ['live', null, null, 'Add how to pay'],
    ['live', 'https://t.example/x', null, null],
    ['live', null, 'door', null],
    ['paused', null, null, null],
    ['draft', null, null, null],
    ['ended', null, null, null],
  ] as const)('%s, ticket %s, payment %s -> nudge %s', (status, ticket, payment, nudge) => {
    const { ws } = make({ lifecycle_status: status, default_ticket_url: ticket, payment_methods: payment });
    expect(payNudge(ws)).toBe(nudge);
  });

  it('a stored ticket link counts as the ticket-link way to pay until the owner picks', () => {
    expect(paymentOf(make({ default_ticket_url: 'https://t.example/x' }).ws)).toEqual(['ticket_link']);
    expect(paymentOf(make({ default_ticket_url: 'https://t.example/x', payment_methods: 'door,cash' }).ws)).toEqual(['door', 'cash']);
  });
});
