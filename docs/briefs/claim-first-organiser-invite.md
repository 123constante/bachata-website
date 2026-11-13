# Claim-first organiser invite (inbox c33d70, owner said "build this" 2026-11-13)

Repo: Website (123constante/bachata-website). Lane: careful (public claim route, organiser ownership).

## Problem (real case)
Admin-invite claim link for an organiser puts the invitee into personal-profile onboarding BEFORE the claim.
Invitee typed the organisation name as their own first name (account teamsueno2026, organiser Sueno Events;
sign-in 14:03, 6 profile saves 14:08, claim 14:39, on 2026-11-13).

## Fix (smallest working version, behind a flag, one branch, one PR)
1. Invite link lands FIRST on a Claim screen showing organiser logo + name ("You are taking over this organisation").
2. After the person confirms, a SEPARATE "Now about you" step collects their own name + photo.
3. Labels make clear the name field is a person's name, not the organisation's (the original message continues past
   this point; the inbox text is truncated, so keep copy plain and warm for low-tech phone organisers).

## Gates
- Find the existing claim + onboarding routes first; reuse the canonical RPCs, no new write path unless unavoidable.
- Survey prod shapes read-only: invitee with and without an existing profile, already-claimed organiser, expired invite.
- Table-driven tests screen x shape; empty/error states say what to do; untouched save sends nothing.
- Walk at 390x844 on prod-shaped data; screenshots on the PR.
- Any RLS/permission/ACL change: stop and report; do not widen access. No prod writes.
