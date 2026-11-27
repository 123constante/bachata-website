# Brief: independent review of PR #1295 (Vercel skips builds by diff), docs only

Lane: careful read-only review. Model: Fable (builder was Opus). Branch: claude/review-1295-r1. One round, no code edits, no push to the PR branch.
Target: claude/skip-builds-by-diff head a6d42312. Read docs/handover/skip-builds-by-diff.md and the brief docs/briefs/skip-builds-by-diff.md (brief/skip-builds-by-diff) first.
## Must check (verdict + file:line each)
1. FALSE SKIP is the only dangerous failure: a push that changes app code must always build. Try to produce a false skip: a diff touching src only through a rename (previous_filename), a deleted file, a file in a BUILD_PATH dir with unusual characters, a submodule/symlink change, a merge commit whose first-parent diff is empty but second-parent is not, VERCEL_GIT_PREVIOUS_SHA pointing at an unrelated branch's sha, a force-push, a shallow clone missing the base, a binary file, package-lock only, vercel.json/vite config only, .env* , public/ assets, scripts that the build runs. Every one must BUILD.
2. BUILD_PATHS is read once; lib/buildRule.mjs parses it from the shell script; confirm the parser cannot be fooled (comments, line continuations, quoting) and that an unparsed list throws (doubt = build).
3. previewProbe.findIdenticalPreview: it must never return a preview of DIFFERENT app code; check ancestor choice (newest of 20), compare-API 'ahead' only, file list truncation (300 files / API pagination cap), renames, merge commits, a preview that is READY but for a different branch's later commit, and [skip preview] heads.
4. claude/* and arc/briefs-* "always skip" (unchanged rule): confirm it is truly unchanged and say whether a claude/* branch with app code relies on the PR preview anyway (the lighthouse and synthetic jobs) and what happens now.
5. Production path unchanged. Every workflow that polls previews still goes green or red for the right reason.
6. Tests: run them; re-run any mutants the builder lists; add two of your own (BUILD_PATHS entry removed; rename ignored) and report a table.
## Output
docs/reviews/1295-r1.md: verdict PASS / FIX / BLOCK, ranked findings, mutant table, Not verified. Push once. Supabase read-only. Never merge or approve. git fetch origin main first.
