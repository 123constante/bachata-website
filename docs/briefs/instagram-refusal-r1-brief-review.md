# Independent review of a BRIEF (read-only, no build)

Review docs/briefs/instagram-refusal-r1.md (branch brief/instagram-refusal-r1) against origin/main code and prod (Supabase READ-ONLY, project stsdtacfauprzrdebmzg). Output docs/review/brief-instagram-refusal-r1.md on branch claude/review-brief-instagram-r1, verdict PASS / PASS WITH NITS / BLOCK, then stop. Do not build, do not edit the brief.

Check, with file:line or SQL evidence:
1. Item 0: every checklist code in REVIEW_ROWS with elsewhere='dancer' (instagram, dj_answer, dj_genres, city, and unknown codes): where does the row navigate, and does the destination expose a control for that code for a person whose base profile (name, city, role, photo) is complete? Are there other destination screens (Dancer4Flow steps, DancerDashboard edit) that already hold the control, and is the brief's plan to reuse them feasible?
2. Item 1: read save_my_dancer_profile_v1 and the dancer_profiles triggers live. Can website_url be cleared by sending ''? Is there an existing way to move a value between columns in one save? What does the brief miss (all Website-box save screens, existing rows)?
3. Item 2: list EVERY screen that saves an Instagram value (callers of saveMyDancerProfile, organiser profile edit, OnboardingSheet). Does the brief name them all? Does anything already map invalid_instagram / 23505?
4. Does _onboarding_missing_v1 count instagram from instagram only, and what would make it count after the move?
5. Missing acceptance cases (person type x journey x data shape), wrong file names, wrong assumptions, anything that would make a worker build the wrong thing.
Report findings numbered, each with evidence. Keep the review under 2 pages.
