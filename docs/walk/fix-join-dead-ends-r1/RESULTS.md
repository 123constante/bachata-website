# Walk: join dead ends after PR #1301 (head 70edc6b), 390x844

Spec: `tests/e2e/walk-fix-join-dead-ends.spec.ts` (not in the CI gate). Chromium via Playwright, dev server, every server answer a `page.route` mock
(`OrganiserFake` helper). Full-page pictures plus `texts.jsonl` (visible text, every control's text, href, bounding-box height) are in this folder.
**Not a real phone and not a real invite.** Mocked preview answers only; Supabase not queried; no product code touched.

| # | Screen | Picture | scrollWidth (<=390) | Page buttons >=44px | Words vs controls | One clear action | Picture shows heading and controls | Result |
|---|---|---|---|---|---|---|---|---|
| 01 | Unknown link: "This link does not work" | `01-unknown.png` | 390 | "Ask for a new link" 48, "Go to Bachata Calendar" 44 | "Ask the person who sent it for a new link." now has a button, "Ask for a new link" (a wa.me link). | Yes (WhatsApp help; home is secondary) | yes (opened and checked) | PASS |
| 02 | Used link, signed out | `02-used-signed-out.png` | 390 | "Sign in" 48, "Ask Diego for a new one" 44, home 44 | "Sign in to continue." has a Sign in button (`/auth?mode=signin&returnTo=/invite/<token>`). | Sign in is primary, but "Ask Diego for a new one" is a second action beside it | yes (opened and checked) | PASS (note) |
| 03 | Expired link | `03-expired.png` | 390 | "Ask Diego for a new one" 48, home 44 | Copy names that button, and it is there. | Yes | yes (opened and checked) | PASS |
| 04 | Join card (row 16) | `04-join-card.png` | 390 | "Join Ritmo Bachata London" 48, "Not you? Use another email" 44 | Card reads exactly "Join Ritmo Bachata London’s team. You’ll finish a few details about you and the page, then you can add and edit events." | Yes | yes (opened and checked) | PASS |

## Retake (r2)
The r1 pictures 01 and 02 were blank bodies (byte-identical) and 03 was blurred mid fade-in, although the DOM text and measurements were right. The spec now waits for each screen's own heading, finished animations and opacity 1, runs with reduced motion, and 300 ms last. A plain `fullPage` capture still painted a blank body for 01 and 02 even with the heading visible (all ancestors opacity 1, visible), so the spec resizes the viewport to the full page height and takes a normal capture. Not an unmocked route or error boundary: the DOM held the real screen throughout. All four pictures were opened and show heading, copy and buttons; sizes all differ. The footer is not in the pictures (page is shorter than the resized height), which is fine for these checks.

## Notes
- Smaller controls in `texts.jsonl` (breadcrumb "Home" 17px, footer links 14px, 1px skip link) are site chrome, not part of these screens; they were not changed by the PR and are not counted in the 44px check.
- 02: signed-out person who already joined sees three controls (Sign in, Ask for a new one, Go to Bachata Calendar). The copy under the title is "Sign in to continue."; the "ask for a new one" button is still there for someone whose link was used by someone else. Judgement call for the owner, not a failure of the brief's check.
- 01's button is a WhatsApp link to the site owner's number with a canned "trying to create an account" message, not a way to reach the person who sent the invite; the sentence above it still says "Ask the person who sent it".

## Not verified
- Real phone, real invite, real prod data shapes (preview answers are mocked), tapping the buttons through (only presence, size, href were checked), flags ON/OFF variants, the other dead states (revoked, used while signed in).
