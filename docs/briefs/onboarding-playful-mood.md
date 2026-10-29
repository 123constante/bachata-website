# Brief: make the built onboarding PLAYFUL, as the owner picked (BUILD-visual, normal lane, Sonnet: copy + CSS, no new rule)

Owner picked the PLAYFUL mood (clickable prototype #1124). The audit `docs/audits/onboarding-tapthrough-2026-10-29.md` on branch `claude/onboarding-tapthrough-audit` (fetch it; screenshots built vs prototype are beside it) shows the build reads calm/plain. Close gaps 1-3 only.

## Build (behind `organiserP3`, which stays OFF)
1. Welcome title uses the person's first name when known: "Hey <first name>, you made it!" (prototype `buildWelcome`, `docs/design/onboarding-prototype.html` ~line 934); fall back to the current "Welcome to <page name>" when no first name. One shared mapping, table-tested (known / empty / long / non-Latin names).
2. Playful touches from the prototype's `data-mood=playful` on every question screen: friendlier helper lines and titles where the prototype has them, a visible friendly reaction when a card/chip is picked (colour pop, tick), use the empty lower half sensibly only if the prototype does (no invented layouts). Copy British English; entities (`&rsquo;`) not raw Unicode in JSX.
3. Flags: add an emoji fallback when the flagcdn image fails (`ObShell.tsx` ~121-135) so a chip is never an empty box.

## Out of scope (owner decisions pending, do NOT change)
Gap 4: progress % semantics on Review (it is truthful on purpose, #1144). Prototype screens find/create/contact (not walked). Languages flags.

## Standing checks
Design Gate: design record `docs/design/<pr>.md` linking before/after pictures at 390x844 for every changed screen, light and dark; contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll, no new scroll. Zero bytes to the /app first load (`npm run check:bundle-budget` main vs branch; never edit `perf-budgets.json` or `vite.config.ts`). Red first for the Welcome mapping. Every applicable CI step run in your sandbox, per-job table and the "Verified on real data" block (shapes = real first-name shapes read read-only: counts only) in the PR body. Existing guard G3 forbids the words "for review" in the organiser module.

## Output
Handover `docs/handovers/onboarding-playful-mood.md` with Verified / Not verified. One push, last commit subject ending `[worker-done playful]`. Context under 50%. Never merge or approve.
