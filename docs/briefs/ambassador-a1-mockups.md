# Brief: Ambassador A1, Design Gate stages 1-2 (MOCKUPS ONLY, nothing built)

Repo: 123constante/bachata-website. Branch `claude/ambassador-a1-mockups`. Sonnet, normal lane. One push. NO production code, NO route, NO RPC calls, NO migration. Static HTML mockups + a design record only.

## Stage 1 brief (owner clicks 2026-10-27)
1. Who: a city ambassador (a volunteer, on a phone, ~95% mobile) who approves or rejects new organiser pages and series in THEIR city. First one will be Jan in Bristol.
2. Scope now: the PENDING QUEUE only. No invite link, tracker, history, city overview (A2/later). Owner chose queue-only.
3. Each item: approve, or reject WITH a reason (reason required). The queue never shows submitter email. An item the ambassador is party to (their own page/series) is shown as "needs an admin" with no buttons (A0a refuses self-approval, error `self_approval_not_allowed`).
4. Real shapes to design for (queue RPC `admin_list_pending_review_v1` returns: target_type organiser|series, name, city_name, submitted_at, organiser_names, next_occurrence_dates (up to a few), future_occurrence_count, venue_name, price_min/max/currency, has_flyer, public_slug). Cover: 0 items, 1 item, 12 items, a 9-day-old item (queue age matters), organiser with no extra fields, series with 13 weekly dates, series with no flyer, free vs priced vs price range, very long name, loading, error with retry, reject-reason sheet with empty/too-short validation, approve confirm, success state after a decision (item leaves the list, count updates), "needs an admin" item, wrong-city ambassador (no access), ambassador paused (A3 will add the switch; show a calm "paused" empty state).
5. Rules: mobile-first 390x844, COMPACT density (read `.claude/rules/design-density.md`), taps >= 44px using explicit px (html font-size is ~13.5px on phones), contrast >= 4.5, no sideways scroll, every empty/error state tells the person what they CAN do, disabled controls say why. HTML entities not raw Unicode punctuation in source. British English, full weekday names.

## Stage 2 deliverable: THREE named options
Read the existing Website look first (tokens, e.g. the organiser area and event page) so the options match the product; do not invent a new brand.
- **Option A, "Inbox cards":** one list; each item a card that expands in place; Approve and Reject on the card.
- **Option B, "List then review":** compact list rows (name, type, age); tap opens a full review screen with a sticky Approve / Reject bar.
- **Option C, "One at a time":** triage view showing one item at a time with a count ("3 of 12") and next/previous; decisions sit at the bottom.
Per option: a standalone HTML file `docs/design/ambassador-a1/option-a.html` (b, c), self-contained, opens at 390x844, with a state switcher (a small row of buttons at the top of the file to flip between the shapes in item 4). Plus `docs/design/ambassador-a1/index.html` linking all three, and `docs/design/ambassador-a1.md` (the design record: the stage 1 brief above, the three options with one paragraph of trade-offs each, which you would pick and why, the stage 4 checks you ran by hand (contrast, tap sizes, overflow at 390 wide) with numbers).
Measure rather than eyeball: open each file in a headless browser at 390x844 if one is available in the sandbox and report overflow/tap-size/contrast numbers; if not, say so under Not verified.

## Rules
Supabase read-only; you do not need it (use the shapes above as fixtures, invented names only, no real people). Do not touch `src/**`. Do not open a PR yourself (the claude/** push opens it). Finish with a handover: files, the three options in two lines each, your recommendation, honest Verified / Not verified.
