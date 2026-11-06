# INVENTORY: share / copy controls (p3-share-event-link)

Line numbers are on main at branch time (the brief's numbers had drifted).

| # | Surface | Control | States | file:line | Covered by the new row? |
|---|---|---|---|---|---|
| 1 | Admin app event view | none in this repo (admin: none) | n/a | n/a | n/a |
| 2 | Public event page | Sticky bar share: share sheet, then clipboard + toast "Link copied to clipboard", then WhatsApp | share ok / cancelled / copied / copy failed | src/modules/event-page/bento/utils/eventActions.ts:38-65; `shareTitle` at src/modules/event-page/bento/BentoPage.tsx:841 | Left alone (out of scope) |
| 3 | P3 event page | "See it as dancers see it" link, or disabled with reason | open / off+reason | src/modules/organiser/p3/screens/EventPage.tsx:146 (`DancerView`) | Reuses its rule (`publicPageOf`) |
| 4 | P3 onboarding live screen | Share the organiser PAGE link: share, else clipboard "Link copied."; cancel silent | share / copied | src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:1031-1042 | Same copy ("Link copied."); not touched |
| 5 | Organiser team | Share invite: share, else copy "Link copied", else shows the text | shared / copied / shown | src/modules/organiser/team/AddSomeone.tsx:73-85 | Same fallback pattern |
| 6 | P3 event page | Share this event link | none before this change | n/a | GAP closed: new `ShareRow` |

GAPs: (6) no event-link share on the P3 event page; (4) swallows a clipboard failure silently (left alone, onboarding is out of scope).

Coverage: rows inventoried 6 / rows covered 4 (rows 1 and 2 intentionally untouched; row 4 not changed).
