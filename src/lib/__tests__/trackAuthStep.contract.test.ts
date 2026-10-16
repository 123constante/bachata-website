import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUTH_FUNNEL_OUTCOMES, AUTH_FUNNEL_STATE_ID, AUTH_FUNNEL_STEPS } from '../trackAuthStep';

const sql = readFileSync('tests/fixtures/auth-funnel-contract.sql', 'utf8');
const list = (re: RegExp) => [...(sql.match(re)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('trackAuthStep matches the pinned SQL allowlists', () => {
  it('steps', () => {
    expect([...AUTH_FUNNEL_STEPS].sort()).toEqual(list(/step IN \(([^)]*)\)/).sort());
    expect(AUTH_FUNNEL_STEPS.length).toBe(10);
  });
  it('outcomes', () => {
    expect([...AUTH_FUNNEL_OUTCOMES].sort()).toEqual(list(/outcome IN \(([^)]*)\)/).sort());
  });
  it('landing state id pattern, landing only', () => {
    expect(sql).toContain(`(step = 'landing' AND outcome ~ '${AUTH_FUNNEL_STATE_ID.source}')`);
  });
});
