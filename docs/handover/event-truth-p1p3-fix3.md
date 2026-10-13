# Handover: event-truth P1+P3 -- FIX-3 slice (review round 2) -- PARTIAL, tests only

Branch `arc/event-truth-p1p3-fix3`, created FROM `origin/arc/event-truth-p1p3-fix2` (a8be7fa5). Brief:
`arc/briefs-event-truth:briefs/event-truth-p1p3-fix3.md` (blob 4eefc7a1). No PR opened (by brief). Written 2026-10-13 by
the cloud worker, which was told to stop early ("this session is too long"), so this commit carries the RED-FIRST TESTS
for fixes 1-7 and NO source change. **The suite is red on this head by design.** The next session (same branch, this
doc first) implements the fixes until these tests are green, then runs the check table and the mutation table.

## 1. State of this head

Source files: none touched. `src/lib/eventCategory.ts` untouched (sha `a8d972e7`); nothing under `calendar/**`; no
budget, pin or `vendor-ui*` change. Test files changed / added (red-first run on a8be7fa5 + these tests, before any
fix: **29 failed**, exactly the cases below; everything else in the four suites green):

| fix | test file | cases | red on a8be7fa5 |
|---|---|---|---|
| 1a | `pages.test.tsx` "a lost create reply freezes name, chips and organiser; the retry sends the identical create even after London midnight and another chip" | 1 | **red** (name not disabled; chips re-enabled) |
| 1b | `pages.test.tsx` "a REFUSED first create (nothing saved) leaves name, chips and organiser open; the retry may change them, under the same key" | 1 | green on both BY DESIGN: it pins that the freeze does not over-apply, and that key handling is unchanged |
| 2 | `createHint.test.ts` (new): table over (phase x busy x chip) for `chipHint`, 3 distinct frozen-phase sentences, "never says is made / open the event before confirmed" | 11 | **10 red** (`chipHint` does not exist yet) |
| 2, 3, 7 | `pages.test.tsx` "while the first create is in flight: chips disabled with the creating hint, no Open; after its reply Open sits below Create, enabled" (replaces the old in-flight test, which ended with a bare `release()`) | 1 | **red** (hint is `CHIPS_LOCKED_HINT` while in flight; Open mounted, disabled) |
| 4 | `pages.test.tsx` "the leave guard stays on while the create is not confirmed, and goes off once the event is made" | 1 | **red** (guard still asks once the event is made) |
| 5 | `eventTruth.matrix.test.tsx`: `expectedSublabel` table over locked x hasUpcoming x cancelledOnly x format x stored (200 rows + shared-constant case); rendered cancelled-only rows assert the date rows under When say Cancelled and `org-schedule-none` starts with `EVERY_UPCOMING_CANCELLED` | 201 + 5 | **9 red** (3 pure rows + the constant case + the 5 rendered rows) |
| 6 | `newEvent.seed.test.ts` imports `firstListedDate` from `shared/seriesModel` (spy test on `upcomingDates` dropped: the helper now lives beside it) + "is seriesModel's helper, not a copy in newEvent.ts"; `pages.test.tsx` "the editor's next date and the create's seed date skip a cancelled date through the one shared helper" (spies `seriesModel.firstListedDate` from BOTH screens over a workspace whose first upcoming date is cancelled) | 6 + 1 | **7 red** |
| -- | `pages.test.tsx` replay test: Open now asserted ENABLED (fix 3: present-and-disabled is no longer a state) | edit | green on both |

Test infra added in `pages.test.tsx`: the `useLondonToday` mock is now a mutable hoisted value (`londonToday.value`, reset
in `beforeEach`) so a test can roll London midnight between two presses; `shared/seriesModel` is mocked with
`firstListedDate: vi.fn(real.firstListedDate)` (pass-through spy).

## 2. The design the tests pin (what the next session builds; brief fixes 1-7)

- **`eventType.ts`:** `export type CreatePhase = 'open' | 'sent' | 'made'`; `chipHint(phase, busy, type)`: made ->
  `CHIPS_LOCKED_HINT` (fix its stale doc comment: it is the hint once the create is CONFIRMED, whatever later step runs
  or failed); else busy -> `'Creating your event…'` (a `\u` escape, never raw Unicode); else sent ->
  `'Not confirmed yet. Press Create to finish: nothing is made twice.'`; else the chip's hint / `FIRST_SESSION_HINT`.
  `export const EVERY_UPCOMING_CANCELLED = 'Every upcoming date is cancelled'` (EditorRows.tsx:29 imports it for the
  Schedule card: one constant, never two copies). `TypeRowState.cancelledOnly: boolean` ("cancelled upcoming dates
  exist, none listable"; a listable date wins over it). `typeSublabel`: NULL word, not locked, !hasUpcoming,
  cancelledOnly -> `${EVERY_UPCOMING_CANCELLED}. Open one under When and put it back on, then add a session and it is
  set for you.` (the date rows under When open the date page, whose "Put this date back on" is the un-cancel, disabled
  only by the event lock; cancelled dates are NOT in DatesTakenOff's Put back list, which reads `removed_dates`).
- **`EventEditorPage.tsx`:** `next = firstListedDate(ws.dates, today)`; Type row state
  `{ locked: !!lock, hasUpcoming: next !== null, cancelledOnly: next === null && upcoming.length > 0 }`.
- **`shared/seriesModel.ts`:** `firstListedDate(dates, today)` moved here (after `upcomingDates`); `newEvent.ts` loses
  it (the test asserts `newEvent.firstListedDate` is undefined); `NewEventPage.tsx` imports it from seriesModel.
- **`NewEventPage.tsx`:** `sentRef = useRef<{ cmds, type } | null>(null)`; `const [sent, setSent]`, `const [made, setMade]`
  (replaces `typeLocked`); `scheduleFailed` state removed (dead once the phase exists). On a press: `kept =
  sentRef.current`; if none, validate name/chip, `await resolveCreateCityId`, compute `cmds` ONCE, store
  `{ cmds, type }` in the ref, `setSent(true)` (same tick as the call), then send; if kept, send `kept.cmds.create`
  under `keys.create` with NO re-read of name/organiser/today/city. First catch: `isServerRefusal(err)` -> nothing was
  saved: `sentRef.current = null; setSent(false)`; otherwise stays frozen. On the confirmed reply `setMade(true)`. Every
  later step uses `kept.type` / `kept.cmds.schedule`. `frozen = busy || sent || made`: name (`TitleInput` needs a
  `disabled` prop passed through to the textarea, 1 line), the three type chips and the organiser chips take
  `disabled={frozen}`; hint = `chipHint(made ? 'made' : sent ? 'sent' : 'open', busy, type)`. Open the event: rendered
  BELOW the Create button, only when `made`, never disabled. Guard: `enabled: name.trim() !== '' && !busy && !created &&
  !made`. **Layout trap for the e2e y-assertion:** the hint `<p>` sits ABOVE Create and swaps from a 2-line chip hint to the
  1-line creating hint, which would move Create by one line; give the hint a fixed two-line box
  (`leading-[18px] min-h-[36px]`) so y is identical before the press, while it spins and after the reply.
- **e2e (not yet written):** `tests/e2e/organiser-events.spec.ts`, 390x844: after `openOrganiser`, `page.route` on
  `**/rest/v1/rpc/series_command_p5` that holds calls 1 and 2 (create, then its date) behind resolvers and then
  `route.fallback()`; assert Create's `boundingBox().y` equal before the press, while `aria-busy`, and after gate 1 is
  released (Open visible, enabled, its y greater than Create's); hint `/^Creating your event/` while held; release gate 2,
  URL becomes the editor, 2 envelopes.

## 3. Still to do (in this order), then re-check this doc

1. Implement section 2; run the four suites until green; `editorOrder.matrix` snapshot expected UNCHANGED (the
   cancelled-only shape stores `party`, so its row reads `Set by its sessions.`) -- confirm, and say so.
2. Mutation table for fixes 1, 2, 3, 4, 6 (brief section "Checks before you push").
3. The full check table (every no-secret step of every `pull_request` workflow, as the fix-2 handover's table), then
   `npm run pre-ship`; the 17-case environment-only set is the baseline.
4. Rewrite this handover as the final one (fixes file by file; red-first; mutation; checks; Verified / Not verified).

## 4. Verified / Not verified (this head)

**Verified:** the 29 red cases above fail on a8be7fa5 for the reasons stated (run 2026-10-13, Node 22); the four suites
otherwise green; test files only, nothing under the ask-first list, lib untouched.

**Not verified:** everything in section 3 -- no fix is built, no mutation run, no CI step run, no e2e written, no
pre-ship. Head SHA: `git log -1 arc/event-truth-p1p3-fix3`.
