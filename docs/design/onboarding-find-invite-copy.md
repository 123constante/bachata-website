# Onboarding Find step: say new pages are by invite

Copy-only change. No database, RPC or admin change.

- Problem: the Find footer read "Not listed? Create a page" and led to two screens before the invite-only trigger (`organiser_invite_required`) refused an uninvited person.
- Change: a short note above the button (`FIND_INVITE_NOTE`, beside `PAGE_COPY.find`), "Message us" rows from `supportLinks()` only when configured, button relabelled "Have an invite? Create a page" (behaviour and `p3-ob-continue` unchanged).
- Alternative considered: block the button until an invite code is entered. Rejected: there is no invite-code mechanism and the brief forbids inventing a route.
- Checked read-only on prod 2026-11-06: trigger `trg_organiser_self_serve_door_v1` is enabled and still raises `organiser_invite_required`.
- Test: `findFooter.matrix.test.tsx` (4 find states x 4 support-link sets, plus other-step absence).
