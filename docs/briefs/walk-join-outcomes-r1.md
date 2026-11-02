# Brief: walk-join-outcomes-r1 (WEBSITE, Sonnet, walk + screenshots only). Branch claude/walk-join-outcomes-r1, created FROM origin/claude/fix-join-outcomes-r1 (PR #1257 head). Never push to claude/fix-join-outcomes-r1.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. No product code changes: you add ONE browser spec and its screenshots only.

Goal: a real-browser walk at 390x844 of every outcome screen on the invite join path (src/modules/admin-organisers/join), with the server answers simulated at the network boundary (route-mock the redeem RPC and the preview RPC the way tests/e2e/arc1-invite-redeem-walk.spec.ts does; read it first). The reviewer must be able to LOOK at each picture.

0. INVENTORY FIRST. Write docs/walk/join-outcomes/INVENTORY.md before the spec: every redeem outcome kind (done, email_mismatch/wrong_account, email_unproven, not_linked, dead: used/expired/revoked/invalid, rate_limited, team_full, unconfirmed_account, profile_incomplete, sign_in, network/failed) x entry (Join tap; after sign-in on a person-bound invite) with the screen it must show, file:line from joinModel.ts redeemAction and JoinScreens.tsx. Coverage count at the end: N outcomes, N screenshotted.
1. Spec tests/e2e/walk-join-outcomes.spec.ts (NOT added to the CI gate list): for each outcome, drive the page to it, screenshot to docs/walk/join-outcomes/<nn>-<outcome>.png, and assert: no sideways scroll, every button and link at least 44px tall (explicit px; the site's root font is about 13.5px), exactly one primary action, a live control on every stop screen, the "we've told" text ONLY on not_linked, and "Send my code" enabled with an empty box and showing the bad-shape error on tap.
2. Run it with the project's playwright runner. Report the pass table and any screen that fails the bar WITHOUT fixing product code (file:line and the picture). Commit pictures and the spec to your branch.

Handover docs/walk/join-outcomes/HANDOVER.md with Verified / Not verified. Commit subject ends [worker-done <ticket>].
