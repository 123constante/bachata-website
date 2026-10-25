# REBASE er-stack handover -- PR #914 `claude/er-c8-eventpage`

Ticket dt_bf630845c6c2, 2026-10-25. Brief: `briefs/REBASE-er-stack-brief.md` @ ebe5fe5.

## Outcome: MERGED LOCALLY, NOT PUSHED (needs owner)

| | sha |
|---|---|
| old head of #914 | `94a7e5eabf859eecc7f4637f00b15ade4479ab03` |
| origin/main merged | `4791d9f276584094e5078618ce3f4d502d992dd1` |
| new head (local, never pushed) | `022cdff4b90242df5318c3f1fc260d7dddd16b72` (tree `b93ee22e3c78081e0cbde325b578b2af91e2e09d`) |

**The push to `claude/er-c8-eventpage` was refused by this session's permission
classifier.** Both forms were refused: `--force-with-lease=...:94a7e5e` and a
plain fast-forward push. I did not work around it. `git ls-remote` still shows
`94a7e5e`, so #914 is **still CONFLICTING**. The backup tag push
(`backup/er-c8-eventpage-pre-rebase-2026-10-25`) was also refused by the proxy
("remote end hung up"). No backup is needed, because the result is a merge:
it is a **fast-forward** of `94a7e5e` and keeps every old commit.

### To land it (owner, or a worker allowed to push that branch)
From a checkout of `claude/rebase-er-stack`, at the repo root:

    sh docs/rebase/er-stack-replay.sh
    git push origin claude/er-c8-eventpage      # plain fast-forward, no force needed

The script checks both input shas, merges, applies
`docs/rebase/er-c8-merge-resolution.patch` (the 9 resolved files, as a diff
against origin/main), and **asserts the tree equals `b93ee22`** before it commits.
It was replayed in a scratch worktree and produced that tree.
If main or #914 has moved, the sha checks stop it. Redo the merge by hand
in that case, following the resolutions below.

## Why merge, not rebase
The branch already has 23 merge commits among 68 (the stack is built by
merging #903 -> #904/#905 -> #917 -> #919 into it, plus 4 earlier main merges).
Rebasing that history would replay the same files across many commits. One
`git merge origin/main` resolves each conflict once.

## Conflicts (7) and how they were resolved
| file | resolution |
|---|---|
| `shared/goLiveCheck.ts` | Main's side: `GO_LIVE_LABEL` derives from main's one map `goLiveKeys.GO_LIVE_BLOCKERS`. ER's `RULE_LABELS` (event-rules.json words) **moved into goLiveKeys.ts**, so the words are not kept in two places. |
| `shared/goLiveKeys.ts` (auto-merged, edited) | The base map is now `BLOCKERS`. `GO_LIVE_BLOCKERS` takes each label event-rules.json owns from that file (name, venue, `no_session_first_date`, `first_date_past`, `bad_session_times`, `no_payment`, `no_flyer`, `cover`) and keeps main's sections and `sameAs` twins. Result: the ER v7 words ("Pick a venue", "Add a flyer", "Add a session", ...) show on every screen, and main's single go-live map stays the only map. **Product note:** main's own words for those codes ("Add a venue", "Upload a flyer", "Say how dancers pay", ...) are replaced by ER's v7 words. No main test pins main's words. ER tests pin the v7 words. |
| `events/eventModel.ts` | Both sides kept: ER removed the `time` and `instagram` detail rows, and main added `payment` ("How to pay"). Result: `'name'\|'venue'\|'level'\|'music'\|'tickets'\|'about'\|'payment'`, with `TextDetail` excluding venue and payment. |
| `flows/add/Time.tsx` | ER's `useOrganiserSeries` lookup and its error condition, plus main's `keepReturnTo(..., search)` Back. |
| `flows/add/WhichDay.tsx` | Main's `keepReturnTo/readReturnTo` import, plus ER's addModel import (no `findSeries`, which ER removed). |
| `__tests__/parity-matrix.test.ts`, `shared/__tests__/seriesCommands.test.ts` | Main's side. Only the comment differed; `payment_methods` is on both sides. |
| `events/__tests__/goLive.webA1a.test.tsx` | Main's side. Its LATER list covers the same codes ER read from event-rules.json, and its verb regex is wider. |
| `events/__tests__/er-c8.fix2.page.test.tsx` (not a conflict) | The `doneState` mock now spreads the real module and overrides only `goDone`. Reason: main's goLiveCheck imports `withReturnTo`, so the old mock crashed the whole file. No assertion changed. |

## File list (`git diff origin/main...HEAD --name-only`): 112 before, 111 after
- Vanished: `shared/__tests__/seriesCommands.test.ts` (now equal to main) and `shared/goLiveCheck.ts` (now equal to main; ER's change moved to goLiveKeys).
- Appeared: `shared/goLiveKeys.ts` (ER's RULE_WORDS override).

## Tests (merged tree, local)
- `npx vitest run src/modules/organiser src/modules/event-page`: 216 files, **5133 passed**, 2 skipped, 0 failed.
- `npm run test:unit` (full): 622 files, 15086 passed, **15 failed** in 4 files. These are `tests/eventViewCompat.contract`, `occurrenceProgram.contract` and `publicEventPageLineup.contract` (live DB), plus `integrityCouldNotRun` (toolchain environment). **The same 15 fail on origin/main** in this container, so none are from the merge.
- `tsc -p tsconfig.app.json --noEmit`: 52 error lines, **identical set to origin/main** (none in organiser).
- `npm run lint`: 21/22 links PASS. `check:integrity` exits 126 only because `bin/check-integrity.sh` is mode 100644 in git (same on main). Run as `bash bin/check-integrity.sh`: ok, 2617 files, 0 issues. eslint is clean on every touched file.
- `editorOrder.matrix.test.tsx` **does not exist** on main or on #914, so there is no snapshot to compare. No snapshot file changed in the merge. A full vitest run in this container rewrites some `tests/regression/today` snapshots; I reverted those and did not commit them.
- `.githooks/pre-push` run by hand: its unit gate fails only on `integrityCouldNotRun` (same as main, environment).

## Verified
- The merge resolves all 7 conflicts. Both sides' intent is kept, as the table above describes.
- ER and organiser tests are green. Typecheck and lint match main.
- The replay script reproduces the exact tree.

## Not verified
- **Not pushed. #914 is still CONFLICTING.** It needs an owner push (see above).
- CI on the new head did not run (no push).
- No browser walk and no Vercel preview.
- No prod shape survey: the merge adds no new data reads.
- The copy change (main's go-live words replaced by ER v7 words) needs an owner nod. It follows the ER "one go-live label map, v7 words" decision, but main's walk-fix words were written later.
- Not touched: #903 #904 #905 #917 #919 #911 #912 #916.
