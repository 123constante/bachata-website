# Handover: course rule card (phase 1)

Branch `claude/course-rule`. Ticket dt_1ae8d0652de8.

## Done
- `SignupRuleBlock.tsx` + server-render test (exact copy for both rules; unset renders nothing).
- Wired in `BentoGrid.tsx` LAYOUT (`signup-rule`, directly before `dates`) and `BentoPage.tsx`
  (hidden unless `flags.courseSignupRule`, `snapshot.event.format === 'course'` and a rule is set;
  decided before the loading early-return so flag-off loading is identical to main).
- `flags.courseSignupRule` from `VITE_ENABLE_COURSE_SIGNUP_RULE`, default off.
- Snapshot parser keeps `event.signup_rule` (`'drop_in' | 'sign_up_first'`, else null) as optional `signupRule`.
- Keep-list `docs/course-rule/INVENTORY.md`. 390x844 walk on a local mock course fixture.
- tsc run on 5c58448: 0 errors in branch files.

## Left / next steps
- Admin #2037 must be applied to prod before turning the flag on; then re-walk one real course.
- Owner call: should the card hide when the Week rows are hidden (single date or paused course)?
- Full unit suite and e2e smoke not run in the sandbox (timeout); rely on PR CI.
- `check:no-social-word` is red on main (3 ticket test files), not from this branch.
