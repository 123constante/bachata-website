# Brief: Organiser invite: claim screen first, then "Now about you"
Source: issue 123constante/bachata-admin#1680 (read it; acceptance contract is the issue body). Website repo, normal lane, no DB change.

Goal: an invited organiser owner who opens the admin invite link on a phone (390x844), where the organiser already exists (logo, name, city, Instagram) and they have no dancer profile yet, sees:
1. Claim screen first (organiser shown), they confirm.
2. Then a separate "Now about you" step: own name + photo, labelled as the person, organiser name shown above it, and a soft non-blocking prompt if the typed name is close to the organiser name (stops the organiser name ending up as the person name).

Rules:
- New invitees only. Existing account teamsueno2026 must not change behaviour or data.
- Behind a flag, smallest working version, one branch, one PR.
- No schema/migration here (schema authority is bachata-admin-11april). If a DB change seems needed, stop and write it in the handover.
- Verify at 390x844 on prod-shaped data; include a "## Verified on real data" block in the PR body (Shapes surveyed / Checks run / NOT verified).
- Use `&mdash;`-style entities in JSX; explicit px tap targets.
