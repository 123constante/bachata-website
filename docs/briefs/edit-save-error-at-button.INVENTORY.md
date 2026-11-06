# Inventory: save-failure surfaces on Edit my profile

Scope note: the brief asks for every field/state/option across the admin app, the Website and the
public page. This change touches only the SAVE area of one screen, so the inventory covers every
save-result state of that screen. The admin app and public page are not in this checkout and have no
equivalent surface (the public page does not save); they are listed as not inventoried.

| # | Item | Where (EditScreen.tsx on main) | Covered by |
|---|------|------|-----------|
| 1 | Top error card `edit-top-error` (role alert, Try again `edit-retry`) | lines 228-234 | table: top present, retry kept |
| 2 | Save button `edit-save`, disabled with reason | line ~409 | untouched row |
| 3 | Disabled reason line `edit-save-reason` | line ~412 | unchanged |
| 4 | Saved line `edit-saved` | line ~417 | success row |
| 5 | Field-level server error (placeServerError field branch) | lines 60-68 | field-error row |
| 6 | Top-level server error (placeServerError top branch) | lines 60-68 | network + 500 rows |
| 7 | NEW `edit-save-error` line under Save | new | table, all rows |
| 8 | Clear on edit (`set`) | line ~118 | clear test |
| 9 | Clear on Save again (`submit`) | line ~192 | clear test |
| 10 | Scroll Save area into view only if off screen; no focus move | new effect | scroll tests |
| 11 | Untouched save sends 0 calls | `submit`, `reason` | untouched row |

Covered 11 / 11 in-scope items. Admin app: not inventoried (not in this repo). Public page: no save surface.
