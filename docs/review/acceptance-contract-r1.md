# Review: acceptance-contract-r1 (PR #1259)

Reviewer: independent read-only review (brief `brief/review-acceptance-contract-r1`). Reviewed head `d0ad29a`
(`claude/acceptance-contract-r1`): `docs/acceptance/INVENTORY.md`, `docs/acceptance/CONTRACT.md`,
`docs/handover/acceptance-contract-r1.md`. Code read at `main` `ff20808`. Prod `stsdtacfauprzrdebmzg` read
only (SELECT, counts and function bodies, no personal data), 2026-11-02.

## Verdict: BLOCK

The structure is right: the 8 person types, 34 journeys and 18 shapes are all there, and so is the 8-row quality bar.
The row counts add up (54 contract rows, 12 GAP, 1 OWNER-PHONE, 41 COVERED). But the contract is meant to stand in
for the owner checking things, and it does not do that yet:

- the GAP that reaches the most real pages is missing (B1);
- at least 8 rows marked COVERED name a test that does not check them (B2);
- the "none silently omitted" line is not true (B3).

Fix B1 to B3 and this becomes PASS WITH NITS.

## Blocking findings (ranked)

**B1. Public claim fails on 45 of 50 pages, and the contract does not show it.** `CONTRACT.md:45` (C15) cites only
"claim RPC". `CONTRACT.md:114` ranks the page-shape survey 8th, with reach "unknown". `INVENTORY.md:95` says "no contact"
was not surveyed. The live `claim_organiser_v1` refuses in four cases:
- `no_contact_email`, when there is no `organiser_claim_emails.claim_email` and no `contact_email`;
- `not_live`;
- `organiser_already_claimed`, when the page already has an owner row or someone else's `claimed_by`;
- `email_mismatch`, on a mailbox-proven session.

Prod today: **45 of 50 pages have no claim evidence**. Of the 37 ownerless pages, only **2** can be claimed through
the public card; the other 35 can only be reached by an admin-issued invite. This is the invite/claim growth path the
owner named on 2026-11-01. It needs:
- a C15 row per refusal, citing the server rule;
- a "no claim e-mail" shape, S19, with count 45;
- a GAP ranked #1 or #2. Is the card hidden, or does it say plainly what to do, on those 45 pages?

**B2. Rows marked COVERED whose named test does not check that row** (grep and header read on `main`):

| Row | Cited test | What the test actually is | Real coverage found |
|---|---|---|---|
| C36 (`CONTRACT.md:69`) contributor opens edit screens | `shared/__tests__/ownership.matrix.test.tsx` | The PUBLIC organiser page ownership/claim-hint matrix (badge, "Is this you?" card). It does not cover series edit refusal. | None found for `NotYoursCard`. Also, the cite `EventPage.tsx:256` is wrong: it is at `:291`, used at `:309` and `HistoryScreen.tsx:41`. |
| C44 (`:81`) contributor create disabled | same file | same as C36 | Only `TeamFixPass.test.tsx:163` (contributor on `/team/add`), which is not create |
| C32 (`:65`) co-hosted, both hosts may edit | `__tests__/consistency.matrix.test.tsx` | No multi-organiser fixture: no `organiser_ids` with 2 or more ids, and no co-host/host text | None. This should be a GAP (6 series). |
| C33 (`:66`) ended reads "Finished" | `consistency.matrix.test.tsx`; `eventPage.matrix.test.tsx` | `consistency.matrix` has 0 hits for `Finished` | Only `eventPage.matrix` can be the cite. Confirm it, or mark the row unconfirmed. |
| C25 (`:58`) prices | `p3/screens/__tests__/screens.matrix.test.tsx` | 0 hits for price, Price or tier | None for prices. This should be a GAP. |
| C52 (`:89`) ownerless page reason | `team/__tests__/Team.test.tsx` | 0 hits for `NO_OWNER`, ownerless or no owner | `p3/you/__tests__/you.matrix.test.tsx` (per `TeamFixPass.test.tsx:126` comment), `More.test.tsx` |
| C53 (`:90`) last-manager leave guard | `TeamFixPass.test.tsx` | No last, lone or orphan case | `more/__tests__/More.test.tsx:337` |
| C55 (`:92`) team at cap 20 | `TeamFixPass.test.tsx` | Its only "20" is a `setTimeout(…, 20)` (`:73`) | `Team.test.tsx` imports `TEAM_CAP` (`:18`); also `teamModel.test.ts` |

C52, C53 and C55 are probably covered, but the cited file is wrong. C36, C44, C32 and C25 have no real test: re-mark
them GAP. C29 (`:63`, "`flows/change/__tests__` (Copy)") names a folder, not a test. `change.flow.test.tsx` and
`pdates.*` mention "copy" but there is no Copy test file, so name the test that checks it.

**B3. "None silently omitted" (`CONTRACT.md:134`, `INVENTORY.md:108-109`) is false.** These inventory rows are not cited
by any contract row:
- **J14** finish person details (P3 `PersonFlow`);
- **S03** live one-off (10);
- **S09** archived with organisers (82): can an organiser see, restore or edit them?
- **S16** page with no member (1 today): only claim or invite reaches it, so it ties to B1.

J07, J12, J13 and S13 are covered only by implication (C04, C11, C34); cite their IDs. Not in the contract at all:
- the live redeem's `already_member` answers for any CURRENT role. A **contributor** who opens an owner invite stays a
  contributor, silently. C03 (`:33`) covers only the happy reading;
- the `link_failed` outcome on an e-mail page invite (seat kept, link failed).

## Non-blocking findings

**N1. S01 is not "weekly".** `INVENTORY.md:76` reads "live recurring (weekly) 45". By `recurrence_rule->>'mode'` the
45 split into:
- weekly 28;
- **monthly 6**;
- custom 1;
- **no rule 10**.

So J20/G-INV-1 (`INVENTORY.md:99`, `CONTRACT.md:109`) undercounts. Organisers already run 6 live monthly series with no
create path. C28 (`:61`) also needs a shape row: what does the Repeat sheet do on the 11 custom or no-rule series?

**N2. C31 is a false GAP.** `CONTRACT.md:64` and `:112` say "none". `p3/screens/__tests__/allDates100.matrix.test.tsx`
(FIXLIST F-27, DATES-100) exists and emulates the live `admin_event_workspace_p5` 100-newest cap. Re-mark C31 COVERED
in P3, and leave R1 as a GAP if R1 lists dates.

**N3. Contributor reach is 0.** Prod has **0** `contributor` rows in `entity_members` (any entity type). P7 rows (C36,
C44) are right to keep as the server rule, but rank them by that reach (0 today).

**N4. GAP rank 1 (C12) reach is overstated today.** `CONTRACT.md:107` cites "4 open invites; 13 of 51 pages already
have an owner". Prod: **0 of the 4 open invites** are to a page with an owner. Historically 1 used invite seated a
second owner on a page that already had one. The permission concern still stands as an owner decision, but under the
brief's "rank by counts" rule, B1 (35 unclaimable ownerless pages) outranks it.

**N5. Count drift since 2026-11-01** (not an error; re-run before merge):

| Count | Was | Now |
|---|---|---|
| Pages | 51 | 50 |
| Without an owner | 38 | 37 |
| With no member | 2 | 1 |
| Invites | 17 | 16 |
| Revoked invites | 2 | 1 |

Series counts match exactly: 758 total, 653 archived, 105 non-archived, every lifecycle x format cell, 571 empty
`organiser_ids` (0 non-archived), 6 multi-organiser (5 live, 1 ended), 12 drafts with no cover. No photo: 2 of 50
pages. No contact of any kind: 3 of 50. These close G-INV-5 except for the "no claim e-mail" shape in B1.

**N6. Server-rule wording.**
- `_assert_can_edit_series_p5` (live) matches `CONTRACT.md:14-15` exactly: admin short-circuit, empty or NULL
  `organiser_ids` admin-only, owner/manager via `_is_entity_member`, contributor refused (A06).
- `redeem_organiser_invite_v1` matches `:16-20`, including the team cap: `owner+manager+contributor >= 20` returns
  `team_full`.
- `claim_organiser_v1` is not cited anywhere (B1).

No "who can do it" cell was found wrong for the series edit rule.

**N7. Quality bar.** It is present (`CONTRACT.md:118-129`), it has 8 rows, and they are the brief's 8 rules.
- Q3-Q8 are mechanically checkable.
- Q7 and Q8 name `organiser-tap-targets.spec.ts` and `organiser-layout.spec.ts`. Both exist; whether they cover 320 px
  was not verified.
- Q2 ("a non-technical reader says each screen's purpose") is a judgement. Mark it OWNER-PHONE, or tie it to a
  copy-review step, so it is not read as automated.

## Verified

- Brief and PR files read in full. Contract row and status counts recounted by hand: 54 / 12 / 1 / 41 are correct.
- Every test or spec file named in CONTRACT.md exists on `main` (find per basename). `screens.matrix.test.tsx` is
  ambiguous: it exists in both `organiser/p3/screens` and `tickets`.
- Live bodies of `_assert_can_edit_series_p5`, `claim_organiser_v1` and the relevant parts of
  `redeem_organiser_invite_v1` (`already_member`, `team_full`, `link_failed`/`not_linked`) read via SELECT on
  `pg_proc`.
- All prod counts above came from read-only SELECT, counts only.
- The B2 findings come from grep plus reading test headers and `describe`/`it` names.

## Not verified

- No test was run. Rows I did not flag were only checked at file level (the file exists), not assertion by assertion.
  Spot-checked beyond B2: the arc1 invite spec `it` names match C01-C06 and C09 by line.
- `_assert_can_edit_occurrence_p5` was not re-read; only the series assert was.
- 100+ dates and cancelled-date counts (S11, S12) were not re-counted.
- No browser walk, so no check of the prod flag values (G-INV-6).

## Handover

- **Done:** this review, pushed on `claude/review-acceptance-contract-r1`.
- **Left for the builder of #1259:** fix B1 to B3, then N1, N2 and N4 (re-rank GAPs), then re-run the counts (N5).
- **Next:** the owner decides C12 (role on invite) and whether the 35 unclaimable ownerless pages get claim e-mails,
  get admin invites, or hide the claim card.
