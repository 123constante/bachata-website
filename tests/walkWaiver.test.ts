// Slice 10 Part A: the owner-only `walk-waived` record (contract 11 item 4,
// drill B5). Removal of a bot label is cleanup; the control is this validator.
import { describe, it, expect } from 'vitest';
import { WAIVER_LABEL, parseWaiver, waiverValid, main } from '../scripts/lib/walk-waiver.mjs';

const HEAD = 'd'.repeat(40);
const CTX = { pinnedHeadSha: HEAD, ownerLogin: 'owner-login', registeredAutomationLogins: ['claude[bot]', 'automation-bot'] };
const rec = (over: Record<string, unknown> = {}) => ({
  label: 'walk-waived',
  appliedBy: 'owner-login',
  eventActor: 'owner-login',
  headSha: HEAD,
  readAtMergeTime: true,
  reason: 'screen is retired next release',
  ...over,
});

describe('walk-waiver', () => {
  it('label constant', () => expect(WAIVER_LABEL).toBe('walk-waived'));

  const rows: [string, unknown, Record<string, unknown> | undefined, boolean][] = [
    ['owner ok', rec(), undefined, true],
    ['owner ok, login case differs', rec({ eventActor: 'Owner-Login', appliedBy: 'Owner-Login' }), undefined, true],
    ['bot applied (B5), label still standing', rec({ eventActor: 'claude[bot]', appliedBy: 'claude[bot]' }), undefined, false],
    ['another human', rec({ eventActor: 'someone-else', appliedBy: 'someone-else' }), undefined, false],
    ['appliedBy claims owner, event actor is a bot', rec({ eventActor: 'automation-bot' }), undefined, false],
    ['stale head', rec({ headSha: 'e'.repeat(40) }), undefined, false],
    ['malformed head', rec({ headSha: 'abc' }), { ...CTX, pinnedHeadSha: 'abc' }, false],
    ['missing actor', rec({ eventActor: undefined }), undefined, false],
    ['blank actor', rec({ eventActor: '  ' }), undefined, false],
    ['not read at merge time', rec({ readAtMergeTime: false }), undefined, false],
    ['readAtMergeTime truthy string', rec({ readAtMergeTime: 'true' }), undefined, false],
    ['wrong label', rec({ label: 'walk-waiver' }), undefined, false],
    ['no reason', rec({ reason: '' }), undefined, false],
    ['A36: automation login equal to owner login', rec(), { ...CTX, registeredAutomationLogins: ['owner-login'] }, false],
    ['A36: case-folded collision', rec(), { ...CTX, registeredAutomationLogins: ['OWNER-LOGIN'] }, false],
    ['missing owner in context', rec(), { ...CTX, ownerLogin: '' }, false],
    ['missing automation list', rec(), { pinnedHeadSha: HEAD, ownerLogin: 'owner-login' }, false],
    ['missing pinned head', rec(), { ...CTX, pinnedHeadSha: undefined }, false],
    ['null record', null, undefined, false],
    ['string record', 'walk-waived', undefined, false],
  ];
  it.each(rows)('%s -> %s', (_n, record, ctx, want) => {
    const r = waiverValid(record, ctx === undefined ? CTX : ctx);
    expect(r.valid).toBe(want);
    if (!want) expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('no context at all -> invalid', () => expect(waiverValid(rec(), undefined as never).valid).toBe(false));

  it('parseWaiver normalises and reports errors', () => {
    expect(parseWaiver(rec()).ok).toBe(true);
    expect(parseWaiver(rec()).waiver.eventActor).toBe('owner-login');
    const bad = parseWaiver({ label: 'x' });
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(2);
  });

  it('main: exit 0 valid, 1 invalid, 2 usage', () => {
    const files: Record<string, string> = {
      'r.json': JSON.stringify(rec()),
      'b.json': JSON.stringify(rec({ eventActor: 'claude[bot]' })),
      'c.json': JSON.stringify(CTX),
    };
    const deps = { readFile: (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }, log: () => {}, error: () => {} };
    expect(main(['--record', 'r.json', '--context', 'c.json'], deps)).toBe(0);
    expect(main(['--record', 'b.json', '--context', 'c.json'], deps)).toBe(1);
    expect(main(['--record', 'missing.json', '--context', 'c.json'], deps)).toBe(1);
    expect(main(['--record', 'r.json'], deps)).toBe(2);
  });
});
