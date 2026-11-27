# Brief: fix-join-copy-r2 (WEBSITE, normal lane, Sonnet). CONTINUATION on claude/fix-join-copy-r1 (PR #1243). One tiny fix, one push.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY.

Walk finding: on the "This link was already used" card (and any dead-link card where `screen.offerNewLink` is true) the page shows THREE lines that say the same thing: body "If that was not you, ask for a new one." + the new "Ask the person who sent it for a new link." + the button "Ask Ricky for a new one".

Fix (src/modules/admin-organisers/join/JoinScreens.tsx, DeadScreen): render `<NextLine reason={reason} />` only when `!screen.offerNewLink`. Leave the refused/StopScreen case as is. Update joinCopyRoughEdges.test.tsx: for DeadScreen pass a `newLink` button and assert `invite-next` is absent when the button is offered and present (equal to ASK_FOR_NEW_LINK) when not; keep the invalid-link case covering the line. Use scripts/safe-edit.py for files over 2 KB. Update the PR #1243 body to mention it. Run the join tests + eslint on join/. Final commit subject ends [worker-done <ticket>].
