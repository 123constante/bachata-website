#!/bin/sh
# Replays the merge of origin/main (4791d9f) into claude/er-c8-eventpage (94a7e5e)
# with the resolution verified on 2026-10-25. Run from the repo root on a checkout
# that has docs/rebase/er-c8-merge-resolution.patch (branch claude/rebase-er-stack).
set -e
PATCH=${PATCH:-docs/rebase/er-c8-merge-resolution.patch}
cp "$PATCH" /tmp/er-c8-merge-resolution.patch
git fetch origin main claude/er-c8-eventpage
test "$(git rev-parse origin/claude/er-c8-eventpage)" = 94a7e5eabf859eecc7f4637f00b15ade4479ab03
test "$(git rev-parse origin/main)" = 4791d9f276584094e5078618ce3f4d502d992dd1
git checkout -B claude/er-c8-eventpage origin/claude/er-c8-eventpage
git merge --no-ff --no-commit origin/main || true
for f in src/modules/organiser/__tests__/parity-matrix.test.ts src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx src/modules/organiser/events/eventModel.ts src/modules/organiser/flows/add/Time.tsx src/modules/organiser/flows/add/WhichDay.tsx src/modules/organiser/shared/__tests__/seriesCommands.test.ts src/modules/organiser/shared/goLiveCheck.ts src/modules/organiser/shared/goLiveKeys.ts src/modules/organiser/events/__tests__/er-c8.fix2.page.test.tsx; do
  git rm -q -f --cached "$f" 2>/dev/null || true; rm -f "$f"
  if git cat-file -e "origin/main:$f" 2>/dev/null; then git checkout origin/main -- "$f"; fi
done
git apply --index /tmp/er-c8-merge-resolution.patch
test "$(git write-tree)" = b93ee22e3c78081e0cbde325b578b2af91e2e09d
git commit -q -m "merge origin/main into claude/er-c8-eventpage (7 conflicts; ER v7 go-live words kept inside main's one go-live map)"
echo "replayed: $(git rev-parse HEAD), tree b93ee22e3c78081e0cbde325b578b2af91e2e09d (fast-forward of 94a7e5e)"
