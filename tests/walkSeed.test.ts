// walk-seed (scripts/walk-seed.mjs): the mirrors of the app's command builders
// cannot drift, keys are stable, a present shape is skipped, and a dry run makes
// no network call.
import { describe, expect, it } from 'vitest';

import * as seed from '../scripts/walk-seed.mjs';
import * as app from '@/modules/organiser/shared/seriesCommands';
import { createSeriesCommand as appCreateSeriesCommand } from '@/modules/organiser/shared/selfServeApi';
import { addPerson, addSession, buildDays, updateItem, type PTree } from '@/modules/organiser/events/programmeSeriesModel';

const TODAY = '2026-10-27';
const throwingFetch = () => { throw new Error('dry run called fetch'); };

/** The same programme built the way the series editor builds it, then saved through buildDays. */
function appDays(items: Array<{ type: string; title: string; start?: string; end?: string; levels?: string[]; room?: string | null; people?: Array<{ profileId: string; profileType: string; role: string }> }>) {
  let tree: PTree = { days: [] };
  for (const it of items) {
    const added = addSession(tree, seed.SECTION_FOR_TYPE[it.type as 'class'], it.type);
    tree = updateItem(added.tree, added.key, { title: it.title, start: it.start ?? '', end: it.end ?? '', levels: it.levels ?? [], raw: it.room ? { room: it.room } : {} });
    for (const p of it.people ?? []) {
      tree = { days: tree.days.map((d) => ({ ...d, sections: d.sections.map((s) => ({ ...s, items: s.items.map((x) => (x.key === added.key ? addPerson(x, { id: p.profileId, name: 'x', profileType: p.profileType, role: p.role as 'teaching' }) : x)) })) })) };
    }
  }
  return buildDays(tree);
}

async function dryRun(argv: string[] = []) {
  const lines: string[] = [];
  const code = await seed.main({ argv: ['--today', TODAY, ...argv], fetchImpl: throwingFetch as unknown as typeof fetch, log: (l: string) => lines.push(l) });
  return { code, lines, envelopes: lines.filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)) };
}

describe('walk-seed mirrors the app builders', () => {
  it('envelope', () => {
    const cmd = app.addDateCommand('2026-11-03');
    expect(seed.envelope('s', 4, cmd, 'k')).toEqual(app.envelope('s', 4, cmd, 'k'));
    expect(seed.envelope('s', undefined, cmd, 'k')).toEqual(app.envelope('s', undefined, cmd, 'k'));
  });

  it('every command builder', () => {
    const draft = { name: ' WALK x ', format: 'recurring' as const, startDate: '2026-11-03', startTime: '19:00', durationMinutes: 240 };
    const appPayload = app.createPayload({ ...draft, description: '', venueId: null, ticketUrl: '', coverImageUrl: '' });
    expect(seed.createPayload(draft)).toEqual(appPayload);
    expect(seed.createSeriesCommand(seed.createPayload(draft), 'org')).toEqual(appCreateSeriesCommand(appPayload, 'org'));
    expect(seed.weeklyRuleCommand(2)).toEqual(app.weeklyRuleCommand(2));
    expect(seed.addDateCommand('2026-11-10')).toEqual(app.addDateCommand('2026-11-10'));
    expect(seed.skipDateCommand('o')).toEqual(app.skipDateCommand('o'));
    expect(seed.cancelCommand('Illness')).toEqual(app.cancelCommand('Illness'));
    expect(seed.setProgramCommand([])).toEqual(app.setProgramCommand([]));
    expect(seed.upsertCommand({ name: 'n', category: 'class', format: 'course' })).toEqual(app.upsertCommand({ name: 'n', category: 'class', format: 'course' }));
  });

  it('every command kind the seed sends is one the owner allowlist mirror admits', () => {
    const admitted = [...app.OWNER_COMMAND_KINDS, ...app.AW1_COMMAND_KINDS] as string[];
    for (const def of seed.SHAPES.filter((d) => !d.skip)) {
      const ctx = seed.dryContext(def.shape, TODAY);
      for (const st of seed.planShape(def, ctx)) expect(admitted).toContain(st.command(ctx).kind);
    }
  });

  it.each(seed.SHAPES.filter((d) => d.program).map((d) => [d.shape, d] as const))('programme of %s equals the editor save', (_s, def) => {
    const items = def.program(seed.dryContext(def.shape, TODAY));
    expect(seed.programDays(items)).toEqual(appDays(items));
  });

  it('weekly16 holds exactly 16 sessions, two in rooms; nameless-session one untitled', () => {
    const count = (shape: string) => {
      const def = seed.SHAPES.find((d) => d.shape === shape)!;
      return seed.programDays(def.program(seed.dryContext(shape, TODAY)))[0].sections.flatMap((s: { items: Array<{ room: string | null; title: string }> }) => s.items);
    };
    expect(count('weekly16')).toHaveLength(16);
    expect(count('weekly16').filter((i) => i.room)).toHaveLength(2);
    expect(count('nameless-session').map((i) => i.title)).toEqual(['']);
  });
});

describe('walk-seed keys and idempotency', () => {
  it('keys are stable per shape+step, distinct across them, and uuid-shaped', async () => {
    const a = await dryRun();
    const b = await dryRun();
    const keys = a.envelopes.map((e) => e.env.idempotency_key);
    expect(keys).toEqual(b.envelopes.map((e) => e.env.idempotency_key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(seed.idempotencyKey('weekly16', 'create')).toBe(seed.idempotencyKey('weekly16', 'create'));
    expect(seed.seriesIdFor('weekly16')).not.toBe(seed.seriesIdFor('course'));
  });

  it('a shape present by exact name is skipped, a near name is not', () => {
    const home = { organisers: [{ id: 'org', role: 'owner', series: [{ id: 's1', name: seed.shapeName('weekly16') }, { id: 's2', name: 'WALK course' }] }] };
    const { organiserId, names } = seed.readHome(home);
    expect(organiserId).toBe('org');
    const left = seed.shapesToCreate(seed.SHAPES, names).map((d) => d.shape);
    expect(left).not.toContain('weekly16');
    expect(left).toContain('course');
    expect(left).not.toContain('festival');
  });

  it('every name says draft, do not publish, and every create is a draft upsert (no lifecycle command)', async () => {
    const { envelopes } = await dryRun();
    for (const e of envelopes.filter((x) => x.step === 'create')) expect(e.env.command.payload.name).toMatch(/^WALK .+ \(draft, do not publish\)$/);
    expect(envelopes.some((e) => e.env.command.kind === 'series.set_lifecycle')).toBe(false);
  });
});

describe('walk-seed dry run', () => {
  it('prints every envelope and never calls fetch', async () => {
    const { code, lines, envelopes } = await dryRun();
    expect(code).toBe(0);
    expect(envelopes.length).toBeGreaterThan(0);
    expect(lines.at(-1)).toMatch(/no network call made/);
    expect(lines.some((l) => l.includes('festival: SKIPPED'))).toBe(true);
  });

  it('the per-shape counts the README states', async () => {
    const { lines } = await dryRun();
    const counts = JSON.parse(lines.at(-1)!.replace(/^.*made\. /, ''));
    expect(counts).toEqual({
      weekly16: 3, 'weekly-lineup': 3, 'oneoff-untimed': 2, 'oneoff-2dates': 2, course: 4,
      'weekly-cancelled-date': 4, 'weekly-30dates': 2, 'empty-sessions': 2, 'nameless-session': 3,
    });
  });

  it('--apply without readable credentials exits 2 and prints no secret', async () => {
    const lines: string[] = [];
    const code = await seed.main({
      argv: ['--apply', '--env-file', 'x'],
      fetchImpl: throwingFetch as unknown as typeof fetch,
      log: (l: string) => lines.push(l),
      readFile: () => 'WALK_TEST_EMAIL=a@b.c\nWALK_TEST_PASSWORD=hunter2\n',
    });
    expect(code).toBe(2);
    expect(lines.join('\n')).not.toContain('hunter2');
  });
});

describe('walk-seed --salt', () => {
  it('a salt changes every series id and key; no salt keeps them', async () => {
    const plain = await dryRun();
    const salted = await dryRun(['--salt', 'r2']);
    const ids = (r: typeof plain) => r.envelopes.map((e) => `${e.env.target_id}|${e.env.idempotency_key}`);
    expect(ids(salted).filter((x) => ids(plain).includes(x))).toEqual([]);
    expect(seed.seriesIdFor('weekly16')).toBe(seed.seriesIdFor('weekly16', ''));
  });
});
