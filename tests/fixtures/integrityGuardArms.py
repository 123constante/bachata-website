#!/usr/bin/env python3
"""
integrityGuardArms.py -- drive every could-not-run arm of
scripts/integrity-guard.py IN-PROCESS and print what each returned as JSON.

WHY THIS EXISTS, rather than an end-to-end case for each arm.

The arms need pinning separately: a future edit that splits a shared `except`
tuple, or narrows one, must not be able to leave half a fail-open in place. Some
of them have no cross-platform end-to-end route:

  node ABSENT     -- drivable for real (strip node out of the child's PATH), and
                     tests/integrityCouldNotRun.test.ts does exactly that. Driven
                     here TOO, so this harness is not trusted only on the arms it
                     alone can reach: a harness that raises one exception cannot
                     tell "the handler catches this" from "the handler catches
                     everything".
  node HUNG       -- no end-to-end route. Forcing a real TimeoutExpired needs a
                     `node` on PATH that blocks, and Windows CreateProcess does
                     not honour a shebang and appends only .exe, so a shell shim
                     is never found. The alternative -- an INTEGRITY_JS_TIMEOUT
                     knob in the guard so a canary could set it to zero -- adds
                     production surface whose only consumer is a canary, and a
                     wrong default there is a NEW fail mode inside the very
                     function being repaired. Rejected on that basis.
  PyYAML MISSING  -- forcing a real one means uninstalling a dependency of the
                     harness's own interpreter. Driven at the seam instead, via
                     a None entry in sys.modules, which is what CPython itself
                     raises ImportError on.

A seam proves the HANDLER; the end-to-end case proves the ROUTE reaches it.
Both exist because neither is sufficient.

Usage:
    python3 tests/fixtures/integrityGuardArms.py <path-to-integrity-guard.py>

Prints a JSON object keyed by arm name. A null value means the arm returned the
NO-ISSUE return -- the fail-open this whole apparatus exists to prevent.
"""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

# Importing the guard by path makes CPython write a .pyc beside it, so every run
# of this canary left an untracked scripts/__pycache__/ in `git status`. A test
# that dirties the working tree teaches its operator to ignore a dirty tree.
sys.dont_write_bytecode = True


def load_guard(guard_path):
    """Import integrity-guard.py by path. Its filename is not a valid module
    name (hyphen), so importlib is the only way in."""
    spec = importlib.util.spec_from_file_location('integrity_guard_under_test', guard_path)
    if spec is None or spec.loader is None:
        raise SystemExit(f'integrityGuardArms: cannot load a module from {guard_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def raiser(exc):
    def _raise(*_args, **_kwargs):
        raise exc
    return _raise


def as_json(issue):
    return None if issue is None else {
        'code': issue.code,
        'path': issue.path,
        'line': issue.line,
        'reason': issue.reason,
        'could_not_run': issue.could_not_run,
        'kind': issue.kind,
    }


# The JS arms, named by the exception class check_js_node catches. The names are
# what the spec asserts against AND what the guard puts in its own message via
# type(exc).__name__, so a reason naming the wrong arm is visible rather than
# merely plausible.
JS_ARMS = (
    ('FileNotFoundError', lambda: FileNotFoundError(2, 'No such file or directory', 'node')),
    ('TimeoutExpired',
     lambda: subprocess.TimeoutExpired(cmd=['node', '--check', 'probe.js'], timeout=10)),
)

# Exceptions the handler must NOT swallow. RuntimeError alone only kills a
# widening to `except Exception`; the NATURAL wrong fix here is `except OSError`,
# which swallows PermissionError and NotADirectoryError into a JS-RUN and would
# survive a battery that tested only RuntimeError. Both are driven.
UNLISTED = (
    ('RuntimeError', lambda: RuntimeError('not a could-not-run condition')),
    ('PermissionError', lambda: PermissionError(13, 'Permission denied', 'node')),
)


def drive_js_arms(guard, results):
    # subprocess is a module object SHARED with the loaded guard, so patching
    # guard.subprocess.run patches it process-wide. Restored after each arm so a
    # later arm cannot inherit the previous one's raiser and pass for the wrong
    # reason.
    real_run = subprocess.run
    for name, build_exc in JS_ARMS:
        guard.subprocess.run = raiser(build_exc())
        try:
            issue = guard.check_js_node('probe.js', Path('probe.js'))
        finally:
            guard.subprocess.run = real_run
        results[f'js_{name}'] = as_json(issue)

    for name, build_exc in UNLISTED:
        guard.subprocess.run = raiser(build_exc())
        try:
            guard.check_js_node('probe.js', Path('probe.js'))
        except Exception as exc:  # noqa: BLE001 -- the point is what type escapes
            results[f'js_propagates_{name}'] = type(exc).__name__
        else:
            results[f'js_propagates_{name}'] = None
        finally:
            guard.subprocess.run = real_run


def drive_yaml_arm(guard, results):
    # A None entry in sys.modules is what CPython itself raises ImportError on,
    # so this drives the real `except ImportError` rather than a stand-in for it.
    had_yaml = 'yaml' in sys.modules
    saved = sys.modules.get('yaml')
    sys.modules['yaml'] = None
    try:
        issue = guard.check_yaml('probe.yml', 'a: 1\n')
    finally:
        if had_yaml:
            sys.modules['yaml'] = saved
        else:
            del sys.modules['yaml']
    results['yaml_ImportError'] = as_json(issue)
    # The green control for this arm: with PyYAML importable again, a well-formed
    # document is clean and a broken one is a YAML corruption finding -- not a
    # could-not-run. Without these two the arm above could pass against a
    # check_yaml that had stopped working entirely.
    results['yaml_valid'] = as_json(guard.check_yaml('probe.yml', 'a: 1\n'))
    results['yaml_broken'] = as_json(guard.check_yaml('probe.yml', 'a: [1\nb: }\n'))


def drive_io_arm(guard, results, repo_root):
    """An unreadable file is a could-not-run, not a corruption finding.

    Driven at the seam because there is no portable way to make a real file
    unreadable: Windows needs an ACL edit and a CI job running as root would
    defeat a chmod anyway. The reachable production trigger is a transient
    EBUSY/EACCES on the FUSE mount, which is at least as likely as the hung
    `node --check` this whole change was written for -- and while it carried a
    path it went straight into bin/repair-corrupt.sh's restore list.
    """
    real_read_bytes = Path.read_bytes

    def deny(_self):
        raise PermissionError(13, 'Permission denied')

    # A file that really EXISTS, or check_file_basic returns early and the arm is
    # never reached -- a null result would then read as "the handler swallowed
    # it" when nothing had been driven at all. The guard's own source is the one
    # file guaranteed present wherever this harness runs.
    subject = 'scripts/integrity-guard.py'
    assert (repo_root / subject).is_file(), f'probe subject missing: {subject}'
    Path.read_bytes = deny
    try:
        issues = guard.check_file_basic(subject, repo_root)
    finally:
        Path.read_bytes = real_read_bytes
    results['io_unreadable'] = as_json(issues[0]) if issues else None


def drive_issue_invariant(guard, results):
    """The invariant that keeps a could-not-run out of repair-corrupt's reach.

    bin/repair-corrupt.sh hands every path this guard reports to
    restore_from_head, which overwrites the working file with HEAD's copy. A
    could-not-run naming a file would turn a ten-second node hiccup into the
    silent destruction of uncommitted edits, so Issue REFUSES to be built that
    way. Asserted here because no --files case can reach a constructor call that
    no site makes.
    """
    try:
        guard.Issue('some/file.js', 0, 'reason', code='JS-RUN', could_not_run=True)
    except ValueError:
        results['issue_rejects_pathful_could_not_run'] = True
    except Exception as exc:  # noqa: BLE001
        results['issue_rejects_pathful_could_not_run'] = type(exc).__name__
    else:
        results['issue_rejects_pathful_could_not_run'] = False
    # The control: the two SHAPES that are legal must still build, or the check
    # above would pass against an Issue that refuses everything.
    pathless = guard.Issue('', 0, 'reason', code='JS-RUN', could_not_run=True)
    pathful = guard.Issue('some/file.js', 3, 'reason', code='JS')
    results['issue_allows_pathless_could_not_run'] = as_json(pathless)
    results['issue_allows_pathful_corruption'] = as_json(pathful)
    # RENDERING, asserted here because main() no longer reaches the pathless
    # branch of __str__: could-not-run issues are printed through
    # summarise_could_not_run, which formats them itself. Proven by mutation --
    # deleting that branch left every end-to-end case green. It is still the
    # contract of a general-purpose renderer, and the ':0: [JS-RUN] ...' it
    # produced without it defeats path:line: parsing and already reached an
    # agent through the post-write hook. Assert it directly or it rots.
    results['str_pathless'] = str(pathless)
    results['str_pathful'] = str(pathful)


def drive_summariser(guard, results):
    """Grouping must fold a SYSTEMIC cause and still name a PER-FILE one.

    An absent node produces one JS-RUN per tracked .js file -- 160 restatements
    of a single fact -- so those fold to one line. IO does not: each one is a
    different file the guard never opened, and "unchecked is NOT clean" is
    actionable only if you know WHICH. Folding those named exactly one of them.

    Driven at the seam because reaching three simultaneous real IO failures
    end to end is not portable, and the GROUPING is what is under test.
    """
    io_issues = [
        guard.Issue('', 0, f'unreadable: src/{name}.tsx -- denied. This file was NOT checked.',
                    code='IO', could_not_run=True, kind='PermissionError')
        for name in ('alpha', 'bravo', 'charlie')
    ]
    js_issues = [
        guard.Issue('', 0, f'node --check could not run for src/{name}.js -- '
                           f'FileNotFoundError: nope. This file was NOT checked.',
                    code='JS-RUN', could_not_run=True, kind='FileNotFoundError')
        for name in ('xray', 'yankee')
    ]
    results['summary_mixed'] = guard.summarise_could_not_run(io_issues + js_issues)


def main(argv):
    if len(argv) != 2:
        raise SystemExit('usage: integrityGuardArms.py <path-to-integrity-guard.py>')
    guard = load_guard(argv[1])
    results = {}
    drive_js_arms(guard, results)
    drive_yaml_arm(guard, results)
    drive_io_arm(guard, results, Path(argv[1]).resolve().parent.parent)
    drive_issue_invariant(guard, results)
    drive_summariser(guard, results)
    print(json.dumps(results, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
