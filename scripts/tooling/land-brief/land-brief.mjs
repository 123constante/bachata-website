#!/usr/bin/env node
// land-brief: land docs-only brief files on a brief branch through the GitHub
// contents API, without the Website pre-push unit gate. Docs paths only.
//
//   node land-brief.mjs <owner/name> <brief-branch> <file>... [--base main]
//        [--message "<text>"] [--root <dir>] [--dry-run]
//   node land-brief.mjs --self-test
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1024 * 1024;
const DOC_DIRS = ['briefs', 'design', 'review', 'handovers', 'plans'];

export class Refusal extends Error {}

/** True only for docs/<allowed dir>/**.md|.json repo paths. */
export function pathAllowed(p) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('\\')) return false;
  const parts = p.split('/');
  if (parts.some((s) => s === '' || s === '.' || s === '..' || s.startsWith('.'))) return false;
  if (parts[0] !== 'docs' || parts.length < 3 || !DOC_DIRS.includes(parts[1])) return false;
  return /\.(md|json)$/.test(parts[parts.length - 1]);
}

export function branchAllowed(b) {
  return (
    typeof b === 'string' &&
    /^[A-Za-z0-9._\/-]+$/.test(b) &&
    !b.includes('..') &&
    (b.startsWith('brief/') || b.startsWith('claude/review-') || b.startsWith('claude/done-'))
  );
}

const SECRET_RE = /(api[_-]?key|secret|token|password)\s*[:=]\s*\S{12,}/i;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

/** Returns null when the content is fine, else a refusal reason (never the value). */
export function contentProblem(buf) {
  if (buf.length > MAX_BYTES) return 'over 1 MB';
  if (buf.includes(0)) return 'binary file (NUL byte)';
  const lines = buf.toString('utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (SECRET_RE.test(lines[i]) || JWT_RE.test(lines[i])) {
      return `likely secret on line ${i + 1}`;
    }
  }
  return null;
}

function ghJson(deps, args) {
  const out = deps.gh(args);
  try {
    return JSON.parse(out);
  } catch {
    throw new Error('unparseable gh output');
  }
}

/**
 * opts: { repo, branch, files: [{local, repoPath}], base, message, dryRun }
 * deps: { gh(args)->stdout, readFile(p)->Buffer, tmpdir(), log(line), allow? }
 * Returns { head, count }. Throws Refusal (exit 2) or Error (exit 1).
 */
export function landBrief(opts, deps) {
  const allow = deps.allow ?? pathAllowed;
  const { repo, branch, base = 'main', dryRun = false } = opts;
  const log = deps.log ?? (() => {});
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '')) throw new Refusal(`bad repo: ${repo}`);
  if (!branchAllowed(branch)) throw new Refusal(`branch not allowed: ${branch}`);
  if (!opts.files?.length) throw new Refusal('no files given');

  // Phase 1: every check, before anything is written.
  const staged = [];
  for (const f of opts.files) {
    if (!allow(f.repoPath)) throw new Refusal(`path not allowed: ${f.repoPath}`);
    const buf = deps.readFile(f.local);
    const problem = contentProblem(buf);
    if (problem) throw new Refusal(`${f.repoPath}: ${problem}`);
    staged.push({ ...f, buf });
  }

  // Phase 2: GitHub.
  const api = `repos/${repo}`;
  let exists = true;
  try {
    deps.gh(['api', `${api}/git/ref/heads/${branch}`, '-q', '.object.sha']);
  } catch {
    exists = false;
  }
  if (!exists) {
    const sha = deps.gh(['api', `${api}/git/ref/heads/${base}`, '-q', '.object.sha']).trim();
    if (!sha) throw new Error(`no sha for ${base}`);
    if (dryRun) log(`would create branch ${branch} from ${base}`);
    else deps.gh(['api', '-X', 'POST', `${api}/git/refs`, '-f', `ref=refs/heads/${branch}`, '-f', `sha=${sha}`]);
  }

  const tmp = dryRun ? null : fs.mkdtempSync(path.join(deps.tmpdir(), 'land-brief-'));
  let n = 0;
  try {
    for (const f of staged) {
      let remoteSha = null;
      let same = false;
      if (exists) {
        try {
          const cur = ghJson(deps, ['api', `${api}/contents/${f.repoPath}?ref=${branch}`]);
          remoteSha = cur.sha;
          same = Buffer.from((cur.content ?? '').replace(/\s/g, ''), 'base64').equals(f.buf);
        } catch (e) {
          if (e.message === 'unparseable gh output') throw e;
          remoteSha = null; // 404: file is new on this branch
        }
      }
      if (same) {
        log(`unchanged ${f.repoPath}`);
        n++;
        continue;
      }
      const verb = remoteSha ? 'updated' : 'created';
      if (dryRun) {
        log(`would be ${verb} ${f.repoPath}`);
        n++;
        continue;
      }
      const body = {
        message: opts.message ?? `docs: land ${f.repoPath} [skip preview]`,
        branch,
        content: f.buf.toString('base64'),
      };
      if (remoteSha) body.sha = remoteSha;
      const jf = path.join(tmp, `${n}.json`);
      fs.writeFileSync(jf, JSON.stringify(body));
      deps.gh(['api', '-X', 'PUT', `${api}/contents/${f.repoPath}`, '--input', jf]);
      log(`${verb} ${f.repoPath}`);
      n++;
    }
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
  const head = dryRun && !exists ? '(dry-run)' : deps.gh(['api', `${api}/git/ref/heads/${branch}`, '-q', '.object.sha']).trim();
  return { head, count: n };
}

function realDeps() {
  return {
    gh: (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
    readFile: (p) => fs.readFileSync(p),
    tmpdir: () => os.tmpdir(),
    log: (l) => console.log(l),
  };
}

function parseArgs(argv) {
  const o = { positional: [], base: 'main', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--base') o.base = argv[++i];
    else if (a === '--message') o.message = argv[++i];
    else if (a === '--root') o.root = argv[++i];
    else o.positional.push(a);
  }
  return o;
}

function main(argv) {
  const a = parseArgs(argv);
  const [repo, branch, ...locals] = a.positional;
  let root = a.root;
  if (!root) {
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  }
  root = path.resolve(root);
  const files = locals.map((l) => {
    const abs = path.resolve(l);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    return { local: abs, repoPath: rel.startsWith('..') ? `../${rel}` : rel };
  });
  try {
    const r = landBrief({ repo, branch, files, base: a.base, message: a.message, dryRun: a.dryRun }, realDeps());
    console.log(`LANDED ${branch} ${r.head} ${r.count} file(s)`);
    return 0;
  } catch (e) {
    if (e instanceof Refusal) {
      console.error(`REFUSED: ${e.message}`);
      return 2;
    }
    const short = String(e.stderr || e.message || e).split('\n')[0].slice(0, 200);
    console.error(`ERROR: ${short}`);
    return 1;
  }
}

// ---------------------------------------------------------------- self-test
function selfTest() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-selftest-'));
  const results = [];
  const B64 = (s) => Buffer.from(s).toString('base64');
  const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abcDEF123_-xyz';

  function harness({ existing = false, remote = {}, failOn = null, files }) {
    const calls = [];
    const logs = [];
    const dirsSeen = [];
    const deps = {
      calls,
      logs,
      dirsSeen,
      tmpdir: () => tmpRoot,
      log: (l) => logs.push(l),
      readFile: (p) => files[p],
      gh(args) {
        calls.push(args);
        const s = args.join(' ');
        if (failOn && s.includes(failOn)) throw new Error('boom');
        if (args.includes('--input')) {
          const j = args[args.indexOf('--input') + 1];
          dirsSeen.push(path.dirname(j));
          if (!fs.existsSync(j)) throw new Error('no json');
        }
        if (s.includes('git/ref/heads/main')) return 'mainsha\n';
        if (s.includes('git/ref/heads/')) {
          if (!existing && !calls.some((c) => c.includes('POST'))) throw new Error('404');
          return 'headsha\n';
        }
        if (s.includes('/contents/') && !args.includes('PUT')) {
          const p = args[1].split('/contents/')[1].split('?')[0];
          if (!(p in remote)) throw new Error('404');
          return JSON.stringify({ sha: 'blob1', content: B64(remote[p]) });
        }
        return '{}';
      },
    };
    return deps;
  }
  const writes = (d) => d.calls.filter((c) => c.includes('POST') || c.includes('PUT'));
  const run = (opts, deps, allow) => {
    try {
      const r = landBrief(opts, allow ? { ...deps, allow } : deps);
      return { ok: true, r };
    } catch (e) {
      return { ok: false, refused: e instanceof Refusal, err: e };
    }
  };
  const one = (repoPath, content = '# hi\n', branch = 'brief/x') => ({
    opts: { repo: 'o/n', branch, files: [{ local: 'L', repoPath }] },
    files: { L: Buffer.from(content) },
  });

  const cases = [];
  const add = (name, fn) => cases.push({ name, fn });
  const refusedClean = (repoPath, content, branch) => (allow) => {
    const c = one(repoPath, content, branch);
    const d = harness({ files: c.files });
    const x = run(c.opts, d, allow);
    return !x.ok && x.refused && writes(d).length === 0;
  };

  add('docs/briefs/x.md allowed', (allow) => {
    const c = one('docs/briefs/x.md');
    const d = harness({ files: c.files });
    const x = run(c.opts, d, allow);
    return x.ok && writes(d).some((w) => w.includes('PUT'));
  });
  add('src/x.ts refused', refusedClean('src/x.ts'));
  add('docs/../src/x.ts refused', refusedClean('docs/../src/x.ts'));
  add('/abs path refused', refusedClean('/docs/briefs/x.md'));
  add('.github/workflows/x.yml refused', refusedClean('.github/workflows/x.yml'));
  add('docs/briefs/x.ts refused (extension)', refusedClean('docs/briefs/x.ts'));
  add('dotfile under docs refused', refusedClean('docs/briefs/.x.md'));
  add('branch main refused', refusedClean('docs/briefs/x.md', '# a', 'main'));
  add('branch brief/x ok', (allow) => {
    const c = one('docs/briefs/x.md', '# a', 'brief/x');
    return run(c.opts, harness({ files: c.files }), allow).ok;
  });
  add('branch claude/w3c-1-repeat refused', refusedClean('docs/briefs/x.md', '# a', 'claude/w3c-1-repeat'));
  add('JWT file refused', refusedClean('docs/briefs/x.md', `see ${JWT}\n`));
  add('token: abcdefghijklmnop refused', refusedClean('docs/briefs/x.md', 'a\ntoken: abcdefghijklmnop\n'));
  add('NUL byte refused', refusedClean('docs/briefs/x.md', 'a\0b'));
  add('over 1 MB refused', refusedClean('docs/briefs/x.md', 'a'.repeat(MAX_BYTES + 1)));
  add('existing branch reuses without POST', (allow) => {
    const c = one('docs/briefs/x.md');
    const d = harness({ existing: true, files: c.files });
    const x = run(c.opts, d, allow);
    return x.ok && !d.calls.some((a) => a.includes('POST'));
  });
  add('new branch POSTs once', (allow) => {
    const c = one('docs/briefs/x.md');
    const d = harness({ files: c.files });
    const x = run(c.opts, d, allow);
    return x.ok && d.calls.filter((a) => a.includes('POST')).length === 1;
  });
  add('unchanged file sends no PUT', (allow) => {
    const c = one('docs/briefs/x.md', '# same\n');
    const d = harness({ existing: true, remote: { 'docs/briefs/x.md': '# same\n' }, files: c.files });
    const x = run(c.opts, d, allow);
    return x.ok && writes(d).length === 0 && d.logs.some((l) => l.startsWith('unchanged'));
  });
  add('changed file PUTs with sha', (allow) => {
    const c = one('docs/briefs/x.md', '# new\n');
    const d = harness({ existing: true, remote: { 'docs/briefs/x.md': '# old\n' }, files: c.files });
    const x = run(c.opts, d, allow);
    const put = d.calls.find((a) => a.includes('PUT'));
    return x.ok && !!put && d.logs.some((l) => l.startsWith('updated'));
  });
  add('gh failure -> Error (exit 1), not Refusal', (allow) => {
    const c = one('docs/briefs/x.md');
    const d = harness({ files: c.files, failOn: 'PUT' });
    const x = run(c.opts, d, allow);
    return !x.ok && !x.refused;
  });
  add('temp dir removed after success', (allow) => {
    const c = one('docs/briefs/x.md');
    const d = harness({ files: c.files });
    const x = run(c.opts, d, allow);
    return x.ok && d.dirsSeen.length === 1 && !fs.existsSync(d.dirsSeen[0]);
  });
  add('temp dir removed after failure', (allow) => {
    const c = one('docs/briefs/x.md');
    const d = harness({ files: c.files, failOn: 'PUT' });
    run(c.opts, d, allow);
    return fs.readdirSync(tmpRoot).length === 0;
  });
  add('dry-run makes zero write calls', (allow) => {
    const c = one('docs/briefs/x.md');
    c.opts.dryRun = true;
    const d = harness({ files: c.files });
    const x = run(c.opts, d, allow);
    return x.ok && writes(d).length === 0;
  });
  add('one bad file among good writes nothing', (allow) => {
    const files = { A: Buffer.from('# a'), B: Buffer.from('# b') };
    const d = harness({ files });
    const x = run(
      { repo: 'o/n', branch: 'brief/x', files: [{ local: 'A', repoPath: 'docs/briefs/a.md' }, { local: 'B', repoPath: 'src/b.ts' }] },
      d,
      allow,
    );
    return !x.ok && x.refused && writes(d).length === 0;
  });

  let fail = 0;
  try {
    for (const c of cases) {
      let ok = false;
      try {
        ok = !!c.fn();
      } catch {
        ok = false;
      }
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
      if (!ok) fail++;
    }
    // Mutant: allow-list replaced by () => true must turn >= 3 cases red.
    let red = 0;
    const redNames = [];
    for (const c of cases) {
      let ok = false;
      try {
        ok = !!c.fn(() => true);
      } catch {
        ok = false;
      }
      if (!ok) {
        red++;
        redNames.push(c.name);
      }
    }
    const mutantOk = red >= 3;
    console.log(`${mutantOk ? 'PASS' : 'FAIL'}  mutant allow=()=>true turns ${red} case(s) red (need >= 3): ${redNames.join('; ')}`);
    if (!mutantOk) fail++;
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
  console.log(fail ? `SELF-TEST FAILED (${fail})` : `SELF-TEST OK (${cases.length} cases + mutant)`);
  return fail ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  process.exit(argv.includes('--self-test') ? selfTest() : main(argv));
}
