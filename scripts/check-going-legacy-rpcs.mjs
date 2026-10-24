#!/usr/bin/env node
/**
 * check-going-legacy-rpcs.mjs -- Going P2: the Website names NONE of the retired
 * interested/going attendance RPCs anywhere under src/.
 *
 * Going is one night (an occurrence) and one button, read and written only through
 * src/modules/going (set_my_going_v1, get_nights_going_v1, get_my_going_v1,
 * get_public_dancer_extras_v1). The old family wrote and read "interested", which
 * the owner retired, and counted whole series. Admin P5 drops them from the
 * database; this guard makes sure the Website stopped calling them first.
 *
 * Refused names (whole identifiers, anywhere in a file: a call, a test mock, a
 * comment, a README -- a mention is how a call comes back):
 *   set_attendance, set_attendance_vN, set_attendance_p5*
 *   set_my_occurrence_attendance (any suffix: _p5_v1, _p5_v2, _v1, ...)
 *   get_my_event_attendance (any suffix: _v2, _p5_v1, ...)
 *   get_festival_attendance, get_festival_attendance_batch (any suffix)
 *   get_event_attendance_counts, get_event_attendance_counts_by_range (any suffix)
 *
 * Any letter case (SQL names are case-insensitive). Template or split strings are
 * out of reach for a regex and are not claimed.
 *
 * Exempt: the generated schema mirrors (src/integrations/supabase/types.ts,
 * src/types/supabase.ts) -- they list every function the database still has, and
 * the names leave them when P5 drops the functions and types are regenerated.
 * Tests outside src/ (tests/) are not scanned: the brief scopes this to src/.
 *
 * Local:  node scripts/check-going-legacy-rpcs.mjs
 *         node scripts/check-going-legacy-rpcs.mjs --self-test
 *
 * Exit codes (R3): 0 clean, 1 a refused name found, 2 could not scan (src/ missing,
 * unreadable, or nothing scanned -- an empty walk is not a clean one).
 */
import fs from 'node:fs';
import path from 'node:path';
import { isEntryPoint } from './lib/entry-point.mjs';
import { REPO_ROOT } from './lib/review-scope.mjs';

export const LEGACY_NAME =
  /\b(set_attendance(?:_v\d+|_p5\w*)?|set_my_occurrence_attendance\w*|get_my_event_attendance\w*|get_festival_attendance\w*|get_event_attendance_counts\w*)\b/gi;

export const SCAN_ROOT = 'src';
export const EXEMPT = new Set(['src/integrations/supabase/types.ts', 'src/types/supabase.ts']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next']);
const TEXT_EXT = /\.(?:[cm]?[jt]sx?|json|md|mdx|css|html|txt|ya?ml|snap)$/i;
/** src/ holds well over a thousand source files; a walk that finds fewer has not looked. */
export const MIN_FILES = 100;

const norm = (p) => p.split(path.sep).join('/');

/** Every scannable file under root/src, repo-relative. Throws on an unreadable directory. */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && TEXT_EXT.test(entry.name)) {
        out.push(norm(path.relative(root, full)));
      }
    }
  };
  walk(path.join(root, SCAN_ROOT));
  return out.sort();
}

/** PURE: one file's text -> its offending lines. */
export function findLegacyNames(rel, text) {
  if (EXEMPT.has(rel)) return [];
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(LEGACY_NAME)) hits.push({ file: rel, line: i + 1, name: m[1] });
  });
  return hits;
}

/** Scan with injected I/O. Returns { code, kind, hits, scanned }. */
export function scan({ list, read }) {
  const files = list();
  const hits = [];
  for (const rel of files) hits.push(...findLegacyNames(rel, read(rel)));
  if (files.length < MIN_FILES) return { code: 2, kind: 'too-few-files', hits, scanned: files.length };
  if (hits.length > 0) return { code: 1, kind: 'legacy-name', hits, scanned: files.length };
  return { code: 0, kind: 'clean', hits, scanned: files.length };
}

function selfTest(log = console) {
  const many = Array.from({ length: MIN_FILES }, (_, i) => 'src/f' + i + '.ts');
  const fake = (files, body) => ({ list: () => files, read: (rel) => body(rel) });
  const clean = () => 'const x = 1;';
  const cases = [
    ['clean tree passes', scan(fake(many, clean)), 0, 'clean'],
    ['a call is caught', scan(fake(many, (r) => (r === 'src/f3.ts' ? "supabase.rpc('set_attendance', {})" : ''))), 1, 'legacy-name'],
    ['a mock name is caught', scan(fake(many, (r) => (r === 'src/f4.ts' ? "if (fn === 'get_my_event_attendance_v2')" : ''))), 1, 'legacy-name'],
    ['a suffixed name is caught', scan(fake(many, (r) => (r === 'src/f5.ts' ? 'get_event_attendance_counts_by_range' : ''))), 1, 'legacy-name'],
    ['a batch name is caught', scan(fake(many, (r) => (r === 'src/f6.ts' ? 'get_festival_attendance_batch' : ''))), 1, 'legacy-name'],
    ['the P5 event-page write is caught', scan(fake(many, (r) => (r === 'src/f7.ts' ? 'set_my_occurrence_attendance_p5_v1' : ''))), 1, 'legacy-name'],
    // R11: the unversioned and _vN spellings of every name, and any letter case.
    ...[
      'get_my_event_attendance',
      'get_my_event_attendance_v3',
      'set_attendance_v2',
      'set_my_occurrence_attendance',
      'set_my_occurrence_attendance_p5_v2',
      'set_my_occurrence_attendance_v1',
      'get_festival_attendance_v2',
      'get_event_attendance_counts_v1',
      'SET_ATTENDANCE',
      'Get_My_Event_Attendance_V2',
      'get_my_event_attendance_p5_v1',
      'set_attendance_p5_v1',
    ].map((name) => ['mutant ' + name + ' is caught', scan(fake(many, (r) => (r === 'src/f8.ts' ? "rpc('" + name + "')" : ''))), 1, 'legacy-name']),
    ['a README mention is caught', scan(fake([...many, 'src/x/README.md'], (r) => (r.endsWith('.md') ? 'reads get_my_event_attendance_v1' : ''))), 1, 'legacy-name'],
    ['generated types are exempt', scan(fake([...many, 'src/integrations/supabase/types.ts', 'src/types/supabase.ts'], (r) => (r.includes('supabase') ? 'set_attendance: {' : ''))), 0, 'clean'],
    ['the going RPCs are allowed', scan(fake(many, () => "rpc('set_my_going_v1'); rpc('get_nights_going_v1'); rpc('get_my_going_v1')")), 0, 'clean'],
    ['a longer identifier is not a hit', scan(fake(many, () => 'set_attendance_note; setAttendanceRpc')), 0, 'clean'],
    ['an empty walk is infrastructure', scan(fake([], clean)), 2, 'too-few-files'],
  ];
  let failed = 0;
  for (const [name, got, code, kind] of cases) {
    if (got.code !== code || got.kind !== kind) {
      failed += 1;
      log.error('FAIL ' + name + ': expected ' + code + '/' + kind + ', got ' + got.code + '/' + got.kind);
    }
  }
  // The exit-code owner, driven end to end (R5), each branch pinned by its kind above.
  const quiet = { out() {}, err() {} };
  const exits = [
    ['main: clean -> 0', main([], { ...quiet, list: () => many, read: clean }), 0],
    ['main: hit -> 1', main([], { ...quiet, list: () => many, read: () => 'set_attendance' }), 1],
    ['main: unreadable -> 2', main([], { ...quiet, list: () => { throw new Error('EACCES'); }, read: clean }), 2],
    ['main: empty walk -> 2', main([], { ...quiet, list: () => [], read: clean }), 2],
    ['main: unknown flag -> 2', main(['--bogus'], quiet), 2],
  ];
  for (const [name, got, want] of exits) {
    if (got !== want) {
      failed += 1;
      log.error('FAIL ' + name + ': expected ' + want + ', got ' + got);
    }
  }
  if (failed) {
    log.error('FAIL self-test -- ' + failed + ' case(s).');
    return false;
  }
  log.log('PASS self-test -- ' + (cases.length + exits.length) + ' cases, both directions.');
  return true;
}

/** Owns the exit code: returns it, the CLI tail assigns it (R5). */
export function main(argv = [], deps = {}) {
  const root = deps.root ?? REPO_ROOT;
  const {
    list = () => listFiles(root),
    read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8'),
    out = console.log,
    err = console.error,
  } = deps;
  const KNOWN = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN.includes(a));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) return selfTest() ? 0 : 1;

  let result;
  try {
    result = scan({ list, read });
  } catch (error) {
    err('check-going-legacy-rpcs: could not scan ' + SCAN_ROOT + '/: ' + (error?.message ?? String(error)));
    return 2;
  }
  if (result.kind === 'too-few-files') {
    err('check-going-legacy-rpcs: only ' + result.scanned + ' file(s) under ' + SCAN_ROOT + '/ (need ' + MIN_FILES + '); not a clean scan.');
    return 2;
  }
  if (result.code === 1) {
    err('Going legacy-RPC guard FAILED: retired attendance RPC name(s) in ' + SCAN_ROOT + '/.');
    err('Use src/modules/going (set_my_going_v1 / get_nights_going_v1 / get_my_going_v1 / get_public_dancer_extras_v1).');
    for (const h of result.hits) err('  - ' + h.file + ':' + h.line + '  ' + h.name);
    const files = new Set(result.hits.map((h) => h.file));
    err('Total: ' + result.hits.length + ' hit(s) in ' + files.size + ' file(s).');
    return 1;
  }
  out('Going legacy-RPC guard passed: ' + result.scanned + ' files under ' + SCAN_ROOT + '/, no retired attendance RPC names.');
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
