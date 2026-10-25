# Brief: #1033 S4 front-door screens -- walk every screen x every shape at 390x844 (normal lane, no DB)

Repo 123constante/bachata-website. CONTINUE on the existing branch `claude/s4-add-organiser-screens` (PR #1033, head dabf9cba). Do not open a new PR. Fetch and rebase on main first. No migration, no `supabase/**`.

## Why
Definition of done step 4 (walk in a real browser at 390x844 on prod-shaped data) is open for #1033. The admin screens sit behind an admin sign-in, and the walker cannot sign in to a Vercel preview (per-host session, email link). So walk the REAL screens locally on the project's fake-Supabase harness: `tests/e2e-phone/` (`fakeSupabase.mjs`, `helpers.ts` with `fakeSupabase(page, { signedInAsOwner })`, `playwright.phone.config.ts`, e.g. `invite-w2-walk.phone.spec.ts` for the pattern: overflow, taps >= 44px, axe contrast, `SHOTS=<dir>` screenshots). Extend the fake with an ADMIN session and the front-door RPC answers (read `src/modules/admin-organisers/frontDoorApi.ts`, `adminApi.ts`, `needsYouModel.ts`, `useNeedsYouCount.ts`, `duplicates/`, `InviteRequests.tsx` for the exact RPC names and response shapes; the real DB is NOT to be touched).

## Prod shapes to seed (owner's phone screenshots of the preview on REAL data, 2026-10-25)
- Organisers list: All 48 = Run by us 42, Invited 0, Joined 2, Live 4. Rows like "a2b Dance Academy" (live, joined: Send invite disabled with reason, Run by us switch disabled) and "Agapi Musicality Dance Project" (run by us: Send invite disabled with reason).
- Needs you: badge 23, one group "Quiet for 30 days (23)" with rows (Tropicana, Sparkle Up, Salsateca, Crouch End...), each with an "Open the page" button.
- Add: Organiser name, Contact person, City picker, "Run by us (no email)" switch, Contact email (optional), submit.
Seed these AND the other shapes: empty list; one row; 150 rows (over the 100-row API cap); very long organiser names; no city; each invite status (none, queued, sent, failed, skipped) on each chip; Needs you empty and with every group the model has (duplicates, invite requests, quiet, failed invites); every Add outcome (invite queued, run by us, already exists, person reused, email_has_login warning) and every server error code in `ADD_ERROR_TEXT`; loading, error and network-failure states.

## Do
1. A table-driven spec `tests/e2e-phone/front-door.phone.spec.ts`: every screen x every shape above, 390x844 (and 360x640 for the main three). Each case asserts: no sideways scroll, every control >= 44px (the site sets html font-size ~13.5px on phones, use px), axe contrast >= 4.5, no copy that points at a missing or disabled-without-reason control, empty states say what the person CAN do, an untouched Add submit sends nothing, and the hint under Run by us matches the switch (the fix in dabf9cba).
2. Screenshot every case with `SHOTS=docs/design/1033` and LOOK at each picture yourself (Design Gate stage 6); name them `<screen>-<shape>.png`. Keep each PNG small (390 wide, optimised) so `npm run check:images` stays green.
3. Anything wrong: red first (a failing case), then fix, in the SAME push. Report each finding with its screen and shape.
4. Write the design record `docs/design/1033.md`: the screens, the shapes, a contact-sheet table linking each screenshot, findings and fixes, and an honest Not verified (fake data, not the real RPC; the owner's phone saw only 3 screens on real data).
5. Run every CI job step that applies (read `.github/workflows`; unit suites under Node 22, `check:images`, lint chain, phone suite) and put a per-job table in the PR body.

## Hard limits
Never connect to the real database or any real credential; the fake only. Do NOT add any label to #1033 (not `automerge-ok`, not `run-ci`): it is a feature PR and only the orchestrator merges it. ONE push to the branch (fetch and rebase on main immediately before it). No `gh api`. Never merge or approve. Vercel deploy cap: one push only.

## Done =
One push to `claude/s4-add-organiser-screens`; last commit subject ends `[worker-done <ticket>]`; report head SHA, the findings list, per-job table, Verified / Not verified.
