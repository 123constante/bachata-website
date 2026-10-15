# Brief: R1a independent REVIEW (Website, read-only on claude/dancer-app-r1a)

You review; you do not fix. You did not write this code. Branch under review: `claude/dancer-app-r1a` at the SHA
in the dispatch line (= main + R0 + W1 + W2a-e + integration + finish). Read first (branch
`arc/briefs-dancer-rebuild`, via `git show`): `briefs/dancer-rebuild-COMMON.md`, `-INTERFACE.md` (incl. Round-2 and
Round-3 additions), `-W2-SHARED.md`, then on r1a `docs/handover/dancer-rebuild-r1a.md` and the W1/W2 handovers.

## Look for (correctness first, then the owner's quality bar)
1. Contract drift vs INTERFACE: RPC names/keys, error codes (W1 `api/errors.ts` vs the A1 list), WhatsApp key
   stripping when `other_roles = []`, replace-only keys (first name, city, photo), diff-first save (an untouched
   save must send NOTHING), gate handling (`area_closed`, closed flag, unconfirmed email).
2. Same fact, same words on every screen (one shared mapping, not copies); no text pointing at a control that is
   not on screen; every empty state says what the person CAN do; a disabled control says why.
3. Isolation: today's site unchanged for people not on the list (R0 regression suite; /app seams; event route).
4. Photo: delete sends only `{keys:[own key]}` under `avatars/u/<uid>/`; foreign/legacy URLs never deleted.
5. Security: no private column (bio, WhatsApp switch, email) reaches a public reader; no secret in client code.
6. Tests that cannot fail (assert on mocks they set up themselves), and missing shapes (ended/legacy/huge/empty).
7. The 42 shots in `docs/review-pack/r1a/` against `measurements.md`: anything clipped, overlapping, < 44px.

## Output
Write `docs/handover/dancer-rebuild-r1a-review.md` on a NEW branch `arc/dancer-app-r1a-review` (from r1a's head):
findings ranked BLOCKER / SHOULD-FIX / NOTE, each with file:line, a concrete failure scenario, and the check that
would catch it. Then a one-line verdict. Push that branch only; last commit subject ends `[worker-done <ticket>]`.

## Boundaries
Never push r1a; no PR, merge or approve; plain git (never `gh api`); commands without variables/loops/`$(...)`
where a plain command works; Supabase read-only. Context: at 25% start nothing new; by 30% push the findings so
far with subject ending `PARTIAL [worker-done <ticket>]`.
