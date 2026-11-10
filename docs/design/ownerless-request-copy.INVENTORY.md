# Inventory: ownerless page request panel (I5 copy)

Every field, state and option of the "help run this page" request, with where it lives today.

| # | Item | Where (file:line on main) | Covered by this change |
|---|------|---------------------------|------------------------|
| 1 | Request panel (`panel === 'request'`) | src/modules/organiser/shared/components/PublicClaimCard.tsx:296 | yes: heading + next-step line added |
| 2 | Hint wording email_differs / no_email / unknown | PublicClaimCard.tsx:301-307 | yes: kept, tested |
| 3 | Note label "Who are you? (optional)" | PublicClaimCard.tsx:321 | yes: required wording |
| 4 | Note textarea, maxLength 500, 16px | PublicClaimCard.tsx:325-334 | yes: unchanged |
| 5 | "Request access" button | PublicClaimCard.tsx:337 | yes: disabled under 3 trimmed chars |
| 6 | Cancel button (44px) | PublicClaimCard.tsx:340 | unchanged |
| 7 | Request refusal copy (selfServeErrors) | src/modules/organiser/shared/selfServeErrors.ts | unchanged by brief |
| 8 | Success copy "Request sent." | PublicClaimCard.tsx:~164 | unchanged by brief |
| 9 | Send payload (trimmed note) | PublicClaimCard.tsx:request(), selfServeApi.ts | unchanged |
| 10 | Onboarding sheet note "Who are you? (optional)" | src/modules/organiser/home/onboarding/OrganiserSheet.tsx:233 | no: other surface, out of the brief's file list |
| 11 | Claim and sign_in kinds | PublicClaimCard.tsx:~290 (claim panel), sign-in link | unchanged, tested |
| 12 | Admin app counterpart | bachata-admin-11april (not in this clone) | not inspected |

Coverage: 9 of 12 covered or pinned unchanged by tests; #10 and #12 out of scope / not inspected.
