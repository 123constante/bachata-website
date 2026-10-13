#!/usr/bin/env bash
# bin/repair-corrupt.sh — restore Cowork-mount-corrupted files.
#
# Workflow:
#   1. Run integrity-guard --json to get the list of corrupt files.
#   2. For each corrupt file:
#      a. If working tree matches HEAD → restore via `git show HEAD:` +
#         safe-write.py (avoids git-checkout's index.lock issue on the
#         Windows mount).
#      b. If working tree differs from HEAD → could be intentional edits
#         OR pure corruption-as-diff. Try a "pure truncation" detection:
#         if HEAD's content STARTS with the working tree's content (i.e.
#         the working tree is a strict prefix of HEAD), it's pure
#         truncation — safe to restore. Otherwise print manual command.
#
# Run from anywhere in the repo.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
    echo "repair-corrupt: not in a git repo" >&2
    exit 1
fi
cd "$REPO_ROOT"

# Clean orphan index.lock if present (this mount leaves them behind)
if [ -f .git/index.lock ]; then
    rm -f .git/index.lock 2>/dev/null || true
fi

if [ ! -x bin/check-integrity.sh ]; then
    echo "repair-corrupt: bin/check-integrity.sh missing or not executable" >&2
    exit 1
fi

echo "repair-corrupt: scanning for corruption..."
# The wrapper's stderr is KEPT, not sent to /dev/null. It is where the
# actionable remedy lives: a mount-truncated scripts/_integrity_ts_parse.cjs
# makes bin/check-integrity.sh exit 2 printing the exact `git checkout` that
# repairs it, and discarding that left this script telling the operator to "fix
# the tooling" about a tracked file it could have restored.
GUARD_ERR="$(mktemp -t repair-guard-err-XXXXXX)"
trap 'rm -f "$GUARD_ERR"' EXIT
set +e
RAW_OUT="$(bash bin/check-integrity.sh --json 2>"$GUARD_ERR")"
GUARD_STATUS=$?
set -e

# TWO filters on the restore list, and both are load-bearing. A could-not-run
# issue says the parser never looked at the file, so restoring it from HEAD on
# that basis would silently discard uncommitted edits over a ten-second node
# hiccup. The producer already guarantees such an issue carries no path (see
# Issue.__init__ in scripts/integrity-guard.py); this end keeps that guarantee
# from being the only thing standing between a hung parser and a data loss.
# Proven load-bearing by mutation: defeat the producer invariant and this
# filter alone still keeps an unchecked file out of restore_from_head.
CORRUPT_FILES="$(printf '%s' "$RAW_OUT" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
seen = set()
for issue in data.get('issues', []):
    if issue.get('could_not_run'):
        continue
    p = issue.get('path', '')
    if p and p not in seen:
        seen.add(p)
        print(p)
")"

if [ -z "$CORRUPT_FILES" ]; then
    if [ "$GUARD_STATUS" -eq 0 ]; then
        echo "repair-corrupt: no corruption detected. nothing to do."
        exit 0
    fi
    # Was an unconditional "nothing to do" + exit 0. The guard exiting 2 means
    # it COULD NOT CHECK, and reporting that as nothing-to-do is the same
    # unknown-recorded-as-clean this whole apparatus exists to not have.
    echo "repair-corrupt: the guard COULD NOT CHECK the tree (exit $GUARD_STATUS)." >&2
    echo "  Nothing was repaired, and nothing here says the tree is clean." >&2
    if [ -s "$GUARD_ERR" ]; then
        sed 's/^/  /' "$GUARD_ERR" >&2
    fi
    # Deduped and capped INSIDE python, and computed only in the branch that
    # prints it. The previous shape piped a generator through `sort -u | head`
    # under `set -o pipefail`: once the block outgrows the pipe buffer (measured
    # at ~64 KB, and this block is precisely what grows with the corpus) head
    # closes the pipe, sort takes SIGPIPE, and the script dies with 141 having
    # printed nothing at all -- losing the very message it exists to deliver.
    printf '%s' "$RAW_OUT" | python3 -c "
import json, sys
from itertools import islice
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
seen = []
for issue in data.get('issues', []):
    if not issue.get('could_not_run'):
        continue
    line = f\"[{issue.get('code','')}] {issue.get('reason','')}\"
    if line not in seen:
        seen.append(line)
for line in islice(seen, 10):
    print('  ' + line)
" >&2
    echo "  Fix the tooling (node / PyYAML / the sha pin), then re-run." >&2
    exit 2
fi

echo "repair-corrupt: found corruption in:"
echo "$CORRUPT_FILES" | sed 's/^/  /'
echo

restored=0
manual=0
declare -a MANUAL_FILES=()

restore_from_head() {
    local file="$1"
    local tmpfile
    tmpfile="$(mktemp -t repair-XXXXXX)"
    if git show "HEAD:$file" > "$tmpfile" 2>/dev/null; then
        cat "$tmpfile" | python3 scripts/safe-write.py --quiet --no-parse-check "$file"
        rm -f "$tmpfile"
        return 0
    fi
    rm -f "$tmpfile"
    return 1
}

is_pure_truncation() {
    local file="$1"
    # Working tree is a strict prefix of HEAD = pure truncation
    local working_size head_size
    working_size="$(wc -c < "$file" 2>/dev/null || echo 0)"
    head_size="$(git cat-file -s "HEAD:$file" 2>/dev/null || echo 0)"
    [ "$working_size" -ge "$head_size" ] && return 1
    [ "$working_size" -eq 0 ] && return 1
    # Compare working tree against the first N bytes of HEAD
    local head_prefix
    head_prefix="$(git show "HEAD:$file" | head -c "$working_size")"
    local working_content
    working_content="$(cat "$file")"
    [ "$head_prefix" = "$working_content" ]
}

while IFS= read -r file; do
    [ -z "$file" ] && continue
    if ! git ls-files --error-unmatch "$file" &>/dev/null; then
        echo "  [skip] $file — not tracked by git"
        continue
    fi
    if git diff --quiet HEAD -- "$file" 2>/dev/null; then
        if restore_from_head "$file"; then
            echo "  [restored] $file (was clean vs HEAD)"
            restored=$((restored + 1))
        else
            echo "  [error] $file — git show failed"
        fi
    elif is_pure_truncation "$file"; then
        if restore_from_head "$file"; then
            echo "  [restored] $file (pure truncation detected)"
            restored=$((restored + 1))
        else
            echo "  [error] $file — git show failed"
        fi
    else
        echo "  [manual] $file — has non-truncation working-tree changes"
        echo "      to inspect: git diff HEAD -- '$file' | head -40"
        echo "      to restore: git show HEAD:'$file' | python3 scripts/safe-write.py '$file'"
        MANUAL_FILES+=("$file")
        manual=$((manual + 1))
    fi
done <<< "$CORRUPT_FILES"

echo
echo "repair-corrupt: restored $restored file(s), $manual file(s) need manual attention"

if [ "$manual" -gt 0 ]; then
    echo
    echo "files needing manual repair (have non-truncation diffs vs HEAD):"
    printf '  %s\n' "${MANUAL_FILES[@]}"
    echo
    echo "for each, decide:"
    echo "  - if the diff is real intentional work, fix the corruption manually"
    echo "    by reconstructing the intended content into /tmp and running"
    echo "      cat /tmp/<file> | python3 scripts/safe-write.py <path>"
    echo "  - if you want to discard the working-tree changes, run"
    echo "      git show HEAD:<path> | python3 scripts/safe-write.py <path>"
    exit 2
fi

echo
echo "repair-corrupt: re-running guard to confirm clean..."
bash bin/check-integrity.sh
