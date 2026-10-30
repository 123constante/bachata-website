# QR door scanning: mockups (Design Gate stage 2, mockups only)

**Brief (5 lines).** Door staff on a phone (390x844), dark room, one thumb, glare, queue waiting.
Scan a buyer's ticket QR and see ONE clear answer in under a second, then the next person.
Six results from one shared table: LET IN (green), ALREADY IN at 21:42 (amber), NOT FOR THIS EVENT,
NOT VALID, CODE NOT RECOGNISED (red), NO SIGNAL (grey, use the list). Each says what to DO next.
Every mockup also shows the "N of M in" counter, manual code entry and the empty state (no tickets sold).

## Files
- `A.html`: camera full screen, the result **sheet slides up** and covers the camera until "Scan next".
- `B.html`: camera top 400 px, counter + **result card always visible** below; the next scan replaces it, no tap.
- `C.html`: B-style scan screen plus a **"Tonight's list" tab** (first name, quantity, In / Not in), which NO SIGNAL opens automatically.

Each file draws every state side by side from ONE `RESULTS` table in `gen.py` (`python3 gen.py docs/design/qr-door-scanning`
regenerates all three), so the words, colours and actions
cannot drift between states or between files.

## What differs
| | A | B | C |
|---|---|---|---|
| Viewfinder size | biggest | half | half (smaller while a result shows) |
| Taps per guest | 2 (scan, Scan next) | 1 (just scan) | 1 |
| Last result visible while aiming | no | yes | yes |
| Dead camera / no signal | button to list | button to list | its own tab, auto-opened on NO SIGNAL |

## Recommendation: C
C's scan screen keeps B's one-tap flow (the queue moves, the last answer stays readable while aiming the next),
and it makes the fallback a first-class tab rather than a buried button. Dead cameras and no signal are exactly
when door staff panic; one obvious "Tonight's list" tab with big In buttons is the safest answer.
A is cleanest but costs a tap per guest and hides the camera during a queue.

## Tokens and checks
- Colours come from `src/modules/organiser/p3/theme/p3.css`, **dark set** (door rooms are dark). There is no
  `DESIGN.md` at repo root on `main` (the brief names one), so p3.css is the only source used.
- Result bands use p3 dark `--ok-fg` / `--danger` / `--mut` as solid fills with `--btnfg` text. Amber is **new**:
  `#ffc061`, because p3's `--warn-fg` (#ff9a6a) read as the same colour as the reds next to it. Needs owner sign-off.
- Contrast computed (WCAG): band texts 7.5 to 12.6:1; muted text on card 5.1 to 5.8:1; orange accent text on card2 4.8:1.
- All sizes in px; every button / tab checked >= 44 px tall and wide in Chromium; no content overflows 390x844.
- ASCII only: punctuation is HTML entities.
