# Brief: Instagram handle clash on profile save links the profile instead of a dead end

Brief-version: 2
Branch: claude/profile-save-instagram-link
Lane: normal, Sonnet. bachata-website, must not touch supabase/**, src/modules/dancer-app/api/fakeBackend.ts behaviour for other keys, or sign-in (claimAtSignIn) behaviour.
Serves: a dancer whose Instagram is already on an admin-made profile; today they hit "already on another profile" and are stuck (arc organiser, row I5 "profile save: handle collision -> link or review, never a dead end"; D16).

## What main lacks
- extends: claimMyDancerProfile takes no handle although admin now ships claim_my_dancer_profile_v1(p_instagram text) -- src/lib/claimMyDancerProfile.ts
- Profile save never tries to link before writing a changed Instagram handle (the link must happen BEFORE the write) -- grep: linkBeforeInstagramSave
- extends: the instagram_taken refusal copy is the only outcome of a clash, with no "we sent it for review" branch -- src/modules/dancer-app/api/errors.ts
- No test covers the clash outcomes linked, ambiguous, no_match, unavailable -- grep: instagramClashLink.matrix

## Files
- src/lib/claimMyDancerProfile.ts
- src/modules/dancer-app/api/useMyDancerEdit.ts
- src/modules/dancer-app/api/errors.ts
- src/modules/dancer-app/api/rpc.ts
- src/lib/__tests__/claimMyDancerProfile.test.ts
- src/modules/dancer-app/__tests__/instagramClashLink.matrix.test.tsx (new)
- docs/design/profile-save-instagram-link.INVENTORY.md (new)
- docs/arcs/organiser.md

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. claimMyDancerProfile(timeoutMs, instagram?) passes { p_instagram } only when given; the no-arg call used at sign-in stays byte-identical. Contract (verified on admin origin/main, migration 20270320110000): statuses linked, already_linked, no_match, ambiguous, email_unproven, not_applicable, plus match_reason.
2. linkBeforeInstagramSave: when the save changes the Instagram handle, call the claim with the new handle first. linked or already_linked: refetch the persona caches, then save against the linked profile. no_match: save proceeds as today. ambiguous: do not save the handle, show "We could not tell which profile is yours. We have asked the team to check." with a way to carry on with the rest of the form. unavailable (function missing, timeout): behave exactly as today.
3. A save that did not change the handle makes no claim call and sends nothing extra (untouched save sends nothing).

## Tests
Table-driven, red first: handle (unchanged, changed-new, changed-clashes) x status (linked, already_linked, no_match, ambiguous, email_unproven, not_applicable, unavailable); assert call order (claim before save), the exact arguments, the copy shown, and that no copy points at a missing control.

## Done when
PR checks green, every CI job step run, walked at 390x844 with a prod-shaped account (fake backend plus one real clash if a test account exists), design record linked, update the I5 row in docs/arcs/organiser.md (Status, Blocked by, PR link) in this PR, and a Verified / Not verified block that says plainly whether the real RPC was exercised.
