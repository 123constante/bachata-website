# CONTINUATION -- rebase #742 (hide /videographers) with the owner's decision

Lane: normal. Ticket branch `claude/rebase-742-cont` (handover + done marker only). EXPLICIT EXCEPTION: you may force-push `claude/hide-videographers-page` (PR #742) ONCE with `git push --force-with-lease=claude/hide-videographers-page:5d989f076127b908ce31f5de70075368210b45cf origin claude/hide-videographers-page` (plain git, no `gh api`, no shell variables). Backup tag first: `backup/hide-videographers-page-pre-rebase-2026-10-25`, push the tag. Never merge, never close.

## Read first
`docs/rebase/small-singles-HANDOVER.md` on `origin/claude/rebase-small-singles`: the previous worker already resolved the 2 mechanical conflicts (`src/components/catchallClientPaths.ts`, `src/lib/seo/buildSeoForRoute.ts`: keep both sides) in an unpushed local commit; redo that.

## Owner decision (2026-10-25 click)
While the /videographers page is hidden (VIDEOGRAPHERS_PUBLIC_ENABLED off), HIDE the "Book a Photoshoot" card on /dancers (`MEDIA_BOOKING_HREF` in `src/modules/person-page/wall/lists.tsx`, rendered in `src/pages/Dancers.tsx` ~line 160 when `flags.peopleWall` is on). It must reappear when the flag is on. Remove `/videographers` from `tests/e2e-phone/helpers.ts` `FLAG_ROUTES` and drop the videographers row in `people-nationality-flag.phone.spec.ts`. Update `src/pages/__tests__/w2aWallPages.test.tsx` so "Book a Photoshoot" is asserted: flag-off card absent, flag-on card present with its target. Table-driven, both flag states. No copy may point at the hidden page.

## Verify
`npx vitest run` over videographers, catchall, w2aWallPages, person-page; the two previously failing tests (`tests/videographersHidden.test.tsx` link guard, `w2aWallPages` Book a Photoshoot) must pass. `npm run lint`, `npx tsc --noEmit`. Compare red with main. ONE push, Vercel cap, no retries; `git ls-remote` shows the new sha.

## Rules
No `supabase/**`, no `.github/workflows`, no `--no-verify`. Context under 50%. Handover `docs/rebase/742-HANDOVER.md` on `claude/rebase-742-cont`: old/new sha, conflicts, the card change, tests (counts), Verified / Not verified (no browser walk possible: say so). End the final commit subject with the done marker from your prompt.
