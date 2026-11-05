// isMoney (slice 2, drill A16; contract section 8; docs/automation-foundations.md). PURE, Node
// built-ins only. Detection is by PATH AND CONTENT, never path alone: every auto path (autopilot
// merge lane, bot-automerge, Dependabot lane) calls isMoney() immediately before acting and refuses
// on a hit with the one-line reason `money set: <name>`.
//
//   parseMoneySet(text) -> set (throws on anything but the documented shape)
//   isMoney({ files, statements?, set }) -> { money, names, reason }
//
// files: [{ path | filename, previous_filename?, patch?, changes?, added?: [], removed?: [] }]
//   (GitHub pull-file objects work as they are). Scanned: (a) every path (and a rename's old path)
//   against `paths` and for any name; (b) every ADDED and REMOVED line, from `added`/`removed` or
//   parsed from `patch` (context lines are not changes); (c) `statements`, a migration's parsed
//   statements supplied by the caller. No path is exempt: .md and .json are scanned like code.
//
// THE NAME RULE: a name matches as a whole identifier: the characters either side must not be
// [A-Za-z0-9_] (so `ticket_orders_x` and `xticket_orders` are NOT hits; `-`, `.`, `(` are
// boundaries). Case-sensitive. `*` inside a name stands for [A-Za-z0-9_]*. A `keys` entry may be
// {regex, why}: the regex must be anchored (^...$) and is tested against every identifier token.
// Path globs are case-insensitive: `**` any depth, `*` within one segment.
//
// FAIL CLOSED: an unreadable set, no files, a file without a path, a file with changes but no
// patch (GitHub omits big patches), or a patch with fewer +/- lines than `changes` (truncated) is
// `money: true` with reason `money set: unreadable (<why>)`. A hit's reason names the matched text
// (a line or statement) or the glob (a path).

export const MONEY_SET_PATH = '.github/automation/money-set.json';
const LISTS = ['paths', 'tables', 'functions', 'keys', 'flags', 'env'];
const ID = 'A-Za-z0-9_';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseMoneySet(text) {
  if (typeof text !== 'string') throw new Error('money-set: no text');
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error(`money-set: not JSON (${e.message})`); }
  return validateMoneySet(j);
}

function validateMoneySet(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('money-set: not an object');
  for (const k of Object.keys(j)) if (k !== 'version' && !LISTS.includes(k) && !k.startsWith('_')) throw new Error(`money-set: unknown key ${k}`);
  if (j.version !== 1) throw new Error('money-set: version is not 1');
  for (const k of LISTS) {
    if (!Array.isArray(j[k])) throw new Error(`money-set: ${k} is not a list`);
    for (const e of j[k]) {
      if (k === 'keys' && e && typeof e === 'object') {
        if (typeof e.regex !== 'string' || typeof e.why !== 'string' || !e.why.trim()) throw new Error('money-set: a keys regex entry needs regex and why');
        if (!e.regex.startsWith('^') || !e.regex.endsWith('$')) throw new Error(`money-set: keys regex ${e.regex} is not anchored ^...$`);
        try { new RegExp(e.regex); } catch (err) { throw new Error(`money-set: keys regex ${e.regex} will not compile (${err.message})`); }
        continue;
      }
      if (typeof e !== 'string' || !e.trim()) throw new Error(`money-set: ${k} has a non-string or empty entry`);
    }
  }
  return j;
}

/** A path glob -> anchored, case-insensitive RegExp. */
export function globRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (glob[i] === '*') re += '[^/]*';
    else re += esc(glob[i]);
  }
  return new RegExp(`^${re}$`, 'i');
}

/** A name -> a global whole-identifier RegExp (`*` = [A-Za-z0-9_]*). */
export function nameRe(name) {
  return new RegExp(`(?<![${ID}])${name.split('*').map(esc).join(`[${ID}]*`)}(?![${ID}])`, 'g');
}

function compile(set) {
  const s = validateMoneySet(set);
  const names = [];
  const regexes = [];
  for (const k of LISTS.filter((x) => x !== 'paths')) {
    for (const e of s[k]) {
      if (typeof e === 'string') names.push(nameRe(e));
      else regexes.push(new RegExp(e.regex));
    }
  }
  return { paths: s.paths.map((g) => [g, globRe(g)]), names, regexes };
}

/** Every hit in one text, in order of position: the matched text. */
function hitsIn(text, c) {
  const found = [];
  for (const re of c.names) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) found.push([m.index, m[0]]);
  }
  const tok = new RegExp(`[${ID}]+`, 'g');
  for (let m = tok.exec(text); m; m = tok.exec(text)) if (c.regexes.some((r) => r.test(m[0]))) found.push([m.index, m[0]]);
  return found.sort((a, b) => a[0] - b[0]).map(([, t]) => t);
}

/** The changed lines of one file, or { why } when they cannot be read in full. */
function changedLines(f, p) {
  if (Array.isArray(f.added) || Array.isArray(f.removed)) {
    const lines = [...(f.added || []), ...(f.removed || [])];
    if (lines.some((l) => typeof l !== 'string')) return { why: `non-text lines for ${p}` };
    return { lines };
  }
  if (typeof f.patch !== 'string') {
    if (f.changes === 0) return { lines: [] }; // binary or rename-only: nothing to read
    return { why: `no patch for ${p}` };
  }
  const lines = f.patch.split(/\r?\n/).filter((l) => (l.startsWith('+') || l.startsWith('-'))).map((l) => l.slice(1));
  if (Number.isInteger(f.changes) && lines.length < f.changes) return { why: `truncated patch for ${p}: ${lines.length} of ${f.changes} changed lines` };
  return { lines };
}

export function isMoney({ files, statements, set } = {}) {
  const names = [];
  let reason = '';
  const hit = (n) => { if (!names.includes(n)) names.push(n); if (!reason) reason = `money set: ${n}`; };
  const unreadable = (why) => ({ money: true, names, reason: reason || `money set: unreadable (${why})` });
  let c;
  try { c = compile(set); } catch (e) { return unreadable(`set: ${set && typeof set === 'object' ? e.message : 'not a money set'}`); }
  if (!Array.isArray(files) || !files.length) return unreadable('no changed files read');
  if (statements !== undefined && (!Array.isArray(statements) || statements.some((s) => typeof s !== 'string'))) return unreadable('statements are not strings');
  let broken = '';
  for (const f of files) {
    const p = f && (f.path ?? f.filename);
    if (typeof p !== 'string' || !p) { broken = broken || 'a changed file without a path'; continue; }
    for (const q of [p, f.previous_filename].filter((x) => typeof x === 'string' && x)) {
      const g = c.paths.find(([, re]) => re.test(q));
      if (g) hit(g[0]);
      for (const n of hitsIn(q, c)) hit(n);
    }
    const r = changedLines(f, p);
    if (r.why) { broken = broken || r.why; continue; }
    for (const l of r.lines) for (const n of hitsIn(l, c)) hit(n);
  }
  for (const s of statements || []) for (const n of hitsIn(s, c)) hit(n);
  if (broken && !reason) return unreadable(broken);
  if (broken) return { money: true, names, reason };
  return { money: names.length > 0, names, reason };
}
