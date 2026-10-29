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
    expect(parse(body)).toEqual({ ok: true, pending: false, problems: [] });
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

describe('PR template', () => {
  it('the PR template, filled in as written, passes; unfilled it fails', async () => {
    const { readFileSync } = await import('node:fs');
    const template = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8');
    const filled = template
      .replace(/^- Shapes surveyed.*$/m, `- Shapes surveyed: ${S}`)
      .replace(/^- Checks run.*$/m, `- Checks run: ${C}`)
      .replace(/^- NOT verified.*$/m, `- NOT verified: ${N}`);
    expect(parse(filled)).toEqual({ ok: true, pending: false, problems: [] });
    expect(parse(template).ok).toBe(false);
  });
});

// The bot (.github/workflows/bot-pr.yml) opens every claude/** PR with the
// section pre-filled with the TO FILL marker. That is PENDING (exit 3, a
// non-failing notice), never a pass: parse().ok stays false so no merge path
// that reads parse() (scripts/automerge-classify.mjs) can treat it as done.
describe('TO FILL marker: pending, not a violation and not a pass', () => {
  const M = 'TO FILL';
  const OLD_STUB =
    'Opened by the bot for cloud branch `claude/x` so the owner can approve it. The session fills in this description.\n\nRaised by .github/workflows/bot-pr.yml.';
  const fence = (s: string) => '```\n' + s + '\n```';

  it.each([
    ['marker on one line', section(M), true],
    ['marker on two lines', section(M, M), true],
    ['marker on three lines', section(M, M, M), true],
    ['marker mixed with real text', section(`${S} ${M}`), true],
    ['marker lowercase is not the marker (short text, violation)', section('to fill'), false],
    ['marker on one line, another line missing', `## Verified on real data\n- Shapes surveyed: ${M}\n- Checks run: ${C}`, false],
    ['marker on one line, another a placeholder', section(M, 'n/a'), false],
  ])('%s', (_n, body, pending) => {
    const r = parse(body);
    expect(r.ok).toBe(false);
    expect(r.pending).toBe(pending);
    expect(main([], { PR_BODY: body }, quiet)).toBe(pending ? 3 : 1);
  });

  it('names every marker line in the problems', () => {
    const r = parse(section(M, C, M));
    expect(r.problems).toHaveLength(2);
    expect(r.problems.join('\n')).toMatch(/Shapes surveyed.*TO FILL/);
    expect(r.problems.join('\n')).toMatch(/NOT verified.*TO FILL/);
  });

  it('a marker only inside a fenced code block is not the section (the real one outside decides)', () => {
    expect(parse(`${fence(section(M, M, M))}\n\n${section()}`)).toEqual({ ok: true, pending: false, problems: [] });
    expect(parse(`${section()}\n\nExample:\n${fence('- Shapes surveyed: ' + M)}`)).toEqual({ ok: true, pending: false, problems: [] });
    const onlyFenced = parse(fence(section(M, M, M)));
    expect(onlyFenced.ok).toBe(false);
    expect(onlyFenced.pending).toBe(false);
    expect(onlyFenced.problems[0]).toMatch(/missing/);
  });

  it('a filled body passes (exit 0)', () => {
    expect(parse(section())).toEqual({ ok: true, pending: false, problems: [] });
    expect(main([], { PR_BODY: section() }, quiet)).toBe(0);
  });

  it('the OLD bot stub stays a violation (red, exit 1)', () => {
    const r = parse(OLD_STUB);
    expect(r).toMatchObject({ ok: false, pending: false });
    expect(main([], { PR_BODY: OLD_STUB }, quiet)).toBe(1);
  });

  it('the body bot-pr.yml writes today is pending (exit 3)', async () => {
    const { readFileSync } = await import('node:fs');
    const yml = readFileSync(new URL('../.github/workflows/bot-pr.yml', import.meta.url), 'utf8');
    const m = /const body = (\[[\s\S]*?\])\.join\("\\n"\);/.exec(yml);
    expect(m, 'bot-pr.yml must build the body as [ ... ].join("\\n")').not.toBeNull();
    const body = (new Function('process', `return ${m![1]}.join("\\n");`) as (p: unknown) => string)({
      env: { BRANCH: 'claude/x' },
    });
    expect(body).toContain('Opened by the bot');
    expect(parse(body)).toMatchObject({ ok: false, pending: true });
    expect(main([], { PR_BODY: body }, quiet)).toBe(3);
  });

  it('a pending body does NOT qualify for bot auto-merge', async () => {
    // @ts-expect-error -- plain .mjs script, no types
    const { classify, BOT_LOGIN, LABEL_OK } = await import('../scripts/automerge-classify.mjs');
    const files = [{ filename: 'docs/a.md', status: 'modified', additions: 3, deletions: 1 }];
    const pr = {
      state: 'open', draft: false, user: BOT_LOGIN, headRef: 'claude/x', headRepo: 'o/r', baseRepo: 'o/r',
      baseRef: 'main', labels: [LABEL_OK], additions: 3, deletions: 1, changedFiles: 1,
    };
    const go = (body: string) =>
      classify({ pr: { ...pr, body }, files, labelActor: BOT_LOGIN, realData: parse, importedByShipped: () => false });
    expect(go(section()).qualifies).toBe(true);
    expect(go(section(M)).qualifies).toBe(false);
  });
});

describe('real-data-verified.yml wiring', () => {
  it('keeps the docs-only skip and turns ONLY exit 3 into a non-failing notice', async () => {
    const { readFileSync } = await import('node:fs');
    const yml = readFileSync(new URL('../.github/workflows/real-data-verified.yml', import.meta.url), 'utf8').replace(/\r/g, '');
    // PRs touching no src/, app/ or api/ are skipped exactly as before.
    expect(yml).toContain('/^(src|app|api)\\//.test(n)');
    expect(yml).toContain("core.setOutput('skip', 'true');");
    // Pending is exit 3 -> notice + exit 0; any other code is passed through (red).
    expect(yml).toMatch(/if \[ "\$code" = "3" \]; then\n\s+echo "::notice [^\n]*\n[^\n]*\n\s+exit 0\n\s+fi\n\s+exit "\$code"/);
  });
});

describe('fenced code blocks', () => {
  const ok = { ok: true, pending: false, problems: [] };
  it.each([
    ['inline triple-backtick span is not a fence', '```npm test``` passes\n\n' + section()],
    ['~~~ fence is stripped', '~~~\n' + section('TO FILL') + '\n~~~\n\n' + section()],
    ['fence with an info string is stripped', '```md\n' + section('TO FILL') + '\n```\n\n' + section()],
    ['indented (3 spaces) fence is stripped', '   ```\n' + section('TO FILL') + '\n   ```\n\n' + section()],
    ['shorter closing run does not close a longer fence', '````\n```\n' + section('TO FILL') + '\n````\n\n' + section()],
  ])('%s', (_n, body) => {
    expect(parse(body)).toEqual(ok);
  });

  it('an unclosed fence runs to the end and hides a section after it (CommonMark)', () => {
    expect(parse('```\n' + section()).ok).toBe(false);
  });
});
