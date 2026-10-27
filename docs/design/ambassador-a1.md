# Ambassador A1: pending queue (Design Gate stages 1-2)

Mockups only. No production code, route, RPC call or migration. Files: `docs/design/ambassador-a1/{index,option-a,option-b,option-c}.html`. Open any at 390x844; the "Mockup states" strip flips between shapes. All data is invented.

## Stage 1 brief (owner clicks, 2026-10-27)

1. **Who:** a city ambassador (volunteer, phone, ~95% mobile) who approves or rejects new organiser pages and series in their city. First one: Jan, Bristol.
2. **Scope now:** the pending queue only. No invite link, tracker, history or city overview (A2/later).
3. **Each item:** approve, or reject with a required reason. Never show submitter email. An item the ambassador is party to shows "needs an admin" with no buttons (A0a refuses self-approval, `self_approval_not_allowed`).
4. **Shapes covered** (from `admin_list_pending_review_v1`): 0, 1 and 12 items; a 9-day-old item; organiser with no extra fields; series with 13 weekly dates; series with no flyer; free / priced / price range; very long name; loading; error with retry; reject sheet with empty and too-short validation; approve confirm; success after a decision (item leaves, count updates); needs-an-admin item; wrong-city (no access); paused (calm empty state).
5. **Rules:** 390x844, compact density, taps >= 44px in explicit px, contrast >= 4.5, no sideways scroll, every empty/error state says what the person can do, disabled controls say why. British English, full weekday names.

Look: matches the site's dark theme tokens (`src/index.css`): black page, `#121212` cards, amber primary `hsl(39 100% 50%)`, muted `#ababab`, border `#333`, destructive red (lightened to `#f87171` for text contrast).

Shared across all three: queue sorted oldest first; a "Waiting N days" chip that turns amber with a warning mark at 7+ days; the same reject sheet (reason required, minimum 10 characters, inline error, organiser sees the reason); the same approve confirm; the same "needs an admin" note; a toast that says what happened and how many are left.

## The three options

**A, Inbox cards.** One list of cards; the first is open, the rest collapse to name, type and age. Approve and Reject appear on an expanded card. *Trade-offs:* fastest for someone clearing a short queue and everything stays on one screen, no navigation to lose their place. But the buttons only show once a card is open, so a queue of 12 means expand, read, decide, and a long expanded series (13 dates, long name) pushes the next cards well below the fold. Easy to scroll past the 9-day-old item if it is not first (it is, because of the sort).

**B, List then review.** Compact rows (name, type, age, chevron) at 57px each, so about eleven fit in a screen. Tap opens a full review screen with a sticky Approve / Reject bar. *Trade-offs:* best overview and the clearest place to see queue age at a glance; the decision screen has room for everything and the bar is always reachable with a thumb. Costs one extra tap and a back step per item, and returning to the list after a decision needs the list to keep its position.

**C, One at a time.** A triage view with "3 of 12", previous/next, and decisions pinned at the bottom. *Trade-offs:* lowest cognitive load and the strongest nudge to actually clear the queue, good for Jan doing five minutes on the bus. Weakest overview: no list, so 12 items feels like a tunnel, a skipped item is easy to forget, and the age warning only appears per item.

## Recommendation: B

B is the best fit for a volunteer who dips in, wants to see "how long has anything been waiting" immediately, and then reads one thing properly before a decision with real consequences (it goes public; a rejection sends a reason). It keeps decisions off the list so nothing is approved by a stray tap, and the sticky bar follows the same pattern as the rest of the site's action bars. A is the cheapest to build; C is a good later "review next" shortcut on top of B (open the oldest, then step through).

## Stage 4 checks run by hand

Headless Chromium (Playwright), viewport 390x844, every state in the switcher for every option (49 state/screen combinations, including B's review screens, C's last-item and needs-admin screens). Script was throwaway and is not committed.

| Check | Result |
| --- | --- |
| Horizontal overflow | `scrollWidth` 390 = `clientWidth` 390 in every combination. |
| Tap targets (buttons and links in the product area, mockup switcher excluded) | Minimum 44x44 px everywhere; B list rows 57 px tall; no element under 44. |
| Contrast (lowest text/background ratio per screen, computed from rendered colours) | Lowest 6.54:1 (red validation message on the sheet); typical 6.8-9.1:1; all >= 4.5. |
| Page errors | None thrown. |

## Not verified

- Real device (iOS Safari, Android Chrome) and the ~13.5px root font-size trap: sizes are explicit px, but not seen on a phone.
- Contrast was computed on solid colours; amber/red chips with translucent borders and the toast over a scrolling page were not separately measured. Disabled controls (previous/next at the ends) are exempt from contrast and were skipped.
- Screen reader behaviour (sheet focus trap, announcements) is only sketched with roles and `aria-*`; not tested.
- Light theme not designed (the site is dark).
- No real data shapes were surveyed: fixtures follow the RPC fields listed in the brief, per instruction no Supabase read was made. The CLAUDE.md real-data gate applies before any build.
- Mockup copy for what the organiser is told on approve/reject is assumed, not confirmed against A0a.
