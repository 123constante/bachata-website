# Brief: ticket picker B1 fix round 2 (PR #1747, branch feat/ticket-picker-b1)
Class: TRIVIAL + verify. Flag ticketPickerB1 stays OFF. Same branch, same PR. Round-2 review: PASS WITH NITS, two conditions.

1. `src/modules/tickets/pickerModel.ts:10` has a raw U+2019 in CANCELLED_NOTE. Replace it with the escape `’` (written as backslash-u-2019 inside the string literal). Repo rule: no raw Unicode punctuation in source. Check `git grep` for other raw U+2018/2019/201C/201D/2013/2014/2026 in files this PR touches under src/modules/tickets (non-test) and fix any.
2. Unit tests never ran at head. Run `npm run test:unit` for src/modules/tickets and the whole picker suite; report pass/fail. Fix only failures caused by this PR.
3. Nits (do them if under 10 lines each, else list in handover): static import in EventTicketsPage; clamp that drops a hold silently.
Push to the same branch; handover as usual.
