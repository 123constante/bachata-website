# Walk C: a page-holder adds a teammate and switches between two pages (REPORT ONLY)

Brief: `docs/briefs/walk-team-and-switch.md` (v2). Code: origin/main `a661186`. No `src/**` edited.
Method: code reading, the existing vitest evidence, and read-only prod counts. No browser, no phone.

**Brief mismatches (main differs from the brief):**
- `p3/screens/PageScope.tsx` and `pageScope.matrix.test.tsx` do not exist on main. The Switch page control is `src/modules/organiser/switch/index.tsx` (shared with R1), and its tests are `switch/__tests__/Switch.test.tsx` and `p3/you/__tests__/you.matrix.test.tsx`.
- `docs/handover/organiser-team-mapping.md` does not exist. Known items come from `docs/design/p3-acceptance/AUDIT-team.md` (A-team-N below).
- `tests/e2e-phone/organiser-team-picker.phone.spec.ts` drives the event editor's Team picker (`edit-in-place/`), not P3 Team / Add someone / Switch page. No existing spec drives the 2-page switch or the P3 team add.

## Evidence run
- vitest `p3/you`, `P3Shell.test.tsx`, `organiser/team`, `organiser/switch`: **9 files, 176 tests, all pass** (you.matrix 90, addPage.matrix 14, Switch 6, Welcome 11, P3Shell 8, TeamG3 6, others).
- Phone spec `organiser-team-picker.phone.spec.ts`: **not run**. It covers the editor picker, which this walk does not rank.
- Pictures: **none opened.** None were produced.

## Prod shapes (counts only; prod `stsdtacfauprzrdebmzg`, SELECT only)
| shape | count |
|---|---|
| pages with an organiser seat (owner / manager / contributor) | 47 |
| pages with exactly 1 seat holder | 37 (79%) |
| pages with 2+ seat holders | 10 |
| pages with 3+ seat holders | 2 |
| users with seats on 2+ pages | 1 (the staff-looking account, 49 pages per AUDIT-team; 0 users on 2 to 5 pages) |
| contributor seats | 0 |
| access requests, open | 2 (on 2 pages) |
| access requests, granted / member / declined | 3 / 2 / 1 |

Meaning: today no real organiser has two pages, so Switch page has never been used by one of the 10 target organisers. The 2-page states are code-only. 37 of 47 pages are "Just you", so Add someone is the first thing a second person ever meets.

## Ranked dead ends (worst first: would an organiser give up here)

1. **Team, Add someone and Done never name the page (2 pages).** In P3 the page chips are hidden (`team/index.tsx:60`, `kind === 'r1'` only). The title is "Team" (`:57`) or "Add someone" (`AddSomeone.tsx:218`), and Done says "Priya is a Manager" (`:211`). A holder of two pages cannot tell whose team they are changing. The page name shows only on You (`YouScreen.tsx:45`). *New.* The `?o=` choice is also silently dropped when it is not a member page (`useOrganiserChoice.ts:136-138`), so a bad link shows the first page with no notice.
2. **One tap adds a stranger as Manager, with no confirm and no undo for a manager.** A face on the 3-column wall calls `addTeamMemberByProfile(..., 'manager')` at once (`AddSomeone.tsx:173,211`). The visible caption is only the fact or "Add"; "as Manager" is in the aria-label only (`:275,280`). Removing needs the owner (`teamRules` `canRemove`; 36 prod pages have a manager and no owner). A mis-tap hands out edit rights that a manager cannot take back. *New.* No role choice either (R: the earlier picker had "Add them as").
3. **"Invite" for a person with no account writes nothing and shows no pending state.** `tap` with `canAdd === false` only shares a generic sign-up link (`AddSomeone.tsx:209`, `inviteShare` in `teamPickerModel.ts:218`). There is no owner invite RPC. The link does not carry the page. The organiser sees nothing on Team afterwards (no "invited" row), so a second person who signs up is invisible until the organiser searches again. The message tells the invitee to "sign up with the email we have for you", which a person with no profile has none of. Related to A-team-9 (still open) and A-team-18 (open).
4. **Switching is a 4-tap loop that always ends on You.** Team has no switch. To add a teammate to the second page: You, Switch page, pick (`switch/index.tsx:42-45` navigates to `You?o=`), You, Team, Add someone. Switching from Team is impossible because Switch is only reachable from You, so "switch while on a sub-screen" cannot happen; it also means the person never lands back on the screen they left. History gets You twice (push, not replace), so Back from You after a switch returns to the old You. *New.*
5. **Home, Events and Stats ignore the chosen page.** `rowsOf` merges every page (`p3/data/home.ts:121-128`), while Switch says "Showing X". **A-team-2: still open.** A two-page holder who switches sees both pages' events and may edit the wrong one.
6. **A failed join-requests read looks like "no requests".** `requests` on Team (`team/index.tsx:42-46`) and You (`YouScreen.tsx:78-82`) never read `isError`. The badge and the "Wants to join" card just vanish. A contributor also gets `not_authorised` there (list RPC allows only owner/manager) and so no badge, which is correct only by accident. *New.* With 2 open requests in prod and the card being the only way to answer, a silent failure means a waiting person is never answered.
7. **Declining a request is owner-only, and a manager sees the reason only after opening the card.** Known and handled by copy (`you.matrix.test.tsx` F1, F2, "decline reason never points at a disabled Add"): **fixed in copy**; the server rule stays (A-team-28 decision open).
8. **A 0-page person on Team gets "Message us", not a way to add a page.** In P3 `team/index.tsx:68` links to Help; the You card has the Add link (`YouScreen.tsx:112`). Team's dead end is one step from You's exit. *New, low.*
9. **Leave on a sole manager of an ownerless page is blocked in UI only; the contributor cannot leave.** A-team-13 / A-team-27: **still open**, covered by tests F3.
10. **Add a page is on two places for 1 page vs 2+ pages** (You row only at 1 page, `youRows.ts:189`; Switch link at 2+). Fine in tests (`you.matrix`, `addPage.matrix`). No dead end found; recorded so the next walk does not repeat it.

## Known items (AUDIT-team) in this area
| id | status |
|---|---|
| A-team-2 Home/Events/Stats merge pages | **still open** (`home.ts:121`) |
| A-team-9 owner cannot mint an invite | **still open** (`teamPickerModel.ts:217`: "There is no owner invite RPC") |
| A-team-12 contributor sees edit | not re-checked (page editor, outside this walk) |
| A-team-13 last owner / contributor leave | **still open** |
| A-team-14 Organisers disabled for managers | not re-checked |
| A-team-18 legacy team not mapped | not re-checked |
| A-team-28 manager sees no hand-over reason | **fixed in copy** (F2, F10) |
| A-team-29 accept lands on You/Welcome | not re-checked |

## Coverage
Of the 17 states the brief lists (one page; two pages; 0 team; requests pending; owner / admin / member roles; no-account person; switch on a sub-screen; plus Add another page, full team, did-not-load, no page, long names, contributor Add, Hand over, Leave, mis-tap add):
- **Tested (vitest, fake data):** 11. One page, 3 pages, 0 team (Just you), requests badge and card, owner, manager, contributor, full team, did-not-load, no page, Hand over/Leave gates.
- **Code-read only:** 6. The 2-page Team context (no page name), one-tap add without confirm, Invite for a person with no account, switch landing, the requests error state, `?o=` non-member fallback.
- **Admin role:** 0 tested. `viewerRole` maps admin to manager (`useTeamContext.ts:342`); no P3 test names an admin.
- No state was driven in a browser or on a phone.

## Not verified
A real invite to a second person, real two-page accounts (none exist in prod), real sign-in, a real phone, any picture. Fake Supabase and code reading only. The optional phone spec was not written (no `src` browser harness run, and the brief makes it optional). `tsc` not run: nothing under `src/**` changed.

DONE [worker-done dt_da336fab7d30]
