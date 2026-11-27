# Brief: claim-code-design-r2 (WEBSITE docs only, Opus, ONE fix round on the merged claim-code PLAN). Branch claude/claim-code-design-r2 (new, from main).

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. Docs only: NO SQL file, NO code.

Read the independent security review: `git fetch origin claude/review-claim-code-design-r1` then `git show FETCH_HEAD:docs/review/claim-code-design-r1.md` (BLOCK, cheap to lift). Edit docs/design/claim-code/PLAN.md (and INVENTORY.md where numbers change) to:
R1. Make the issue RPC implementable: gate by user id (p_user_id) with a by-id dancer-profile gate, REVOKE EXECUTE FROM PUBLIC, anon, authenticated, edge function calls with the service key; add the matrix row "issue RPC called by an authenticated session via PostgREST -> permission denied". Say whether the edge function generates the code and only the hash+salt reach the DB (review's alternative) and pick one with the reason.
R2. Close the one-account lockout and the harassment channel: per (page,user) cap, escalating cool-down on unredeemed codes, an admin kill switch for a page, no requester-controlled text in the message (fixed copy, validated first name or none), mail/WhatsApp footer to stop it.
R3. Replace the false "invites untouched" claim: state what the live redeem_organiser_invite_v1 really does (seats a second owner), add the two matrix rows, and record it as an OWNER DECISION (list the options, give a recommendation, do not decide).
R4. Add SECURITY DEFINER SET search_path and schema-qualified extensions.digest / gen_random_bytes to every pseudo-signature.
R5. Rewrite F1 honestly: email-only moves about 0 pages; the value is the phone/WhatsApp route; add the review's seven phone-route abuse cases (relay social engineering, cost cap, E.164 normalisation, send_failed not counting against caps, venue lines, inbound replies, number recycling) with a mitigation each. Record F1 as the owner decision with a recommendation.
Also fix N1-N9 if they are one-line edits, and update the counts (37 unclaimed live pages: 2 email, 32 phone only, 3 none) with today's date.
Handover docs/handover/claim-code-design-r2.md with Verified / Not verified and the list of owner decisions. Commit subject ends [worker-done <ticket>].
