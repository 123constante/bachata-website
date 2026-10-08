import { describe, expect, it } from 'vitest';
import { main, parse } from '../scripts/check-pr-real-data-verified.mjs';

const S = 'events table, 412 rows, null venue_id in 9';
const C = 'matrix tests plus a browser walk at 390x844';
const N = 'behaviour with more than 1000 occurrences';
const section = (s = S, c = C, n = N, heading = '## Verified on real data') =>
  [heading, `- Shapes surveyed: ${s}`, `- Checks run: ${c}`, `- NOT verified: ${n}`].join('\n');
const quiet = { log() {}, error() {} };

describe('parse: valid bodies', () => {
  it.each([
    ['plain section', section()],
    ['text around the section', `## Summary\nstuff\n\n${section()}\n\n## Other\nmore`],
    ['lowercase heading', section(S, C, N, '## verified on real data')],
    ['uppercase heading', section(S, C, N, '## VERIFIED ON REAL DATA')],
    ['extra spaces in heading', section(S, C, N, '##   Verified   on  real data  ')],
    ['CRLF line endings', section().replace(/\n/g, '\r\n')],
    ['bold labels', `## Verified on real data\n**Shapes surveyed:** ${S}\n**Checks run:** ${C}\n**NOT verified:** ${N}`],
    ['Nothing plus explanation', section(S, C, 'Nothing, every path was exercised in the matrix')],
    ['template hint plus real text', section('events and venues rows (read-only, counts)')],
    ['section valid, comment elsewhere', `<!-- note -->\n${section()}`],
  ])('%s', (_n, body) => {
    expect(parse(body)).toEqual({ ok: true, problems: [] });
  });
});

describe('parse: invalid bodies', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['no section', '## Summary\nhello'],
    ['heading is h3', section(S, C, N, '### Verified on real data')],
  ])('%s -> section missing', (_n, body) => {
    const r = parse(body as string | null);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/missing|empty/);
  });

  it.each([
    ['Shapes surveyed', `## Verified on real data\n- Checks run: ${C}\n- NOT verified: ${N}`],
    ['Checks run', `## Verified on real data\n- Shapes surveyed: ${S}\n- NOT verified: ${N}`],
    ['NOT verified', `## Verified on real data\n- Shapes surveyed: ${S}\n- Checks run: ${C}`],
  ])('missing %s line names it', (label, body) => {
    const r = parse(body);
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain(label);
    expect(r.problems[0]).toContain('missing');
  });

  it.each([
    ['empty', ''],
    ['(read-only, counts)', '(read-only, counts)'],
    ['(matrix tests, every CI job step, browser walk at 390x844)', '(matrix tests, every CI job step, browser walk at 390x844)'],
    ['(be honest)', '(be honest)'],
    ['n/a', 'n/a'],
    ['N/A.', 'N/A.'],
    ['none', 'None'],
    ['todo', 'TODO'],
    ['tbd', 'tbd'],
    ['dash', '-'],
    ['short', 'looked ok'],
  ])('placeholder %s in each of the three lines fails and names the line', (_n, value) => {
    for (const label of ['Shapes surveyed', 'Checks run', 'NOT verified']) {
      const body =
        label === 'Shapes surveyed' ? section(value) : label === 'Checks run' ? section(S, value) : section(S, C, value);
      const r = parse(body);
      expect(r.ok).toBe(false);
      expect(r.problems).toHaveLength(1);
      expect(r.problems[0]).toContain(label);
    }
  });

  it('bare Nothing in NOT verified fails with the explanation hint', () => {
    for (const v of ['Nothing', 'Nothing.', 'nothing - ok']) {
      const r = parse(section(S, C, v));
      expect(r.ok).toBe(false);
      expect(r.problems[0]).toContain('NOT verified');
    }
  });

  it('a valid section inside an HTML comment does not count', () => {
    expect(parse(`<!--\n${section()}\n-->`).ok).toBe(false);
    expect(parse(`intro <!-- ${section()} --> outro`).ok).toBe(false);
  });

  it('labels outside the section do not count', () => {
    const body = `- Shapes surveyed: ${S}\n- Checks run: ${C}\n- NOT verified: ${N}\n\n## Verified on real data\n\n## Next\n`;
    expect(parse(body).ok).toBe(false);
  });

  it('the section twice fails', () => {
    const r = parse(`${section()}\n\n${section()}`);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/2 times/);
  });

  it('reports every bad line at once', () => {
    expect(parse(section('n/a', '', 'tbd')).problems).toHaveLength(3);
  });
});

describe('main: exit codes', () => {
  it('2 when PR_BODY is not set', () => expect(main([], {}, quiet)).toBe(2));
  it('1 on a violating body', () => expect(main([], { PR_BODY: 'x' }, quiet)).toBe(1));
  it('1 on an empty body (set but empty)', () => expect(main([], { PR_BODY: '' }, quiet)).toBe(1));
  it('0 on a valid body', () => expect(main([], { PR_BODY: section() }, quiet)).toBe(0));
  it('--self-test passes', () => expect(main(['--self-test'], {}, quiet)).toBe(0));
});
