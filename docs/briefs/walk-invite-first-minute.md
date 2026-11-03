# Brief: walk the invite link, first minute to first event edit (docs + walk spec only)

Lane: normal, read-only walk. Model: Sonnet. Branch: claude/walk-invite-first-minute (claude/walk-* is claimed).
Owner words 2026-11-03: invited organisers "all simply stop responding" after the invite link. Prod count: 17 invites, 8 redeemed,
0 of 8 finished the onboarding checklist, 0 of 8 made a successful event edit; 6 of the 8 redeemed BEFORE the gate went ON
(2026-11-02 08:01Z), so the gate alone does not explain it. We need to see what a new invitee SEES.

## Goal
Walk, at 390x844 (phone), what a brand-new invited organiser sees from tapping /join (invite link) to making their first event edit.
Reuse the mocked-invite approach of branch claude/walk-join-help-r1 (e2e spec, mocked RPCs). No prod writes, no real invite redeemed,
Supabase read-only. Do not change app code.

## Cover every state
1. Invite link, fresh account (no dancer row), page with: claim email set / not set; first-name prefill / none.
2. Invite link expired, revoked, already used (what does the person see; is there a way forward).
3. Sign-up wall (invite-only wall, request access), code sent / refused / expired code.
4. After join: Home with organiserP3 flag ON and OFF (state which one prod serves today: read the flag default in code).
5. Checklist shapes seen on prod: 10 items missing, 6, 3, 2 (codes: first_name, city, dance_role, photo, nationality, languages,
   instagram, teach_answer, dj_answer, dj_genres, teach_years, teach_levels, org_logo, org_link, contact_confirm).
6. First event edit attempt with the gate ON: what the refusal sheet says; can the person continue; how many taps back to the event.

## Output (docs only, commit once)
docs/walk/invite-first-minute/RESULTS.md with, per state: screenshot path (390x844), what the person is told to do next (quote the words),
whether any screen names ONE next action, taps from link to first event edit, any dead end, any copy that points at a missing control.
End with a ranked list of the 5 worst places a person would stop, each with the evidence (screen + quote). No fixes proposed in code.

## Rules
- git fetch origin main and check `git merge-base HEAD origin/main` equals origin/main before the first push (cloud sandboxes carry a stale base).
- Push once. Do not add run-ci.
