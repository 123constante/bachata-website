# move-date-guests-web: handover

Branch `claude/move-date-guests-web`. Brief: `docs/briefs/move-date-guests-web.md` (sha 38efec7). Website half of Q10.

## Done
- `moveDateCommand(toDate, acknowledgePeople = false)`: default payload byte-identical; `{ to_date, acknowledge_people: true }` when asked. `PLAN.move(d, to, acknowledge?)`.
- Date sheet `move` step: first tap sends without the flag. A `date_has_people:` refusal opens a confirm step in the same sheet (title with total, non-zero parts, "They are not told automatically. Tell them yourself.", `Move it anyway` / `Choose another day`, both `min-h-[44px]`). Confirm resends with the flag and a NEW idempotency key (`forget(plan)` before the resend). A repeat refusal re-shows the confirm with the new counts. Other refusals keep their copy.
- Counts: `details` (object or JSON string) first, then numbers in the message, then no numbers ("People are on this date").
- Copy and parsing live in `p3/model/labels.ts` (`peopleCountsOf`, `moveNoticesOf`, `moveOutcomeCopy`, `MOVE_PEOPLE_COPY`); one mapping, no second copy in the screen.
- `selfServeErrors.ts`: `^date_has_people:` row.
- Test ids added: `p3-move-people`, `-title`, `-body`, `-tell`, `p3-move-anyway`, `p3-move-another` (none existed).

## Decisions to check
- Success with NO confirm (no people) keeps today's `Moved to {day}.` toast. The "Moved. Tell the people..." / "We emailed N people..." line is used only after a confirmed move. Brief says "success -> as today", and saying "tell the people" after an empty-date move would be wrong.
- The confirm line is always the "not told automatically" one, because the reply is unknown before the move. Once the admin `notices` brief is applied, that line is untrue for a date whose guests will be emailed. Follow-up: reword it then.
- `notices` is read from the reply top level or `data.notices`; the admin shape is unconfirmed.
- Undo for a confirmed move is the same as an unconfirmed one (`undoFor('move')`). Not checked: an undo move-back of a date that now has people would itself hit the guard.

## Checks (local, plain git; no CI run, no PR opened)
| Check | Result |
|---|---|
| New cells red on main, green after | yes (14 of 32 red before the screen/command change) |
| `npx vitest run src/modules/organiser` | 222 files, 8443 passed, 2 skipped (before the last toast tweak; the 16 move tests re-run green after) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 24 of 24 links green; whole-tree eslint informational (red on main); eslint on changed files clean |
| `npm run check:mojibake` | clean |
| `/code-review` | NOT run (scheduled worker) |

## Verified / Not verified
Verified: the unit and screen tables above, through the real send path with only `supabase.rpc` stood in.
Not verified: a real move of a date with people on prod; the admin `notices` reply; a real phone; the 390x844 and 320x568 walk (flag `organiserP3` is OFF on prod; the walk needs a preview with it on); the full-repo vitest run and `pre-ship`; the Shape survey (not needed, Supabase unused).
