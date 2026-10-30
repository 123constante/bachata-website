# P3 acceptance: shape survey and test accounts

Step 3 of `docs/briefs/p3-acceptance-contract.md`. **The lead creates these accounts. No worker writes to prod.** Journeys are in [CONTRACT.md](CONTRACT.md).

## 1. Prod shape survey (read-only, 2026-10-30, project stsdtacfauprzrdebmzg)

These are counts only, with no personal data. Source tables: `event_series_p5` and `event_occurrence_p5`. The repeat rule is `recurrence_rule->>'mode'`. "none" means no rule (a legacy recurring row with materialised dates, or a one-off).

| format | status | rule | series | ended_on set | no photo | 0 dates | has a cancelled date | all dates past | max dates |
|---|---|---|---|---|---|---|---|---|---|
| course | live | weekly | 6 | 0 | 0 | 0 | 0 | 5 | 16 |
| course | ended | none | 8 | 8 | 0 | 0 | 0 | 8 | 8 |
| course | draft | weekly | 1 | 0 | 1 | 0 | 0 | 0 | 30 |
| course | archived | weekly | 1 | 0 | 0 | 0 | 0 | 1 | 9 |
| festival | live | none | 8 | 0 | 0 | 0 | 0 | 2 | 1 |
| festival | archived | none | 5 | 0 | 2 | 0 | 0 | 5 | 1 |
| one_off | live | none | 10 | 0 | 0 | 0 | 0 | 9 | 1 |
| one_off | paused | none | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| one_off | draft | none | 4 | 0 | 3 | 1 | 0 | 0 | 2 |
| one_off | archived | none | 635 | 0 | 605 | 298 | 0 | 337 | 1 |
| recurring | live | weekly | 28 | 0 | 0 | 0 | 18 | 0 | 132 |
| recurring | live | monthly | 6 | 0 | 0 | 0 | 1 | 0 | 71 |
| recurring | live | custom | 1 | 0 | 0 | 0 | 1 | 0 | 10 |
| recurring | live | none | 10 | 0 | 0 | 0 | 3 | 6 | 20 |
| recurring | paused | weekly | 1 | 0 | 0 | 0 | 1 | 0 | 80 |
| recurring | draft | weekly | 7 | 0 | 7 | 0 | 1 | 0 | 52 |
| recurring | draft | none | 1 | 0 | 1 | 0 | 0 | 0 | 1 |
| recurring | ended | none | 13 | 13 | 0 | 0 | 7 | 11 | 64 |
| recurring | archived | weekly | 7 | 0 | 5 | 0 | 0 | 2 | 53 |
| recurring | archived | monthly | 2 | 0 | 0 | 1 | 0 | 1 | 1 |
| recurring | archived | none | 3 | 0 | 1 | 0 | 0 | 2 | 34 |

Other facts:
- **Rule shapes:** weekly interval 1 (42), weekly interval null (9), monthly interval 1 (8), custom (1). **No every-N-months (interval > 1) and no explicit-dates mode in prod.** The seeds must create these (G-15).
- **Over the 100-row cap:** the largest organiser has **45 series** across all statuses and **258 dates**. The largest single series has 132 dates. Series lists stay under 100 in prod today, but date lists go over it.
- **Claimed organiser pages: 10.** Non-archived series per claimed page: 0 series (1 page), 1-5 (8), 6-20 (1).
- **Live live-shape edge cases:** a "live" series with no rule and all dates past (6 recurring, 9 one-off, 5 course). These must not read as coming up.
- **Profile claims:** 5 pending, all `teacher`. Organiser invites: 2 open, 4 expired unused, 4 used, 1 revoked. Pending co-host invites: 0. Incomplete onboarding progress rows: 0.

## 2. Test accounts (seed spec)

Use a test email domain the lead controls. Each account is a separate auth user. "Page" means an `organiser_profiles` row claimed by that user. Series counts are on that page. Every series gets `organiser_ids = {page}` unless noted.

| account | person | auth / profile state | pages | series and dates (status x format x rule x past x cancelled) | journeys |
|---|---|---|---|---|---|
| A-dancer-new | a | none (created during the walk) | 0 | - | J-a1 |
| A-dancer | a | dancer profile complete, no roles | 0 | - | J-a2, J-a3, J-b1 |
| A-deleted | a | dancer, account deletion requested | 0 | - | J-a4 |
| A-dancer-teacher | b | dancer complete + teacher role saved (`save_my_role_v1`) | 0 | - | J-b2 |
| A-teacher-new | b | none (signs up as Teacher during the walk) | 0 | - | J-b3 |
| A-org-new | c | none (signs up as Organiser during the walk) | 0 -> 1 | creates 1 one-off in J-c6 | J-c1, J-c6 |
| A-org-claimer | c | dancer complete | 0 | unclaimed page **P-claimable** (3 live weekly series, 1 one-off) + a second unclaimed page **P-claimable-b** | J-c2 |
| A-org-claimer2 | c | dancer complete | 0 | unclaimed page **P-claimable-2** (1 live weekly) | J-c4 |
| A-org-waiting | c | dancer **incomplete**, 1 open `request_organiser_access_v1` to A-org-big's page | 0 | - | J-c3 |
| A-invitee | c | fresh email; 1 open invite + 1 expired + 1 revoked token for A-org-big's page | 0 | - | J-c5 |
| A-org-unfinished | c | page created, onboarding NOT complete (no contact confirmed) | 1 | 1 draft weekly, no photo | J-c7 |
| **A-org-big** | d | dancer complete, onboarding complete, owner | **2** (P-big, P-small) | see A-org-big below | J-d1 to J-d10, J-d13 |
| A-org-member | d | team member (not owner) of P-big | 0 own | - | J-d9, J-d10 |
| A-org-drafts-only | d | onboarding complete | 1 | 1 draft one-off (no photo, 0 dates), 2 draft weekly (no photo, 52 dates), 1 draft course | J-d11 |
| A-org-ended-only | d | onboarding complete | 1 | 2 ended recurring (13 and 64 dates, 3 cancelled), 1 ended course (8 sessions, all past), 1 live one-off with its date in the past | J-d2, J-d11 |
| A-org-tickets | d | owner + Stripe account row (charges_enabled false, then true) | 1 | 1 live one-off with 2 ticket types, 3 orders, 1 refunded | J-d12 |

### A-org-big, page P-big (copy the prod extremes)

| key | format | rule | status | dates | past | cancelled | skipped | photo | notes |
|---|---|---|---|---|---|---|---|---|---|
| W-weekly-130 | recurring | weekly i=1 | live | 132 | 30 | 3 | 2 | yes | over the 100 cap (Event page "100 of N") |
| W-weekly-null | recurring | weekly i=null | live | 20 | 5 | 0 | 0 | yes | null interval shape |
| M-monthly | recurring | monthly i=1 | live | 71 | 40 | 1 | 0 | yes | |
| M-every2 | recurring | monthly i=2 | live | 12 | 3 | 0 | 0 | yes | not in prod (G-15) |
| C-custom | recurring | custom | live | 10 | 2 | 1 | 0 | yes | |
| D-dates | recurring | explicit dates | live | 6 | 2 | 0 | 0 | yes | not in prod (G-15) |
| R-norule-past | recurring | none | live | 20 | 20 | 2 | 0 | yes | "live" but all past: must not read as coming up |
| K-course | course | weekly | live | 16 | 16 | 0 | 0 | yes | all sessions past |
| K-course-now | course | weekly | live | 8 | 3 | 0 | 0 | yes | with programme items |
| F-festival | festival | none | live | 1 | 0 | 0 | 0 | yes | programme days/sections/items + artists |
| O-oneoff-future | one_off | none | live | 1 | 0 | 0 | 0 | **no** | no photo |
| O-oneoff-cancelled | one_off | none | live | 1 | 0 | 1 | 0 | yes | cancelled one-off |
| O-oneoff-past | one_off | none | live | 1 | 1 | 0 | 0 | yes | |
| P-paused | recurring | weekly | paused | 80 | 40 | 1 | 0 | yes | |
| E-ended | recurring | none | ended | 64 | 64 | 7 | 0 | yes | ended_on set; must show Ended, never Draft |
| X-draft | recurring | weekly | draft | 52 | 0 | 1 | 0 | no | |
| A-archived x3 | one_off | none | archived | 1 | 1 | 0 | 0 | no | must not appear in the Events list |

To prove the series list over the 100 cap (G-10), add **100 extra live one-offs** to P-big (future dates, no photo) in a second seed step. This takes P-big to about 116 non-archived series and about 520 dates. Prod's biggest organiser is 45 series, so this step is the stress test, not a copy of prod.

**P-small:** 1 live weekly series (10 dates). It exists so that Switch page (S36) appears and the page choice can be checked across screens.

Team on P-big: owner A-org-big, member A-org-member, an open access request from A-org-waiting, and history rows (more than 50 changes on W-weekly-130 so that History "Load more" shows).

## 3. Rules for the seed

- Seed through the admin repo's tooling or the RPCs as the account itself. Never hand-written DDL here (this repo owns no migrations).
- Never seed into real organisers' pages. Mark every seeded row (for example, a name prefix `[ACC]`) so cleanup can find it, and keep the pages out of public listings if the admin side supports that.
- After seeding, rerun the section 1 query restricted to the `[ACC]` pages and paste the counts under each account. That is the walker's proof that the shapes exist.

## 4. Round 2 shape survey (read-only, 2026-10-30, project stsdtacfauprzrdebmzg)

Counts only. Sources: `organiser_profiles`, `organiser_team_members`, `organiser_claim_emails`, `organiser_onboarding_progress`, `organiser_self_start_v1_meta`, `series_organiser_invites`, `event_series_p5`, `event_occurrence_p5`, `cancellation_reasons`.

| fact | prod count |
|---|---|
| users who claimed 2+ pages | **0** (max 1 page per user) |
| unclaimed pages | 39 |
| pages with a claim email set (auto-claim) | **0** (G-17) |
| claimed pages with no completed onboarding row | **10 of 10** (G-19) |
| pages with a Facebook link (website or socials) | 29 (R3, G-20) |
| active team rows by role | `Leader` on 48 pages, `Member` on 5 pages |
| pages with 2+ active team members | 4 |
| page lifecycle | 49 `live` (44 with `is_active` null, 5 true); no hidden / taken down (G-27) |
| possible duplicate pages flagged | 0 |
| series listing 2+ organiser pages | 6 |
| pending series co-organiser invites | 0 |
| most series on one page | 45 |
| most past dates on one page | 86; pages with 50+ past dates: 9 |
| active cancellation reasons (fixed list) | venue_closed, teacher_unavailable, bank_holiday, low_signups, other |

So "several pages per person" (J-e4) and "two owners" (J-e6) exist only in seeds; the gate (J-e8) meets every real organiser.

## 5. Round 2 test accounts (persons e, f, g)

Same rules as section 3 (`[ACC]` prefix, lead seeds, no worker writes).

| account | person | auth / profile state | pages | series and dates | journeys |
|---|---|---|---|---|---|
| A-org-autoclaim | e | dancer complete; NOT yet claimed | 0 -> 1 | page **P-autoclaim** with `organiser_claim_emails` = this account's email, 2 live weekly; plus **P-autoclaim-other** with a different email (must not claim) | J-e1 |
| A-org-history | e | onboarding complete, owner | 1 | **P-history**: 3 series, 86 past dates in total (2 ended recurring, 1 live weekly with 40 past), 60+ history rows | J-e5 |
| A-org-coowner-1 / -2 | e | -1 is `claimed_by`; -2 is an active team row `Leader` | 1 shared | **P-shared**: 2 live weekly | J-e6 |
| A-org-half | e | claimed, **no** `organiser_onboarding_progress` row, no contact confirmed | 1 | **P-half**: 1 live weekly | J-e7 |
| **A-org-legacy-live** | e | claimed, no onboarding row (copy of the prod shape), website = a Facebook URL | 1 | **P-legacy**: 3 live weekly (52 dates each, 10 past), 1 cancelled date, people going on the next 3 dates | J-e8, J-p1 (P1) |
| A-org-big (reuse) | e | as section 2; owns P-big and P-small | 2 | as section 2 | J-e4 (P1) |
| A-dj | f | dancer complete + DJ role saved | 0 | - | J-f3 |
| A-org-nodancer | f | organiser intent, **no** dancer profile | 0 | - | J-f4 |
| A-dancer-teacher-org | f | dancer + teacher role + owner of **P-teach** | 1 | 1 live course (8 sessions) | J-p3 |
| A-helper | g | fresh email; 1 open invite to P-big | 0 | - | J-g1 |
| A-org-member (reuse) | g | Member on P-big only; NOT on P-small | 0 own | - | J-g2, J-g3, J-g5, J-v8 |
| A-org-solo | g | only owner of **P-solo**, no team | 1 | 1 live weekly with people going | J-g4 |
| A-org-partner | g | owner of **P-partner** | 1 | series **S-shared** with `organiser_ids = {P-big, P-partner}`, live weekly | J-g6 |

Extra seed for J-x2 and J-v*: on P-big's W-weekly-130, mark 3 future dates with people going (so the R1 preview has names), and hand-edit 1 future date's time (so "hand-edited dates kept" is testable). Pages for J-p6: one `[ACC]` page in each lifecycle state the admin side supports (hidden, taken down, flagged duplicate).

## 6. Round 3 test accounts (a person already in the system comes to join, J-i1..J-i18)

The prod survey for this round is [PEOPLE-INVENTORY.md](PEOPLE-INVENTORY.md) section 1 (counts only). Same rules as section 3: `[ACC]` prefix, the lead seeds, no worker writes. "Listed" = a `person` row + its `dancer_profiles` persona + `person_roles` (+ role details), created as an admin would (`created_by` null, `profile_source` admin_create), with NO account unless stated. Emails use `example.test`.

| account / row | seed | journeys |
|---|---|---|
| A-listed-same | listed person, roles teaching + dancing, `teacher_role_details` filled, persona email = the account email to be used | J-i1 |
| A-listed-other | listed teacher with email E1; the walker signs up with E2 | J-i2, J-i5 |
| A-listed-variant | listed persona email in mixed case `Name.Teacher@example.test` | J-i3 |
| A-listed-noemail | listed teacher + DJ, no email anywhere (the 132-row prod shape) | J-i4 |
| A-listed-ambiguous | two live unlinked personas with the same email (the prod shared-email shape) | J-i6 |
| A-two-1 / A-two-2 | -1 linked to a listed persona; -2 a second email with its own stub | J-i9 |
| A-claim-1 / A-claim-2 | -1 email = listed persona email and = an unclaimed `[ACC]` page contact email; -2 another email | J-i10, J-i11 |
| A-impostor | fresh account; knows the A-listed-noemail name only | J-i12 |
| A-listed-three | one person with teaching + djing + dancing active, both role-detail rows, email on file (the 23-person prod shape) | J-i13 |
| A-listed-archived / A-listed-merged | persona with `archived_at` set; a person with `merged_into_id` pointing at a survivor with a different email | J-i14 |
| A-team-legacy | listed person with email, active `organiser_team_members` row `Member` on P-big (`member_profile_id` = the person id), no `entity_members` row | J-i15 |
| A-helper-noprofile | open `organiser_invites` row on P-big with `person_profile_id` set to a persona whose email differs from the invite email | J-i17 |
| A-deleted (reuse) + one banned account | erase request open; `banned_until` in the future | J-i8, J-i18 |
| profile_claims row | one pending teacher claim pointing at A-listed-noemail's current person id (and the 5 prod orphans stay untouched) | J-i12 |

After each J-i walk, run the "one person, one account" check from CONTRACT.md round 3 (read-only SELECT on `[ACC]` rows).
