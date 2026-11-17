# Review: PR #1763 buyer onboarding slice A (flag OFF)

Independent review. Do NOT edit the PR branch. Check out head 3bfe74e2d (origin/claude/onboard-a) read-only.
Write your verdict to `docs/review/onboard-a-1763.md` on branch `claude/review-onboard-a-1763`: first line `PASS`, `PASS WITH NITS` or `BLOCK`, then findings as file:line, severity, fix.

Context: docs/briefs/onboard-a-slice-a.md (brief), docs/handover/onboard-a-slice-a.md (on the PR branch). DB function `ensure_my_dancer_profile_v1` is already live on prod (read-only checks only; never write).

Review targets (saves and screens, careful lane):
1. Silent create via `ensure_my_dancer_profile_v1`: any failure (not_signed_in, rate_limited, network) must NEVER block sign-in or payment. Check every call site, errors swallowed safely, no double submit, no retry storm.
2. Flag OFF (`src/lib/buyerOnboardingFlag.ts`) = behaviour byte-identical to main for every touched screen (TicketPickerB1, TicketThanksPage, MyTicketsPage). Look for flag-off paths that changed.
3. "Not you?" signOut keeps the basket/selection and does not strand the user.
4. Checkout lands on Home; order poll cannot loop forever or hide a paid order.
5. `ticketCardStatus.ts` mapping: passed/cancelled greyed with reason, refunded = QR void (no usable QR shown), every status covered, tests assert real cases.
6. `scripts/dancer-area-isolation-allowlist.json` edit: only the files in the diff added, one seamNotes entry, nothing widened.
7. Copy: British English, full weekday names, `&mdash;` style entities in JSX, tap targets explicit px.

Do not run the full test suite (low RAM). Targeted reads and `npm run test:unit -- <file>` for the new tests only if RAM allows. State what you did not verify.
