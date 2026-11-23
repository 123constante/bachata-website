# Handover: raffle share poster (web)

Nothing in the prototype was left unbuilt.

Built behind `raffleSharePoster` (`VITE_ENABLE_RAFFLE_SHARE_POSTER`, default OFF; only read when `raffleV2` is on).

- `model.ts`: night gains venue/poster/public id; claim and lock return `firstName`; `screenAfterLock`; `share` screen.
- `sharePoster.ts` (new): pure `posterText`, canvas `drawPoster`/`renderPoster` (1080x1350, no-flyer fallback on load fail or tainted canvas), share/save helpers.
- `RaffleWin.tsx`: `share` step after a fresh lock. Pool count fetched once when the step opens (`fetchRaffleBoard`); failure = no pill.
- Tests: model, sharePoster, RaffleWin.share (screen table + keep-list for pick/honest).

Link on the poster is the long form `/event/<public_event_id>?occurrenceId=<id>` (the night has no slug; brief said "as the site builds it today").

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Share (share sheet resolves) | qr | prototype |
| Share (no file share support) | download, stays on share | prototype |
| Share (cancelled) | stays on share | prototype |
| Save image | download, stays on share | prototype |
| Skip, show my QR | qr | prototype |

## Not verified
Real-device share sheet; prod-shaped data walk of the full page with the flag on; Vercel preview.
