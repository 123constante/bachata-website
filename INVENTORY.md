# INVENTORY — interim seat labels (brief interim-seat-p3-labels)

Admin app source is NOT in this repo or this session; admin items cite the Website's own record of them (honest limit, see Not covered).

| # | Source | Field / state / option | file:line | Covered |
|---|---|---|---|---|
| 1 | admin | `organiser_ownership_v1.seat_kind` returned for a caller with a role | docs/scoping/g1-write-door-check.md:78 | yes: src/modules/organiser/shared/ownership.ts parseSeatKind |
| 2 | admin | seat values owner / manager / interim / contributor | src/modules/organiser/shared/ownership.ts:9 (SeatKind) | yes |
| 3 | admin | `interim_cannot_add` refusal on add | docs/scoping/g1-write-door-check.md:94 | yes: Add someone replaced |
| 4 | admin | interim seat opened by manager grant / manager invite | docs/scoping/g1-write-door-check.md:87,89 | no UI (server-side only) |
| 5 | admin | interim seat table `organiser_interim_seats` | src/integrations/supabase/types.ts:5646 | no (never read by Website) |
| 6 | web | ownership shape my_role / is_managed / i_own_it | src/modules/organiser/shared/ownership.ts:21 | yes, unchanged |
| 7 | web | parse of unknown / missing seat | src/modules/organiser/shared/ownership.ts:97 | yes |
| 8 | web | Team "Add someone" (enabled / disabled+reason / contributor) | src/modules/organiser/team/index.tsx:168 | yes: share branch for interim |
| 9 | web | own-row role label (listed rows) | src/modules/organiser/team/index.tsx:60 | yes |
| 10 | web | own-row role label (members fallback) | src/modules/organiser/team/index.tsx:97 | yes |
| 11 | web | Leave this page gate | src/modules/organiser/team/index.tsx:179 | unchanged by design |
| 12 | web | Team add gate mapping canAdd | src/modules/organiser/shared/teamRules.ts:55 | yes: teamAddOffer wraps it |
| 13 | web | You tab Get paid row | src/modules/organiser/p3/shell/youTickets.tsx:13 | yes: line for interim |
| 14 | web | Get paid route `you/get-paid` | src/modules/organiser/p3/shell/youTickets.tsx:23 | no (flag-gated route; reachable by URL only, server refuses) |
| 15 | web | invite share (sign-up link) in AddSomeone | src/modules/organiser/team/AddSomeone.tsx:76 | reused pattern (share, then clipboard, then show link) |
| 16 | public | "Ask to join" button on the public page | src/modules/organiser/shared/components/PublicClaimCard.tsx:263 | yes: the share line names it |
| 17 | public | public organiser route /organisers/:id | src/components/AnimatedRoutes.tsx:195 | yes: the URL shared |
| 18 | public | "Managed by the organiser" badge | src/modules/organiser/shared/ownership.ts:68 | unchanged |

Coverage: 12 covered or deliberately unchanged / 18 total; 6 not covered, with reasons in rows 4, 5, 14 (server side or URL-only) and rows 11, 15, 18 counted as unchanged/reused. Strict count of rows with a UI change: 7 / 18.
