# Brief: post-flip cleanup, Website (small slices, Sonnet, normal lane, no database change)

Branch: `claude/p3-post-flip-cleanup` (create from main). Marker `[worker-done p3-post-flip-cleanup]`. Do the items in order; stop and write a handover if context passes 35%.

1. Home banner: on the P3 Home "Finish your details to create and edit events" banner the label of the orange "Continue" button sits high, not vertically centred (390x844 walk screenshot, owner-visible). Fix with explicit px sizing (the public site sets html font-size to about 13.5px on phones, so rem sizes are off). Test: tap target at least 44px and the label centred within 1px.
2. Invite journey: add table-driven tests for the invite landing at `/invite/:token` (src/modules/admin-organisers `InviteRedeemPage`): token valid and open, used, revoked, expired, unknown, signed-out, signed-in without a dancer profile, email entry (`bind_organiser_invite_email_v1`: bad email, rate limited, bound). Every state must say what the person can do next.
3. Any other cosmetic nit you find while doing 1 and 2 goes in the handover, not in code.

Files you own: the P3 Home banner component and its tests, and tests under src/modules/admin-organisers. Do not touch routing or auth. PR body: Verified on real data and a Phone QA section naming 390x844. Stopping rule: one independent review, one fix round.
