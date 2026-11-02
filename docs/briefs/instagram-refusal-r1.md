# BRIEF: Instagram save refusal shows a clear message (normal lane, Website only)

Status: DRAFT 2026-11-02, NOT landed, NOT dispatched. Needs land-brief, cost line, independent brief review.
OWNER CLICKS 2026-11-02 (evening): (1) the evidence test goes to a CLOUD WORKER (local fast-lane write was blocked by no-local-feature-code.mjs even with a trivial pass; hook not touched). (2) SCOPE = items 0, 1, 2 as separate commits on ONE branch (claude/instagram-refusal-r1), one push. Worker's FIRST step: write the Finish-profile render test (complete-profile fixture, Simon shape) and report red/green BEFORE building item 0; a green result means item 0 is not needed, report and skip it. Item 1 worker must READ save_my_dancer_profile_v1 first: if a blank Website cannot clear, STOP item 1 and report (admin migration = separate careful slice).
Trigger: Simon (Bachata Influence, dancer bebc8933) reported "the screen flashes for abit and then ntg happen". Prod read 2026-11-02: his instagram and instagram_normalized are both empty, so the save never stuck. Exact text he typed is UNKNOWN (owner asked him; no reply seen). Cause (server refusal vs never sent) is NOT proven.

## UPDATE 2026-11-02 15:00Z (read-only, proven)
Simon's Instagram URL is stored in dancer_profiles.website_url; instagram is NULL (updated_at 00:13Z). /dancers/simon (cache-busted, MISS) renders it from website_url. So for Simon NO refusal happened; the value went into the Website box. The refusal mapper below stays as a hardening item; add a second item: an instagram.com URL typed into Website should be offered as Instagram (or the checklist should say where the value is). OWNER DECIDED (via website-e5, 2026-11-02): if an instagram.com link is put in the Website box, the app MOVES it into the Instagram box and clears the Website box, and the checklist then counts it. The refusal-message fix stays a SEPARATE item (two PRs, or two commits in one branch, each with its own tests).

### Item 2 spec: move Instagram link out of Website
- On save (all dancer save screens that have a Website box): if website value is an instagram.com URL (host instagram.com or www.instagram.com, with a handle path) AND the Instagram box is empty -> send instagram = that value, website = '' in the same save. If the Instagram box already has a DIFFERENT value, do NOT overwrite; show a message under Website ("This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram.") and block that save.
- Caution from the code read: the save RPC uses COALESCE(NULLIF(new,''),old), so sending website='' will NOT clear the stored Website. Clearing needs either an RPC change (admin repo, careful lane, migration) or an explicit clear path. DECIDE BEFORE DISPATCH: Website-only client move cannot clear; if the RPC cannot clear, the move leaves the link in both boxes. Worker must READ the RPC first and report; if a migration is needed, split to a careful-lane admin slice.
- Checklist: _onboarding_missing_v1 reads dancer_profiles.instagram raw, so once the move saves it counts. EXISTING rows (Simon) are not fixed by code; fixing his row is a prod write the owner must name (one row, read before/after). Not done.
- Tests (red first): table-driven website value x instagram value ({empty, same, different} x {ig link, www ig link, https non-ig, plain site, empty, ig link with query/trailing slash}); untouched save sends nothing; same helper as instagramHandle.ts rules.

## UPDATE 2 2026-11-02 evening (code-read of origin/main, NOT browser-reproduced): LIKELY ROOT CAUSE = the row sends to a screen with no Instagram box
Simon (WhatsApp 16:50): "i couldnt type anything / i click on the thing and it just flashes / no response".
- Checklist row `instagram` ("Your Instagram") has step=null, elsewhere='dancer' (p3/onboarding/pageModel.ts l.318). Tap -> OnboardingFlow.tsx l.274: navigate(finishProfileHref(`${P3_PATHS.start}?o=<org>&at=review`)).
- Finish profile (src/pages/FinishProfile.tsx) only asks for what useProfileCompletion lists missing: first_name, city, dance_role, photo. Instagram, DJ answer, DJ genres, city-elsewhere are NOT fields there. For a person whose base profile is complete, finishScreenMode = 'done' (profileCompletion.ts l.213-226): no input, just a "Continue" button back to the checklist. So the row opens a screen with nothing to type, and Continue returns to the same checklist. That matches "couldn't type", "no response". The "flash" (route change + redirect/gate) is NOT explained; reproduce.
- Same dead end for: dj_answer, dj_genres, city (all `elsewhere='dancer'`). Likely hits Daniel's dj_answer too. Verify.
- BUILD (item 0, before items 1-2): every `elsewhere='dancer'` row must open a screen where that field can actually be entered (the dancer editor / Dancer4 step for Instagram, DJ answer, DJ genres, city), with a table-driven test: every missing code x destination exposes a control for that code (no row points at a missing control). Red first.
- Reproduce at 390x844 on a prod-shaped account (claimed dancer, complete base profile, missing instagram) on the laptop walk before finalising. ATTEMPTED 2026-11-02 evening: INCONCLUSIVE. Walk test account has an INCOMPLETE base profile (/finish-profile showed the "Hey Walker, you made it!" Dancer4 intro, not the 'done' Continue screen) and does not own the org it was pointed at ("We couldn't load your page"). The walk tool cannot tap rows. So the 'no Instagram box for a complete profile' theory is UNVERIFIED. Next option, no prod write: jsdom render test of FinishProfileScreen with a complete-profile fixture on the laptop. A real Simon-shaped test account would be a prod write (owner must name it).

## Problem
save_my_dancer_profile_v1 refuses an invalid handle (invalid_instagram, 22023) or a handle already used by another profile (unique index dancer_profiles_instagram_normalized_uidx, 23505). Dancer save screens swallow the error:
- src/pages/FinishProfile.tsx l.96: `catch { setSaveError(true) }` -> one generic flag, no reason.
- src/pages/EditProfile.tsx l.186 and l.291: catch handlers; check what they show for these two codes (unread in detail).
- src/lib/saveMyDancerProfile.ts rethrows the raw error.
- Also check src/pages/Onboarding.tsx, PracticePartners.tsx, AuthCallback.tsx, DancerDashboard.tsx (all call saveMyDancerProfile).
Existing mapping to reuse: src/modules/organiser/shared/selfServeErrors.ts l.77 (invalid_instagram -> "Enter an Instagram handle or a full https:// link."). Client rule: src/lib/instagramHandle.ts (parity with server by fixture; do not change).

## Build
1. ONE shared mapper (e.g. in saveMyDancerProfile.ts or a sibling): error -> {field:'instagram', message} for invalid_instagram and 23505; anything else stays generic. Messages:
   - invalid: "Enter your Instagram handle (like @yourname) or a full instagram.com link."
   - taken (23505 on that index): "That Instagram is already on another profile. Check the spelling, or message us if it is yours."
2. Every screen above that saves Instagram shows the message under the Instagram field (aria-live, field marked invalid), not a flash.
3. Client pre-check with instagramHandle.ts before sending, so the invalid case never leaves the device.
4. Do NOT touch the save RPC or DB. Side note only (queue, do not fix): COALESCE(NULLIF(new,''),old) means an empty box cannot clear a stored Instagram.

## Tests (red first)
Table-driven: every save screen x {valid, invalid text, 23505, other error, empty}. Assert message shown at the field, no generic-only state for the two codes, untouched save sends nothing, mapper is the single source (no second copy of the strings). Run new tests against unfixed code first and show red.

## Walk
390x844 on prod-shaped profile (claimed dancer with organiser membership, no Instagram), typing: valid handle, "not a handle!!", a handle used by another profile (use a fixture, no prod write). Pictures per screen.

## Lane / limits
Normal, Opus worker, one branch claude/instagram-refusal-r1, single push, bot PR, PR body with Verified / Not verified, context under 35%. No prod writes, no migration. Not touching calendar-excluded files.

## Open before dispatch
- Simon's exact text (would confirm which branch it hit; if it was an ordinary valid handle, then 23505 or a never-sent bug is likelier and this brief must add a network trace step).
- Owner OK on the two message wordings.

## Standing header (dispatch checklist)
- Prove the data source first: read save_my_dancer_profile_v1, _onboarding_missing_v1 and the dancer_profiles trigger read-only on prod; state which column each checklist code reads and who writes it. Read ONLY (Supabase read-only, no writes).
- First step, before any build: write the Finish profile render test (src/pages/__tests__/FinishProfile.checklistRows.test.tsx; complete-profile fixture, status 'complete'; mount at finishProfileHref('/account/p3/start?o=org1&at=review'); assert an Instagram input and a DJ control) and report red/green in the handover. Green = item 0 not needed, skip it and say so.
- Item 0 destination rows: instagram, dj_answer, dj_genres, city (REVIEW_ROWS elsewhere='dancer', src/modules/organiser/p3/onboarding/pageModel.ts). Use the existing dancer editor / Dancer4 steps; do not invent a new screen.
- Zero bytes to the /app first load: npm run check:bundle-budget on main and branch; never edit perf-budgets.json or vite.config.ts.
- Branch claude/instagram-refusal-r1, three commits (item 0, item 1, item 2), ONE push. Stopping rule: one independent review, one fix round, then the orchestrator walk.
- Design: item 0 changes where a row leads and item 2 adds field messages: bug-fix class, no new visual language; walk at 390x844 and state it in the PR. Copy wordings in this brief need the owner's OK before merge.
- Not touching: calendar-excluded files, supabase/migrations (a needed migration = stop and report).
