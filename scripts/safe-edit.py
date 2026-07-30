#!/usr/bin/env python3
"""
safe-edit.py -- surgical (hunk-scoped) write path for the Cowork mount.

Companion to safe-write.py v2. safe-write replaces a whole file body;
safe-edit replaces exactly ONE occurrence of an old block with a new
block, then hands the patched FULL body to safe-write.py -- unchanged,
as a subprocess -- so every mount defence in the proven write path still
runs (staging in /tmp, backup, sync, subprocess sha256 verify, recopy
retries, parse check, backup restore).

Why this exists
---------------
Editing a 137 KB page costs ~2x the file in transported bytes when the
whole body must be re-emitted. Surgical mode costs ~2x the hunk.

Why it is more dangerous than safe-write, and what the defences buy
-------------------------------------------------------------------
safe-write never reads the target as an input, so the mount's stale-read
bug (corruption mode 1) and concurrent-session clobber (mode 2) can only
make its *verify* fail loudly. safe-edit reads the current file as its
patch base. A STALE base whose old block still matches would commit
"stale base + hunk" -- silently reverting an earlier edit while passing
every downstream check, because a sha verify proves the write landed,
not that the base was current.

Three defences convert that silent revert into a loud failure:

  1. Settled read -- sync, sha256 via subprocess, short delay, sha
     again. Two consecutive identical digests are required, AND the
     bytes read in-process must hash to that same digest, before the
     patch is computed. An unsettled/racing mount exits 2.
  2. Base-sha continuity -- every success prints the resulting sha256.
     Chained edits pass the previous one via --expect-base-sha; a
     mismatch exits 6 with NO write. This is what makes a concurrent
     clobber loud instead of silent.
  3. Unique match -- 0 or >1 occurrences of the old block: refuse,
     no write.

Fail-closed: ANY non-zero exit means "fall back to full-body
safe-write.py". The worst case is the status quo, never a corrupt file.

Payload format (stdin)
----------------------
Three marker lines, each exactly once, each alone on its line, in order:

    @@SAFE-EDIT-OLD@@
    ...text to find (must occur exactly once in the file)...
    @@SAFE-EDIT-NEW@@
    ...replacement text (may be empty for a pure deletion)...
    @@SAFE-EDIT-END@@

The newline that terminates a marker line is NOT part of the block, and
the newline immediately preceding a marker line is NOT part of the block
either -- so the blocks are exactly what you typed between the markers.

Usage
-----
    PATCH=$(mktemp /tmp/hunk-XXXXXX.txt)
    cat > "$PATCH" <<'HUNK'
    @@SAFE-EDIT-OLD@@
    const foo = 1;
    @@SAFE-EDIT-NEW@@
    const foo = 2;
    @@SAFE-EDIT-END@@
    HUNK
    PYTHONUTF8=1 python3 scripts/safe-edit.py src/pages/Foo.tsx < "$PATCH"

Never pipe a producer straight into safe-edit -- stage the payload in a
file first, so a failed producer cannot present as an empty patch.

Chained edits:
    PYTHONUTF8=1 python3 scripts/safe-edit.py src/pages/Foo.tsx \
        --expect-base-sha <sha printed by the previous edit> < "$PATCH2"

Flags
-----
    --expect-base-sha SHA   Require the settled base to hash to SHA.
    --no-parse-check        Forwarded to safe-write.py.
    --quiet                 Print only the result sha256 on stdout.

Exit codes
----------
    0  success -- hunk applied, full body written and mount-verified
    1  payload corruption (null bytes / stray carriage returns)
    2  target could not be read as a SETTLED base (mount never quiesced)
    3  usage / argument / malformed-payload / no-op error
    4  match failure -- 0 or >1 occurrences, or mixed line endings
    5  the safe-write.py write path failed (its exit code is reported)
    6  --expect-base-sha mismatch: the base is not what you think it is
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import os
import re
import subprocess
import sys
import time

MARKER_OLD = '@@SAFE-EDIT-OLD@@'
MARKER_NEW = '@@SAFE-EDIT-NEW@@'
MARKER_END = '@@SAFE-EDIT-END@@'

# Settled-read tuning. Two consecutive identical subprocess digests are
# required; each gap is SETTLE_DELAY. The mount normally quiesces on the
# first comparison, so the common case costs one delay.
SETTLE_DELAY_SECONDS = 0.35
SETTLE_ATTEMPTS = 4

HERE = os.path.dirname(os.path.abspath(__file__))
SAFE_WRITE_PATH = os.path.join(HERE, 'safe-write.py')


# ---------------------------------------------------------------------
# Reuse safe-write.py v2's mount primitives verbatim (import, not copy).
# safe-write.py is __main__-guarded, so importing it has no side effects.
# ---------------------------------------------------------------------

def load_safe_write():
    if not os.path.isfile(SAFE_WRITE_PATH):
        return None
    # Importing normally drops a scripts/__pycache__/ directory into the
    # repo. A write-path tool must not dirty the worktree it is editing.
    previously = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec = importlib.util.spec_from_file_location(
            'safe_write_v2', SAFE_WRITE_PATH)
        if spec is None or spec.loader is None:
            return None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception:
        return None
    finally:
        sys.dont_write_bytecode = previously


# ---------------------------------------------------------------------
# Payload parsing
# ---------------------------------------------------------------------

def marker_match(text: str, marker: str):
    """Find the single occurrence of `marker` alone on its own line.

    Returns the re.Match, or raises ValueError with a human message.
    """
    pat = re.compile(r'(?:\A|\n)' + re.escape(marker) + r'(?=\n|\Z)')
    hits = list(pat.finditer(text))
    if len(hits) == 0:
        raise ValueError(f'payload is missing the {marker} marker line')
    if len(hits) > 1:
        raise ValueError(
            f'{marker} appears {len(hits)} times -- it collides with your '
            f'content. Use full-body safe-write.py for this edit.')
    return hits[0]


def strip_leading_newline(s: str) -> str:
    return s[1:] if s.startswith('\n') else s


def parse_payload(text: str) -> tuple[str, str]:
    """Return (old_block, new_block) or raise ValueError."""
    m_old = marker_match(text, MARKER_OLD)
    m_new = marker_match(text, MARKER_NEW)
    m_end = marker_match(text, MARKER_END)

    if not (m_old.start() < m_new.start() < m_end.start()):
        raise ValueError(
            'payload markers are out of order -- expected OLD, then NEW, '
            'then END')

    old = strip_leading_newline(text[m_old.end():m_new.start()])
    new = strip_leading_newline(text[m_new.end():m_end.start()])
    return old, new


# ---------------------------------------------------------------------
# Settled read -- defence 1
# ---------------------------------------------------------------------

def settled_read(sw, path: str) -> tuple[bytes | None, str | None]:
    """Read `path` only once the mount has stopped changing its mind.

    Requires two consecutive identical subprocess digests AND that the
    bytes we read in-process hash to that same digest -- which is what
    links the cache-bypassing digest to the content we will patch.

    Returns (data, sha) or (None, None) if it never settled.
    """
    sw.force_mount_sync()
    prev = sw.sha256_via_subprocess(path)
    for _ in range(SETTLE_ATTEMPTS):
        time.sleep(SETTLE_DELAY_SECONDS)
        cur = sw.sha256_via_subprocess(path)
        if cur is not None and cur == prev:
            try:
                with open(path, 'rb') as f:
                    data = f.read()
            except OSError:
                return None, None
            if hashlib.sha256(data).hexdigest() == cur:
                return data, cur
            # Our in-process read disagrees with the cache-bypassing
            # digest: the mount is still serving two generations. Retry.
        prev = cur
    return None, None


# ---------------------------------------------------------------------
# Line-ending handling
# ---------------------------------------------------------------------

def detect_style(data: bytes) -> str | None:
    """Return 'crlf', 'lf', or None when the file mixes endings."""
    crlf = data.count(b'\r\n')
    bare_lf = data.count(b'\n') - crlf
    lone_cr = data.count(b'\r') - crlf
    if lone_cr > 0:
        return None
    if crlf > 0 and bare_lf > 0:
        return None
    return 'crlf' if crlf > 0 else 'lf'


def to_style(s: str, style: str) -> bytes:
    if style == 'crlf':
        s = s.replace('\n', '\r\n')
    return s.encode('utf-8')


# ---------------------------------------------------------------------
# Write -- delegated wholesale to safe-write.py v2
# ---------------------------------------------------------------------

def write_via_safe_write(target: str, body: bytes, style: str,
                         no_parse_check: bool) -> tuple[int, str]:
    """Hand the patched FULL body to safe-write.py, unchanged.

    The body is passed as bytes on the child's stdin (so no text-mode
    newline translation touches it), and the child is told explicitly
    which ending convention the file already uses -- so a surgical edit
    never rewrites the whole file's line endings as a side effect.
    """
    cmd = [sys.executable, SAFE_WRITE_PATH, target,
           '--crlf' if style == 'crlf' else '--lf', '--quiet']
    if no_parse_check:
        cmd.append('--no-parse-check')
    env = os.environ.copy()
    env['PYTHONUTF8'] = '1'
    env['PYTHONIOENCODING'] = 'utf-8'
    try:
        r = subprocess.run(cmd, input=body, capture_output=True, env=env)
    except OSError as exc:
        return 5, f'could not invoke safe-write.py: {exc}'
    err = (r.stderr or b'').decode('utf-8', 'replace').strip()
    return r.returncode, err


def fail(msg: str, code: int) -> int:
    print(f'safe-edit: {msg}', file=sys.stderr)
    print('safe-edit: NO WRITE performed. Fall back to full-body '
          'scripts/safe-write.py if you cannot resolve this.',
          file=sys.stderr)
    return code


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Surgical single-hunk editor for the Cowork mount.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('target')
    parser.add_argument('--expect-base-sha', default=None,
                        help='Require the settled base to hash to this '
                             'sha256 (chained-edit continuity guard)')
    parser.add_argument('--no-parse-check', action='store_true')
    parser.add_argument('--quiet', action='store_true')
    args = parser.parse_args()

    sw = load_safe_write()
    if sw is None:
        return fail(f'cannot import the write path from {SAFE_WRITE_PATH}', 3)

    try:
        sys.stdin.reconfigure(encoding='utf-8')
    except Exception:
        pass
    try:
        payload = sys.stdin.read()
    except Exception as exc:
        return fail(f'failed to read the patch payload from stdin: {exc}', 3)

    if '\x00' in payload:
        return fail('REFUSING -- the patch payload contains null bytes', 1)
    payload = payload.replace('\r\n', '\n')
    if '\r' in payload:
        return fail('REFUSING -- the patch payload contains stray carriage '
                    'returns after CRLF normalisation', 1)

    try:
        old, new = parse_payload(payload)
    except ValueError as exc:
        return fail(str(exc), 3)

    if old == '':
        return fail('the old block is empty -- it would match everywhere', 3)
    if old == new:
        return fail('the old and new blocks are identical -- nothing to do', 3)

    target = args.target
    if not os.path.exists(target):
        return fail(f'{target} does not exist. safe-edit patches EXISTING '
                    f'files; use safe-write.py to create one.', 3)
    if not os.path.isfile(target):
        return fail(f'{target} is not a regular file', 3)

    # --- Defence 1: settled read -------------------------------------
    data, base_sha = settled_read(sw, target)
    if data is None or base_sha is None:
        return fail(
            f'could not obtain a SETTLED read of {target} -- the mount kept '
            f'changing its answer across {SETTLE_ATTEMPTS} attempts (another '
            f'session writing? mount lagging?). Patching a base we cannot '
            f'trust is how an earlier edit gets silently reverted.', 2)

    # --- Defence 2: base-sha continuity ------------------------------
    if args.expect_base_sha and args.expect_base_sha.lower() != base_sha:
        return fail(
            f'BASE SHA MISMATCH for {target}\n'
            f'  expected base: {args.expect_base_sha.lower()}\n'
            f'  actual  base:  {base_sha}\n'
            f'  The file changed since the sha you are chaining from. '
            f'Applying this hunk would commit a stale base and silently '
            f'revert whatever changed. Re-read the file first.', 6)

    style = detect_style(data)
    if style is None:
        return fail(
            f'{target} mixes line endings (or contains lone CRs). A surgical '
            f'patch cannot preserve that safely -- use full-body '
            f'safe-write.py.', 4)

    # --- Defence 3: unique match -------------------------------------
    needle = to_style(old, style)
    repl = to_style(new, style)
    count = data.count(needle)
    if count == 0:
        return fail(
            f'the old block does not occur in {target} (searched as {style}). '
            f'Re-read the file -- your copy is out of date, or the '
            f'indentation/whitespace does not match byte for byte.', 4)
    if count > 1:
        return fail(
            f'the old block occurs {count} times in {target} -- refusing an '
            f'ambiguous patch. Widen the old block with surrounding lines '
            f'until it is unique.', 4)

    idx = data.find(needle)
    patched = data[:idx] + repl + data[idx + len(needle):]
    if patched == data:
        return fail('the patch is a no-op against this file', 3)

    expected_sha = hashlib.sha256(patched).hexdigest()

    # --- Write via the proven full-body path --------------------------
    rc, err = write_via_safe_write(target, patched, style,
                                   args.no_parse_check)
    if rc != 0:
        print(f'safe-edit: safe-write.py failed (exit {rc})', file=sys.stderr)
        if err:
            print(err, file=sys.stderr)
        print('safe-edit: the write path restores its own backup on failure; '
              'verify with `git diff` before retrying.', file=sys.stderr)
        return 5

    # --- Post-write settled read: this is the sha you chain from -------
    #
    # Two OUTCOMES, and they must not be conflated -- rolling them together
    # let this block destroy a good write. safe-write.py returns 0 only after
    # its OWN cache-bypassing sha check passes (copy_and_verify, up to ~4.3s
    # of backoff), so by here the new content is already cryptographically
    # confirmed on disk. Our re-read gives up after SETTLE_ATTEMPTS x
    # SETTLE_DELAY_SECONDS (~1.4s) -- LESS patience than the writer had. On a
    # momentarily unsettled mount (exactly the condition this tool exists for)
    # `after` came back None and we wrote the PRE-EDIT body back over correct,
    # verified content and reported failure. A safety net must never be the
    # thing that reverts a verified edit.
    after, result_sha = settled_read(sw, target)

    if after is not None and result_sha != expected_sha:
        # A settled read that POSITIVELY disagrees. Two very different causes,
        # and rolling back is only ever right for ONE of them:
        #
        #   (a) the mount mangled our bytes -> restoring the pre-edit body is
        #       the correct, conservative repair.
        #   (b) ANOTHER writer legitimately wrote this file in the ~1.4s
        #       between safe-write's verify and our re-read -> restoring would
        #       destroy their work AND ours, and report it as "corruption".
        #
        # We cannot always tell, but we can rule (a) in: mount corruption of
        # our own write is overwhelmingly a MANGLED form of the bytes we sent
        # (truncation / null injection), so it should not coincide with valid,
        # complete content that we never authored. Treat "on disk is a prefix
        # of what we wrote, or is byte-identical to the pre-edit body" as ours
        # to repair, and anything else as a foreign write we must not touch.
        print(f'safe-edit: POST-WRITE VERIFY FAILED for {target}',
              file=sys.stderr)
        print(f'  expected: {expected_sha}', file=sys.stderr)
        print(f'  actual:   {result_sha}', file=sys.stderr)

        looks_like_our_mangled_write = (
            after == data                      # write silently didn't land
            or patched.startswith(after)       # truncated form of our bytes
            or b'\x00' in after                # null-byte injection
        )
        if not looks_like_our_mangled_write:
            print('safe-edit: on-disk content is neither our write nor a '
                  'truncated/nulled form of it -- this looks like a '
                  'CONCURRENT WRITE by another process, NOT mount corruption.',
                  file=sys.stderr)
            print('safe-edit: REFUSING to roll back, because restoring the '
                  'pre-edit body would destroy that writer\'s work as well as '
                  'ours. Inspect with `git diff` and re-apply your hunk on '
                  'top of the current content.', file=sys.stderr)
            return 6

        rc2, err2 = write_via_safe_write(target, data, style, True)
        if rc2 == 0:
            print('safe-edit: restored the pre-edit content', file=sys.stderr)
        else:
            print(f'safe-edit: RESTORE ALSO FAILED (exit {rc2}) {err2}',
                  file=sys.stderr)
            print('safe-edit: recover with `git checkout -- <path>`',
                  file=sys.stderr)
        return 5

    if after is None:
        # Never settled -- we learned NOTHING, which is not evidence against
        # the write. Keep it (safe-write verified it), say so plainly, and
        # hand back the expected sha so the caller can still chain.
        print(f'safe-edit: post-write re-read never settled for {target}',
              file=sys.stderr)
        print('safe-edit: KEEPING the write -- safe-write.py already verified '
              'it on disk via its own cache-bypassing check. Confirm with '
              '`git diff` if you want a second opinion.', file=sys.stderr)
        if args.quiet:
            print(expected_sha)
            return 0
        print(f'safe-edit: result sha256 = {expected_sha} (writer-verified, '
              'not re-read)')
        print('safe-edit: chain the next edit with '
              f'--expect-base-sha {expected_sha}')
        return 0

    if args.quiet:
        print(result_sha)
        return 0

    old_lines = len(old.split('\n'))
    new_lines = len(new.split('\n')) if new else 0
    print(f'safe-edit: ok ({target}: 1 hunk, -{old_lines}/+{new_lines} lines, '
          f'{len(data)} -> {len(after)} bytes, {style} preserved, '
          f'mount-verified, parse-check '
          f'{"skipped" if args.no_parse_check else "passed"})')
    print(f'safe-edit: base   sha256 = {base_sha}')
    print(f'safe-edit: result sha256 = {result_sha}')
    print('safe-edit: chain the next edit with '
          f'--expect-base-sha {result_sha}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
