# Inventory: Instagram handle clash on profile save

Scope note: the admin app lives in `bachata-admin-11april`, which is not attached to this
session, so its column is taken from the brief (migration `20270320110000`) and NOT read
line by line. Website lines were read on this branch.

| # | Item | Source | Covered by |
|---|------|--------|-----------|
| 1 | Claim RPC `claim_my_dancer_profile_v1(p_instagram text)` | brief (admin migration 20270320110000) | claimMyDancerProfile.test.ts |
| 2 | Statuses linked, already_linked, no_match, ambiguous, email_unproven, not_applicable | src/lib/claimMyDancerProfile.ts:28-35 | instagramClashLink.matrix.test.tsx |
| 3 | Sign-in no-arg call stays unchanged | src/lib/claimMyDancerProfile.ts (claimAtSignIn) | claimMyDancerProfile.test.ts |
| 4 | Changed-handle detection (delta carries only changed keys) | src/modules/dancer-app/api/rpc.ts (changedInstagram) | matrix: unchanged / cleared / same |
| 5 | Save entry points: Edit screen, hook save (Onboarding) | EditScreen.tsx mutation; api/useMyDancerEdit.ts save | matrix (shared saveMyDancerProfile) |
| 6 | Persona caches refetched before the save when linked | api/useMyDancerEdit.ts, EditScreen.tsx (onLinked) | matrix (onLinked order) |
| 7 | `instagram_taken` refusal copy | api/errors.ts:42 | instagramRefusals.test.tsx (existing) |
| 8 | New `instagram_review` copy + field mapping | api/errors.ts | matrix |
| 9 | "Save the rest" button on the review card | EditScreen.tsx (edit-save-rest) | NOT covered by a screen test |
| 10 | Untouched save sends nothing | api/rpc.ts saveMyDancerProfile | matrix |
| 11 | Public page shows the handle (no change) | src/pages/AllProfiles.tsx:180 | n/a, unchanged |

Coverage: 9 covered / 11 total (item 9 uncovered; item 11 unchanged by design; item 1 admin side unread).

Note: the claim helper is imported lazily in api/rpc.ts so the /app first-load chunk count stays at its allowance (47).
