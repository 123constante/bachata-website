#!/usr/bin/env node
/**
 * check-event-rules-mirror.mjs -- the organiser event rules, byte-identical in both repos.
 *
 * WHAT IT GUARDS. src/modules/organiser/shared/event-rules.json is ONE rule set
 * shared with the admin repo (plan "How one rule set works"; same pattern as the
 * day-rollover mirror, CI #8). This compares it, byte for byte, with the admin
 * repo's copy. Where the admin copy lives is given by `--admin <file>` or the
 * EVENT_RULES_ADMIN_COPY env var (a path to the admin repo's event-rules.json).
 *
 * ABSENT ADMIN COPY. With no path at all (no --admin, no env var) the check
 * prints a clear SKIPPED line and exits 0 -- nothing was compared and it says so.
 * A path that was ASKED FOR -- `--admin <file>` (or a bare `--admin`) -- and is
 * missing is exit 2: the caller meant to compare and a typo must not pass green.
 * With EVENT_RULES_ADMIN_REQUIRED=1 (CI) any missing path or file is exit 2.
 *
 * LINE ENDINGS. The Website checkout is CRLF (.gitattributes eol=crlf), an admin
 * checkout may be LF; both copies are compared after CRLF -> LF, so only content
 * differences count.
 *
 * Exit codes: 0 identical (or skipped, said aloud) / 1 the copies differ /
 * 2 infrastructure (required copy absent, unreadable file).
 * Flags: --self-test, --admin <file>.
 */
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);
const LOCAL_REL = 'src/modules/organiser/shared/event-rules.json';

const toLf = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');

/** Compares two Buffers; returns the 1-based line of the first difference, or 0 when identical. */
function firstDifference(a, b) {
  if (a.equals(b)) return 0;
  const n = Math.min(a.length, b.length);
  let line = 1;
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) return line;
    if (a[i] === 0x0a) line += 1;
  }
  return line;
}

/** The decision, as data so the self-test can pin WHICH branch produced a code. */
export function compare({ localPath, adminPath, required, asked = false, exists = existsSync, read = readFileSync }) {
  if (!exists(localPath)) return { code: 2, branch: 'local-missing', message: `ERROR: ${localPath} is missing` };
  if (!adminPath || !exists(adminPath)) {
    const where = adminPath ? `not found at ${adminPath}` : 'no path given (--admin or EVENT_RULES_ADMIN_COPY)';
    if (asked) return { code: 2, branch: 'admin-asked-absent', message: `ERROR: --admin was given, but the admin event-rules.json: ${where}` };
    if (required) return { code: 2, branch: 'admin-required-absent', message: `ERROR: admin event-rules.json ${where}, and EVENT_RULES_ADMIN_REQUIRED=1` };
    return { code: 0, branch: 'skipped', message: `SKIPPED: admin event-rules.json ${where}; NOTHING WAS COMPARED` };
  }
  let local;
  let admin;
  try {
    local = toLf(read(localPath));
    admin = toLf(read(adminPath));
  } catch (err) {
    return { code: 2, branch: 'unreadable', message: `ERROR: cannot read a copy: ${err.message}` };
  }
  const line = firstDifference(local, admin);
  if (line === 0) return { code: 0, branch: 'identical', message: `OK: event-rules.json is identical, line endings aside (${local.length} bytes)` };
  return { code: 1, branch: 'differs', message: `FAIL: event-rules.json differs from the admin copy, first at line ${line}` };
}

function main(argv, env, log) {
  const i = argv.indexOf('--admin');
  const given = i >= 0 ? argv[i + 1] : undefined;
  const adminPath = (i >= 0 ? (given && !given.startsWith('--') ? given : '') : env.EVENT_RULES_ADMIN_COPY) || '';
  const result = compare({
    localPath: path.join(REPO_ROOT, LOCAL_REL),
    adminPath,
    required: env.EVENT_RULES_ADMIN_REQUIRED === '1',
    asked: i >= 0,
  });
  log(result.message);
  return result.code;
}

function selfTest(log) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rules-mirror-'));
  const put = (name, text) => {
    const file = path.join(dir, name);
    writeFileSync(file, text);
    return file;
  };
  const failures = [];
  const expect = (name, got, code, branch) => {
    if (got.code !== code || got.branch !== branch) failures.push(`${name}: got ${got.code}/${got.branch}, want ${code}/${branch}`);
  };
  try {
    const a = put('a.json', '{\n  "v": 1\n}\n');
    const same = put('same.json', '{\n  "v": 1\n}\n');
    const diff = put('diff.json', '{\n  "v": 2\n}\n');
    const crlf = put('crlf.json', '{\r\n  "v": 1\r\n}\r\n');
    const missing = path.join(dir, 'nope.json');
    expect('identical', compare({ localPath: a, adminPath: same, required: false }), 0, 'identical');
    expect('differs', compare({ localPath: a, adminPath: diff, required: false }), 1, 'differs');
    expect('CRLF vs LF is the same content', compare({ localPath: a, adminPath: crlf, required: false }), 0, 'identical');
    expect('CRLF copy that differs still differs', compare({ localPath: crlf, adminPath: diff, required: false }), 1, 'differs');
    expect('asked, absent, local run', compare({ localPath: a, adminPath: missing, required: false, asked: true }), 2, 'admin-asked-absent');
    expect('asked, no value, local run', compare({ localPath: a, adminPath: '', required: false, asked: true }), 2, 'admin-asked-absent');
    expect('absent, local run', compare({ localPath: a, adminPath: missing, required: false }), 0, 'skipped');
    expect('no path, local run', compare({ localPath: a, adminPath: '', required: false }), 0, 'skipped');
    expect('absent, CI run', compare({ localPath: a, adminPath: missing, required: true }), 2, 'admin-required-absent');
    expect('no path, CI run', compare({ localPath: a, adminPath: '', required: true }), 2, 'admin-required-absent');
    expect('local missing', compare({ localPath: missing, adminPath: same, required: false }), 2, 'local-missing');
    const throwing = () => { throw new Error('EIO'); };
    expect('unreadable', compare({ localPath: a, adminPath: same, required: false, read: throwing }), 2, 'unreadable');
    // THE EXIT-CODE CONTRACT ITSELF: main() owns process.exitCode, so drive it.
    const lines = [];
    const code = main(['--admin', missing], { EVENT_RULES_ADMIN_REQUIRED: '1' }, (m) => lines.push(m));
    if (code !== 2) failures.push(`main() with a required, absent copy returned ${code}, want 2`);
    const typo = main(['--admin', missing], {}, (m) => lines.push(m));
    if (typo !== 2) failures.push(`main() with --admin <missing file> returned ${typo}, want 2`);
    const bare = main(['--admin'], {}, (m) => lines.push(m));
    if (bare !== 2) failures.push(`main() with a bare --admin returned ${bare}, want 2`);
    const flagNext = main(['--admin', '--self-check'], {}, (m) => lines.push(m));
    if (flagNext !== 2) failures.push(`main() with --admin followed by a flag returned ${flagNext}, want 2`);
    const real = main([], {}, (m) => lines.push(m));
    if (real !== 0) failures.push(`main() with no admin copy returned ${real}, want 0 (skipped)`);
    const realCopy = main(['--admin', path.join(REPO_ROOT, LOCAL_REL)], {}, (m) => lines.push(m));
    if (realCopy !== 0) failures.push(`main() comparing the real file with itself returned ${realCopy}, want 0`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  failures.forEach((f) => log(`SELF-TEST FAIL: ${f}`));
  if (failures.length === 0) log('self-test: all cases behaved');
  return failures.length === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  process.exitCode = argv.includes('--self-test') ? selfTest(console.log) : main(argv, process.env, console.log);
}

export { main, selfTest };
