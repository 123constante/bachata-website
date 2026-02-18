# Person Identity + Multi-Account Plan

## Why
In the dance scene, one human can have many roles (teacher, organiser, DJ), and may use multiple login accounts over time. We need stable identity that does not split event history.

## Canonical Model
- `person_identities`: one real-world human.
- `person_account_links`: many auth users linked to one human.
- `person_profiles`: many role profiles linked to one human.

This separates:
1. human identity,
2. auth account,
3. role profile.

## What the migration adds
- New tables:
  - `person_identities`
  - `person_account_links`
  - `person_profiles`
- Helper functions:
  - `is_current_user_admin()`
  - `can_current_user_manage_profile(profile_type, profile_id)`
- Additive RLS policies for linked users/admins.
- Bootstrap of existing claimed `entities` rows into person identity links.

## Immediate behavior
- Existing features continue to work (no breaking changes).
- Existing `entities.claimed_by` ownership remains valid as fallback.
- New helper allows gradual migration of edit permissions to person-based checks.

## Recommended next steps
1. Update write checks for event graph edits to use `can_current_user_manage_profile(...)`.
2. Add UI in profile settings for "Link another account" (invite/verification flow).
3. Add optional dedupe/admin merge tool to combine two `person_identities`.
4. Backfill non-entity profiles (`dancers`, `vendors`, `videographers`) into `person_profiles` once ownership source is confirmed.

## Permission target state
- `organising` edge: event owner, linked organiser, or admin.
- `teaching` edge: linked teacher/organiser or admin.
- `performing_dj` edge: linked DJ/organiser or admin.
- `attending`/`interested`: self-service for linked person accounts.

## Notes
- Keep UX simple: encourage one account with multiple profiles.
- Keep backend flexible: support multiple linked accounts per person.
