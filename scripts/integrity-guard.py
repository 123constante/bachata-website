#!/usr/bin/env python3
"""
integrity-guard.py — production-grade source-file corruption detector.

Defends against the Cowork sandbox's Linux→Windows mount file-write bug,
which can:
  (a) inject NULL bytes into written files
  (b) silently TRUNCATE files mid-content (no nulls, just missing tail)

This script catches both classes by delegating to real parsers per
language. It is also self-sealed against corruption by a sha256 pin
(see `bin/check-integrity.sh` wrapper which copies the script to /tmp,
verifies the pin, and runs from there).

Per-extension checks:
  .json            → JSON.parse (skips jsonc files like tsconfig)
  .yml / .yaml     → yaml.safe_load (PyYAML; skipped if not installed)
  .js .cjs .mjs    → node --check (built-in syntax check)
  .ts .tsx .jsx    → TypeScript parser via _integrity_ts_parse.cjs helper
  .sql             → balanced-paren + unterminated-string heuristic
  *                → null-byte scan + UTF-8 decode + size-shrinkage vs HEAD

Usage:
    python3 scripts/integrity-guard.py             # all tracked source files
    python3 scripts/integrity-guard.py --staged    # staged files only
    python3 scripts/integrity-guard.py --files a.ts b.ts   # explicit list
    python3 scripts/integrity-guard.py --json      # machine-readable output
    python3 scripts/integrity-guard.py --no-self-check     # skip sha256 self-seal
    python3 scripts/integrity-guard.py --no-ts     # skip TS parse phase (faster)

Exit codes:
    0   clean
    1   corruption detected
    2   self-check failed (script tampered or corrupted)
    3   I/O / argument error
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SOURCE_EXTS = {
    '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs',
    '.json', '.sql', '.yml', '.yaml',
    '.html', '.css', '.sh', '.py', '.md',
}

PARSE_AS_JSON = {'.json'}
PARSE_AS_JS = {'.js', '.cjs', '.mjs'}
PARSE_AS_TS = {'.ts', '.tsx', '.jsx'}
PARSE_AS_SQL = {'.sql'}
PARSE_AS_YAML = {'.yml', '.yaml'}

# JSON files that are actually jsonc — skip strict parse
JSONC_PATTERNS = [
    re.compile(r'(^|/)tsconfig[^/]*\.json$'),
    re.compile(r'(^|/)\.vscode/.*\.json$'),
    re.compile(r'(^|/)package-lock\.json$'),
    re.compile(r'(^|/)\.claude/settings(\.local)?\.json$'),
]

# Paths that should never be checked (gitignored-but-tracked artefacts,
# vendored code, etc). Glob-match against the path.
SKIP_PATTERNS = [
    re.compile(r'^test-results/'),
    re.compile(r'^\.claude/worktrees/'),
    re.compile(r'^node_modules/'),
    re.compile(r'^dist/'),
    re.compile(r'^build/'),
    re.compile(r'^playwright-report/'),
    re.compile(r'^supabase/.temp/'),
]

# Drastic shrinkage threshold (catches one class of truncation: file
# silently halves with no working-tree changes). Active edits naturally
# defeat this signal — that's why we ALSO have parser checks above.
SIZE_SHRINK_RATIO = 0.5
SIZE_SHRINK_MIN_BYTES = 500

SELF_SHA_FILE = '.integrity-guard.sha256'
TS_HELPER = 'scripts/_integrity_ts_parse.cjs'


# ─── Self-seal ────────────────────────────────────────────────────────────

def self_check(repo_root: Path) -> int:
    pin_path = repo_root / SELF_SHA_FILE
    if not pin_path.exists():
        print(f'integrity-guard: no {SELF_SHA_FILE} pin found; '
              f'run `bin/integrity-pin.sh` to lock the current script',
              file=sys.stderr)
        return 0
    try:
        with open(__file__, 'rb') as f:
            actual = hashlib.sha256(f.read()).hexdigest()
        expected = pin_path.read_text().strip().split()[0]
    except Exception as exc:
        print(f'integrity-guard: SELF-CHECK FAILED to read pin: {exc}',
              file=sys.stderr)
        return 2
    if actual != expected:
        print(f'integrity-guard: SELF-CHECK FAILED — script sha mismatch',
              file=sys.stderr)
        print(f'  expected: {expected}', file=sys.stderr)
        print(f'  actual:   {actual}', file=sys.stderr)
        print(f'  the guard may be corrupted or tampered with.', file=sys.stderr)
        print(f'  restore: git checkout HEAD -- scripts/integrity-guard.py',
              file=sys.stderr)
        print(f'  or, if intentional change: bin/integrity-pin.sh', file=sys.stderr)
        return 2
    return 0


# ─── Discovery ────────────────────────────────────────────────────────────

def list_tracked_files(staged: bool, repo_root: Path) -> list[str]:
    if staged:
        cmd = ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR']
    else:
        cmd = ['git', 'ls-files']
    out = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True, check=True)
    return [line for line in out.stdout.splitlines() if line.strip()]


def is_source_file(path: str) -> bool:
    if any(p.search(path) for p in SKIP_PATTERNS):
        return False
    ext = os.path.splitext(path)[1].lower()
    return ext in SOURCE_EXTS


def is_jsonc(path: str) -> bool:
    return any(p.search(path) for p in JSONC_PATTERNS)


# ─── Issue model ──────────────────────────────────────────────────────────

class Issue:
    __slots__ = ('path', 'line', 'code', 'reason')

    def __init__(self, path: str, line: int, reason: str, code: str = ''):
        self.path = path
        self.line = line
        self.code = code
        self.reason = reason

    def to_dict(self):
        return {'path': self.path, 'line': self.line, 'code': self.code, 'reason': self.reason}

    def __str__(self):
        prefix = f'[{self.code}] ' if self.code else ''
        return f'{self.path}:{self.line}: {prefix}{self.reason}'


# ─── Per-file checks ──────────────────────────────────────────────────────

def check_null_bytes(path: str, data: bytes) -> Issue | None:
    if b'\x00' in data:
        n = data.count(b'\x00')
        return Issue(path, 0, f'null bytes detected ({n})', code='NULL')
    return None


def check_json(path: str, text: str) -> Issue | None:
    if is_jsonc(path):
        return None
    try:
        json.loads(text)
    except json.JSONDecodeError as exc:
        return Issue(path, exc.lineno, f'JSON parse error: {exc.msg}', code='JSON')
    return None


def check_yaml(path: str, text: str) -> Issue | None:
    try:
        import yaml  # type: ignore
    except ImportError:
        return None
    try:
        yaml.safe_load(text)
    except yaml.YAMLError as exc:
        line = getattr(getattr(exc, 'problem_mark', None), 'line', 0) + 1
        return Issue(path, line, f'YAML parse error: {exc}', code='YAML')
    return None


def check_js_node(path: str, abs_path: Path) -> Issue | None:
    try:
        result = subprocess.run(
            ['node', '--check', str(abs_path)],
            capture_output=True, text=True, timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        msg_lines = (result.stderr or result.stdout or '').strip().splitlines()
        first = msg_lines[0] if msg_lines else 'node --check failed'
        m = re.search(r':(\d+)', first)
        line = int(m.group(1)) if m else 0
        return Issue(path, line, f'node --check: {first[:200]}', code='JS')
    return None


def check_sql(path: str, text: str) -> Issue | None:
    """Lightweight SQL sanity: balanced parens, no unterminated strings/blocks.
    Real SQL parsing requires a full grammar — overkill for corruption-detection.
    This catches the common truncation symptoms."""
    paren = 0
    in_string = False
    in_block_comment = False
    in_line_comment = False
    line = 1
    last_open_line = 0
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ''
        if c == '\n':
            line += 1
            in_line_comment = False
            i += 1
            continue
        if in_line_comment:
            i += 1
            continue
        if in_block_comment:
            if c == '*' and nxt == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_string:
            if c == "'" and nxt == "'":
                i += 2
                continue
            if c == "'":
                in_string = False
            i += 1
            continue
        if c == '-' and nxt == '-':
            in_line_comment = True
            i += 2
            continue
        if c == '/' and nxt == '*':
            in_block_comment = True
            i += 2
            continue
        if c == "'":
            in_string = True
            i += 1
            continue
        if c == '(':
            paren += 1
            last_open_line = line
        elif c == ')':
            paren -= 1
            if paren < 0:
                return Issue(path, line, 'unmatched closing )', code='SQL')
        i += 1
    if in_string:
        return Issue(path, line, 'unterminated SQL string', code='SQL')
    if in_block_comment:
        return Issue(path, line, 'unterminated SQL block comment', code='SQL')
    if paren > 0:
        return Issue(path, last_open_line,
                     f'{paren} unclosed paren(s) — file may be truncated', code='SQL')
    return None


def check_size_sanity(path: str, data: bytes, repo_root: Path) -> Issue | None:
    try:
        result = subprocess.run(
            ['git', 'cat-file', '-s', f'HEAD:{path}'],
            cwd=repo_root, capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return None
        head_size = int(result.stdout.strip())
    except (subprocess.SubprocessError, ValueError):
        return None
    if head_size < SIZE_SHRINK_MIN_BYTES:
        return None
    actual_size = len(data)
    if actual_size < head_size * SIZE_SHRINK_RATIO:
        try:
            diff = subprocess.run(
                ['git', 'diff', '--name-only', 'HEAD', '--', path],
                cwd=repo_root, capture_output=True, text=True, timeout=5,
            )
            if diff.stdout.strip():
                return None  # User explicitly modified — trust them
        except subprocess.SubprocessError:
            pass
        return Issue(path, 0,
                     f'size shrunk drastically: HEAD={head_size}B, now={actual_size}B '
                     f'(possible silent truncation with no working-tree edit)',
                     code='SIZE')
    return None


def check_file_basic(path: str, repo_root: Path) -> list[Issue]:
    """All non-TS checks. TS/TSX/JSX are handled in a batched helper call."""
    abs_path = repo_root / path
    if not abs_path.exists() or not abs_path.is_file():
        return []
    try:
        data = abs_path.read_bytes()
    except OSError as exc:
        return [Issue(path, 0, f'unreadable: {exc}', code='IO')]
    issues: list[Issue] = []
    nb = check_null_bytes(path, data)
    if nb:
        return [nb]  # Don't try to parse a null-poisoned file
    try:
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        return [Issue(path, 0, f'not valid UTF-8: {exc}', code='UTF8')]
    ext = os.path.splitext(path)[1].lower()
    if ext in PARSE_AS_JSON:
        j = check_json(path, text)
        if j:
            issues.append(j)
    elif ext in PARSE_AS_YAML:
        y = check_yaml(path, text)
        if y:
            issues.append(y)
    elif ext in PARSE_AS_JS:
        n = check_js_node(path, abs_path)
        if n:
            issues.append(n)
    elif ext in PARSE_AS_SQL:
        s = check_sql(path, text)
        if s:
            issues.append(s)
    sz = check_size_sanity(path, data, repo_root)
    if sz:
        issues.append(sz)
    return issues


def check_ts_batch(files: list[str], repo_root: Path) -> list[Issue]:
    """Single Node invocation that parses every TS/TSX/JSX file via the
    real TypeScript compiler API (syntax-only — no type checking)."""
    if not files:
        return []
    helper = repo_root / TS_HELPER
    if not helper.exists():
        print(f'integrity-guard: TS helper missing at {TS_HELPER}; skipping TS phase',
              file=sys.stderr)
        return []
    payload = json.dumps(files)
    try:
        result = subprocess.run(
            ['node', str(helper)],
            input=payload, capture_output=True, text=True,
            cwd=repo_root, timeout=60,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return [Issue('', 0, f'TS parse helper failed: {exc}', code='TS-RUN')]
    if result.returncode != 0:
        return [Issue('', 0, f'TS parse helper exit {result.returncode}: {result.stderr[:200]}',
                      code='TS-RUN')]
    try:
        raw_issues = json.loads(result.stdout or '[]')
    except json.JSONDecodeError as exc:
        return [Issue('', 0, f'TS helper bad output: {exc}', code='TS-RUN')]
    return [Issue(i['path'], i['line'], i['message'], code=i['code']) for i in raw_issues]


# ─── Main ─────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--staged', action='store_true')
    parser.add_argument('--files', nargs='+', default=None)
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--no-self-check', action='store_true')
    parser.add_argument('--no-ts', action='store_true', help='Skip TS parse phase (faster)')
    parser.add_argument('--quiet', action='store_true')
    args = parser.parse_args()

    try:
        repo_root = Path(subprocess.run(
            ['git', 'rev-parse', '--show-toplevel'],
            capture_output=True, text=True, check=True,
        ).stdout.strip())
    except subprocess.CalledProcessError:
        print('integrity-guard: not in a git repository', file=sys.stderr)
        return 3

    if not args.no_self_check:
        rc = self_check(repo_root)
        if rc != 0:
            return rc

    if args.files:
        files = [f for f in args.files if (repo_root / f).exists()]
    else:
        try:
            files = list_tracked_files(args.staged, repo_root)
        except subprocess.CalledProcessError as exc:
            print(f'integrity-guard: git failed: {exc.stderr}', file=sys.stderr)
            return 3
        files = [f for f in files if is_source_file(f)]

    all_issues: list[Issue] = []
    for path in files:
        all_issues.extend(check_file_basic(path, repo_root))

    if not args.no_ts:
        ts_files = [f for f in files
                    if os.path.splitext(f)[1].lower() in PARSE_AS_TS
                    and (repo_root / f).exists()]
        all_issues.extend(check_ts_batch(ts_files, repo_root))

    if args.json:
        print(json.dumps({
            'checked': len(files),
            'issues': [i.to_dict() for i in all_issues],
            'ok': len(all_issues) == 0,
        }, indent=2))
    else:
        if all_issues:
            n_files = len({i.path for i in all_issues})
            print(f'integrity-guard: CORRUPTION DETECTED in {n_files} file(s):',
                  file=sys.stderr)
            for issue in all_issues:
                print(f'  {issue}', file=sys.stderr)
            print(f'\nrepair: bin/repair-corrupt.sh', file=sys.stderr)
        else:
            print(f'integrity-guard: ok ({len(files)} files checked, 0 issues)')

    return 0 if not all_issues else 1


if __name__ == '__main__':
    sys.exit(main())
