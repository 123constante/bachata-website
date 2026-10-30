# Session handover: P3 W3a details + prices (2026-10-27, ticket dt_c6540b5c4591)

Branch `claude/p3-w3a-details`, PR #1082 (opened by bot-pr.yml). Brief `brief/p3-w3a-details`
`docs/briefs/p3-w3a-details.md` (sha e626c69). Design record `docs/design/1082.md`.

## Done
- ONE save model: `p3/model/saveModel.ts` (pure) + `p3/screens/EditTray.tsx` (useEditForm, useSaveRun,
  EditTray, GuardedBack, useBackToEvent). Tray, Undo my changes with confirm, leave guard (Back, route change,
  tab close), untouched = nothing sent, one key per command reused by a retry, refusals via COMMAND_COPY,
  someone else's save keeps the typing with "Start again from the saved version".
- Name and details (`events/:id/details`): name, About, music, Where (venue + city), ticket, cover upload,
  Instagram, videos, group chat link. Prices (`events/:id/prices`): It's free, price rows, how to pay; team
  price lists locked with reason. Event page About: two rows replace the "current organiser area" note.
- `series.set_group_chat` joined `OWNER_COMMAND_KINDS` (+ both mirror tests) with `groupChatCommand`;
  `parseEventWorkspace` now reads `group_chat_url` (`groupChatUrl`) -- it was dropped before (found by the matrix).
- W2d nits A/B/C fixed in SessionSheet / LineupSheet; `w2dNits.test.tsx` red on unfixed code (6 failing), green
  after; 3 old `sessions.send.test.tsx` rows that pinned the old behaviour updated.
- Prod survey (read-only, counts) and walk: see the PR body and `docs/handover/p3-w3a-details/`.

## Open / next
- No `/code-review` round was run on this diff (CLAUDE.md wants one before commit; the orchestrator's stage).
- CI on the final head: read the PR checks; the local pre-ship result is in the PR body.
- Not built (see design record "Known limits"): gallery, default level, per-field "Was: X undo".
- Before merge: rebase on `main` if website-c2's PRs on EventPage/P3Routes/paths/p3.css land first
  (my edits there are append-only: two routes, two paths, one About block, appended CSS).
