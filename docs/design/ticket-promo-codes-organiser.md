# Design record: ticket promo codes, organiser section

Where: P3 event page &rarr; Tickets row &rarr; tall Tickets sheet, list view, under Orders: a "Promo codes" heading, a card list, and "Add a promo code". Flag: the existing `organiserTicketing` (TicketsEntry is only mounted under it, `EventPage.tsx:271`); no new flag. Lazy chunk (`promo/PromoSection.tsx`) so the Tickets sheet loads nothing extra.

No new visual language: rows use `p3-row` / `p3-switch` / `TONE_CLASS` like ticket types; the create/edit sheet is a `StackSheet` layer like TypeSheet; outcomes use the Tickets sheet's toast and alert queue (`say`, `late(text, false)`).

Permission: decided by the server. Nothing predicts it; `not_authorised` is shown as words with who can do it.

## State table (ONE mapping: `promo/promoModel.ts`; tests: `__tests__/promo.matrix.test.tsx`)

| Screen | State | Shows | Person can do next |
|---|---|---|---|
| List | loading | "Loading promo codes&hellip;"; Add disabled | wait |
| List | could not load | alert + Try again; Add disabled | Try again |
| List | refused (not_authorised) | `LIST_REFUSED`; Add disabled + reason | ask an owner/manager |
| List | empty | "No promo codes yet. Tap Add a promo code&hellip;" | Add |
| List | 1 / many (20 tested) | one row each | tap to edit, switch |
| Row | percent / fixed | "10% off each ticket" / "&pound;2.50 off each ticket" | - |
| Row | unlimited / limited | "Used on N orders, no limit" / "Used on N of M orders" | - |
| Row | no expiry / future / past | "No end date" / "Ends Friday 13 November, 23:59" / "Ended &hellip;" + tag Ended | new end date |
| Row | used up | tag Used up | raise or remove the limit |
| Row | turned off | tag Turned off | turn it on |
| Sheet | locked (any order) | discount chips + amount disabled, `LOCKED_WHY` | change limit/end, or new code |
| Sheet | untouched save | toast "Nothing changed, so nothing was saved."; NO command | - |
| Sheet | create errors: code_taken, invalid_code, invalid_value, invalid_max_uses, invalid_expiry, not_authorised, series_not_organisers | `REASON_COPY[reason]`, sheet stays | fix and save |
| Sheet | update errors: locked_after_use, invalid_request | `REASON_COPY[reason]` | as copy says |
| Sheet / row | network error | `NETWORK`; Save / switch enabled again | try again |
| Sheet / row | slow double-tap | "Saving&hellip;", one command (ref guard) | wait |
| Sheet | onboarding gate refusal | shared gate sheet, no second error | finish details |
| Sheet | closed mid-save | success = toast; refusal = alert that stays | read, dismiss |

Rules mirrored client-side before the tap (server still decides): code 3..32 of A-Z 0-9 _ - (upper-cased on send); percent 1..100 whole; fixed &pound;0.01..&pound;1,000 (pence); limit &ge; 1 and &ge; orders already made; end date in the future. On an edit, a field left as it was is never an error (an ended or over-limit code can still save its other changes).
