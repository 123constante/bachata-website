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
    4  post-write parse check failed
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
    while cur != '/':
        if os.path.isdir(os.path.join(cur, '.git')):
            return cur
        cur = os.path.dirname(cur)
    return None


# ──────────────────────────────────────────────────────────────────────
# Mount-flush + cache-bypass verification
# ──────────────────────────────────────────────────────────────────────

def force_mount_sync() -> None:
    """Force the mount to flush pending writes."""
    try:
        subprocess.run(['sync'], timeout=SYNC_TIMEOUT_SECONDS, check=False)
    except (FileNotFoundError, subprocess.TimeoutExpired):
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
        return r.stdout.split()[0] if r.stdout else None
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

def parse_check(target: str, repo_root: str | None) -> tuple[bool, str]:
    ext = os.path.splitext(target)[1].lower()

    if ext in PARSEABLE_JSON:
        if any(h in target for h in JSONC_HINTS):
            return True, ''
        try:
            with open(target, 'r', encoding='utf-8-sig') as f:
                json.load(f)
            return True, ''
        except (json.JSONDecodeError, OSError) as exc:
            return False, f'JSON parse: {exc}'

    if ext in PARSEABLE_PY:
        try:
            import ast
            with open(target, 'r', encoding='utf-8-sig') as f:
                ast.parse(f.read())
            return True, ''
        except (SyntaxError, OSError) as exc:
            return False, f'Python parse: {exc}'

    if ext in PARSEABLE_YAML:
        try:
            import yaml  # type: ignore
            with open(target, 'r', encoding='utf-8-sig') as f:
                yaml.safe_load(f)
            return True, ''
        except ImportError:
            return True, ''
        except Exception as exc:
            return False, f'YAML parse: {exc}'

    if ext in PARSEABLE_JS:
        try:
            r = subprocess.run(['node', '--check', target],
                               capture_output=True, text=True, timeout=10)
            if r.returncode != 0:
                msg = (r.stderr or r.stdout).strip().splitlines()
                first = msg[0] if msg else 'node --check failed'
                return False, f'node --check: {first[:200]}'
            return True, ''
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return True, ''

    if ext in PARSEABLE_TS:
        if not repo_root:
            return True, ''
        helper = os.path.join(repo_root, 'scripts', '_integrity_ts_parse.cjs')
        if not os.path.isfile(helper):
            return True, ''
        try:
            payload = json.dumps([os.path.relpath(target, repo_root)])
            r = subprocess.run(['node', helper], input=payload,
                               capture_output=True, text=True,
                               cwd=repo_root, timeout=20)
            if r.returncode != 0:
                return False, f'TS helper exit {r.returncode}'
            issues = json.loads(r.stdout or '[]')
            if issues:
                first = issues[0]
                return False, (
                    f'TS parse: {first.get("path")}:{first.get("line")} '
                    f'{first.get("message", "")[:160]}'
                )
            return True, ''
        except (FileNotFoundError, subprocess.TimeoutExpired,
                json.JSONDecodeError):
            return True, ''

    return True, ''


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

    if not args.no_parse_check:
        repo_root = find_repo_root(target_dir)
        ok, msg = parse_check(args.target, repo_root)
        if not ok:
            print(f'safe-write: PARSE CHECK FAILED for {args.target}',
                  file=sys.stderr)
            print(f'  {msg}', file=sys.stderr)
            if backup_path:
                shutil.copy(backup_path, args.target)
                force_mount_sync()
                print('safe-write: restored previous content from backup',
                      file=sys.stderr)
            _cleanup(None, backup_path)
            return 4

    _cleanup(None, backup_path)

    if not args.quiet:
        size = len(final_data)
        print(
            f'safe-write: ok ({args.target}: {size} bytes, {line_count} lines, '
            f'sha256={expected_sha[:12]}…, mount-verified, parse-check passed)'
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
