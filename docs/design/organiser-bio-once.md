# Design record: organiser bio shown once (branch claude/organiser-bio-once)

Brief: `brief/organiser-bio-once`. Public screen copy/layout change.

## Inventory (INVENTORY.md, coverage 9/9 code items)
| # | Item | Where (file:line on main) | Done |
|---|---|---|---|
| 1 | Header tagline (first sentence), mobile + desktop | src/pages/OrganiserProfile.tsx:1146-1149, 1296, 1327 | yes: heroBio, 150 chars, More |
| 2 | About section + aboutExpanded toggle | src/pages/OrganiserProfile.tsx:675, 1151, 1498-1514 | yes: deleted |
| 3 | No-bio header line | OrganiserProfile.tsx:1084, 1127 | yes: "City · category" |
| 4 | Owner slots about / about-empty / mark('bio') | OrganiserProfile.tsx:1501-1507 | yes: kept in header |
| 5 | checkAbout / ABOUT_MAX 4000 | fieldRules.ts:305-318 | yes: limit param, 4000 stays server ceiling |
| 6 | Sheet counter | FieldSheet.tsx:176 | yes: n / 150, red + reason, Done disabled |
| 7 | Onboarding About textarea | PersonFlow.tsx:535 | yes: counter, input cut, Continue blocked |
| 8 | Wizard bio step (4000) | wizard/registry.tsx | out of scope: follow-up |
| 9 | Legacy inline editForm | OrganiserProfile.tsx (editForm) | has no bio field on main; no change |

Admin bio editor and dancer bios: out of scope.

## Behaviour
- Bio <= 150 shown whole; over 150 cut at 150 (back to last space within 20), `…`, More / Show less (44px, aria-expanded). Saved bio never changed.
- Editors: input past 150 is cut unless the loaded value was already longer; then red counter, "Shorten to 150 characters to save", Done disabled.
