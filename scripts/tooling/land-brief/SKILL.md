---
name: land-brief
description: Land docs-only brief files (docs/briefs, design, review, handovers, plans; .md/.json) onto a brief/* branch via the GitHub contents API, bypassing the load-flaky pre-push unit gate. Never for code.
---

# land-brief

```
node land-brief.mjs <owner/name> <brief-branch> <file>... [--base main] [--message "<text>"] [--root <dir>] [--dry-run]
node land-brief.mjs --self-test
```

- Branch must start with `brief/`, `claude/review-` or `claude/done-`.
- Every file's repo path (relative to `--root`, default git toplevel) must be `docs/{briefs,design,review,handovers,plans}/**` ending `.md` or `.json`. Anything else: exit 2, nothing written.
- Refuses >1 MB, binary, and likely-secret files (names the line, never the value).
- Idempotent: existing branch is reused, identical files report `unchanged`.
- Ends with `LANDED <branch> <head sha> <n> file(s)`; gh failure prints `ERROR: ...`, exit 1.
- Run `--dry-run` first. Run `--self-test` after any edit.
