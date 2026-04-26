#!/usr/bin/env python3
"""
safe-write.py — bulletproof file writer for the Windows-mounted repo.

Background: the Cowork sandbox's Write/Edit tools sometimes corrupt files
written through the Linux→Windows mount, injecting null bytes or truncating
mid-content. This script writes to /tmp first (Linux-native, no mount bug),
verifies, then atomically copies to the target with a post-copy reverify.

Usage:
    cat content.tsx | python3 scripts/safe-write.py path/to/file.tsx
    cat content.tsx | python3 scripts/safe-write.py path/to/file.tsx --crlf

Flags:
    --crlf      Force CRLF line endings (recommended for Windows-native repos)
    --expect-min-lines N    Fail if output is shorter than N lines (sanity check)
    --quiet     Suppress success output

Exit codes:
    0  success
    1  null bytes detected (corruption)
    2  too few lines (truncation suspected)
    3  I/O or argument error
"""
import sys
import os
import argparse
import tempfile
import shutil

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('target', help='Destination file path')
    parser.add_argument('--crlf', action='store_true', help='Use CRLF line endings')
    parser.add_argument('--expect-min-lines', type=int, default=0, help='Fail if fewer than N lines')
    parser.add_argument('--quiet', action='store_true', help='Suppress success message')
    args = parser.parse_args()

    try:
        content = sys.stdin.read()
    except Exception as exc:
        print(f'safe-write: failed to read stdin: {exc}', file=sys.stderr)
        return 3

    if '\x00' in content:
        print('safe-write: REFUSING — input already contains null bytes', file=sys.stderr)
        return 1

    if args.crlf:
        content = content.replace('\r\n', '\n').replace('\n', '\r\n')

    # Write to /tmp (Linux-native FS, immune to the mount bug)
    fd, tmp_path = tempfile.mkstemp(prefix='safe-write-', suffix='.tmp', dir='/tmp')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(content.encode('utf-8'))

        # Verify temp file pre-copy
        with open(tmp_path, 'rb') as f:
            tmp_data = f.read()
        if b'\x00' in tmp_data:
            print(f'safe-write: FATAL — null bytes in temp file (this should be impossible)', file=sys.stderr)
            return 1

        # Atomic copy to target
        target_dir = os.path.dirname(os.path.abspath(args.target))
        os.makedirs(target_dir, exist_ok=True)
        shutil.copy(tmp_path, args.target)

        # Post-copy reverify (this is the critical check — catches the mount bug)
        with open(args.target, 'rb') as f:
            final_data = f.read()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    null_count = final_data.count(b'\x00')
    if null_count > 0:
        print(f'safe-write: CORRUPTION DETECTED — {null_count} null bytes in {args.target} after copy', file=sys.stderr)
        print(f'safe-write: file may be partially written; re-run or investigate', file=sys.stderr)
        return 1

    line_count = final_data.count(b'\n') + (1 if final_data and not final_data.endswith(b'\n') else 0)
    if args.expect_min_lines and line_count < args.expect_min_lines:
        print(f'safe-write: TRUNCATION SUSPECTED — got {line_count} lines, expected at least {args.expect_min_lines}', file=sys.stderr)
        return 2

    if not args.quiet:
        size = len(final_data)
        print(f'safe-write: ok ({args.target}: {size} bytes, {line_count} lines, 0 nulls)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
