#!/usr/bin/env python3
"""
safe-write.py v2 — bulletproof file writer for the Cowork mount.

Background: the Cowork sandbox writes to user repos through a stack of
  Cowork bash → FUSE bindfs → virtio-fs → Windows NTFS
that exhibits two distinct corruption modes:

  1. Same-process write succeeds + reports correct size, but a *separate*
     follow-up process sees a stale/truncated version of the file. The
     mount serves cached content from a prior write generation.
  2. Concurrent writes from two Cowork sessions clobber each other with
     no error from either side.

v2 strategy:
  - Stage content in /tmp (Linux-native, immune to the mount bug)
  - Compute the expected sha256 of the staged content
  - shutil.copy the staged file to the target
  - subprocess.run(['sync']) to force a mount flush
  - Verify the target's sha256 by reading it back IN A SUBPROCESS
    (sha256sum binary). This bypasses our own kernel cache and forces
    the mount to surface its actual settled state.
  - If the round-trip sha256 doesn't match: sleep + retry verify up to
    3 times. The mount usually converges within ~3 seconds.
  - If still mismatched after the verify retries: re-copy the staged
    file and start the verify loop over. Up to 2 full re-copy cycles.
  - If still mismatched after that: restore the backup and exit 5.

Exit codes:
    0  success — content on disk matches expected sha256 in a fresh
       subprocess read
    1  null bytes detected (corruption)
    2  too few lines (truncation suspected)
    3  I/O or argument error
    4  post-write parse check failed -- a parser RAN and rejected the
       content. A parser that could not run at all is NOT this: it keeps
       exit 0, prints "PARSE CHECK DID NOT RUN" on stderr, and says so in
       the stdout receipt instead of claiming a pass.
    5  sha256 round-trip mismatch — mount-eventual-consistency bug
       defeated all retries; backup restored

Usage:
    cat content.tsx | python3 scripts/safe-write.py path/to/file.tsx
    cat content.tsx | python3 scripts/safe-write.py path/to/file.tsx --no-parse-check
    cat content.tsx | python3 scripts/safe-write.py path/to/file.tsx --quiet

Flags:
    --crlf                   Force CRLF line endings (overrides auto-detect)
    --lf                     Force LF line endings (overrides auto-detect)
    --expect-min-lines N     Fail if output is shorter than N lines
    --no-parse-check         Skip the post-write parser invocation
    --quiet                  Suppress success output
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

PARSEABLE_TS = {'.ts', '.tsx', '.jsx'}
PARSEABLE_JS = {'.js', '.cjs', '.mjs'}
PARSEABLE_JSON = {'.json'}
PARSEABLE_YAML = {'.yml', '.yaml'}
PARSEABLE_PY = {'.py'}

# Parse-check verdicts. FOUR outcomes, not two.
#
# "a parser ran and rejected this content" and "no parser ran" are different
# facts, and collapsing them has cost real content in both directions. Reported
# as a pass, an absent parser silently disarms the check (that is the fail-open
# scripts/_integrity_ts_parse.cjs was changed to exit 3 to close). Reported as a
# failure, it makes this tool restore the backup over perfectly good bytes --
# which is how a checkout without node_modules ended up with NO write path at
# all for .ts/.tsx, since safe-edit.py delegates here and
# .claude/hooks/pre-write-block.sh blocks raw Edit/Write above 2 KB.
#
# NOT_RUN is announced on stderr and keeps exit 0. The exit code is deliberate
# and was Ricky's call on 2026-08-31: a new non-zero here would break every
# existing caller of this script, and could re-create the same lockout by
# another route. The stderr line is what makes it visible instead.
PARSE_PASSED = 'passed'    # a parser ran and found nothing wrong
PARSE_FAILED = 'failed'    # a parser ran and rejected the content
PARSE_NOT_RUN = 'not-run'  # a parser was expected and could not run
PARSE_NA = 'n/a'           # no parser applies to this file at all
# Set by main(), never returned by parse_check, which is not called at all in
# this case. It is its own value rather than PARSE_NA because "a parser applies
# and the caller declined it" is not "no parser applies" -- printing n/a over a
# .ts written with --no-parse-check states something false, which is the exact
# conflation the four above exist to end.
PARSE_SKIPPED = 'skipped'

# Source-code extensions that should default to CRLF in this repo
CRLF_EXTENSIONS = {
    '.ts', '.tsx', '.jsx', '.js', '.cjs', '.mjs',
    '.json', '.css', '.scss', '.html', '.sql',
    '.yml', '.yaml', '.md',
}

JSONC_HINTS = ('tsconfig', '.vscode/', 'package-lock.json', '.claude/settings')

# Mount-eventual-consistency tuning. The mount usually converges within
# ~1s of a sync; we give it up to 3 retries with exponential backoff,
# then re-copy and try again up to 2 full cycles.
VERIFY_BACKOFF_SECONDS = (0.3, 1.0, 3.0)
RECOPY_ATTEMPTS = 2
SYNC_TIMEOUT_SECONDS = 5


# ──────────────────────────────────────────────────────────────────────
# Repo-discovery helpers
# ──────────────────────────────────────────────────────────────────────

def find_repo_root(start: str) -> str | None:
    cur = os.path.abspath(start)
    while True:
        if os.path.isdir(os.path.join(cur, '.git')):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            # Filesystem root reached: '/' on POSIX, 'C:\\' on native Windows.
            # The old `while cur != '/'` guard never terminated on Windows
            # (dirname stabilises at the drive root), spinning the CPU forever
            # inside the post-write parse-check.
            return None
        cur = parent


# ──────────────────────────────────────────────────────────────────────
# Mount-flush + cache-bypass verification
# ──────────────────────────────────────────────────────────────────────

def force_mount_sync() -> None:
    """Force the mount to flush pending writes."""
    try:
        # Output captured, not inherited. stderr is now a signal channel --
        # it is where a could-not-run parse phase is announced -- so a `sync`
        # that warns (a read-only or network mount, a Windows sync.exe with a
        # banner) would put a message about the environment into the stream a
        # caller reads for messages about the file.
        subprocess.run(['sync'], timeout=SYNC_TIMEOUT_SECONDS, check=False,
                       capture_output=True)
    except (OSError, subprocess.TimeoutExpired):
        pass


def sha256_via_subprocess(path: str) -> str | None:
    """Read file via sha256sum subprocess to bypass our own kernel cache.

    Returns the hex digest or None if the file can't be read.
    """
    try:
        r = subprocess.run(
            ['sha256sum', path],
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode != 0:
            return None
        if not r.stdout:
            return None
        tok = r.stdout.split()[0]
        # GNU coreutils sha256sum prefixes the hash with a backslash
        # when the path contains escaped chars (e.g. Windows-style
        # backslashes). Strip leading backslashes so the comparison
        # against expected_sha succeeds. Without this, every verify
        # fails on this repo's Cowork+Windows mount, triggering
        # spurious backup-restores.
        while tok.startswith(chr(92)):
            tok = tok[1:]
        return tok
    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Fallback: read in-process (less reliable for the bug we're
        # defending against, but better than failing).
        try:
            with open(path, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except OSError:
            return None


def copy_and_verify(src: str, dst: str, expected_sha: str) -> tuple[bool, str]:
    """Copy src to dst, force a sync, then verify the on-disk sha256
    via a subprocess. Returns (ok, actual_sha)."""
    shutil.copy(src, dst)
    force_mount_sync()
    for delay in VERIFY_BACKOFF_SECONDS:
        time.sleep(delay)
        actual = sha256_via_subprocess(dst)
        if actual == expected_sha:
            return True, actual
    return False, sha256_via_subprocess(dst) or '<unreadable>'


# ──────────────────────────────────────────────────────────────────────
# Parse-check (delegated to per-language tooling)
# ──────────────────────────────────────────────────────────────────────

def parse_check(target: str, repo_root: str | None) -> tuple[str, str]:
    """Classify the just-written file into one of the four PARSE_* verdicts.

    Every arm is split the same way: READING the file back is separated from
    PARSING what was read, because a read that fails is the mount misbehaving
    -- the exact condition this whole tool exists for -- and must never be
    reported as bad content. Each of the JSON, Python and YAML arms used to
    catch OSError alongside the parse error and return "the file is bad", so a
    transient read failure restored the backup over content that had just
    passed a cache-bypassing sha256 verify.
    """
    ext = os.path.splitext(target)[1].lower()

    def read_back(label: str) -> tuple[str | None, str]:
        # UnicodeDecodeError alongside OSError, and it is NOT decoration. This
        # process wrote UTF-8 and verified the on-disk sha256 from a separate
        # subprocess; bytes that will not decode afterwards mean the mount is
        # serving a different generation than the one that was verified. Left
        # uncaught it escapes parse_check entirely -- a traceback and Python's
        # default exit 1, which this file's own table calls "null bytes
        # detected", with no restore and a leaked backup. The YAML arm used to
        # catch it under a bare `except Exception`; splitting the read out of
        # that handler is what dropped it.
        try:
            with open(target, 'r', encoding='utf-8-sig') as f:
                return f.read(), ''
        except OSError as exc:
            return None, f'{label}: could not read the file back: {exc}'
        except UnicodeDecodeError as exc:
            return None, f'{label}: the file did not read back as UTF-8: {exc}'

    if ext in PARSEABLE_JSON:
        # Separators normalised BEFORE the substring test. The hints are
        # forward-slash literals and this is a Windows-first repo, so a
        # backslash spelling of .claude/settings.local.json -- a file agents
        # are told to edit, and one that legitimately carries comments --
        # missed the exemption, was strictly parsed, came back FAILED, and had
        # the backup copied over the body just written. Measured both
        # spellings on this branch. chr(92) rather than an escaped literal:
        # the edit transport collapses a doubled backslash, which is a
        # syntax error here and was one.
        hint_path = target.replace(chr(92), '/')
        if any(h in hint_path for h in JSONC_HINTS):
            return PARSE_NA, 'JSON with comments permitted -- not strictly parsed'
        text, why = read_back('JSON')
        if text is None:
            return PARSE_NOT_RUN, why
        try:
            json.loads(text)
        except json.JSONDecodeError as exc:
            return PARSE_FAILED, f'JSON parse: {exc}'
        return PARSE_PASSED, ''

    if ext in PARSEABLE_PY:
        import ast
        text, why = read_back('Python')
        if text is None:
            return PARSE_NOT_RUN, why
        try:
            ast.parse(text)
        except SyntaxError as exc:
            return PARSE_FAILED, f'Python parse: {exc}'
        return PARSE_PASSED, ''

    if ext in PARSEABLE_YAML:
        try:
            import yaml  # type: ignore
        except ImportError:
            return PARSE_NOT_RUN, 'YAML: PyYAML is not installed'
        text, why = read_back('YAML')
        if text is None:
            return PARSE_NOT_RUN, why
        try:
            yaml.safe_load(text)
        except yaml.YAMLError as exc:
            return PARSE_FAILED, f'YAML parse: {exc}'
        except Exception as exc:  # noqa: BLE001
            # Not a YAMLError: the parser itself came apart, which is a phase
            # that produced no verdict rather than a verdict about the file.
            return PARSE_NOT_RUN, f'YAML: parser raised {type(exc).__name__}: {exc}'
        return PARSE_PASSED, ''

    if ext in PARSEABLE_JS:
        try:
            r = subprocess.run(['node', '--check', target],
                               capture_output=True, text=True, timeout=10)
        except FileNotFoundError:
            return PARSE_NOT_RUN, 'JS: node is not on PATH'
        except OSError as exc:
            # The catch-all under it, and NOT redundant: a node that is present
            # but not executable raises PermissionError, and a stale PATH entry
            # raises NotADirectoryError. Neither is a statement about this file,
            # and uncaught either one exits 1 -- the code this file's own table
            # gives to null-byte corruption. FileNotFoundError is a subclass, so
            # it has to stay above this to keep its more useful wording.
            return PARSE_NOT_RUN, f'JS: node could not be run: {exc}'
        except subprocess.TimeoutExpired:
            return PARSE_NOT_RUN, 'JS: node --check timed out after 10s'
        if r.returncode != 0:
            msg = (r.stderr or r.stdout).strip().splitlines()
            first = msg[0] if msg else 'node --check failed'
            return PARSE_FAILED, f'node --check: {first[:200]}'
        return PARSE_PASSED, ''

    if ext in PARSEABLE_TS:
        if not repo_root:
            return PARSE_NOT_RUN, ('TS: no repo root above the target, so the '
                                   'batch helper could not be located')
        helper = os.path.join(repo_root, 'scripts', '_integrity_ts_parse.cjs')
        if not os.path.isfile(helper):
            return PARSE_NOT_RUN, f'TS: helper not found at {helper}'
        try:
            # relpath raises ValueError when the target and the repo root sit
            # on different Windows drives -- a real shape here, since the
            # target is whatever the caller passed. It is the same class as
            # the two below: the helper never ran.
            payload = json.dumps([os.path.relpath(target, repo_root)])
            r = subprocess.run(['node', helper], input=payload,
                               capture_output=True, text=True,
                               cwd=repo_root, timeout=20)
        except ValueError as exc:
            return PARSE_NOT_RUN, f'TS: could not relativise the target: {exc}'
        except FileNotFoundError:
            return PARSE_NOT_RUN, 'TS: node is not on PATH'
        except OSError as exc:
            return PARSE_NOT_RUN, f'TS: node could not be run: {exc}'
        except subprocess.TimeoutExpired:
            return PARSE_NOT_RUN, 'TS: the batch helper timed out after 20s'
        if r.returncode != 0:
            # The helper's contract: exit 0 means the phase RAN and stdout is
            # the complete verdict, empty array included. Exit 3 is its own
            # explicit "the TS parse phase did NOT run" (an unresolvable
            # typescript, or unreadable input); any other non-zero is a crash,
            # which is equally not a statement about this file's syntax.
            lines = (r.stderr or '').strip().splitlines()
            first = lines[0] if lines else 'no message on stderr'
            return PARSE_NOT_RUN, f'TS: helper exit {r.returncode} -- {first[:200]}'
        try:
            issues = json.loads(r.stdout or '[]')
        except json.JSONDecodeError as exc:
            return PARSE_NOT_RUN, f'TS: helper stdout was not JSON: {exc}'
        if issues:
            first = issues[0]
            return PARSE_FAILED, (
                f'TS parse: {first.get("path")}:{first.get("line")} '
                f'{first.get("message", "")[:160]}'
            )
        return PARSE_PASSED, ''

    return PARSE_NA, f'no checker for {ext or "(no extension)"}'


# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('target')
    parser.add_argument('--crlf', action='store_true',
                        help='Force CRLF line endings (overrides auto-detect)')
    parser.add_argument('--lf', action='store_true',
                        help='Force LF line endings (overrides auto-detect)')
    parser.add_argument('--expect-min-lines', type=int, default=0)
    parser.add_argument('--allow-empty', action='store_true',
                        help='Allow writing empty content over an existing non-empty file')
    parser.add_argument('--no-parse-check', action='store_true')
    parser.add_argument('--quiet', action='store_true')
    args = parser.parse_args()

    if args.crlf and args.lf:
        print('safe-write: --crlf and --lf are mutually exclusive', file=sys.stderr)
        return 3

    try:
        content = sys.stdin.read()
    except Exception as exc:
        print(f'safe-write: failed to read stdin: {exc}', file=sys.stderr)
        return 3

    if '\x00' in content:
        print('safe-write: REFUSING — input already contains null bytes',
              file=sys.stderr)
        return 1

    if not content.strip() and not args.allow_empty:
        if os.path.exists(args.target) and os.path.getsize(args.target) > 0:
            print(
                'safe-write: REFUSING — stdin is empty but target is an existing '
                'non-empty file. This usually means the upstream generator/patcher '
                'failed silently (bad match, empty heredoc, etc.) and piped nothing '
                'into safe-write.py. Pass --allow-empty if this is intentional.',
                file=sys.stderr,
            )
            return 3

    # Line-ending normalization: explicit flag wins; otherwise auto-detect
    # by extension (this repo is CRLF-locked for source files).
    ext = os.path.splitext(args.target)[1].lower()
    use_crlf = args.crlf or (not args.lf and ext in CRLF_EXTENSIONS)
    if use_crlf:
        content = content.replace('\r\n', '\n').replace('\n', '\r\n')

    target_dir = os.path.dirname(os.path.abspath(args.target))
    os.makedirs(target_dir, exist_ok=True)

    # Backup existing target so we can roll back on any failure
    backup_path: str | None = None
    if os.path.exists(args.target):
        fd, backup_path = tempfile.mkstemp(prefix='safe-write-bak-', dir='/tmp')
        os.close(fd)
        shutil.copy(args.target, backup_path)

    # Stage the new content in /tmp (Linux-native, immune to the mount
    # bug). Compute the expected sha256 from the staged file.
    fd, staged_path = tempfile.mkstemp(prefix='safe-write-staged-',
                                       suffix='.tmp', dir='/tmp')
    try:
        encoded = content.encode('utf-8')
        with os.fdopen(fd, 'wb') as f:
            f.write(encoded)
            f.flush()
            os.fsync(f.fileno())

        if b'\x00' in encoded:
            print('safe-write: FATAL — null bytes in staged file (impossible)',
                  file=sys.stderr)
            _cleanup(staged_path, backup_path)
            return 1

        expected_sha = hashlib.sha256(encoded).hexdigest()

        # Copy to target with verify-loop. Up to RECOPY_ATTEMPTS full
        # copy attempts; each attempt does up to len(VERIFY_BACKOFF_SECONDS)
        # verify retries waiting for the mount to converge.
        last_actual = ''
        for copy_attempt in range(1, RECOPY_ATTEMPTS + 1):
            ok, actual = copy_and_verify(staged_path, args.target, expected_sha)
            if ok:
                last_actual = actual
                break
            last_actual = actual
            if copy_attempt < RECOPY_ATTEMPTS:
                # Try again from scratch — sometimes the mount needs a
                # fresh inode rather than a content overwrite.
                try:
                    os.unlink(args.target)
                except OSError:
                    pass
                time.sleep(0.5)
        else:
            print(
                f'safe-write: SHA256 ROUND-TRIP FAILED after '
                f'{RECOPY_ATTEMPTS} copy attempts × '
                f'{len(VERIFY_BACKOFF_SECONDS)} verify retries',
                file=sys.stderr,
            )
            print(f'  expected: {expected_sha}', file=sys.stderr)
            print(f'  actual:   {last_actual}', file=sys.stderr)
            print('  this is the mount-eventual-consistency bug.',
                  file=sys.stderr)
            if backup_path:
                shutil.copy(backup_path, args.target)
                force_mount_sync()
                print('safe-write: restored previous content from backup',
                      file=sys.stderr)
            _cleanup(staged_path, backup_path)
            return 5

    finally:
        try:
            os.unlink(staged_path)
        except OSError:
            pass

    # We have a verified-by-subprocess copy on disk. Read it once for
    # the line-count + null-byte sanity messages.
    try:
        with open(args.target, 'rb') as f:
            final_data = f.read()
    except OSError as exc:
        print(f'safe-write: failed to read back target: {exc}', file=sys.stderr)
        _cleanup(None, backup_path)
        return 3

    null_count = final_data.count(b'\x00')
    if null_count > 0:
        # Should be impossible after the sha256 verify, but defend anyway
        print(f'safe-write: CORRUPTION DETECTED — {null_count} null bytes '
              f'in {args.target}', file=sys.stderr)
        if backup_path:
            shutil.copy(backup_path, args.target)
            force_mount_sync()
        _cleanup(None, backup_path)
        return 1

    line_count = final_data.count(b'\n') + (
        1 if final_data and not final_data.endswith(b'\n') else 0
    )
    if args.expect_min_lines and line_count < args.expect_min_lines:
        print(f'safe-write: TRUNCATION SUSPECTED — got {line_count} lines, '
              f'expected at least {args.expect_min_lines}', file=sys.stderr)
        if backup_path:
            shutil.copy(backup_path, args.target)
            force_mount_sync()
        _cleanup(None, backup_path)
        return 2

    if args.no_parse_check:
        verdict, detail = PARSE_SKIPPED, ''
    else:
        repo_root = find_repo_root(target_dir)
        verdict, detail = parse_check(args.target, repo_root)
        if verdict == PARSE_FAILED:
            print(f'safe-write: PARSE CHECK FAILED for {args.target}',
                  file=sys.stderr)
            print(f'  {detail}', file=sys.stderr)
            if backup_path:
                shutil.copy(backup_path, args.target)
                force_mount_sync()
                print('safe-write: restored previous content from backup',
                      file=sys.stderr)
            else:
                # A NEW file has nothing to restore, so the rejected body is
                # STILL ON DISK. Said out loud, because the caller contract --
                # .claude/hooks/pre-write-block.sh -- tells an agent that every
                # non-zero exit means fall back to the full-body path, from
                # which it reasonably concludes nothing landed. It did.
                print(f'safe-write: {args.target} did not exist before this '
                      'write, so there is no backup to restore -- the '
                      'REJECTED content is still on disk. Delete it or fix it.',
                      file=sys.stderr)
            _cleanup(None, backup_path)
            return 4

    _cleanup(None, backup_path)

    # On STDERR, and unconditionally -- not folded into the stdout receipt
    # below, which --quiet suppresses and which callers that capture stdout to
    # chain a sha would swallow. safe-edit.py passes --quiet on every write, so
    # a stdout-only signal is invisible on the path agents actually use.
    if verdict == PARSE_NOT_RUN:
        print(f'safe-write: PARSE CHECK DID NOT RUN for {args.target}',
              file=sys.stderr)
        print(f'  {detail}', file=sys.stderr)
        print('  the write was KEPT and mount-verified, but NOTHING checked '
              'its syntax.', file=sys.stderr)

    if not args.quiet:
        size = len(final_data)
        if verdict == PARSE_PASSED:
            receipt = 'parse-check passed'
        elif verdict == PARSE_SKIPPED:
            receipt = 'parse-check skipped (--no-parse-check)'
        elif verdict == PARSE_NOT_RUN:
            receipt = f'parse-check NOT RUN ({detail})'
        else:
            receipt = f'parse-check n/a ({detail})'
        print(
            f'safe-write: ok ({args.target}: {size} bytes, {line_count} lines, '
            f'sha256={expected_sha[:12]}…, mount-verified, {receipt})'
        )
    return 0


def _cleanup(*paths: str | None) -> None:
    for p in paths:
        if p:
            try:
                os.unlink(p)
            except OSError:
                pass


if __name__ == '__main__':
    sys.exit(main())
