# REBASE small singles (#742, #884): handover

Ticket dt_b62e6cb14092. Brief: `brief/people-arc` `briefs/REBASE-small-singles-brief.md` (0bdf882e).
Main at the time of the run: `4791d9f2` (#1022). Result: **both PRs LEFT UNTOUCHED** (nothing force-pushed, nothing closed).

Note: the brief names the branches `hide-videographers-page` / `s13-site-background`. The real heads are
`claude/hide-videographers-page` (= refs/pull/742/head) and `claude/s13-site-background` (= refs/pull/884/head).

## #742 `claude/hide-videographers-page`: LEFT UNTOUCHED (needs a product decision)

- Old head: `5d989f076127b908ce31f5de70075368210b45cf` (unchanged on origin, checked with ls-remote).
- Old base: `5e0ec4cd` (#739). 2 commits (docs brief + feature).
- Conflicts (merge-tree): `src/components/catchallClientPaths.ts` (main added the `/app/*` dancer paths at the
  end of the list; the PR wraps the list in `.filter(isPathPublic)`), `src/lib/seo/buildSeoForRoute.ts` (both
  added an import line). Both are mechanical: keep both sides. A local rebase with that resolution
  (`85792081`, not pushed) kept the same 10-file `--stat` (171+/12-), with no file added or lost.
- **Why not pushed:** since the PR's base, main has added links into `/videographers`:
  - `src/modules/person-page/wall/lists.tsx` `MEDIA_BOOKING_HREF = '/videographers'`, used by the /dancers
    "Book a Photoshoot" card (`src/pages/Dancers.tsx:160`, when `flags.peopleWall` is on);
  - phone e2e: `tests/e2e-phone/helpers.ts` `FLAG_ROUTES` and `people-nationality-flag.phone.spec.ts`
    (the "videographers cards (inset)" check) both load `/videographers`.
  On the rebased tree, `npx vitest run` over the videographers, catchall, w2aWallPages and person-page tests gave
  **976 passed, 2 failed** (29 files):
  - `tests/videographersHidden.test.tsx` "no src/app/public file links or navigates to /videographers": the PR's
    own guard catches main's new link;
  - `src/pages/__tests__/w2aWallPages.test.tsx` "Book a Photoshoot, flag ON -> /videographers": main expects a
    routable target.
  Fixing these means choosing where "Book a Photoshoot" goes while the page is hidden (or hiding the card), and
  dropping `/videographers` from the phone-e2e routes. That is the owner's product call, so per the brief
  step 3 I pushed nothing.
- **Next step once the owner decides:** redo the rebase (2 mechanical conflicts, above), apply the decision to
  `MEDIA_BOOKING_HREF` / the Dancers card and its wall test, remove `/videographers` from the phone-e2e
  `FLAG_ROUTES` and the flag spec row, then run vitest, lint and tsc, and push once with force-with-lease.

## #884 `claude/s13-site-background`: LEFT UNTOUCHED (main already replaced it)

- Old head: `3503f90b9e3c9a5b190fd863340cd86f53f5c620` (unchanged on origin).
- Old base: `claude/s12-mockups` tip `952d4f16`. Only **1** commit is #884's own (the brief said 7, which
  probably counted against main). It does not depend on the stack: `s13Background.tsx` is self-contained, and the
  docs are its own 40 PNGs plus `docs/handover/s13-site-background.md`.
- Conflicts on `git rebase --onto origin/main 952d4f16`: `src/components/layout/GlobalLayout.tsx` (3 hunks).
- **Why not pushed:** main already shipped the result of this prototype. `src/components/layout/pageGrounds.ts`
  (W1 S4, #893) makes `default` the static calm-graphite ground, commented "owner pick B, S13". That is exactly
  this PR's option B (same `#0e1215` base and wash), with no icons, and with `<html>/<body>` painted. Rebasing
  would mean grafting a `?s13=A|B|C` prototype switch on top of the shipped grounds system: a design rewrite,
  not a rebase. Brief step 3 says "main already replaced what the PR builds", so I pushed nothing. The PNGs and
  the review doc still have value as the record of the decision. Whether to keep #884 open is the owner's call
  (I did not close it).

## Verified / Not verified
- Verified: neither remote branch moved (ls-remote shows the old shas). #742's rebase resolution was built locally
  and its tests run (counts above). #884's commit count, its independence from the stack, and main's
  `pageGrounds.ts` superseding it were all read from git.
- Not verified: `npm run lint` / `tsc` on the #742 rebase (stopped at the product decision); no browser walk;
  no Vercel or CI run, because nothing was pushed. I did not push backup tags: no history was rewritten, so the
  originals are still the branch heads.
