# Plan: organiser-invite journey, Option B, production standard

## HANDOVER (2026-10-23, context gate): PLAN APPROVED BY OWNER; next session DISPATCHES
- **Owner approved:** this whole plan, plus both prototypes (linking, publishing). The owner wants SPEED: a big allowance that expires Monday 2026-10-26.
- **Speed decisions:**
  - (1) Dispatch ALL FIVE now, in parallel: W1, W2, W3, A1, A2. W2 is built against A1's agreed names (`invalid_phone` / `invalid_instagram`, the go-live keys) and merges only after A1 is applied.
  - (2) The owner applies A1 + A2 in ONE sitting.
  - (3) Walk each PR as it lands, not serially.
  - (4) Run the review worker for A1/A2 as soon as each pushes.
  - (5) Orchestrator on `/fast`.
- **Models (OWNER SAID SO, 2026-10-23, click):**
  - **Fable 5.1** (`--model claude-fable-5-1 --allow-fable`) for A1, A2, their independent review workers, and W1.
  - **Opus 5.5** (`--model claude-opus-5-5`) for W2 and W3.
- **Briefs:** each brief = its §4 slice + §3 standards + §5 release gates + the approved prototype link (linking https://claude.ai/artifact/3gL4uGiZLMX9QgQrNsUQnk; publishing https://claude.ai/artifact/RRXU7H3ZaLvD4PFnx14MAu; join = v3 Option B https://claude.ai/artifact/TYZuWuVfoSLc6MqyHWSB1G), and states which files the other four own.
- **Process:** read `~/.claude/docs/dispatch-checklist.md` first. Check the Vercel cap (3 Website pushes). Arm `watch-workers.mjs`.
- **Stray state from this session:**
  - The Bash tool's cwd moved to C:/dev/Website. Only a `git fetch` ran there; no writes.
  - Prototype sources are in this session's scratchpad: C:\Users\ecual\AppData\Local\Temp\claude\C--dev-wt-session-lock-guard\2fc6fee7-0849-4a10-9249-51b7854cf157\scratchpad (`profile-linking.html`, `publishing.html`, `walk2.cjs`, `walk3.cjs`).
- **NEXT-SESSION PROMPT:** "Read ~/.claude/plans/pasted-content-id-5f5b-read-claude-plan-rustling-planet.md (HANDOVER at the top). The plan is approved. Dispatch W1, W2, W3, A1, A2 in parallel per the handover's speed decisions and model choice, then monitor. Never apply or merge admin PRs."
(Rewrite of radiant-tinkering-coral.md per UPDATE 49. The owner chose Option B on 2026-10-23.)

## 1. Context
**The problem.** The owner's invite walk on 2026-10-23 broke (screenshots in ~/.claude/plans/walk-invite-2026-10-23/):
- the email is typed 3 times;
- the person lands on generic /auth with "No account found" and a role picker;
- "Not now" on the photo wall loses the invite for good.

**The goal.** An invited person joins an organiser team in one guided page and never makes a decision we already know. Full details are asked only when they publish. Phone numbers and Instagram names are stored one correct way everywhere.

**Settled decisions** (owner clicks, UPDATES 48-49; audit https://claude.ai/artifact/WSaqa8eVz1L86td7LPxxuz). Not reopened here:
- **Option B "Never leave the invite page"** (prototype v3 https://claude.ai/artifact/TYZuWuVfoSLc6MqyHWSB1G).
- **At join:** first name, city, dance role and photo. This is today's dancer rule, so the redeem gate is unchanged. One "Join <org>" tap is the consent moment.
- **Full details at PUBLISH** via the existing "Almost live" step (`series_go_live_check_v1` / `_profile_fields_p5`). All 16 fields are kept.
- **DJ and teacher:** asked once in "Almost live". A Yes needs a minimum: a DJ name and 1 genre, or 1 teaching style. This reverses B-DB1 `20261129550000`.
- **"It's live" screen:** offers more details through the existing `src/modules/areas/{dj,teacher}` editors.
- **Phone:** stored as E.164. **Instagram:** stored as the bare name. One rule on the Website and the server. Legacy values are normalised on their next save, never blocked.
- **Teacher public page:** returns real values.
- **#959** is folded into W1.

## 2. Evidence (read-only, 2026-10-23, prod stsdtacfauprzrdebmzg, counts only)

### Phones: 0 values break the rule
| Field | Filled | E.164 | `+` with spaces | No `+` | Bad |
|---|---|---|---|---|---|
| dancer.phone | 39 | 28 | 11 | 0 | 0 |
| dancer.whatsapp | 3 | 2 | 0 | 1 (8 digits) | 0 |
| organiser.contact_phone (42 public) | 43 | 37 | 5 | 1 (7 digits) | 0 |
| person.contact_phone (mirror of dancer.phone) | 39 | 28 | 11 | 0 | 0 |

### Instagram
| Field | Filled | URL form | @ form | Bare | Fails after normalising |
|---|---|---|---|---|---|
| dancer.instagram | 18 | 2 | 2 | 14 | 1 (34 chars) |
| organiser.instagram | 45 | **41** | 1 | 3 | 0 |

- `organiser.socials->instagram`: 2 rows. Both duplicate the column, so no unique data.
- `dancer.instagram_normalized` matches the normaliser on every row.

### DJ and teacher
- The roles are `djing` / `teaching`. `is_active` can be NULL (3 rows), which counts as not active.
- Active: 39 DJs and 123 teachers. **0 DJ rows have a genre**, and 118 of 123 teachers have no style.
- Only **2 DJs + 2 teachers have a login AND an organiser seat** (`entity_members`). The new publish minimum can reach at most these 4 people today.

### Sign-up and invites
- **Sign-up:** `hook_before_user_created_v2` with `dancer_area_open` = true, so sign-up is open except for 12 blocked email domains (403, "Sign-up with this email provider is not accepted").
- **Redeem outcomes:** `ok`, `already_member`, `used`, `expired`, `revoked`, `invalid`, `email_unproven`, `email_mismatch`, `rate_limited`.
- **Bind outcomes** (`bind_organiser_invite_email_v1`): `not_open`, `already_bound`, `rate_limited`.

### Reusable code on Website main
- `src/lib/phoneRules.ts`: per-country lengths, trunk-zero stripping, `isValidE164`.
- `src/lib/countryDialCodes.ts`: the world list with pinned countries.
- `RafflePhoneInput.tsx`: a picker that emits E.164. Shipped and tested (`phoneRules.test.ts`).
- `src/lib/organiserLinkLabels.ts` `extractIgHandle`.
- `OrganiserProfile.tsx:1020` already builds a link from a bare name.
- Auth: `AuthStepper.tsx` (OTP), `src/lib/auth-otp-routing.ts` (`OTP_RATE_LIMITED_MESSAGE`, refusal classifiers).
- Invite: `src/modules/admin-organisers/InviteRedeemPage.tsx` + `inviteRedeemApi.ts`.
- `input-otp`, `react-hook-form` and `zod` are already dependencies.
- E2E: `tests/e2e/arc1-invite-redeem-walk.spec.ts`; phone-size specs in `tests/e2e-phone/`.

## 2b. People who are ALREADY on the system (most invitees). Papacito duplicate, diagnosed
**What happened (read-only, 2026-10-22):**
- The Sensual Vibes invite was issued at 17:59 as a **page invite with an email**. It did not say "this is for Papacito".
- At 18:02 he signed up with his sensualvibes.co.uk email. The sign-up made an `auto_stub` profile ("Jinder") and he redeemed the invite as owner.
- His April profile **Papacito** (admin-made, photo, DJ role, on the Sensual Vibes team list) was never linked. **Both now sit on the team list.**

**Why nothing linked them:**
1. The automatic claim (`claim_my_dancer_profile_v1`, via `_dancer_profile_link_matches_v1`) links only when the pre-made profile's email equals the login email. **Only 1 of 170** pre-made profiles without a login has an email.
2. The page invite carries no person. `admin_invite_person_v1(profile, email, organiser)` does (it writes the email onto the profile so the claim fires), but it was not the path used.
3. Papacito's profile is backed by its own **never-used login** with a different email, so even "Invite person" refuses it (`email_in_use`), and the claim treats it as not claimable. **4 profiles** have this shape.
4. **Option B trap:** the Website runs the claim only in `/auth/callback` (`src/lib/claimMyDancerProfile.ts`, test `DancerInviteSelfClaim.test.tsx`). Verifying the code inline on /invite skips that page, so without a fix B would duplicate EVERY pre-made invitee.

**Scale:**
- 52 people are on organiser team lists, and **49 have no login**. These are the invitees.
- 41 of 50 organiser pages are unclaimed.
- `_my_dancer_profile_id_v1` (used by the join gate) already prefers the claimed profile. So once linked, a complete pre-made profile skips About you entirely: Papacito would have joined in 3 taps.

**OWNER APPROVED (2026-10-23, after walking prototype https://claude.ai/artifact/3gL4uGiZLMX9QgQrNsUQnk, source scratchpad `profile-linking.html`):**
- the linking system as shown: "Who is this for?" first;
- linked on join, About you skipped when complete;
- the placeholder-login email switch;
- the safety stop with "We've told Ricky";
- the daily duplicate check;
- the two-step repair screen.

That prototype is the reference for W1/W3/A2.

**Prototype for W2/A1, OWNER APPROVED 2026-10-23:** https://claude.ai/artifact/RRXU7H3ZaLvD4PFnx14MAu (scratchpad `publishing.html`). It covers:
- the Instagram and phone fields;
- the "Do you also DJ or teach?" question in "Almost live";
- the "It's live" optional offer;
- the teacher page before/after.

Headless walk at 390 passed (every rule, no errors, no overflow).

**Error screens: no prototype (owner decision 2026-10-23).** The W1/W3 workers write the wording to §3's copy rule. The owner sees every error screen as a screenshot in the W1 and W3 review packs before merge.

The Papacito heal (H1) still waits for the owner to say "heal Papacito".

**The rule this job enforces:** *an invite always names the person, and the join lands the login on that person's existing profile, or stops and says why. Never a silent second profile.*

## 3. Engineering standards (apply to every slice)
- **One source of truth per rule.**
  - Dancer completeness: `profileCompletion.ts`.
  - Phone: `phoneRules.ts`.
  - Instagram: a new `src/lib/instagramHandle.ts` that wraps `extractIgHandle`.
  - The server mirrors each rule, and a **shared fixture file of cases** is run by both the Website unit test and the migration self-verify (parity by test, not by copy).
- **Enforcement in the database, not only in RPCs.** The phone/IG rule is a BEFORE INSERT OR UPDATE trigger per table. It fires on value change only: an `IS DISTINCT FROM OLD` test inside the body, never `UPDATE OF` (set-list membership trap). So every writer is covered (RPCs, admin, mirrors, future code), and an unchanged legacy value always passes.
- **No new heavy dependency.** No libphonenumber: we reuse the curated rules already in production for the raffle (bundle size decision recorded in `phoneRules.ts`).
- **Accessibility:** WCAG 2.2 AA.
  - Labels on every field.
  - `autocomplete` on each field: `email`, `one-time-code`, `tel-national`, `given-name`.
  - `inputmode` set; a pasted 8-digit code fills all boxes.
  - Focus moves to the new step's heading; errors in an `aria-live="polite"` region.
  - Taps of 44px or more, contrast of 4.5 or more, and `prefers-reduced-motion` respected.
- **Security:**
  - No email enumeration: one `signInWithOtp({ shouldCreateUser: true })` path for new and returning people, with no `account_exists_by_email` call.
  - The invite token never goes to Sentry, logs or analytics (scrubbed), and `Referrer-Policy` is checked on /invite.
  - The server binds the email before the code is sent.
  - Redeem is idempotent: `already_member` shows the success screen, and the Join button is disabled while pending.
  - A 60-second resend cooldown uses the existing rate-limit copy.
- **Copy:** plain English, in one copy module per screen. Every error says what the person can do next, never a raw code.
- **Observability:** Sentry tags each failure with the invite step and outcome code (no PII). The release checklist includes a 48-hour Sentry check.
- **Rollback:**
  - Website: Vercel "promote previous deployment" (instant).
  - Admin: the A1 PR ships `rollback.sql`, which restores the prior function bodies and drops the new triggers. It is reviewed with the PR and never applied unless the owner names it.

## 4. Slices

### W1 · Website, normal lane: Option B join on /invite (replaces #959)
**State machine.** The step is derived from server truth on every load, never from local state, so a reload, the back button or a second device all resume correctly.

| State | Derived from | Screen |
|---|---|---|
| `checking` | loading the preview | skeleton |
| `dead` | preview `used` / `expired` / `revoked` / `invalid` | why + "Ask <inviter> for a new link" |
| `email` | no session | invite card + email box |
| `code` | code sent (`?step=code&email=`) | 8 boxes, "Sent to <full email>", change email, resend in 60 s |
| `about` | session, profile incomplete | first name, city, role chips, photo (reused `/finish-profile` parts) |
| `join` | session, profile complete, not a member | "Join <org>", one tap |
| `done` | member (`ok` or `already_member`) | go to `/account/o`, "You're on <org>'s team" |
| `wrong_account` | `email_mismatch` | "You're signed in as X; this invite is for Y" + sign out and continue |

- **Person-bound invites (the majority):**
  - The invite card shows the existing profile ("Hi Papacito", photo, city) with the line "This is your profile on Bachata Calendar; joining links it to your email".
  - Right after the code is verified, `claimMyDancerProfile()` runs **before** anything reads the persona. This is the same order `/auth/callback` uses; there is a test for it.
  - When the claim returns `linked` / `already_linked`, About you is skipped if the profile is complete, and pre-filled if not.
  - When it returns `ambiguous` / `no_match`, or the server returns `not_linked`, a screen says "We couldn't join your profiles automatically. We've told <inviter>, who will sort it out and let you know." The join is never completed into a new duplicate.
  - "We've told" is real: the `not_linked` attempt is recorded (`organiser_invite_redeem_attempts`) and appears in the W3 duplicates alert. No automatic email in this job.
- **Progress:** a "1 of 3" bar over email/code, about and join. A complete account skips `about`.
- **Roles:** Dancer and Organiser are written silently through the sign-up path's existing writer. No role picker, no tabs, no "No account found".
- **`DancerProfileGate`:** never redirects /invite (from #959; its test `inviteSelfBoundGate.test.tsx` is folded in).
- **Refusals that each get a screen:** blocked email domain (403), `rate_limited`, a network error (retry), and `email_unproven`.
- **Tests:**
  - A state-machine table test: every row above x {new, returning incomplete, returning complete, already member}. Red first on the old journey.
  - RTL component tests per screen.
  - A Playwright spec extending `arc1-invite-redeem-walk.spec.ts` on the E2E project.
  - A phone spec at 390x844 in `tests/e2e-phone/`.
- **Design record:** `docs/design/<pr>.md` (stage 2 pick = v3 Option B; stages 4-6 by hand, stated in the pack).

### A1 · Admin, careful lane: one migration PR; the owner applies
1. **`_role_requirements_v1`:** djing = `dj_name` + at least 1 genre; teaching = at least 1 style.
2. **`series_go_live_check_v1`:** adds those keys for the publishing person when the role `is_active IS TRUE`.
3. **`normalize_phone_e164_v1(text)`:**
   - Strips spaces, dashes and brackets.
   - Requires `^\+[1-9][0-9]{7,14}$` (equal to the Website `isValidE164`).
   - Raises `invalid_phone` with a hint.
4. **Instagram:** extend `normalize_instagram_handle_v1` with a validator for edge dots, `..` and the 30-character limit (`invalid_instagram`).
5. **Triggers** (change-only, see §3):
   - `dancer_profiles` (phone, whatsapp, instagram);
   - `organiser_profiles` (contact_phone, instagram; stop the `socials->instagram` copy);
   - `organising_role_details.contact_phone`;
   - the `person.contact_phone` mirror stays in step (its writer is traced).
   - The guard asserts `tgenabled IN ('O','A')`.
6. **`get_public_teacher_detail_v1`:** returns the real `teacher_role_details` values (public route, so `/code-review low` is required). Note: the cached public pages refresh on their normal revalidation, so state the expected delay.
7. **Proof:**
   - md5 pins on every replaced body.
   - Self-verify matrices:
     - go-live: who x role x missing key;
     - phone/IG: the shared fixture file, plus the legacy no-`+` and 34-character cases passing unchanged and failing when changed.
   - A `check_*` guard (positive, negative, fidelity, non-vacuity), proven with rolled-back mutants.
   - Migration Proof green.
   - An independent review worker.
8. **Reader trace in the PR body:** every reader of `organiser_profiles.instagram` and `contact_phone` (Website pages, event-page contacts, admin, public RPCs), each shown handling a bare name and E.164.

### W2 · Website, normal lane: dispatched after the A1 apply is confirmed
- **`PhoneInput`:** extracted from `RafflePhoneInput` into `src/components/forms/PhoneInput.tsx`. The raffle becomes a thin wrapper and its tests stay green.
- **`InstagramInput`:** accepts @name, a name or a link; shows the bare name and a "tap to check it's you" link.
- **Where they go:** dancer whatsapp/phone and organiser contact_phone/instagram editors. A legacy value is shown raw until edited.
- **Server refusals:** `invalid_phone` / `invalid_instagram` map to field errors.
- **"Almost live":** "Do you also DJ? Teach?". A Yes opens the minimum inline. The answer writes `person_roles`, so the question never repeats.
- **"It's live":** an optional link into the DJ and teacher area editors.
- **Tests:**
  - tables over role combinations x missing keys;
  - phone/IG fixture parity with A1;
  - the go-live list: no text points at a missing control, and a save with nothing changed sends nothing;
  - phone specs at 390.

### W3 · Website, normal lane: owner side, "an invite always names the person"
- Admin "Invite to manage <page>" starts with **"Who is this for?"**:
  - the page's Leader is pre-selected (the existing `fetchPageLeader` / `PageLeader`);
  - other people on the team list;
  - search (`admin_search_people_v1`);
  - or "Someone new, not on Bachata Calendar yet".
- An existing person goes through `admin_invite_person_v1`. Only "someone new" makes a person-less page invite.
- The refusals (`email_in_use`, shadow login) explain what to do, never a dead end.
- **Possible duplicates** (as in the approved prototype):
  - An alert on the admin home, computed live from A2's check each time it opens: "1 possible duplicate". It includes paused `not_linked` joins.
  - "Same person?" shows both side by side, with "Not the same person" (dismissed for good).
  - "What will change" lists the changes in plain words from A2's dry-run.
  - A second confirm, then "Joined".
- Files: `src/modules/admin-organisers/InvitePerson*.tsx`, `invitePerson*.ts`, `inviteModel.ts`, plus a new `src/modules/admin-organisers/duplicates/*`. W1 owns `InviteRedeemPage.tsx` / `inviteRedeemApi.ts` (no overlap).
- **Merge order:** W3's invite part works on today's `admin_invite_person_v1`. The shadow-login invite and the duplicates screens go live only after A2 is applied; until then the screen says "available soon", never a broken button.
- **Tests:**
  - a table over leader {none, one, several} x person {unclaimed with email, unclaimed without email, shadow login, already claimed, new};
  - duplicates: {none, one, dismissed, not_linked} x confirm {cancel, confirm}; nothing is sent before the second confirm.

### A2 · Admin, careful lane: identity on join (the owner applies; can share A1's PR only if the review worker agrees; default separate)
1. **`redeem_organiser_invite_v1`:** for an invite created by `admin_invite_person_v1` (store the target as a new `organiser_invites.person_profile_id`, backfilled from the profile email for open invites):
   - run the existing claim inside the redeem, the same pattern as `redeem_dancer_invite_v1`;
   - return `not_linked` (invite stays open, seat NOT granted) if the login did not land on that profile.
   - **This makes a duplicate impossible by construction, whatever the Website does.**
2. **Shadow-login profiles (4):**
   - Teach `admin_invite_person_v1` to accept a target whose own login has **never signed in**, by moving that unused login's email to the invited email. Then the code signs the person into the existing account: no second login, no merge.
   - Needs the auth admin API, so: an admin-only edge function with a service role from env, refusing any login that has ever signed in, audited via `admin_settings_audit_insert`.
3. **Duplicate guard `check_invitee_duplicates_v1`** (read-only, runs in CI against the replay DB and on demand on prod): any login whose `auto_stub` sits on the same organiser team list as an unclaimed pre-made profile. It flags Papacito-type cases within a day instead of when the owner spots them. Positive, negative and non-vacuity proven.
4. **`admin_join_duplicate_people_v1(p_keep_profile, p_fold_profile, p_dry_run)`** (admin-only):
   - Dry-run returns the plain change list the W3 screen shows.
   - Real run, all in one transaction:
     - the keep profile is claimed by the real login;
     - seats stay;
     - the fold profile's team-list rows move or drop if duplicated;
     - its roles and empty fields fill gaps on the keep profile, never overwriting;
     - the stub is retired (archived, never deleted);
     - the unused login is disabled;
     - an entry goes in the merge log.
   - `admin_merge_person_entities_v1` is reused inside it for the entity references.
   - A dismiss table backs "Not the same person".
5. **Self-verify matrix:**
   - invite kind {page, person, person+shadow} x account {new, existing stub, existing claimed elsewhere} x claim result;
   - join-duplicates: dry-run writes nothing; a real run is idempotent; it refuses two logins that have both signed in (two real people need the owner, not a button).

### H1 · Heal Papacito: a prod-data write, ONLY when the owner names it in chat
- **Target state:** his real login (`2abd433b…`, owner seat on Sensual Vibes) holds the Papacito profile (`ae3bffbb…`, photo, DJ role). The Jinder stub is folded in, its team-list row dropped and the stub retired. The unused April login is disabled.
- **Process:** after A2 is applied, using `admin_join_duplicate_people_v1`. The owner either does it from the W3 screen, or says "heal Papacito" and I run the dry-run, show it, and run once after their yes. Read-back after.
- Never done by a worker.

### Later arc (separate plan)
- Self-sign-up without an invite by someone who already has a profile: "Already listed? Find your profile" → a claim request → admin approval (existing `profile_claims`). It needs identity proof, so it is not in this job. The A2 check and the W3 alert catch these cases meanwhile.
- One team list: `entity_members` vs `organiser_team_members`.

## 5. Order, dispatch, release gates
1. **Dispatch together: W1, W2, W3 (`--lane normal`) and A1, A2 (`--lane careful`). Models per the HANDOVER at the top** (Fable for A1, A2, their reviews and W1; Opus for W2 and W3). File sets do not overlap: W1 is the redeem page, W2 is the phone/IG inputs and "Almost live"/"It's live", W3 is the invite creation and duplicates, A1 is go-live/phone/IG/teacher, A2 is invites/claim. W2 merges after A1 is applied.
   - **W1 merges only after A2 is applied**: the server guarantee comes first, and W1's `not_linked` screen depends on it.
   - H1 waits for the owner's word.
   - Read `~/.claude/docs/dispatch-checklist.md` first.
   - Check the Vercel push cap and the open Website PRs touching `/invite` (6 live sessions are on Website `feat/event-truth-p1p3`).
   - Arm the `watch-workers.mjs` Monitor.
2. **Release gate for each PR (all of these, in order):**
   - a. every CI job green; the worker's per-job table;
   - b. I read the diff against main's head;
   - c. A1 and A2: the independent review worker is clean;
   - d. a walk at 390x844 on the preview with real data, with measured numbers (rects, `elementFromPoint`, contrast). Shapes: a new person, **a pre-made profile without an email (the Papacito shape), a pre-made profile with a shadow login**, a returning incomplete dancer, an existing organiser, an expired link, the wrong account, and a blocked domain. Pass = one person row per human afterwards, counted read-only. Use a FRESH invite from the owner; +join1 is never reused without asking;
   - e. a review pack with Verified / Not verified.
3. **Merges:**
   - W1/W2/W3: I merge only if every rule in CLAUDE.md is met.
   - A1/A2: the owner approves, merges and applies. Afterwards a read-only check of the ledger, bodies, ACL, triggers and a re-run of the survey counts.
4. **After each Website merge:** re-measure the live page, check Sentry over 48 hours, then the owner's phone test (last).

## 6. Risks and how they are handled
| Risk | Mitigation |
|---|---|
| Organiser Instagram readers expect a URL (41 rows) | Reader trace in A1 is required before merge; the change happens on the next save only, so there is no mass change |
| A legacy phone or Instagram value blocks an unrelated save | The change-only trigger; self-verify cases for the 3 known legacy shapes |
| **A pre-made person gets a second profile (Papacito)** | W3 makes every invite name the person; W1 runs the claim before any read; A2 refuses to grant the seat unless linked; the A2 duplicate guard catches anything else |
| Moving a shadow login's email takes over an account | Only a never-signed-in login, admin-only, audited; refused otherwise; mutant-proven |
| An invitee loses their place | State derived from the server; the token stays in the URL; Playwright reload test |
| An invitee is on a blocked email domain | A dedicated screen with a WhatsApp help link (existing `SIGNUP_HELP_WHATSAPP_URL`) |
| The raffle regresses during the `PhoneInput` extraction | The raffle keeps its tests; a wrapper, not a rewrite |
| The publish minimum surprises an existing organiser | At most 4 people today; inline fields, never a dead end |

## Boundaries
- Never apply or merge admin PRs.
- No prod writes. Everything in this plan so far was read-only.
- Workers are dispatched only through the dispatch scripts. Bot-authored PRs. Never `--no-verify`.
