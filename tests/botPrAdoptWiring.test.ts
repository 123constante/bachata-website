import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

describe('bot-pr.yml wiring', () => {
  const doc = parse(readFileSync(path.resolve(__dirname, '../.github/workflows/bot-pr.yml'), 'utf8'));
  const job = doc.jobs['open-pr'];
  const run = job.steps.map((s: any) => s.run || '').join('\n');
  it('uses the adopt script and stops unless it said open', () => {
    expect(run).toContain('ADOPT_OUT=adopt.out node scripts/lib/bot-pr-adopt.mjs');
    expect(run).toContain('[ "$(cat adopt.out)" = "open" ] || exit 0');
  });
  it('keeps default-branch checkout without persisted credentials', () => {
    const co = job.steps[0];
    expect(co.uses).toBe('actions/checkout@v7');
    expect(co.with['persist-credentials']).toBe(false);
  });
});
