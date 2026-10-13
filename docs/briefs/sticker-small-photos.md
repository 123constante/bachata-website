# Brief: smaller Sticker on small photos (PR #740, round 3)

Branch `feat/people-nationality-flags`, open PR #740, current head `edfdabc7ce2a7d971440648063432111cd892e77` (all 34 checks green). Push ONE commit to this branch. Do not open a new PR. Do not edit the PR body except to keep it accurate at the end (edit it ONCE, last, and expect `real-data-verified` and `phone-qa-section` to re-run; keep their required labels with text on the SAME line: `Shapes surveyed:`, `Checks run:`, `NOT verified:`).

## Owner feedback (2026-10-13, with a screenshot of the header search on desktop)
The sticker is too big on the 36px search-row photos: its 20px minimum width covers more than half the photo. The owner chose: **a smaller Sticker for small photos** (same style, scaled down). Big photos stay exactly as they are.

## Spec
- Photos under 28px: no sticker, country in label/title (unchanged, owner decision earlier).
- Photos 28px to 47px (header search 36px, Cmd+K overlay rows 36px, list rows 40px): sticker width = `max(14, round(photo * 0.4))` px, so 28 -> 14, 36 -> 14, 40 -> 16, 44 -> 18 (height stays 2/3 of width). Same tilt (9deg), same 2px white edge and soft shadow, same position (top -6%, right -14%).
- Photos 48px and up: unchanged (46% of the photo, minimum 20px).
- Check the 14px sticker still reads (stripes visible) for the 11 codes in use on prod (ES CO AR EC BO ZA IT VE GB DE CY): render them at 14px, and say honestly which ones are hard to tell apart.
- The 5px `mr-[5px]` added to the header-search and Cmd+K rows last round: keep it only if still needed; with a smaller sticker a smaller or no extra margin may do. Measure, do not guess.
- Keep the shared implementation: one function (`stickerSize` in `src/components/people/NationalityFlag.tsx`) decides the size for every surface; no per-surface copies.

## Tests (table-driven; same fact reads the same on every surface)
- Update the unit tests for `stickerSize` over photo sizes 27, 28, 36, 40, 47, 48, 56, 96 and the matrix test; update the phone spec thresholds (the current checks require the sticker to be at least 20px wide and photo cover <= 0.4: make them size-aware) and keep all clipping, text-overlap, neighbour-overlap and tap-through checks at 390x844 and 360x640 for the 15 surfaces.
- Prove the size rule red before / green after: run the new size table against the OLD `stickerSize` first.
- Add a measured assertion that on the 36px header-search row the sticker covers at most 25% of the photo area.

## Gates and report
Run every CI job step you can locally (read `.github/workflows`), the pre-push chain once (if `.githooks` are not executable in your checkout, run them by hand: `sh .githooks/pre-commit` and `sh .githooks/pre-push`, and say so), push ONCE. Replace the screenshots under `docs/screenshots/nationality-flags/` for the surfaces whose size changed. Update the handover doc. Report: head SHA, CI per job on the new head (wait for it), the size table with measured px on each surface, the 11-code readability note, screenshots, honest Verified / Not verified.
