# Review: PR #1790 delta, b8ca2d154 → 40ba2189d (organiser Round 4)

Delta review of the single fix commit `40ba218` ("fix(organiser): R4 full day/month names, escape unicode punctuation") on `claude/organiser-r4`. The prior review (`docs/review/pr-1790-organiser-r4.md`, PASS WITH NITS) covered `b8ca2d1` and is not repeated here. The PR branch was not edited.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Hard-tier scope (save path, RPC/ACL, routing, feature flags, money) was checked by reading the diff and found untouched.

## What the delta is

`git diff b8ca2d154 40ba2189d` touches 13 files (35 insertions, 29 deletions) plus one handover doc. Every changed code line falls in one of two classes:

**(a) Full weekday and month names replace short ones.**
- `p3/r4/r4EventsModel.ts`: `DAYS` and `MONTHS` arrays change from `Sun`/`Jan` style to full names. `shortDay()` is the only reader. Its only consumers are inside `p3/r4` (confirmed with `git grep` at `40ba2189d`; nothing outside the module imports it).
- `p3/r4/R4Tickets.tsx`, `r4DoorInviteModel.ts` (`dayWord`), and `r4TicketsModel.ts` / `r4NightModel.ts` / `r4EditModel.ts` doc comments: `toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })` replaces the `short` options. The `timeZone: 'UTC'` and the `T12:00:00Z` anchor are unchanged, so the calendar day cannot shift.
- The `.replace(',', '')` in `dayWord` stays. With `en-GB` long options there is no comma to strip, so it is a no-op, not a behaviour change.

**(b) Raw Unicode punctuation becomes escapes.**
- `r4NightModel.ts` `CANCEL_R4_COPY`: `‘`/`’` → `‘`/`’`. Byte check against `b8ca2d154`: the original bytes were `342 200 230` (U+2018) and `342 200 231` (U+2019). Equal code points.
- `r4TeamModel.ts` `R4_ADD_COPY.adding`: `…` → `…`. Original bytes `342 200 246` (U+2026). Equal.

No other line changed. No change to save paths, mutations, RPC names, routing, feature flags (`organiserR4`), or the door module.

## Checks run

| Check | Where | Result |
|---|---|---|
| `npx vitest run src/modules/organiser/p3/r4 src/modules/organiser/p3/door` | worktree at `40ba218` (node_modules symlinked) | **18 files, 612 tests passed, 0 failed** |
| `npx tsc --noEmit -p .` | same worktree | **exit 0, no errors** |
| Raw-punctuation sweep of `p3/r4` non-test sources | `git grep -P "[^\x00-\x7F]"` at `40ba218` | Only one hit: a `£` inside a comment in `r4EditModel.ts:16`. No raw punctuation in rendered strings. |
| Consumer sweep for `shortDay` / `DAYS` / `MONTHS` / changed copy | `git grep` at `40ba218`, outside `p3/r4` | No consumers outside `p3/r4`. |

## Nits (non-blocking)

1. **Matrix test not fully escaped.** `p3/r4/__tests__/r4Edit.matrix.test.ts:56` still holds a raw `’` (`'title is the board’s; …'`). The brief asked for escapes in matrix tests. It is a test-title string, so it has no runtime effect, but it is the one remaining raw curly apostrophe in the delta's test scope. `r4Tickets.matrix.test.ts:72` also has a raw `£` in an assertion. Same reasoning: no effect on behaviour.
2. **Copy is roughly 2× longer on the screens that show it.** `Fri 20 Nov, 9pm, Soho Dance Studio` becomes `Friday 20 November, 9pm, Soho Dance Studio`. The Tickets night line, Events row, and Night header all carry it. At 390 px this may wrap onto a second line where the old string did not. The delta changes copy only and no layout was re-measured, so this is a phone-QA item, not a verdict change. Owner should eyeball the R4 Tickets, Events, and Night screens at 390×844 before merge.
3. **Full organiser suite not re-run by this reviewer.** The handover claims `npx vitest run src/modules/organiser`: 367 files, 14347 passed. I re-ran only the `p3/r4` and `p3/door` subtrees (18 files, 612 tests). The rest of the module is unchanged by this delta, but the claim is inherited, not re-verified here.

## Not verified

- **Phone walk at 390×844 was not done** by this reviewer. The handover states "phone walk (copy-only change)" as not verified; I agree and carry it forward (nit 2).
- **CI status on the PR** was not read. Only local checks above were run.
- **`check:mojibake` / `pre-ship`** were not run by this reviewer. The handover reports `check:mojibake` clean; not re-run here.
- **Production data shapes** were not surveyed for this delta. The change is copy-only and the matrix tests cover the shapes in the prior review; no Supabase reads were made.
- **Visual wrapping** of the longer weekday/month strings was not observed in a browser.

## Method

Read `git diff b8ca2d154 40ba2189d` in full. Byte-compared the escaped code points against the pre-fix sources. Ran the two requested vitest directories and `tsc` in a detached worktree at `40ba218` so the PR branch was not touched.
