# Design record: Languages tick list (dancer edit) + nationality search height

Named for the branch because the PR number does not exist until the PR is opened. The design-record Stop hook is not written yet: the stages below were applied by hand.

- Mockup (owner-chosen, Option A): https://claude.ai/artifact/RyHVnR22AYtK2BjHLk72eZ (OptionA.dc.html)
- Tokens: the dancer edit screen's own: `FIELD_CLASS` input at 48px, `Chip` (44px, gold selected + check), `--fg`, `--mut`, `--card`, `--card2`, `--line-strong`, `--r-chip`. Explicit px sizes (html is ~13.5px on phones).
- Stored value unchanged: ticked names joined with ", " in the existing languages text; no column, no migration.

## 390x844 checks (by construction, from the code; orchestrator walks prod-shaped data)
- Contrast: text uses `--fg` / `--mut` on `--card2`, the same pairs the screen already uses (>= 4.5 not re-measured here).
- Taps: every row is a `min-h-[44px]` label around a 22px checkbox; chips are the 44px `Chip`; search is 48px.
- No clipping / sideways scroll: list is `max-h-[320px] overflow-y-auto`, chips wrap.
- Empty state: "No language matches ...  Check the spelling, or clear the search to see the full list."
- Nationality search input: `h-[44px] min-h-[44px]` (was `h-11`, 37px at the 13.5px root).
