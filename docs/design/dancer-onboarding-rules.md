# Dancer signup and onboarding: owner rules (permanent)

Source: owner clicks and notes, 2026-11-24. Mockup: https://claude.ai/artifact/4QNp8Rbaa3EqsxMZpR5icX (Neon Night, direction 1).
These rules beat any older issue, queue row or brief. Change only on a new owner decision.

## Signup journey (Neon Night look)
1. Menu for a visitor = two buttons only: Create account, Sign in. All other items (Dancers, Teachers, DJs, Organisers, Venues, Raffles, Festivals, Cities, Community, search, social links) show only after sign-in.
2. One question per screen: roles (Dancer/Organiser/Teacher/DJ, multi-pick), first name, city (search all cities), lead/follow/both, email, 8-digit code.
3. After the code: a short "You're in" moment that moves on by itself (about 2 seconds, no button), then the dancer Home. Home gets its own design round.

## Dashboard sneak peek, then required fields
- After the code the dancer sees a SNEAK PEEK of the dashboard, then must finish the required fields before using it.
- All questions below are asked. Optional ones may be skipped. Required ones may not.
- Nudge style: progress-driven (visible progress), skippable only for optional fields.
- Where nudged: (a) extra steps right after signup, (b) a card at the top of Home while incomplete, (c) at the moment it matters.

| Field | Required? |
|---|---|
| Profile photo | REQUIRED |
| Dancing experience = year they started dancing (or years dancing) | REQUIRED |
| Dance styles (at least one) | REQUIRED |
| Short bio | optional |
| Social links | optional |
| "Are you looking for a dance partner?" yes/no | asked of everyone |

- Partner question: if YES, a follow-on form or overlay asks: what kind of partner, preferred role and level of partner, a short note to potential partners. If NO, continue to the next step.
- Dancers are NOT asked for phone or email contact choices (they already have email; no phone in dancer onboarding). Phone IS asked in other profile types (organiser etc.).

## Dance level is retired, system-wide
- No beginner/intermediate/advanced anywhere. Ask only "how many years have you been dancing" or "what year did you start".
- Whole-system switch (database, admin editor, website, partner filters) needs an inventory first: every place the level appears. Not built; plan before any change.
- Preferred partner level = a years-of-experience range (for example 0-2, 2-5, 5+ years, or any). Owner 2026-11-24.

## Level retirement scope (owner clicks 2026-11-24, after read-only inventory)
- Inventory: dancer level lives in `dancing_role_details.partner_search_level` (text[]) and the wizard `experience_level` answer; `dance_started_year` (integer) already exists and STAYS. ~35 migrations/RPCs, admin editor (DynamicForm, PersonViewRoleTabs), Website EditProfile, DancerDashboard, DancerProfileGrid, ExperiencePicker, create-full-dancer edge function.
- `partner_search_level` -> replaced by a preferred-partner years-of-experience range; OLD VALUES CONVERTED (e.g. Beginner -> 0-2 years) so nobody loses a preference.
- Derived labels (Newcomer, Rising Star, Experienced, Veteran, Intermediate) REMOVED; show only "N years dancing".
- Event series ratings, class difficulty (`level_keys`), search level filter: NOT touched.
- Wizard: ask "how many years have you been dancing"; convert to a start year ourselves. The Beginner..Advanced experience question is removed.
- Needs a DB migration (new column + conversion): goes through Skill(migrate), DB builder = Opus; not started.

## Sneak peek and reward details (owner clicks 2026-11-24)
- Sneak peek = the real Home shown clearly (not blurred), every item locked with a lock icon. Tapping a locked item: the item shakes gently and a message appears ("Finish your profile to unlock this" + Finish button).
- Required steps: one screen each (photo, years dancing, styles). Partner yes opens a bottom sheet (kind, role, partner years range, note).
- Home progress card: animated progress ring with counting percentage; confetti burst on each completed step; BIG celebration at 100% (full confetti, "Profile complete" message, card turns into a badge).
