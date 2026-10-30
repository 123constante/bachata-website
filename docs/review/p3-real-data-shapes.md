# P3 organiser screens vs real production data shapes

*Read-only audit, 2026-10-30. Branch `claude/review-p3-real-data-shapes` from `main` @ `1dc1660`.
DB: prod `stsdtacfauprzrdebmzg`, SELECT counts only (no personal data, no writes).
Code paths are relative to `src/modules/organiser/` unless they start with `src/`.*

Class: AUDIT. No src edits. No browser walk was done; see "Not verified" at the end.

---

## 1. Shape survey (prod counts)

### Organiser pages (`organiser_profiles`, 49 rows)

| Shape | Count |
|---|---|
| `lifecycle_status = live` | 49 (no draft / pending / rejected / archived page exists) |
| `is_active` NULL / true / false | ~45 / ~4 / 0 |
| Claimed (`claimed_by` set) | 7; each owner has exactly 1 page |
| Owner has a `dancer_profiles` row | 5 of 7 (**2 have none**) |
| Page with no avatar | 1 (unclaimed) |
| Page with no city | 0 |
| Active series per page | 0 (1 page), 1, 2-5, 6-20 (4 pages); none >20 |
| `organiser_onboarding_progress` rows | **0** (every owner reads as fresh) |

### Team (`organiser_team_members`, active)

| Shape | Count |
|---|---|
| Pages with 0 active members | 0 |
| 1 member | most pages |
| 2-5 members | ~10 pages |
| >5 | 0 |
| Roles | Leader 55, Member 4 |
| `member_profile_id` set / `person_entity_id` set | 59 / 0 (ids resolve in both `dancer_profiles` and `member_profiles`) |

### Series (`event_series_p5`, non-archived = 105)

| lifecycle x format | Count | Date shape |
|---|---|---|
| live recurring | 44 | 30 with 11-100 future; 1 with **>100 total dates (53 future)**; 5 all past; 2 with 11-100 total, none future |
| live one_off | 11 | **10 with their only date in the past**; 1 future |
| live course | 6 | **5 all past**; 1 future |
| live festival | 8 | 1 date each; 2 past |
| draft recurring | 8 | 7 with 11-100 future dates, 1 with 1 |
| draft one_off | 4 | **1 with 0 dates** |
| draft course | 1 | 11-100 future |
| ended recurring / course | 13 / 8 | all past |
| paused one_off / recurring | 1 / 1 | future dates |

- Dates: 3,277 scheduled, 150 cancelled. ~22 live/draft series have at least 1 cancelled date. No series is all-cancelled.
- `removed_dates` non-empty: 16 series.
- 2 organisers on one series: 6 series.

**Recurrence rules (non-archived):**

| Rule shape | Count |
|---|---|
| NULL | 55, of which **9 live recurring**, 13 ended recurring, 8 ended course, 1 draft recurring |
| weekly, end none, `interval` 1 | 26 |
| weekly, end none, no `interval` key | 8 |
| weekly `until_date` / `after_count` | 3 / 6 |
| monthly `nth_weekday` | 5 |
| monthly `weekday_except_last` | 1 |
| monthly, other | 1 |
| custom `{dates,mode}` | 1 (live recurring) |
| `interval` >= 2 | **0** |

### Programme / sessions (non-archived)

| Shape | Count |
|---|---|
| Series with 0 programme items | 9 (4 one-off, 4 recurring, 1 course) |
| Series with items but no people at all | 25 |
| Series with at least 1 item with no people | 61 |
| Series with per-date added sessions | 15 (all recurring) |
| People roles | teacher/teaching 208, dj/djing 78, teacher/mc 1, dancer/performing 1 |

### History RPC

`organiser_series_history_v1` pages with a strict `< p_before` timestamp cursor.

---

## 2. Per-screen findings

### Home (`p3/screens/HomeScreen.tsx`, `p3/data/home.ts`)

- **Handled:**
  - Archived series are filtered out (`shared/homeModel.ts:49`, `home.ts:127`).
  - The 6 two-organiser series are de-duplicated (`home.ts:123-128`).
  - Live series with every date past read "Finished" or "All classes done" and move to Past (`model/status.ts:35`, `home.ts:179`).
  - Live recurring with nothing coming up reads "Nothing coming up" and adds a Needs-you item (`status.ts:34`, `home.ts:188`).
  - Paused reads Hidden (`status.ts:29`).
  - The draft one-off with 0 dates reads "No dates yet" with a draft nag (`home.ts:74,196`).
  - `next_dates` holds scheduled dates only (`homeModel.ts:35-39`).
  - 6-20 series show 4 rows plus "See all N" (`HomeScreen.tsx:374-381`). There is no 100-row cap, because the RPC returns a single JSON value.
- **Gap (latent, 0 rows today):** a draft whose dates are all past would still read "No dates yet" (`home.ts:74`).
- **Doc drift:** `shared/lifeLabel.ts:6-9` says `upcoming_count` includes cancelled dates, but `homeModel.ts:35` says it does not.

### Grace banner (`p3/screens/GraceBanner.tsx`)

- **Gap, will hit all 7 claimed owners.** The progress table is empty and the status RPC reads it, so `contact_confirm` is very likely reported missing for every existing owner. They then see "Finish your details to create and edit events, N things left" (`GraceBanner.tsx:85-95`, `graceModel.ts:9`) on every visit, although they finished R1. "Hide for today" lasts only the day.
- **Gap (latent):** "things left" counts the person's items plus the first incomplete page's only (`:24,29`). It would undercount with 2 or more pages, but no owner has 2 today.

### Events list (`p3/screens/EventsScreen.tsx`)

- **Handled:** grouped current / Hidden / Past (`home.ts:211-214`). Paused, ended and all-past series each land in the right group.

### Event page (`p3/screens/EventPage.tsx`, `p3/data/eventPage.ts`)

- **Handled:**
  - On the >100-date series, all 53 coming dates are in the 100-row read. `readIsFull` is false, the partial note is shown, and the course class count is suppressed (`events/eventModel.ts:332`, `eventPage.ts:120,168`).
  - Cancelled dates are struck through (`eventPage.ts:154`, `EventPage.tsx:104`).
  - Festival programme is read-only, and Add / Skip are greyed (`EventPage.tsx:68,84`, `model/dates.ts:204`).
  - Weekly with no `interval` key defaults to 1 (`model/repeat.ts:145`).
  - Monthly, `until_date` and `after_count` rules are read correctly (`repeat.ts:149-170`).
- **Gap, 9 live recurring series.** The NULL rule makes the Repeats row read "Doesn't repeat" (`model/repeat.ts:288`, `EventPage.tsx:217`) on an event that has weekly dates. The same wrong card shows on the 13 ended recurring series and 8 ended courses.
- **Gap, 1 draft one-off with 0 dates: a dead end.**
  - Coming up shows the `oneOffAdd` copy, "Move it, or make a new event" (`model/dates.ts:152,205`, `EventPage.tsx:117`), but there is no date to move and Add a date is disabled.
  - Status "Put it live" is greyed with "Add a date coming up first." (`eventPage.ts:253`). That copy points at a disabled control, which CLAUDE.md DoD step 2 forbids.
  - Any draft one-off whose only date has passed would be stuck the same way.
- **Minor:**
  - "and N more dates coming up" counts cancelled dates (`eventPage.ts:146,159`).
  - A raw `·` sits in the source at `eventPage.ts:142`, against the HTML-entities rule.
- **Latent (0 rows):** `isRuleDate` accepts only interval 1 (`shared/seriesModel.ts:310`). A fortnightly series would tag every date "Not the usual day".

### Status sheet / Go live (`p3/screens/StatusSheet.tsx`, `statusRows` at `eventPage.ts:244`)

- **Handled:**
  - The "Put it live" gate checks for a coming date, then a cover, then sessions (`eventPage.ts:250-256`). This fits the 7 draft recurring series.
  - Live and paused series get Hide / Show, End and Remove.
  - Ended series get one greyed row with a reason (`:258-259`).
  - "Stop repeating" is hidden for a NULL or custom rule (`:269`).
- **Friction:** the keep list on the >100-date series has 53 checkboxes (`:364`).
- **Go live for the organiser page** (`p3/onboarding/pageModel.ts:359-391`): all 49 pages are live, so the state is 'live' and Review shows "Go to Home". **Handled.**

### Cancel event sheet (`p3/screens/CancelEventSheet.tsx`)

- **Handled:** it is only reachable for a live one-off with one date (`cancel.ts:46`). Retries reuse the same key, and an already-cancelled date is reported as such (`:35,45`).
- **Gap (copy):** `CANCEL_WHY.cancelled` sends the organiser to "the current organiser area" (`cancel.ts:22`), but P3's own date sheet has "Bring it back".
- **Gap (latent):** an empty reasons list renders no buttons and no message (`:91-99`).

### All dates (`p3/screens/AllDatesScreen.tsx`, `p3/data/dates.ts`)

- **Handled:**
  - The 30-date cap greys Add / Bring back with a reason (`model/dates.ts:137`).
  - Empty filters say what to do (`dates.ts:103-117`).
  - The partial note shows on the >100-date series (`AllDatesScreen.tsx:47`).
- **Gap, the >100-date series:** the Past count chip shows the held count with no partial marker.
- **Gap, up to 16 series with `removed_dates`:** breaks are listed only when they fall on a weekly rule (`dates.ts:62-63`). On NULL, monthly or custom rules they never show, so "Put this week back" can't be reached.

### Date sheet (`p3/screens/DateSheet.tsx`, `model/dates.ts`)

- **Gap, 9 live recurring with a NULL rule:** Skip is refused with "Only a weekly pattern has break weeks" (`model/dates.ts:114`) on an event the organiser knows is weekly.
- **Friction, the >100-date series:** the taken-days check for Move / Add reads the capped list (`data/dates.ts:129`). The server refuses a clash, but only after the tap.
- **Latent (0 rows):** with interval >= 2, Skip gets the wrong copy (`model/dates.ts:115`).

### Sessions (`p3/screens/SessionSheet.tsx`, `p3/data/sessions.ts`, `model/programme.ts`)

- **Handled:**
  - 0 items: "Add a session" works and the date view says "No sessions yet" (`SessionSheet.tsx:115,326`).
  - Items with no people read "Nobody yet" (`:249`).
  - Festival and ended series are fully greyed with reasons (`programme.ts:236-237`).
  - Per-date added sessions: "Every date" is greyed and only "Remove from this date" is offered (`SessionSheet.tsx:53,154,164`, `programme.ts:273`).
  - Unknown session kind is shown read-only (`:28-36`).
  - "Just this date" on the >100-date series defaults to the earliest held date, which is a real coming date, since all 53 are held (`:54-55`).
- **Minor:** a one-off is offered both "Every date" and "Just this date".

### Line-up (`p3/screens/LineupSheet.tsx`)

- **Handled:**
  - teacher/teaching and dj/djing rows are editable (`:64`).
  - The 1 MC row and 1 performer row are read-only and preserved on save (`:62`, `data/sessions.ts:153`, `shared/programmeModel.ts:273-278`).
- **Gap (edge):** one person in two roles on a session loses both rows when one is removed on an every-date save (`data/sessions.ts:153`).
- **Friction:** the 12-person cap is enforced only at save, as an error (`shared/programmeModel.ts:454`).

### Repeat rules, W3c (`p3/screens/RepeatSheet.tsx`, `model/repeat.ts`)

- **Handled, and nothing is overwritten by accident:**
  - Weekly rules, with or without `interval`, open on the stored rule (`repeat.ts:142-156`). An untouched sheet sends nothing (`:244`).
  - `until_date` and `after_count` are handled, and a past end date blocks the edit with a reason (`:150-151,231`).
  - The 5 monthly `nth_weekday` rules are editable (`:158-171`).
  - The 1 `weekday_except_last` rule and the 1 custom rule open read-only with "Only the team can change this pattern" or "Dates you pick" (`:121-122,289,292`). The custom series is recurring, not a course, so the course-before-custom check at `:120` doesn't fire.
- **Gap, 9 live recurring with a NULL rule:**
  - The sheet opens editable with "It doesn't repeat yet. Pick the days to make it repeat." (`repeat.ts:122,362`, `RepeatSheet.tsx:220`) and an empty weekday draft.
  - Saving writes a new rule. The dry-run preview lists removals first (`RepeatSheet.tsx:236`), so data is safe but the copy is wrong.
- **Gap (copy), 21 ended series with a NULL rule:** read-only "This has finished", but the card still says "Doesn't repeat" (`RepeatSheet.tsx:205`).
- **Minor:** the course line never reads `course_total_sessions`. It falls back to counting held dates (`repeat.ts:376-388`).

### History (`p3/screens/HistoryScreen.tsx`, `p3/data/history.ts`)

- **Handled:**
  - Pages of 50 with a button (`history.ts:80-90`, `HistoryScreen.tsx:224`).
  - A failed older page keeps the rows already shown (`:179,223`).
  - Malformed rows are dropped and counted (`history.ts:58-67`).
- **Gap (plausible):** the RPC cursor is a strict `< p_before` timestamp. A bulk command that writes many audit rows with the same `at` across a page boundary would drop rows. A tie count was not measured.

### Details / Prices / EditTray / DateFieldSheets

- **Handled:** they don't depend on these shapes. Untouched saves send nothing (`model/saveModel.ts:43`, `data/prices.ts:64-66`). A festival shows only the ticket-link option (`data/prices.ts:33`).

### Onboarding / Welcome (`p3/onboarding/OnboardingFlow.tsx`, `PersonFlow.tsx`, `personModel.ts`, `pageModel.ts`)

- **Gap, hard dead end for 2 of 7 owners (and every brand-new user without a dancer row):**
  - `my_dancer_edit_v1` refuses `no_profile`, and `parseWizardDancer` throws without `profile_id` (`wizard/dancerApi.ts:24`).
  - Every person step and the Review rows that open one show "We couldn't load your details. Try again." (`OnboardingFlow.tsx:215-216`). Retry fails the same way, and `readFailCopy` knows only `area_closed`.
  - `/you/details` hits the same dead end (`PersonFlow.tsx:69-76`).
  - `heldFrom` would cope with a null dancer (`personModel.ts:143`), but nothing passes it one.
- **Handled:**
  - Welcome greets with an empty first name, not a hang (`OnboardingFlow.tsx:198,308`).
  - With a dancer row, the person steps prefill (`personModel.ts:143-160`). Teaching levels never prefill (`:156`).
  - A page with no city or logo goes to its step (`pageApi.ts:87-91`, `pageModel.ts:105,270`).
  - Existing owners are NOT routed to `/start` at sign-in (`src/lib/auth-otp-routing.ts:166,184`).
- **Gap, two "things left" numbers.** You and the page editor count from `my_profile_progress_v1` (`p3/you/YouScreen.tsx:81-102`, `page/index.tsx:18-27`). The banner and Review count from `organiser_onboarding_status_v1`. One fact on two screens from two sources breaks DoD step 2.

### You / Account (`p3/you/YouScreen.tsx`, `youRows.ts`, `AddPageScreen.tsx`, `page/index.tsx`)

- **Handled:**
  - 1 page: no Switch row, "Add another page" shows, and "Just you" for a team of 1 (`youRows.ts:41,61,70`).
  - No avatar shows initials (`YouScreen.tsx:49`).
  - Role labels and the Live tag are right (`:45-55`).
- **Gap, 0-page users (every brand-new organiser):** opening the You tab directly says creating a page "needs an invite… Message us" (`YouScreen.tsx:110-113`, and the same at `page/index.tsx:56-60`). Home's Add a page offers claim and find (`HomeScreen.tsx:56`, `AddPageScreen.tsx:25,49-57`). The two screens contradict each other, and You has no claim row.

### Team / Hand over / Switch / Welcome / Done

- **Handled:**
  - Team of 1 owner: no Leave, no self-Remove, no self-Hand over (`shared/teamRules.ts`, `teamModel.ts:234`, `Person.tsx:71,101`).
  - Add is on under the cap of 20 (`teamModel.ts:209`).
  - Hand over with nobody eligible says "No one can take over yet" and offers Add (`flows/handover/ToWhom.tsx:24-32`).
  - Switch is only reachable with 2+ pages (`switch/index.tsx:59-91`).
  - Welcome without `?o=` redirects Home (`switch/Welcome.tsx:30`).
  - Done redirects on reload (`flows/Done.tsx`).
- **Partly handled:** `profileId` null greys the public toggle with "Finish your dancer profile first" (`team/PublicToggle.tsx:27,55`), but there is no link to do it. This affects the 2 owners with no dancer row.
- **Gap (plausible), pages with 2-5 public Leader/Member rows:** the team list shows access seats from `organiser_team_v1` (`team/useTeamContext.ts`), so a page with a public roster can still read "Just you".
- **Checked and probably fine:** the subagent worried that the public toggle matches `member_profile_id` (`team/publicTeamApi.ts:16-26`) against the wrong id kind. All 59 active `member_profile_id`s resolve in both `dancer_profiles` and `member_profiles`, so the ids are shared.
- `is_active` NULL on 45 pages: nothing in P3 or the shared code reads it.

---

## 3. Matrix (screen x shape)

H = handled, **GAP** = an organiser can hit it today, latent = 0 prod rows today, n/a = the screen doesn't meet the shape.

| Screen | Live recurring, NULL rule (9) | One-off/course/festival all past (17) | Draft one-off 0 dates (1) | >100 dates (1) | Cancelled dates (~22) | removed_dates (16) | Monthly/custom rule (7) | 0 sessions (9) / no people (61) | Per-date added sessions (15) | Owner no dancer row (2/7) | Empty onboarding progress (7/7) | 0-page user | Team of 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home | H | H | H | H | H | n/a | H | n/a | n/a | n/a | **GAP** (banner) | H | n/a |
| Events list | H | H | H | H | H | n/a | H | n/a | n/a | n/a | n/a | n/a | n/a |
| Event page | **GAP** (Repeats copy) | H | **GAP** (dead end) | H | H (count minor) | n/a | H | H | H | n/a | n/a | n/a | n/a |
| Status / Go live | H | H | **GAP** (points at disabled control) | H (long list) | H | n/a | H | H | n/a | n/a | n/a | n/a | n/a |
| All dates | H | H | **GAP** | **GAP** (Past chip) | H | **GAP** (non-weekly) | **GAP** (breaks hidden) | n/a | n/a | n/a | n/a | n/a | n/a |
| Date sheet | **GAP** (Skip copy) | H | n/a | H (clash after tap) | H | **GAP** | H | n/a | H | n/a | n/a | n/a | n/a |
| Sessions | H | H | n/a | H | n/a | n/a | n/a | H | H | n/a | n/a | n/a | n/a |
| Line-up | n/a | n/a | n/a | n/a | n/a | n/a | n/a | H | H | n/a | n/a | n/a | n/a |
| Repeat (W3c) | **GAP** (wrong copy, safe save) | **GAP** (copy, ended) | n/a | H | n/a | n/a | H (read-only) | n/a | n/a | n/a | n/a | n/a | n/a |
| History | H | H | H | H | H | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| Onboarding / Welcome | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **GAP** (dead end) | **GAP** (two counts) | H | n/a |
| You / Account | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | H | **GAP** (two counts) | **GAP** (invite-only copy) | H |
| Team / Hand over | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | partly (no link) | n/a | H | H |

---

## 4. Top 5 gaps, ranked by how likely an organiser hits them

1. **The "Finish your details" grace banner on every visit for all 7 claimed owners.**
   - Why: `organiser_onboarding_progress` has 0 rows and `organiser_onboarding_status_v1` reads it (`p3/screens/GraceBanner.tsx:85-95`, `p3/onboarding/pageModel.ts:100`).
   - Likelihood: 7 of 7 owners, on the first screen they open.
   - Pair with the two-source "things left" count (You vs banner) for one shared mapping.
2. **Onboarding and `/you/details` dead end for an owner with no dancer row.**
   - Why: "We couldn't load your details", and retry fails the same way (`p3/onboarding/OnboardingFlow.tsx:215-216`, `p3/onboarding/PersonFlow.tsx:69-76`, `wizard/dancerApi.ts:24`).
   - Likelihood: 2 of 7 owners today, and very likely most brand-new organisers who never made a dancer profile.
3. **"Doesn't repeat" on the 9 live weekly series whose rule is NULL.**
   - Where: Repeats row, Repeat sheet "doesn't repeat yet", Skip refused with "Only a weekly pattern…" (`p3/model/repeat.ts:288,362`, `p3/screens/RepeatSheet.tsx:220`, `p3/model/dates.ts:114`).
   - Likelihood: about 20% of live recurring series, on the event page every owner of one of them opens. The same copy appears on 21 ended series.
4. **The You tab tells a 0-page user that pages are invite-only** (`p3/you/YouScreen.tsx:110-113`, `page/index.tsx:56-60`).
   - Why it matters: Home's Add a page offers claim and find.
   - Likelihood: every brand-new organiser who taps You before Home's card.
5. **Breaks (`removed_dates`) hidden on non-weekly or NULL-rule series** (`p3/data/dates.ts:62-63`).
   - Why it matters: "Put this week back" can't be reached.
   - Likelihood: 16 series have breaks. With 30 NULL-rule live/ended series and 7 monthly/custom rules, a share of them will hit it.
   - Runner-up, the draft one-off with 0 dates: only 1 row, but it is a total dead end whose copy points at a disabled control (`p3/model/dates.ts:152,205`, `p3/data/eventPage.ts:253`).

---

## Not verified

- No browser walk at 390x844, and no RPC was called as a claimed owner. So what `organiser_onboarding_status_v1` and `my_profile_progress_v1` actually return for the 7 owners is inferred (gap 1). The status function body reads the progress table, but it does not read `contact_confirmed_at` by name.
- Which of the 16 `removed_dates` series have a NULL or non-weekly rule was not counted (gap 5).
- History cursor ties: no count of audit rows sharing one timestamp.
- Whether `organiser_team_v1` returns the public roster.
- Code findings come from three read-only code-reading passes. Line numbers were cited by those passes and spot-checked, not all re-opened.
