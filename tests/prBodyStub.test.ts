import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as realData from '../scripts/check-pr-real-data-verified.mjs';
import * as phoneQa from '../scripts/check-pr-phone-qa.mjs';
import { buildStub, main as stubMain } from '../scripts/pr-body-stub.mjs';

// The bot PR body (.github/workflows/bot-pr.yml) comes from ONE generator,
// scripts/pr-body-stub.mjs, built from the checkers' own HEADING/LABELS/MARKER.
// This pins the stub to both checkers so the three copies can never drift.
const quiet = { log() {}, error() {} };
const UI = 'src/components/BottomNav.tsx';
const body: string = buildStub('claude/x');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

describe('pr-body-stub: agrees with both checkers', () => {
  it('real-data parse() says pending, never a pass', () => {
    expect(realData.parse(body)).toMatchObject({ ok: false, pending: true });
    expect(realData.main([], { PR_BODY: body }, quiet)).toBe(3);
  });
  it('Phone QA parse() says pending, never a pass', () => {
    expect(phoneQa.parse(body)).toMatchObject({ ok: false, pending: true });
    expect(phoneQa.main([], { PR_BODY: body, PR_FILES: UI }, quiet)).toBe(3);
  });
  it('a docs-only PR with the stub is OK, not required', () => {
    expect(phoneQa.main([], { PR_BODY: body, PR_FILES: 'docs/a.md' }, quiet)).toBe(0);
  });
  it.each([
    ...realData.LABELS.map((l: string) => ['real-data', l]),
    ...phoneQa.LABELS.map((l: string) => ['phone-qa', l]),
  ])('%s label "%s" appears exactly once, as "- <label>: TO FILL"', (_k, label) => {
    const lines = body.split('\n').filter((l) => l.startsWith(`- ${label}:`));
    expect(lines).toEqual([`- ${label}: ${realData.MARKER}`]);
  });
  it('exactly one heading per section (no "appears 2 times" trap)', () => {
    expect(count(body, realData.HEADING)).toBe(1);
    expect(count(body, phoneQa.HEADING)).toBe(1);
    expect(realData.parse(body).problems.join('\n')).not.toMatch(/appears \d+ times/);
    expect(phoneQa.parse(body).problems.join('\n')).not.toMatch(/appears \d+ times/);
  });
  it('both checkers use the same marker', () => {
    expect(phoneQa.MARKER).toBe(realData.MARKER);
  });
  it('filling every TO FILL in place makes both checkers pass', () => {
    const filled = body
      .replace('- Shapes surveyed: TO FILL', '- Shapes surveyed: events table, 412 rows, counts only')
      .replace('- Checks run: TO FILL', '- Checks run: matrix tests plus a browser walk')
      .replace('- NOT verified: TO FILL', '- NOT verified: series over 1000 dates per event')
      .replace('- Sizes checked: TO FILL', '- Sizes checked: 390x844 and 360x640')
      .replace('- Walked: TO FILL', '- Walked: organiser page top to bottom as owner')
      .replace('- Not verified: TO FILL', '- Not verified: iOS safe-area inset in Chromium');
    expect(realData.parse(filled).ok).toBe(true);
    expect(phoneQa.parse(filled).ok).toBe(true);
    expect(filled).not.toContain('TO FILL');
  });
  it('names the branch and the workflow', () => {
    expect(body).toContain('`claude/x`');
    expect(body).toContain('Raised by .github/workflows/bot-pr.yml.');
  });
  it('no label, heading or marker text is hard-coded in pr-body-stub.mjs', () => {
    const src = readFileSync(new URL('../scripts/pr-body-stub.mjs', import.meta.url), 'utf8');
    for (const s of [...realData.LABELS, ...phoneQa.LABELS, realData.HEADING, phoneQa.HEADING, realData.MARKER]) {
      expect(src, s).not.toContain(s);
    }
  });
  it('--self-test passes; BRANCH prints the stub (0); no BRANCH is infrastructure (2)', () => {
    expect(stubMain(['--self-test'], {}, quiet)).toBe(0);
    const out: string[] = [];
    expect(stubMain([], { BRANCH: 'claude/y' }, { log: (m: string) => out.push(m), error() {} })).toBe(0);
    expect(out.join('\n')).toContain('`claude/y`');
    expect(stubMain([], {}, quiet)).toBe(2);
  });
});
