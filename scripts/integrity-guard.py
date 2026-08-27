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
  .yml / .yaml     → yaml.safe_load (PyYAML; a missing PyYAML is reported as
                     could-not-run, never as a pass)
  .js .cjs .mjs    → node --check (built-in syntax check)
  .ts .tsx .jsx    → TypeScript parser via _integrity_ts_parse.cjs helper
  .sql             → balanced-paren + unterminated-string heuristic
  *                → null-byte scan + UTF-8 decode + size-shrinkage vs HEAD
  *                → raw C0 control-byte scan (mount-eaten escapes)

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
    2   COULD NOT CHECK -- the self-seal did not verify, or a parser could not
        be RUN (node absent or hung, PyYAML missing, the TS helper unusable).
        The files it covers went UNCHECKED, which is not the same as clean.
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

# Tracked text files that carry no extension. The extension filter above would
# skip these entirely, which mattered once found: .githooks/pre-commit is the
# script that ENFORCES this guard at commit time, and it was itself unscanned.
EXTENSIONLESS_SOURCE = [
    re.compile(r'(^|/)\.githooks/[^/.]+$'),
    re.compile(r'(^|/)\.gitattributes$'),
    re.compile(r'(^|/)\.editorconfig$'),
]

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

# Byte-scan constants, written escape-free on purpose: this file lives on the
# same mount whose backslash-eating is the thing being guarded against.
NUL = bytes([0x00])
LF = bytes([0x0A])
# Tab, line feed and carriage return are the only control bytes source may hold.
ALLOWED_CONTROL = frozenset({0x09, 0x0A, 0x0D})

# Could-not-run codes whose cause is PER FILE rather than systemic, so the
# grouped summary must still name the individual files. See
# summarise_could_not_run.
PER_FILE_CODES = frozenset({'IO'})
PER_FILE_LIST_CAP = 20


# ─── Self-seal ────────────────────────────────────────────────────────────

def self_check(repo_root: Path) -> tuple[int, 'Issue | None']:
    """Verify the guard against its own sha pin.

    Returns (abort_code, issue). A NON-ZERO abort code means stop before
    scanning: the guard has failed its own seal, so nothing it says about the
    tree can be trusted. An issue with a ZERO code means the seal could not be
    RUN -- report it and carry on scanning.

    The difference matters and an earlier draft got it backwards. Returning 2
    for a MISSING pin aborted before any file was read, so a tree with genuinely
    corrupt files reported "could not check" and named none of them -- the exact
    inverse of the precedence main() and bin/check-integrity.sh both state, that
    a real corruption outranks a guard that could not run. It also silently
    defeated the wrapper, which prints "no pin yet" and deliberately continues.
    """
    pin_path = repo_root / SELF_SHA_FILE
    if not pin_path.exists():
        # Not an abort, and not a pass either: an unverified seal is a
        # could-not-run like any other, and it rides along with the scan instead
        # of replacing it.
        return 0, Issue('', 0,
                        f'self-seal could not run -- no {SELF_SHA_FILE} pin found. '
                        f'Run `bin/integrity-pin.sh` to lock the current script, '
                        f'or pass --no-self-check to skip the seal deliberately.',
                        code='SEAL-RUN', could_not_run=True, kind='NoPin')
    try:
        with open(__file__, 'rb') as f:
            actual = hashlib.sha256(f.read()).hexdigest()
        expected = pin_path.read_text().strip().split()[0]
    except Exception as exc:
        print(f'integrity-guard: SELF-CHECK FAILED to read pin: {exc}',
              file=sys.stderr)
        return 2, None
    if actual != expected:
        print(f'integrity-guard: SELF-CHECK FAILED — script sha mismatch',
              file=sys.stderr)
        print(f'  expected: {expected}', file=sys.stderr)
        print(f'  actual:   {actual}', file=sys.stderr)
        print(f'  the guard may be corrupted or tampered with.', file=sys.stderr)
        print(f'  restore: git checkout HEAD -- scripts/integrity-guard.py',
              file=sys.stderr)
        print(f'  or, if intentional change: bin/integrity-pin.sh', file=sys.stderr)
        # An ABORT, unlike the missing pin above: the bytes on disk are not the
        # bytes that were sealed, so this script's report on anything -- including
        # its own findings -- is worthless. Nothing it could add to the scan is
        # trustworthy enough to be worth continuing for.
        return 2, None
    return 0, None


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
    if ext in SOURCE_EXTS:
        return True
    return any(p.search(path) for p in EXTENSIONLESS_SOURCE)


def is_jsonc(path: str) -> bool:
    return any(p.search(path) for p in JSONC_PATTERNS)


# ─── Issue model ──────────────────────────────────────────────────────────

class Issue:
    """A finding. `could_not_run` separates the two facts this guard reports.

    "This file is corrupt" and "I could not check this file" are different
    facts, and only the first is about your tree. Every site that swallowed a
    missing parser and returned None -- the NO-ISSUE return -- conflated them,
    so an absent `node` reported 160 tracked .js files as CLEAN.

    It is a PROPERTY of the issue rather than a list of codes kept elsewhere, so
    a new could-not-run site cannot forget to join the list.

    The invariant below is enforced by construction: a could-not-run MUST carry
    no path. bin/repair-corrupt.sh feeds every path this guard reports to
    restore_from_head, which overwrites the working file with HEAD's copy -- so
    a ten-second node hiccup naming a file would silently destroy uncommitted
    edits. The file is named in `reason` instead: nothing is lost from the
    report, and the destructive route is closed structurally rather than by a
    comment asking the next author to remember.
    """

    __slots__ = ('path', 'line', 'code', 'reason', 'could_not_run', 'kind')

    def __init__(self, path: str, line: int, reason: str, code: str = '',
                 could_not_run: bool = False, kind: str = ''):
        if could_not_run and path:
            # raise, not assert: assert is stripped under `python -O`, and this
            # invariant is what stands between a hung parser and a data-losing
            # restore.
            raise ValueError(
                f'could_not_run issue must carry no path, got {path!r} ({code})')
        self.path = path
        self.line = line
        self.code = code
        self.reason = reason
        self.could_not_run = could_not_run
        # WHY the exception class is a FIELD and not merely words in `reason`:
        # the report groups could-not-run issues to keep 160 restatements of one
        # fact off the screen, and grouping on the code alone folds an ABSENT
        # node together with a HUNG one. Those need different remedies, so a
        # summary that cannot tell them apart hides the rarer of the two behind
        # the commoner one's count. Grouping reads this; nothing parses `reason`.
        self.kind = kind

    def to_dict(self):
        return {'path': self.path, 'line': self.line, 'code': self.code,
                'reason': self.reason, 'could_not_run': self.could_not_run,
                'kind': self.kind}

    def __str__(self):
        prefix = f'[{self.code}] ' if self.code else ''
        if not self.path:
            # A pathless issue used to render as ':0: ...' -- a leading bare
            # colon that defeats path:line: parsing, and it already reached an
            # agent through .claude/hooks/post-write-check.sh.
            return f'{prefix}{self.reason}'
        return f'{self.path}:{self.line}: {prefix}{self.reason}'


# ─── Per-file checks ──────────────────────────────────────────────────────

def check_null_bytes(path: str, data: bytes) -> Issue | None:
    if NUL in data:
        n = data.count(NUL)
        return Issue(path, 0, f'null bytes detected ({n})', code='NULL')
    return None


def check_control_bytes(path: str, data: bytes) -> Issue | None:
    """Reject C0 control bytes (and DEL) outside tab / LF / CR.

    The mount bug that eats a backslash out of an escape sequence leaves the
    control character it denoted sitting raw in the source: an x1b escape in a
    regex becomes a literal 0x1b, a b escape becomes a literal 0x08. Both stay
    syntactically valid, so every parser check above passes them, and one such
    byte already reached main this way. Nothing in this codebase legitimately
    stores a raw control byte, so the rule is a flat ban rather than an
    allowlist -- an exemption here would blind the guard to exactly the
    corruption it exists to catch.
    """
    cap = 5
    offenders = []
    for i, b in enumerate(data):
        if (b < 0x20 and b not in ALLOWED_CONTROL) or b == 0x7F:
            offenders.append((i, b))
            # Collect one PAST the cap so the "and more" suffix is truthful:
            # stopping AT the cap cannot distinguish exactly-cap from truncated.
            if len(offenders) > cap:
                break
    if not offenders:
        return None
    shown = offenders[:cap]
    line = data.count(LF, 0, shown[0][0]) + 1
    detail = ', '.join(
        f'0x{b:02x} at byte {i} (line {data.count(LF, 0, i) + 1})' for i, b in shown)
    more = ' (and more)' if len(offenders) > cap else ''
    return Issue(path, line,
                 f'raw control byte(s) in source: {detail}{more} -- '
                 f'a mount-eaten escape sequence, not intended content',
                 code='CTRL')


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
    except ImportError as exc:
        # NOT `return None`. Without PyYAML every tracked .yml/.yaml -- which is
        # all of .github/workflows/, the files that decide whether anything else
        # is checked at all -- reported CLEAN having been parsed by nothing.
        return Issue('', 0,
                     f'YAML check could not run for {path} -- '
                     f'{type(exc).__name__}: {exc}. This file was NOT checked. '
                     f'Install PyYAML to close this gap.',
                     code='YAML-RUN', could_not_run=True, kind=type(exc).__name__)
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
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        # NOT `return None`. None is the no-issue return, so a missing or hung
        # node reported every .js/.cjs/.mjs file as CLEAN -- proven by execution
        # on 2026-08-27: with node off PATH the guard printed
        # "ok (160 files checked, 0 issues)" and exit 0, and a deliberately
        # broken fixture passed with them.
        #
        # The exception TYPE goes in the message so the two arms stay
        # distinguishable: an absent node and a hung node need different
        # remedies, and a canary that cannot tell them apart pins only one edge.
        return Issue('', 0,
                     f'node --check could not run for {path} -- '
                     f'{type(exc).__name__}: {exc}. This file was NOT checked.',
                     code='JS-RUN', could_not_run=True, kind=type(exc).__name__)
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
        # A COULD-NOT-RUN, not a corruption finding, and this is the arm where
        # it matters most. "I could not read this file" says nothing about its
        # contents -- and a transient EBUSY/EACCES on the FUSE mount is at least
        # as likely here as the hung `node --check` this change was written for.
        # While it carried a path it went straight into repair-corrupt.sh's
        # restore list, so a momentary read failure overwrote the working file
        # with HEAD's copy and took any uncommitted edit with it. That is the
        # hazard Issue's invariant exists to close, and it was open on the most
        # reachable arm.
        return [Issue('', 0, f'unreadable: {path} -- {exc}. This file was NOT checked.',
                      code='IO', could_not_run=True, kind=type(exc).__name__)]
    issues: list[Issue] = []
    nb = check_null_bytes(path, data)
    if nb:
        return [nb]  # Don't try to parse a null-poisoned file
    cb = check_control_bytes(path, data)
    if cb:
        return [cb]  # Same: a mangled escape means the bytes are untrustworthy
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
        # Was a stderr note plus `return []`. The empty list is the no-issue
        # return, so a missing helper reported every TS/TSX/JSX file as clean --
        # the same fail-open check_js_node carried, on the half of the corpus
        # this comment used to say was already covered.
        return [Issue('', 0,
                      f'TS parse helper missing at {TS_HELPER}; '
                      f'{len(files)} TS/TSX/JSX file(s) were NOT checked.',
                      code='TS-RUN', could_not_run=True, kind='HelperMissing')]
    payload = json.dumps(files)
    try:
        result = subprocess.run(
            ['node', str(helper)],
            input=payload, capture_output=True, text=True,
            cwd=repo_root, timeout=60,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return [Issue('', 0,
                      f'TS parse helper could not run -- {type(exc).__name__}: {exc}. '
                      f'{len(files)} TS/TSX/JSX file(s) were NOT checked.',
                      code='TS-RUN', could_not_run=True, kind=type(exc).__name__)]
    # Every TS-RUN below is a could-not-run, never a corruption finding: the
    # helper reports a per-file parse failure as an ISSUE and still exits 0, so
    # a non-zero exit or unreadable output means the phase did not produce
    # results -- it says nothing about the tree.
    if result.returncode != 0:
        return [Issue('', 0,
                      f'TS parse helper exit {result.returncode}: {result.stderr[:200]}. '
                      f'{len(files)} TS/TSX/JSX file(s) were NOT checked.',
                      code='TS-RUN', could_not_run=True, kind='HelperExit')]
    try:
        raw_issues = json.loads(result.stdout or '[]')
    except json.JSONDecodeError as exc:
        return [Issue('', 0,
                      f'TS helper bad output: {exc}. '
                      f'{len(files)} TS/TSX/JSX file(s) were NOT checked.',
                      code='TS-RUN', could_not_run=True, kind='HelperBadOutput')]
    # The helper reports its own unreadable-file failures as code 'IO', which
    # means the same thing there as it does in check_file_basic: the file was
    # never parsed. It is mapped to a could-not-run for the same reason, and
    # loses its path for the same reason -- otherwise a transient read failure
    # inside the TS phase reaches restore_from_head with a filename attached.
    return [Issue('', i['line'],
                  f"unreadable: {i['path']} -- {i['message']}. This file was NOT checked.",
                  code='IO', could_not_run=True, kind='HelperIO')
            if i['code'] == 'IO' else
            Issue(i['path'], i['line'], i['message'], code=i['code'])
            for i in raw_issues]


def summarise_could_not_run(issues: list[Issue]) -> list[str]:
    """One line per (CODE, KIND), not one per file and not one per code.

    An absent node produces one JS-RUN per tracked .js file -- 160 of them on
    this tree. Printing all of them buries the single fact the operator needs
    (node is not runnable) under a screenful of restatements of it.

    Grouping on the code ALONE went too far the other way: 158 absent-node and 2
    hung-node failures collapsed into one line whose count covered both and whose
    example named only the first, so the two timeouts -- against a node that is
    present and working, and needing a completely different remedy -- became
    invisible. The kind is carried on the Issue precisely so this grouping can
    keep them apart; see Issue.__init__.
    """
    by_key: dict[tuple[str, str], list[Issue]] = {}
    for issue in issues:
        by_key.setdefault((issue.code, issue.kind), []).append(issue)
    lines = []
    for (code, kind), group in sorted(by_key.items()):
        label = f'{code}/{kind}' if kind else code
        lines.append(f'[{label}] {len(group)} check(s) did not run; '
                     f'first: {group[0].reason}')
        # Grouping is right for a SYSTEMIC cause -- an absent node produces 160
        # restatements of one fact -- and wrong for a PER-FILE one. IO and
        # HelperIO are per-file: three files hit by a transient EBUSY rendered
        # as one line naming exactly one of them, so an operator was told three
        # files were unverified and could learn only one of their names.
        # "Unchecked is NOT clean" is actionable only if you know WHICH, and
        # this is the arm the change calls the one where it matters most.
        # The remainder is capped: the point is to name files, not to restore
        # the screenful the grouping exists to prevent.
        if code in PER_FILE_CODES and len(group) > 1:
            for issue in group[1:PER_FILE_LIST_CAP]:
                lines.append(f'    also: {issue.reason}')
            hidden = len(group) - min(len(group), PER_FILE_LIST_CAP)
            if hidden:
                lines.append(f'    ... and {hidden} more (use --json for the full list)')
    return lines


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
    parser.add_argument('--list-corpus', action='store_true',
                        help='Print the files this guard would scan, one per line, and exit. '
                             'Lets a test assert against the REAL corpus instead of '
                             'maintaining a second copy of SOURCE_EXTS that can drift.')
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

    seal_issues: list[Issue] = []
    if not args.no_self_check:
        rc, seal_issue = self_check(repo_root)
        if rc != 0:
            # The guard failed its own seal. Abort: nothing it could say about
            # the tree is worth reading.
            return rc
        if seal_issue is not None:
            # The seal could not be RUN. That rides along with the scan rather
            # than replacing it, so a corrupt tree is still named and still
            # exits 1 -- the precedence this whole file states.
            seal_issues.append(seal_issue)

    if args.files:
        files = [f for f in args.files if (repo_root / f).exists()]
    else:
        try:
            files = list_tracked_files(args.staged, repo_root)
        except subprocess.CalledProcessError as exc:
            print(f'integrity-guard: git failed: {exc.stderr}', file=sys.stderr)
            return 3
        files = [f for f in files if is_source_file(f)]

    if args.list_corpus:
        for f in files:
            print(f)
        return 0

    all_issues: list[Issue] = list(seal_issues)
    for path in files:
        all_issues.extend(check_file_basic(path, repo_root))

    if not args.no_ts:
        ts_files = [f for f in files
                    if os.path.splitext(f)[1].lower() in PARSE_AS_TS
                    and (repo_root / f).exists()]
        all_issues.extend(check_ts_batch(ts_files, repo_root))

    # Split the two facts ONCE, here, so the headline, the repair hint, the JSON
    # and the exit code all read the same predicate.
    could_not_run = [i for i in all_issues if i.could_not_run]
    corrupt = [i for i in all_issues if not i.could_not_run]
    # A real contract violation outranks a guard that could not run: if anything
    # is genuinely corrupt, that is the fact the operator needs and 1 is the code
    # that says it. Same precedence run-lint-chain.mjs's decideExit applies over
    # the whole tier, on purpose -- the guard and the tier must not be able to
    # disagree about which of the two is the headline.
    exit_code = 1 if corrupt else (2 if could_not_run else 0)

    if args.json:
        print(json.dumps({
            # `considered`, not `checked`: these are the files this run LOOKED
            # AT, which with a parser that could not run is emphatically not the
            # same as the files it checked. Reporting 160 "checked" beside 160
            # could-not-run issues was the same unknown-recorded-as-a-pass this
            # change exists to remove, wearing a different field name.
            'considered': len(files),
            # Every issue carries its own could_not_run flag, and all three
            # consumers filter on it. A second copy of the same subset was
            # published here with a comment claiming consumers needed it; none
            # read it, so it was a fourth place for the split to drift out of
            # step. `exit` stays: it is the guard's VERDICT, and it is the one
            # thing a consumer cannot re-derive without re-implementing the
            # corruption-outranks-could-not-run precedence for itself.
            'issues': [i.to_dict() for i in all_issues],
            'exit': exit_code,
            'ok': len(all_issues) == 0,
        }, indent=2))
    else:
        if corrupt:
            n_files = len({i.path for i in corrupt})
            print(f'integrity-guard: CORRUPTION DETECTED in {n_files} file(s):',
                  file=sys.stderr)
            for issue in corrupt:
                print(f'  {issue}', file=sys.stderr)
        if could_not_run:
            # Printed as its own block even in a MIXED run. Folding these in
            # under CORRUPTION DETECTED is the conflation this change exists to
            # remove, and it is exactly how an earlier draft reintroduced it.
            print(f'integrity-guard: COULD NOT CHECK -- {len(could_not_run)} '
                  f'check(s) did not run. Unchecked is NOT clean.',
                  file=sys.stderr)
            for line in summarise_could_not_run(could_not_run):
                print(f'  {line}', file=sys.stderr)
        if corrupt:
            # Two prints, escape-free on purpose, like the byte constants at the
            # top of this file: a mount-eaten backslash in an n escape leaves a
            # literal n, which still parses and which the control-byte scan
            # cannot see. The hint is tied to `corrupt` because repair-corrupt.sh
            # restores files -- it has nothing to offer a run that never ran.
            print('', file=sys.stderr)
            print('repair: bin/repair-corrupt.sh', file=sys.stderr)
        if not all_issues:
            print(f'integrity-guard: ok ({len(files)} files checked, 0 issues)')

    return exit_code


if __name__ == '__main__':
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except KeyboardInterrupt:
        # Re-raised, not reclassified. Ctrl-C during a full-tree scan (~35s of
        # git subprocesses) is an OPERATOR decision, not a guard that could not
        # run -- and reporting it as "the guard itself raised" with a traceback
        # made run-lint-chain print BROKEN, indistinguishable in a log from a
        # genuinely unrunnable guard. The BaseException arm below still catches
        # every real crash; this only keeps an interrupt legible as one.
        raise
    except BaseException:
        # An unhandled exception used to leave Python's own exit code 1 -- the
        # code this guard's table reserves for CORRUPTION DETECTED. So a guard
        # that crashed reported a verdict about the tree, and run-lint-chain's
        # classify(1) printed FAIL rather than BROKEN. It is reachable: the
        # handlers here deliberately let an unlisted OSError propagate (a `node`
        # on PATH that is not executable raises PermissionError), which is
        # correct -- but it must arrive as "this guard could not run", not as
        # "your tree is broken".
        #
        # The traceback is still printed in full: this reclassifies the exit
        # code, it does not hide the defect.
        import traceback
        traceback.print_exc()
        print('integrity-guard: COULD NOT CHECK -- the guard itself raised. '
              'Nothing above is a finding about your tree.', file=sys.stderr)
        sys.exit(2)
