# Inventory: where an organiser's own picture is drawn (p3-broken-image-states)

| # | Place | file:line (main) | Failed load before | Now |
|---|-------|------------------|--------------------|-----|
| 1 | Details cover | screens/DetailsScreen.tsx:133 | broken icon | BrokenImage; Change button kept |
| 2 | Date pictures grid | screens/DateFieldSheets.tsx:171 | broken icon | BrokenImage; Remove kept |
| 3 | Event pictures grid on Details | none on main (DetailsScreen has no gallery) | n/a | not built: nothing to change |
| 4 | Event page cover | screens/EventPage.tsx:199 | unchanged by brief | left as is (brief item 3) |
| 5 | Events list / home thumbnail | screens/parts.tsx:26-34 (Thumb) | already handled | left as is (different markup: "No photo yet") |
| 6 | Onboarding photo / logo previews | onboarding/PersonFlow.tsx:377, OnboardingFlow.tsx:764, ObShell.tsx:149 | broken icon | outside the brief's three; listed only |
| 7 | Admin equivalent | events/Details.tsx (admin-style editor in src/modules/events) | n/a | read-only reference |
| 8 | Public event page cover | src/modules/event-page (BentoPage) | handled there | not touched |

Covered / total: 5 of 8 resolved (rows 1, 2 changed; 3 absent on main; 4, 5 deliberately unchanged per brief); rows 6-8 listed, out of scope. Admin and public line numbers were not walked line by line (stated under Not verified).
