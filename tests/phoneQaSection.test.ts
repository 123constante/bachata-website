import { describe, expect, it } from 'vitest';
import { main, parse, touchesUi, uiPaths } from '../scripts/check-pr-phone-qa.mjs';

const S = '390x844 and 360x640';
const W = 'organiser page as owner, Save bar up, top to bottom';
const N = 'iOS safe-area inset, Chromium cannot emulate it';
const section = (s = S, w = W, n = N, heading = '## Phone QA') =>
  [heading, `- Sizes checked: ${s}`, `- Walked: ${w}`, `- Not verified: ${n}`].join('\n');
const quiet = { log() {}, error() {} };
const UI = 'src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx';

describe('parse: positive', () => {
  it.each([
    ['plain section', section()],
    ['text around the section', `## What and why\nstuff\n\n${section()}\n\n## Merge note\nmore`],
    ['lowercase heading', section(S, W, N, '## phone qa')],
    ['CRLF line endings', section().replace(/\n/g, '\r\n')],
    ['bold labels', `## Phone QA\n**Sizes checked:** ${S}\n**Walked:** ${W}\n**Not verified:** ${N}`],
    ['multiplication sign in size', section('390\u00d7844')],
    ['spaced size', section('390 x 844 only')],
    ['Nothing plus explanation', section(S, W, 'Nothing, every page was walked at both sizes')],
  ])('%s', (_n, body) => {
    expect(parse(body)).toEqual({ ok: true, problems: [] });
  });
});

describe('parse: negative', () => {
  it.each([
    ['null', null],
    ['empty', ''],
    ['no section', '## What and why\nhello'],
    ['heading is h3', section(S, W, N, '### Phone QA')],
    ['section only inside a comment', `<!--\n${section()}\n-->`],
  ])('%s -> section missing', (_n, body) => {
    const r = parse(body as string | null);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/missing|empty/);
  });

  it('a doubled section fails', () => {
    expect(parse(`${section()}\n\n${section()}`).problems[0]).toContain('2 times');
  });

  it.each([
    ['Sizes checked', `## Phone QA\n- Walked: ${W}\n- Not verified: ${N}`],
    ['Walked', `## Phone QA\n- Sizes checked: ${S}\n- Not verified: ${N}`],
    ['Not verified', `## Phone QA\n- Sizes checked: ${S}\n- Walked: ${W}`],
  ])('missing %s line names it', (label, body) => {
    const r = parse(body);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([expect.stringContaining(`${label}: line is missing`)]);
  });

  it.each(['phones', 'mobile sizes', 'iPhone', 'n/a', 'N/A.', '-', ''])('Sizes checked "%s" (no WxH) fails', (v) => {
    const r = parse(section(v));
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain('Sizes checked');
  });

  it.each(['n/a', 'none', 'TODO', 'tbd', '-', 'looked ok'])('placeholder "%s" in Walked and in Not verified fails', (v) => {
    for (const body of [section(S, v), section(S, W, v)]) {
      const r = parse(body);
      expect(r.ok).toBe(false);
      expect(r.problems).toHaveLength(1);
    }
  });

  it('bare Nothing in Not verified fails with the explanation hint', () => {
    const r = parse(section(S, W, 'Nothing.'));
    expect(r.problems[0]).toContain('"Nothing" must be followed');
  });

  it('the section after a later heading does not borrow its lines', () => {
    const body = `## Phone QA\n- Sizes checked: ${S}\n\n## Other\n- Walked: ${W}\n- Not verified: ${N}`;
    expect(parse(body).ok).toBe(false);
  });
});

describe('scope: which changed paths are UI paths', () => {
  it.each([
    ['src/components/BottomNav.tsx', true],
    ['src/index.css', true],
    ['src/modules/home-map/homeMap.css', true],
    ['tailwind.config.ts', true],
    ['public/robots.txt', true],
    ['public/og/default.png', true],
    ['src/lib/utils.ts', false],
    ['app/routes/organiser.tsx', true],
    ['app/InitialVisiblePageTransition.tsx', true],
    ['index.html', true],
    ['app/detailLoader.ts', false],
    ['docs/pr-batching-policy.md', false],
    ['README.md', false],
    ['.github/workflows/phone-qa.yml', false],
    ['tests/e2e-phone/helpers.ts', false],
    ['playwright.phone.config.ts', false],
    ['srcx/a.tsx', false],
    ['nested/src/a.tsx', false],
  ])('%s -> %s', (file, want) => {
    expect(touchesUi([file])).toBe(want);
  });

  it('uiPaths keeps only the UI paths, in order', () => {
    expect(uiPaths(['docs/a.md', UI, 'src/lib/x.ts', 'src/index.css'])).toEqual([UI, 'src/index.css']);
  });
});

describe('main: exit codes, end to end', () => {
  it('a UI PR WITHOUT the section fails (non-vacuity: the check is not satisfied by absence)', () => {
    expect(main([], { PR_BODY: '## What and why\nA UI change.', PR_FILES: UI }, quiet)).toBe(1);
  });
  it('a UI PR with a half-filled section fails', () => {
    expect(main([], { PR_BODY: section(S, W, 'n/a'), PR_FILES: `docs/a.md\n${UI}` }, quiet)).toBe(1);
  });
  it('a UI PR with the section passes', () => {
    expect(main([], { PR_BODY: section(), PR_FILES: UI }, quiet)).toBe(0);
  });
  it('a docs-only PR passes without the section', () => {
    expect(main([], { PR_BODY: 'docs', PR_FILES: 'docs/a.md\nREADME.md' }, quiet)).toBe(0);
  });
  it('a non-UI code PR (src .ts, CI) passes without the section', () => {
    expect(main([], { PR_BODY: '', PR_FILES: 'src/lib/utils.ts\n.github/workflows/x.yml' }, quiet)).toBe(0);
  });
  it('the PR template, filled in as written, passes', async () => {
    const { readFileSync } = await import('node:fs');
    const template = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8');
    const filled = template
      .replace(/^- Sizes checked:.*$/m, `- Sizes checked: ${S}`)
      .replace(/^- Walked:.*$/m, `- Walked: ${W}`)
      .replace(/^- Not verified:.*$/m, `- Not verified: ${N}`);
    expect(parse(filled)).toEqual({ ok: true, problems: [] });
    // ...and unfilled, it fails: the template alone never satisfies the check.
    expect(parse(template).ok).toBe(false);
  });
  it.each([
    ['no PR_BODY', { PR_FILES: UI }],
    ['no PR_FILES', { PR_BODY: section() }],
    ['empty PR_FILES', { PR_BODY: section(), PR_FILES: ' \n ' }],
  ])('%s is infrastructure (2), never a pass', (_n, env) => {
    expect(main([], env as Record<string, string>, quiet)).toBe(2);
  });
  it('the canary passes', () => {
    expect(main(['--self-test'], {}, quiet)).toBe(0);
  });
  it('the failure names the UI path and prints the format', () => {
    const errors: string[] = [];
    main([], { PR_BODY: 'x', PR_FILES: UI }, { log() {}, error: (m: string) => errors.push(m) });
    expect(errors.join('\n')).toContain(UI);
    expect(errors.join('\n')).toContain('## Phone QA');
  });
});
