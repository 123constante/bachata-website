# move-date-guests-web-c1: handover

Branch `claude/move-date-guests-web` (PR #1343). Brief: `docs/briefs/move-date-guests-web-c1.md` (sha f1002df). Continues `docs/handovers/move-date-guests-web.md`. **Must NOT merge before admin #1223 is applied.**

## Verdict on the "generic error" walk finding
A mock artefact. New `dateMove.realShape.test.tsx` drives the real `DateSheet` through a REAL `supabase-js` client (only `fetch` stood in), answering with PostgREST's HTTP 400 body for the guard: `{code:'P0001', hint:'date_has_people', message:'date_has_people: 3 guest-list, 4 going, 2 tickets on <day>; ...', details:'<jsonb text>'}`. On the unchanged branch head, every refusal row (a)-(f) reached the confirm step with the right counts. No row showed the generic error. The 11 red rows (of 17) were all copy: the "not told automatically" line and the done toast. After the fix, 17 of 17 pass.

## Done
- `peopleCountsOf`: the message fallback reads the real `N guest-list` form (number first; `guest_list`, `guest-list` and `guest list` all accepted) and a `key: n` form. Before, it worked only by accident, by taking the first three numbers.
- Confirm line is `MOVE_PEOPLE_COPY.tell(counts)`, the only mapping. Ticket buyers and/or people going "get an email about the new day" (only the kinds that are present). "{n} on the guest list cannot be emailed. You may want to tell them yourself." With no counts, it states both lines in general terms. The old "not told automatically" copy is gone.
- Done toast is `moveOutcomeCopy(moveNoticesOf(reply), "Moved to {day}.")`. With no notices (server not applied) or nothing reached, it shows only "Moved to {day}.". Otherwise it adds "We emailed N people about the new day." and/or "N on the guest list could not be emailed, so you may want to tell them yourself."
- DateSheet: only the two call sites changed (forced by the signature change). Nothing else changed byte for byte. `dates.ts` was not changed.
- Taps: "Move it anyway" sends `acknowledge_people: true` with a new key. "Choose another day" returns to the picker and keeps the day, with nothing sent. Both buttons have `min-h-[44px]`. No element on the step has a fixed width over 320px (checked against class and inline style).

## Checks
| Check | Result |
|---|---|
| `dateMove.realShape` red on head | 11 of 17 red (copy only), 17 of 17 green after |
| `npx vitest run src/modules/organiser` | 223 files, 8468 passed, 2 skipped |
| full `npx vitest run` | 701 of 705 files pass. The 4 that fail (live-DB contracts `eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`, plus `integrityCouldNotRun`) fail the same way on the unchanged head; no network or DB in this container |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 24 of 24 links green; eslint on changed files clean |
| `check:mojibake`, `check-integrity.sh`, `check:images` (AUDIT_STRICT=1), `check:legacy-tables`, `check:legacy-program-rpcs`, `check:rpc-typing`, `check:wallclock-brand`, `check:dancer-area-isolation`, `lint:architecture` | all exit 0 |
| `/code-review` | NOT run (scheduled worker) |

## Not verified
- The real server reply: admin #1223 is not applied, so the `details` key names (`guest_list/going/tickets/total`) and the `notices` shape are taken from the brief, not read from prod.
- The actual email send.
- A browser walk at 390x844 or 320x568, and a real phone. `organiserP3` is OFF on prod; only the jsdom size and width asserts were checked.

## Next
After #1223 is applied: do one real move on a test date with people on it, confirm the `details` keys and `notices`, then walk 390x844 and 320x568 on a preview with `organiserP3` on.
