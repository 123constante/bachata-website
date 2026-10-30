# Brief: independent review r1 of Website PR #1195 (new organisers land on P3 Welcome), read-only

Branch to review: `claude/p3-landing-welcome` at head `1b9021f5`. Owner's words 2026-10-30 on the failure: "sign-up lands in old dark /account/o screens (not P3 Welcome); the Find your page sheet shows a red already-asked error with a live Ask to join button". Spec: `docs/briefs/p3-landing-welcome.md` on that branch.

Read-only. Push ONE new file `docs/review/1195-r1.md` on branch `claude/review-1195-r1` (create from main). No src edits, no prod writes (Supabase connector SELECT only). Marker `[worker-done review-1195]`. Verdict PASS / FIX FIRST, ordered findings with file:line, honest Verified / Not verified.

## Attack list
1. Every way in reaches P3 Welcome for a person with 0 pages when P3 is live (`organiserP3` AND `organiserSelfServe`): sign-up callback, `/account`, `/account/o`, Options links, R1 Done Back to Home, dancer-first `returnTo`, `/account/continue`.
2. With P3 OFF every landing is exactly as before (routing table test; try to break it with each flag alone on).
3. Never redirects a person who HAS a page, nor before the home read lands, nor when the read fails (no loop, no flash of the old screen).
4. Already-asked: no red error and no live Ask to join button; the message says what the person can do. Check pending, approved, declined/withdrawn, and two open requests.
5. The `/app` first-load chunk budget: the builder says `continueAsLanding` was moved out of `lib/accountRouting` to avoid +190 B. Confirm no new bytes on the `/app` route and that bundle-budget and chunk pins are unchanged.
6. Table-driven tests: does every screen x shape (no dancer row, unfinished dancer, 0 pages, 1 page, 2 pages, open request) have a row? Name any missing row and write the failing test as a snippet in your file.
7. Back-button and refresh behaviour at /account/p3/start; deep links with query strings.
