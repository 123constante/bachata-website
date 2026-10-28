# Handover: P3 W-T fix 3 (review r3 S1, N1, N2, N3)

Branch `claude/p3-wt-fix3` from `main` at 8b171b4. Source: `docs/review/pr-1079-r3.md` on `claude/review-1079-r3`.
No data path changes: no query, RPC, payload or read changed; `ticketsApi.ts` and `data.ts` are untouched.

## Done

| Finding | Fix | Pin | Mutation (fix reverted) |
|---|---|---|---|
| S1 toast column over the sheet footer | `p3.css` (appended last line): `.p3-theme .p3-toast-stack { top: calc(var(--top-h) + 12px + env(safe-area-inset-top, 0px)); bottom: auto; }` | `layout.cascade.test.ts` "r3 S1" (resolved `bottom` = `auto`, `top` set); new `tests/e2e/p3-toast-geometry.spec.ts` (390x844, real `p3.css`, Refund sheet and add sheet over the tall sheet, 1/3/6 toasts: no toast box intersects the confirm button, `elementFromPoint` at the confirm centre is the confirm, sheets/confirm/column in the viewport, `scrollY` 0, no x-overflow); added to `test:e2e` by name | cascade 1 red; geometry 6/6 red |
| N1 late rename named by the old name | `TypeSheet.tsx` `named`: `form.name.trim() \|\| type?.name \|\| 'New ticket'` | `stack.draft.test.tsx` R4 now expects `"Door renamed": Ticket saved.` | R4 red |
| N2 Escape mid-close a silent no-op | routed: Escape while the close block is busy calls `onClose(true)`, as Close and the scrim do; not busy, it still means Keep selling (F6) | R5 / P9 test rewritten: Escape mid-close leaves only the tall sheet, one `setTicketStatus` call, the late refusal lands as an alert | R5 red |
| N3 alert keys by id not pinned | none needed (product right) | new P10 test: same order refused twice, identical texts, two alerts, each dismissed alone, no React duplicate-key warning | keys by text: P10 red |

## Left / notes for the next reviewer

- With the column at the top, toasts can sit over the TALL sheet's head (its Close is at y 35-79; column starts at y 68) and over the top of an add sheet's body. No money control is there; Close on a dirty draft does not lose it (the draft is held above the sheets). Not changed: outside this brief's four findings.
- N1's expression also names a late REFUSED rename by the typed name (the list still shows the old one). The brief fixed the expression; flagging it.
- The geometry spec uses markup mirroring the components (as review r3 did), not the mounted React tree; the class names are pinned by the jsdom tests.
- Carried forward from r3, unchanged: two buyerless orders read alike late (prod 0), R6, R9.

## Next steps

One independent review, one fix round, then the orchestrator walk (brief stopping rule).
