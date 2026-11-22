# Handover: editor v2 slice 17h

## Done
- tickets.managerReal.matrix: expects `ticket_sales_summary_v2` (checklist 1).
- copy.ts: raw non-ASCII in strings now `\u` escapes (same runtime text); `whereAbout.addVenueSoon` added.
- WhereSheet: disabled `where-add-soon` row after rows/noMatch, only once venues loaded.
- whereAbout.test: 3 new cases (present+disabled+click no-op, unknown name, loading).

## Tap table
| button | destination | prototype/OLD |
|---|---|---|
| Where sheet venue row (existing venue pick) | saves venue / closes if current | prototype |
| Adding venues: coming soon | none (disabled) | prototype |
| Back to the usual venue | back + close | prototype |

## UNBUILT
- Typed new venue (owner decision). 
- consistency.matrix G3 B-N8 still RED: raw U+2014 in EveryBody.tsx and NightCard.tsx, U+2026 in Facts.tsx. These files are outside the brief's 4-file list, so left alone. Next step: swap them for `—` / `…` escapes (3 tiny edits).

## Verified / Not verified
- Verified: `npm run test:unit -- src/modules/organiser`: 399/400 files pass, only the G3 B-N8 case above fails. tsc run on this branch: 0 errors. `npm run check:mojibake` clean.
- Not verified: browser walk at 390x844; branch not rebased on current main.
