# Brief: P3 acceptance contract, round 3: "a person already in the system comes to join" (docs only; branch claude/p3-acceptance-contract-3, built on claude/p3-acceptance-contract-2)

Context cap 30%. Docs only, no src/. Supabase read-only, counts only (no personal data). Push once; end the commit subject with the [worker-done <ticket>] marker named in the dispatch prompt. Start from claude/p3-acceptance-contract-2.

## Why
The owner asked: what about a person who is ALREADY in the system (listed by an admin, imported, created as a dancer / teacher / DJ / organiser profile, or already holding an account) and then tries to join or sign up? Rounds 1-2 covered organiser PAGES being claimed (J-c2, J-c4, J-e1) but not the person's own profiles, and not the account collisions. The owner also said: "why am I having to think of all these routes instead of you?" So do NOT work from memory of the code: derive the cases from the DATA.

## Step 1 (before drawing anything): INVENTORY-FROM-DATA
docs/design/p3-acceptance/PEOPLE-INVENTORY.md. Read-only prod survey (counts only) of every way a person or profile can exist in the system:
- every table/RPC that holds a person-like or profile-like row (dancer, teacher, DJ, organiser person, videographer, venue contact, team member, claim/invite/request rows, interim seats), with: row count, rows with an account link vs none, rows with an email vs none, duplicate emails / near-duplicate names, hidden/deleted, created by admin/import vs self-signup.
- every entry path that can touch such a row: sign-up, sign-in (OTP/typed code/link), "Already listed?" step (src/lib/auth-otp-routing.ts showsAlreadyListedStep, AuthCallback.tsx), claim by email at sign-in (claimOrganisersAtSignIn), claim from a public profile, invite accept, access request, admin merge. file:line for each.

## Step 2: journeys (extend CONTRACT.md; ids J-i1...)
For each combination found in Step 1 write numbered journeys with expected text and the must-be-impossible list. At minimum:
- listed teacher/DJ/dancer (no account) signs up with the SAME email; with a DIFFERENT email than the one on file; with a typo variant; "Already listed?" answered yes / no / not sure.
- person who already HAS an account tries to sign up again (same email), signs in with another method, or has two accounts.
- two people claim the same profile; a claim on a profile that is already claimed; a claim by someone who is not that person (what proves identity?).
- person listed as both a teacher and a DJ and a dancer (three rows) joins: one account, one You area (owner rule R2), nothing duplicated.
- person on the system as a team member / co-organiser / venue contact joins.
- hidden, deleted, suspended, merged rows.
Each journey: data shape needed (seed spec added to ACCOUNTS.md), pass/fail line blank, severity. Add GAP entries for anything the code does not handle (e.g. rows with no email cannot be auto-matched: what is the path?).

## Step 3
Update coverage line (N rows, N covered, 0 uncovered) and the P1 walk order (owner order stays: gate, public page matches, co-organisers/several pages; add this class as P1 beside the gate). Handover docs/handovers/p3-acceptance-contract-r3.md.
