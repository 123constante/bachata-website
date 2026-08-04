/**
 * reviewStampProvenance.test.ts -- both-directions proof for the provenance
 * fields on the review receipt.
 *
 * Origin, measured 2026-08-04: three consecutive /code-review runs failed to
 * receipt one ship. The third reported CLEAN while describing a different
 * branch's diff. Root cause: REPO_ROOT in review-scope.mjs is derived from that
 * module's own file location, so a review stamps the tree whose copy of the
 * module it loaded -- regardless of which diff it actually read. With git
 * worktrees that is two independent stamp files, and the gate's honest
 * "no valid review stamp found" reads as "nobody reviewed this" when the truth
 * is "somebody reviewed this, in the other tree".
 *
 * The receipt was never the weak link: content hashing held every time and the
 * gate correctly refused. These specs cover the thing that was missing -- the
 * ability to TELL. So they assert the SILENT directions as hard as the loud
 * one: a stamp that predates provenance, one that matches, one whose root
 * differs only by drive-letter case, and one minted on a detached HEAD must all
 * produce no note at all, or the gate cries wolf on every honest ship.
 *
 * Note what the provenance FIELDS can and cannot reach. The stamp lives at
 * REPO_ROOT/.claude/, so any stamp the gate can READ was written by a module
 * rooted in that same directory -- the cross-tree miss presents as NO STAMP,
 * not as a mismatched root. The line that actually names it is ship-gate
 * printing STAMP_PATH on the absent branch, asserted at the bottom of this file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import os from 'node:os';
import {
  describeMintHistory,
  describeProvenance,
  mergeReviewStamp,
  provenanceMismatch,
  readMintLog,
  recordMintAttempt,
} from '../scripts/lib/review-scope.mjs';
import { runHook } from '../scripts/hooks/review-stamp.mjs';
import { decide } from '../scripts/ship-gate.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HERE = 'C:/tmp/this-tree';
const runFor = (branch: string, head = 'abc123') => (args: string[]) =>
  args[1] === '--abbrev-ref' ? branch : head;

const stampWith = (provenance: unknown) => ({
  version: 1,
  timestamp: new Date().toISOString(),
  session_id: 's',
  provenance,
  hashes: { 'a.mjs': 'h1' },
  deletions: [],
  findings: [],
});

describe('provenance: what gets recorded', () => {
  it('records the tree, branch and head of the mint', () => {
    const p = describeProvenance({ root: HERE, run: runFor('feat/x', 'deadbeef') });
    expect(p).toEqual({ repo_root: HERE, branch: 'feat/x', head: 'deadbeef' });
  });

  it('resolves branch and head IN the tree it names, not some other one', () => {
    // Otherwise a record can claim tree A's path beside tree B's branch, and a
    // self-inconsistent receipt is worse than no receipt at all.
    const seen: string[] = [];
    describeProvenance({
      root: HERE,
      run: (_args: string[], cwd: string) => {
        seen.push(cwd);
        return 'x';
      },
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set([HERE]));
  });

  it('degrades to nulls rather than throwing when git is unavailable', () => {
    // Provenance is a diagnostic; it must never be the reason a mint dies.
    const p = describeProvenance({
      root: HERE,
      run: () => {
        throw new Error('no git here');
      },
    });
    expect(p.repo_root).toBe(HERE);
    expect(p.branch).toBeNull();
  });

  it('rides onto a minted stamp when the writer supplies it', () => {
    const s = mergeReviewStamp(null, {
      hashes: { 'a.mjs': 'h1' },
      nowIso: new Date().toISOString(),
      provenance: { repo_root: HERE, branch: 'main', head: 'abc' },
    });
    expect(s.provenance).toEqual({ repo_root: HERE, branch: 'main', head: 'abc' });
  });

  it('leaves the merge PURE when the caller omits it', () => {
    // mergeReviewStamp has ~30 unit call sites that pass no provenance. A
    // describeProvenance() DEFAULT would make every one of them shell out to
    // git, turning a pure merge into an environment-dependent one.
    const s = mergeReviewStamp(null, {
      hashes: { 'a.mjs': 'h1' },
      nowIso: new Date().toISOString(),
    });
    expect(s.provenance).toBeNull();
  });

  it('is supplied by the PRODUCTION writer, not left to a default', () => {
    // The consequence if this regresses is silent: every real receipt loses
    // provenance while every spec above still passes, because they all inject
    // the field themselves. Assert the one call site that actually mints.
    const hook = fs.readFileSync(path.join(REPO, 'scripts/hooks/review-stamp.mjs'), 'utf8');
    expect(hook).toContain('provenance: describeProvenance()');
  });
});

describe('provenance: the loud direction', () => {
  it('names a stamp minted in a different worktree', () => {
    const note = provenanceMismatch(
      stampWith({ repo_root: 'C:/dev/Website', branch: 'main', head: 'abc' }),
      { root: HERE, run: runFor('main') },
    );
    expect(note).toContain('DIFFERENT working tree');
    expect(note).toContain('C:/dev/Website');
    expect(note).toContain(HERE);
  });

  it('names a stamp minted on a different branch of the same tree', () => {
    const note = provenanceMismatch(
      stampWith({ repo_root: HERE, branch: 'ci/other-ship', head: 'abc' }),
      { root: HERE, run: runFor('ci/this-ship') },
    );
    expect(note).toContain('ci/other-ship');
    expect(note).toContain('ci/this-ship');
    // Coverage is content hashing, so the other branch's stamp DOES still cover
    // every file whose bytes it recorded. Telling the operator otherwise sends
    // them back for a full re-review they do not need.
    expect(note).toContain('stay covered');
  });
});

describe('provenance: the silent directions', () => {
  it('says nothing when the stamp was minted right here', () => {
    expect(
      provenanceMismatch(stampWith({ repo_root: HERE, branch: 'main', head: 'abc' }), {
        root: HERE,
        run: runFor('main'),
      }),
    ).toBeNull();
  });

  it('says nothing about a stamp that predates provenance', () => {
    // An older receipt is quiet, not suspect. Reporting it as a mismatch would
    // red every honest ship made before this field existed.
    expect(provenanceMismatch(stampWith(undefined), { root: HERE, run: runFor('main') })).toBeNull();
    expect(provenanceMismatch({ hashes: {} }, { root: HERE, run: runFor('main') })).toBeNull();
  });

  it('says nothing when git cannot answer, rather than guessing a mismatch', () => {
    expect(
      provenanceMismatch(stampWith({ repo_root: HERE, branch: 'main', head: 'abc' }), {
        root: HERE,
        run: () => null,
      }),
    ).toBeNull();
  });

  it('says nothing about a trailing separator', () => {
    expect(
      provenanceMismatch(stampWith({ repo_root: HERE + '/', branch: 'main', head: 'abc' }), {
        root: HERE,
        run: runFor('main'),
      }),
    ).toBeNull();
  });

  it('says nothing about drive-letter case on win32', () => {
    // The two roots come from two independent sources: the mint resolves a
    // RELATIVE argv path (the hook runs node scripts/hooks/review-stamp.mjs),
    // the gate an ABSOLUTE one from git rev-parse --show-toplevel, and
    // path.resolve preserves whichever case it was handed. On a case-insensitive
    // filesystem c:/x and C:/x are ONE directory -- accusing the operator of
    // being in the wrong tree while they stand in it is the exact cry-wolf this
    // mechanism exists to prevent.
    const note = provenanceMismatch(
      stampWith({ repo_root: 'c:/tmp/this-tree', branch: 'main', head: 'abc' }),
      { root: 'C:/tmp/this-tree', run: runFor('main') },
    );
    if (process.platform === 'win32') expect(note).toBeNull();
    else expect(note).toContain('DIFFERENT working tree'); // POSIX: genuinely two paths
  });

  it('says nothing when either side is a detached HEAD', () => {
    // rev-parse --abbrev-ref returns the literal "HEAD" during a rebase, a
    // bisect or a CI checkout. That names no branch, so there is nothing to
    // compare -- and printing "minted on branch 'HEAD'" is pure noise.
    expect(
      provenanceMismatch(stampWith({ repo_root: HERE, branch: 'HEAD', head: 'abc' }), {
        root: HERE,
        run: runFor('ci/this-ship'),
      }),
    ).toBeNull();
    expect(
      provenanceMismatch(stampWith({ repo_root: HERE, branch: 'ci/this-ship', head: 'abc' }), {
        root: HERE,
        run: runFor('HEAD'),
      }),
    ).toBeNull();
  });
});

describe('provenance: what the operator actually reads', () => {
  const scope = { hard: ['scripts/check-thing.mjs'], soft: [] };
  const currentHashes = { 'scripts/check-thing.mjs': 'h-new' };
  const stamp = stampWith({ repo_root: 'C:/dev/Website', branch: 'main', head: 'abc' });

  const NOTE = 'the review stamp was minted in a DIFFERENT working tree (C:/dev/Website)';

  it('explains the miss ONCE, beside the paths rather than inside them', () => {
    const v = decide({ scope, currentHashes, stamp, provenanceNote: NOTE });
    expect(v.code).toBe(1);
    expect(v.reasons[0]).toContain('was never reviewed');
    expect(v.reasons[0]).not.toContain('note:'); // the path line stays readable
    expect(v.reasons.at(-1)).toBe('note: ' + NOTE);
  });

  it('does not repeat itself once per uncovered file', () => {
    const many = ['scripts/a.mjs', 'scripts/b.mjs', 'scripts/c.mjs'];
    const v = decide({
      scope: { hard: many, soft: [] },
      currentHashes: Object.fromEntries(many.map((r) => [r, 'h-new'])),
      stamp,
      provenanceNote: NOTE,
    });
    expect(v.reasons.filter((r: string) => r.startsWith('note: ')).length).toBe(1);
  });

  it('reaches "changed after review", not only "never reviewed"', () => {
    // The per-file variant of this note attached to ONE of the four uncovered
    // reasons -- and for a file present on both branches, "changed after
    // review" is the typical symptom, which got no explanation at all.
    const v = decide({
      scope,
      currentHashes,
      stamp: { ...stamp, hashes: { 'scripts/check-thing.mjs': 'h-old' } },
      provenanceNote: NOTE,
    });
    expect(v.code).toBe(1);
    expect(v.reasons[0]).toContain('changed after review');
    expect(v.reasons.at(-1)).toBe('note: ' + NOTE);
  });

  it('leaves the reasons clean when there is nothing to explain', () => {
    const v = decide({ scope, currentHashes, stamp, provenanceNote: null });
    expect(v.code).toBe(1);
    expect(v.reasons[0]).toContain('was never reviewed');
    expect(v.reasons.join(' ')).not.toContain('note:');
  });

  it('does not turn a covered ship red just because provenance differs', () => {
    // Coverage is decided by CONTENT HASH alone. Provenance explains a miss; it
    // must never create one, or a legitimate cross-tree review would be voided.
    const v = decide({
      scope,
      currentHashes: { 'scripts/check-thing.mjs': 'h1' },
      stamp: { ...stamp, hashes: { 'scripts/check-thing.mjs': 'h1' } },
      provenanceNote: 'minted somewhere else',
    });
    // Green carries an informational reason line; the verdict is what matters.
    expect(v.code).toBe(0);
    expect(v.status).toBe('green');
    expect(v.reasons.join(' ')).not.toContain('never reviewed');
    expect(v.reasons.join(' ')).not.toContain('note:');
  });
});

describe('the miss the provenance fields CANNOT reach', () => {
  it('names the absent stamp by absolute path', () => {
    // A review that loaded another worktree's copy of review-scope.mjs wrote a
    // valid receipt -- over there. HERE there is no stamp to read provenance
    // FROM, so the only thing separating "reviewed elsewhere" from "never
    // reviewed" is seeing WHICH file the gate went looking for. That, not the
    // provenance fields, is what would have named the 2026-08-04 failure.
    const gate = fs.readFileSync(path.join(REPO, 'scripts/ship-gate.mjs'), 'utf8');
    expect(gate).toContain('no valid review stamp found at ');
    expect(gate).toContain('STAMP_PATH');
  });

  it('carries that path into every uncovered reason', () => {
    const label = 'no valid review stamp found at C:/tmp/wc-prov/.claude/.review-stamp.json';
    const v = decide({
      scope: { hard: ['scripts/check-thing.mjs'], soft: [] },
      currentHashes: { 'scripts/check-thing.mjs': 'h-new' },
      stamp: null,
      stampAbsentLabel: label,
    });
    expect(v.code).toBe(1);
    expect(v.reasons[0]).toContain(label);
  });
});

describe('the mint journal: has this mechanism EVER worked here?', () => {
  const tmpLog = () =>
    path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mintlog-')), '.review-mint-log.json');

  it('says NEVER FIRED when there is no journal at all', () => {
    // The 2026-08-04 sentence. Five /code-review runs reported findings as prose
    // and minted nothing; the gate could only say "no valid review stamp found",
    // which reads as "nobody reviewed this". Provenance cannot reach this case --
    // there is no stamp to read fields from -- so the journal answers the prior
    // question instead: did the mint ever run here?
    const msg = describeMintHistory(readMintLog({ file: tmpLog() }));
    expect(msg).toContain('NEVER fired in this tree');
    expect(msg).toContain('TEXT');
  });

  it('records a genuine fire, and then says the hook IS wired', () => {
    const file = tmpLog();
    recordMintAttempt({ outcome: 'minted', genuine: true, file });
    const log = readMintLog({ file });
    expect(log).toMatchObject({ fires: 1, hook_fires: 1, last_outcome: 'minted' });
    expect(describeMintHistory(log)).toContain('HAS fired in this tree');
  });

  it('does NOT let a hand-run script pass as evidence the hook is wired', () => {
    // The inverse cry-wolf. `node review-stamp.mjs` with nothing on stdin is the
    // documented footgun, not a hook fire -- counting it would swap one false
    // reassurance for another and tell the operator the mechanism works.
    const file = tmpLog();
    recordMintAttempt({ outcome: 'refused-empty-stdin', genuine: false, file });
    const log = readMintLog({ file });
    expect(log).toMatchObject({ fires: 1, hook_fires: 0 });
    expect(describeMintHistory(log)).toContain('NEVER fired in this tree');
    expect(describeMintHistory(log)).toContain('never once with a ReportFindings payload');
  });

  it('accumulates across fires without losing the genuine count', () => {
    const file = tmpLog();
    recordMintAttempt({ outcome: 'refused-empty-stdin', genuine: false, file });
    recordMintAttempt({ outcome: 'minted', genuine: true, file });
    recordMintAttempt({ outcome: 'refused-empty-stdin', genuine: false, file });
    expect(readMintLog({ file })).toMatchObject({ fires: 3, hook_fires: 1 });
  });

  it('is SILENT rather than fatal when it cannot read or write', () => {
    // A diagnostic that breaks a review is worse than no diagnostic.
    const unwritable = path.join(os.tmpdir(), 'mintlog-nope', 'x', '\0bad', 'log.json');
    expect(() => recordMintAttempt({ outcome: 'minted', genuine: true, file: unwritable })).not.toThrow();
    expect(recordMintAttempt({ outcome: 'minted', genuine: true, file: unwritable })).toBeNull();
    expect(readMintLog({ file: unwritable })).toBeNull();
  });

  it('treats a corrupt journal as no journal', () => {
    const file = tmpLog();
    fs.writeFileSync(file, '{ this is not json');
    expect(readMintLog({ file })).toBeNull();
    expect(describeMintHistory(readMintLog({ file }))).toContain('NEVER fired');
  });

  it('never lets a throwing journal break the hook, or unmint a written stamp', () => {
    // The success path writes the receipt BEFORE journalling. A throw there must
    // not drop into the catch and report a real mint as a failure.
    const write = () => ({ hashes: { 'scripts/a.mjs': 'HA' }, deletions: [], findings: [] });
    const boom = () => {
      throw new Error('journal exploded');
    };
    const r = runHook({
      readInput: () => JSON.stringify({ tool_input: { findings: [] } }),
      write,
      record: boom,
    });
    expect(r).toEqual({ minted: true, code: 0 });
  });

  it('reaches the operator: the gate asks the journal, but only with no stamp', () => {
    // decide() takes the note as data; run() is what consults the journal, and
    // it reads the real tree, so assert the wiring. Guarded on a missing stamp:
    // with one in hand the mint plainly works and its history is just noise.
    const gate = fs.readFileSync(path.join(REPO, 'scripts/ship-gate.mjs'), 'utf8');
    expect(gate).toContain('mintNote: status === "ok" ? null : describeMintHistory(readMintLog())');
    const v = decide({
      scope: { hard: ['scripts/check-thing.mjs'], soft: [] },
      currentHashes: { 'scripts/check-thing.mjs': 'h-new' },
      stamp: null,
      mintNote: 'MINT-NOTE',
      stampAbsentLabel: 'no valid review stamp found at /x',
    });
    expect(v.code).toBe(1);
    expect(v.reasons.at(-1)).toBe('note: MINT-NOTE');
  });

  it('leaves the real journal alone when a spec drives runHook', () => {
    // record defaults to a no-op precisely so ten existing runHook specs do not
    // each append a GENUINE fire to this tree's journal -- which would have the
    // gate vouch for the mint on the strength of a test run.
    const seen: unknown[] = [];
    runHook({
      readInput: () => JSON.stringify({ tool_input: { findings: [] } }),
      write: () => ({ hashes: {}, deletions: [], findings: [] }),
      record: (e: unknown) => seen.push(e),
    });
    expect(seen).toHaveLength(1);
    const hook = fs.readFileSync(path.join(REPO, 'scripts/hooks/review-stamp.mjs'), 'utf8');
    expect(hook).toContain('record = () => {}');
    expect(hook).toContain('runHook({ record: recordMintAttempt })');
  });
});

describe('a diagnostic must never be mistaken for a finding', () => {
  const soft = { hard: [], soft: ['src/pages/Foo.tsx'] };
  const currentHashes = { 'src/pages/Foo.tsx': 'h-new' };
  const stamp = stampWith({ repo_root: 'C:/dev/Website', branch: 'main', head: 'abc' });
  const NOTE = "the review stamp was minted on branch 'main'";
  const green = (provenanceNote: string | null) =>
    decide({ scope: soft, currentHashes, stamp, strictSoft: false, provenanceNote });

  it('counts uncovered FILES, never the note explaining them', () => {
    // Measured before the fix: one uncovered soft file plus one note printed
    // "-1 of 1 risky file(s) covered by a fresh review stamp". The count is
    // totalScope minus warnings, so anything in that array that is not a file
    // silently under-reports coverage -- and a NEGATIVE count is the tell.
    const v = green(NOTE);
    expect(v.status).toBe('green');
    expect(v.reasons[0]).toBe('0 of 1 risky file(s) covered by a fresh review stamp');
    expect(v.reasons[0]).not.toContain('-1');
  });

  it('reports the same count with the note as without it', () => {
    // The stronger claim: provenance EXPLAINS a miss and must never change one.
    expect(green(NOTE).reasons[0]).toBe(green(null).reasons[0]);
  });

  it('keeps the note OUT of warnings, so the count cannot regress', () => {
    // Structural, not cosmetic. Every warnings entry is one uncovered file --
    // both the count above and the CLI's "unreviewed app code (advisory)"
    // banner depend on it, and that banner would announce a diagnostic as a
    // source file nobody reviewed.
    const v = green(NOTE);
    expect(v.warnings.join(' ')).not.toContain(NOTE);
    expect(v.warnings).toHaveLength(1);
    expect(v.notes).toEqual([NOTE]);
  });

  it('stays silent when there is nothing already red or warned', () => {
    const v = decide({
      scope: { hard: [], soft: [] },
      currentHashes: {},
      stamp,
      strictSoft: false,
      provenanceNote: NOTE,
    });
    expect(v.status).toBe('green');
    expect(v.notes).toEqual([]);
    expect(v.reasons.join(' ')).not.toContain('note:');
  });

  it('is not offered at all for a STALE stamp', () => {
    // A stale stamp covers NOTHING -- every path is red for age alone -- so the
    // branch note's "files it already stamped stay covered by content hash"
    // would be false exactly when it is read, sending the operator back for a
    // partial re-review when the whole ship needs one. The suppression lives at
    // the run() call site, which reads the real tree, so assert the wiring.
    const gate = fs.readFileSync(path.join(REPO, 'scripts/ship-gate.mjs'), 'utf8');
    const wiring = gate.slice(gate.indexOf('provenanceNote:'));
    expect(wiring.slice(0, 120)).toContain('stampIsFresh');
  });
});
