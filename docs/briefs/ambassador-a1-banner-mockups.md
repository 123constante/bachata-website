# Mockups: the "dancer profile is missing" banner on /ambassador (Design Gate stage 2)

Branch `claude/ambassador-a1-banner-mockups` off `main`. Docs and static HTML only; no source changes, nothing built.

Problem (owner Ricky, 2026-10-27): on /ambassador, a signed-in account with no dancer profile (Jan's will be one) sees a large global banner, about 190 px tall at 390x844: "Your dancer profile is missing. Your account does not have a dancer profile yet. Message us and we'll set one up for you." plus a WhatsApp button. It pushes the pending-review queue down. See screenshots on branch `claude/walk-1086` at docs/walk/walk-1086/01-list.png and 03-review-series.png. Find the banner's component and the rule that decides when it shows (grep for "dancer profile is missing"), and say in the design record what it keys on, who else sees it, and where it is dismissed or remembered.

Produce `docs/design/ambassador-a1-banner.md` (5-line brief, three options, recommendation, what each costs in code, hand checks, Not verified) and static mockups `docs/design/ambassador-a1-banner/{index,option-a,option-b,option-c}.html`, 390x844, same dark theme and tokens as `docs/design/ambassador-a1/option-b.html` on branch `claude/ambassador-a1-mockups`. Each mockup shows the queue list AND the review screen with the option applied, plus a state strip to flip: no dancer profile / has dancer profile / banner dismissed.

Options:
- A: hidden on /ambassador* entirely (still shows everywhere else).
- B: a slim one-line strip (about 44 px, same words shortened, tap opens the WhatsApp message, dismiss with remembered choice) on /ambassador*, full banner elsewhere.
- C: banner stays, but moves below the queue list and out of the review screen so the queue is first on screen.

Taps >= 44 px, contrast >= 4.5, no sideways scroll; list what you measured. One push. Honest Verified / Not verified. Do not merge or build.
