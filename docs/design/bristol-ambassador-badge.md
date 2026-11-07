# Ambassador badge on public profiles

## INVENTORY (public person renders)
| Render | File:line | Shows badge |
|---|---|---|
| /people/:id hub (flag personHub ON) | src/modules/person-page/hub/PersonHub.tsx (header, above the role chips) | yes |
| /people/:id tabbed page (flag OFF) | src/modules/person-page/PersonPage.tsx (header, under the role chips) | yes |
| /dancers/:id standalone | src/pages/DancerProfile.tsx (embedded body of the tabbed page) | no: embedded under the page header above |
| /djs/:id, /teachers/:id | src/pages/DJProfile.tsx, TeacherProfile.tsx | no (role pages; follow-up) |
| src/pages/PublicProfile.tsx | empty file (0 lines), no importer | n/a |
Coverage: 2 of 2 person-page headers; role pages not covered.

Admin ambassador screen: src/modules/ambassador/AmbassadorQueuePage.tsx (not changed).

## Design
One `AmbassadorBadge` (src/modules/ambassador/link/AmbassadorBadge.tsx), label "Ambassador", tap opens "Helps new organisers join their city". Renders nothing unless the public RPC returns exactly true.
