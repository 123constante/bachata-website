# Raffle v3 tap table (walked by `tests/e2e/raffle-v3-walk.spec.ts`, 390x844, mocked RPCs)

| Screen | Button | Destination | Prototype/OLD |
|---|---|---|---|
| claim (signed out) | Continue with Google | `/auth?returnTo=/raffle/win/<token>`, then pick (or none) | prototype |
| won | Choose my night | pick | prototype |
| pick | night option | selected state (`aria-pressed`) | prototype |
| pick | Lock this night | honest (disabled until a night is chosen) | prototype |
| honest | checkbox | enables Confirm | prototype |
| honest | Confirm and get my QR | qr (spot_taken / already_been_to_event / night_not_open: back to pick with a line) | prototype |
| honest | Back | pick | prototype |
| none | Check again | refetch (claim RPC called again) | prototype |
| error (win) | Retry | refetch | prototype |
| door valid | Admit | Admitted (or Already admitted if raced) | prototype |
| door error | Retry | re-check | prototype |

No row is OLD. Screen copy matched the prototype on every state. One fix: the door Retry and Admit buttons
were `h-12` (rem), which renders 41px on phones at this site's 13.5px root; now `h-[48px]`.
