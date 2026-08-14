import { describe, expect, it } from 'vitest';

import { decide, pagerExecHits, segmentArgv, selfTest } from '../scripts/hooks/pre-exec-guard.mjs';

/**
 * Every ALLOW case marked "(was a false positive)" and every DENY case marked
 * "(was a bypass)" is a real verdict observed from an earlier draft of this
 * guard, not a hypothetical. The first draft passed 16/16 of its own tests
 * while being defeated by quoting a flag and while hard-denying `wget -O`.
 * They are pinned here so a regression reds immediately.
 */
describe('segmentArgv', () => {
  it('strips quotes, because the shell strips them before git sees them', () => {
    expect(segmentArgv('git grep "-O" cat')).toEqual([['git', 'grep', '-O', 'cat']]);
  });

  it('does not split on a separator that sits inside quotes', () => {
    expect(segmentArgv("git grep 'foo|bar' x")).toEqual([['git', 'grep', 'foo|bar', 'x']]);
  });

  it('splits on unquoted separators', () => {
    expect(segmentArgv('ls; git grep -O cat')).toEqual([
      ['ls'],
      ['git', 'grep', '-O', 'cat'],
    ]);
  });

  it('treats a newline as a command separator, not as whitespace', () => {
    expect(segmentArgv('git status\ngit grep -O cat')).toEqual([
      ['git', 'status'],
      ['git', 'grep', '-O', 'cat'],
    ]);
  });
});

describe('pre-exec-guard denies git grep pager execution', () => {
  it.each([
    ['the plain form', 'git grep -O cat foo'],
    ['the CLUSTERED form every literal prefix rule misses', 'git grep -inOcat foo'],
    ['the long form with an inline argument', 'git grep --open-files-in-pager=cat foo'],
    ['a -C redirect, the style this repo uses', 'git -C /c/dev/Website grep -Osh x'],
    ['a quoted flag (was a bypass)', 'git grep "-O" cat foo'],
    ['a flag after a quoted pattern (was a bypass)', "git grep 'foo|bar' -Ocat"],
    ['a second command after a separator', 'ls -la; git grep -O cat'],
    ['a second line of a multi-line script (was a bypass)', 'git status\ngit grep -O cat'],
    ['a leading env assignment', 'GIT_PAGER=x git grep -Ocat foo'],
    ['an absolute path to git', '/usr/bin/git grep -O cat foo'],
  ])('denies %s', (_label, command) => {
    expect(pagerExecHits(command).length).toBeGreaterThan(0);
    expect(decide(command)?.permissionDecision).toBe('deny');
  });
});

describe('pre-exec-guard does NOT over-block', () => {
  // deny is unoverridable by any allow rule, so a false positive here is worse
  // than a miss -- it silently makes ordinary work impossible.
  it.each([
    ['git clone -o upstream https://example.com/r.git'],
    ['git push -o ci.skip origin main'],
    ['git grep -n pattern'],
    ['git grep -i -w needle -- src/'],
    ['git diff --stat origin/main'],
    // argv[0] is wget, not git -- the URL merely mentions git-grep.
    ['wget -O /tmp/x https://git-scm.com/docs/git-grep'],
    // argv[0] is grep, not git.
    ['grep -rn "gh pr merge" .claude/'],
    // gh is permissions.ask territory, not this guard's.
    ['gh pr merge 227'],
    ['echo "git grep -O cat"'],
    ['ls -la'],
  ])('leaves %s alone', (command) => {
    expect(pagerExecHits(command)).toEqual([]);
    expect(decide(command)).toBeNull();
  });
});

const BS = String.fromCharCode(92);

describe('pre-exec-guard: flag parsing', () => {
  it('stops at a bare -- so a literal pattern is not read as a flag', () => {
    // Was a false DENY: searching a C codebase for the string -O2.
    expect(pagerExecHits('git grep -n -- ' + JSON.stringify('-O2'))).toEqual([]);
  });

  it('skips the operand of -e, which is a pattern and never a flag', () => {
    expect(pagerExecHits('git grep -e ' + JSON.stringify('-Ofast') + ' -- src/')).toEqual([]);
  });

  it('catches an ABBREVIATED long flag, since git accepts unique prefixes', () => {
    // Was a bypass: --op=cat is --open-files-in-pager=cat to git.
    expect(pagerExecHits('git grep --op=cat foo')).toEqual(['--op=cat']);
  });

  it('is not fooled by a backslash-escaped quote', () => {
    // Was a bypass: the escaped quote opened a string the shell never opens,
    // swallowing the rest of the line.
    expect(pagerExecHits('git grep can' + BS + "'t -Ocat x")).toEqual(['-Ocat']);
  });
});

describe('pre-exec-guard: limits this guard deliberately accepts', () => {
  it('does NOT flag core.pager, which is an everyday idiom', () => {
    // Same exec effect as -O, but `git -c core.pager=cat log` is how people
    // routinely disable the pager. An unoverridable deny here would cost far
    // more than it protects -- the exact over-block that killed the deny rules.
    expect(pagerExecHits('git -c core.pager=cat grep foo')).toEqual([]);
  });

  it("runs the guard's own canary, so CI owns it and not just a human", () => {
    // The vacuous-tsconfig vector is proven in --self-test rather than here:
    // it needs injected deps for a whole fake tree, and duplicating those
    // fixtures in two places is how two suites drift into disagreeing. This
    // line is what puts them in front of `npm run test:unit`.
    expect(selfTest()).toBe(0);
  });

  it('no longer flags a heredoc body line -- the flip this case was left for', () => {
    // This case used to assert the OPPOSITE, as a pinned known false positive:
    // "distinguishing a heredoc body from a command needs a real shell parser;
    // pinned here so a future parser has a test to flip." Flipped 2026-08-14.
    //
    // The parser arrived for vector 2, where the same false positive was not
    // survivable: a deny cannot be overridden by any allow, this repo mandates
    // heredoc transport for every source write, and the string `tsc --noEmit`
    // appears in its own docs -- so writing a note about the typecheck failed
    // the write that described it. Vector 1 inherits the fix.
    const heredoc = ['cat > f <<EOF', 'git grep -O cat foo', 'EOF'].join('\n');
    expect(pagerExecHits(heredoc)).toEqual([]);
  });

  it('still flags the same command AFTER the heredoc terminator', () => {
    // The complement, and the one that would catch an over-eager strip: a
    // heredoc that swallowed the rest of the input would be a blanket off
    // switch wearing a bug fix's clothes.
    const after = ['cat > f <<EOF', 'harmless', 'EOF', 'git grep -O cat foo'].join('\n');
    expect(pagerExecHits(after)).toEqual(['-O']);
  });
});
