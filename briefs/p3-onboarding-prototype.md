# Brief: onboarding prototype (design only, no app code)

Role: you are the lead product designer. Deliver ONE standalone, clickable HTML prototype of the whole organiser/dancer onboarding flow, at phone size (390x844 framed, scales up on desktop). The owner is a beginner who only approves; make it good enough that a developer can build each screen from it. No React, no app code, no migrations, no changes outside `docs/design/`.

Output: `docs/design/onboarding-prototype.html` (single file, inline CSS/JS, no network, no external fonts, under 600 KB) plus `docs/design/onboarding-prototype.md` (decisions, assumptions, screen list, what a developer needs). Branch: claude/p3-onboarding-prototype.

## Read first
- `docs/plans/onboarding-arc.md` (the flow: find/claim/create page, confirm contact, teaching levels, skip about, sign-in email, go-live, 14-day grace gate; Appendix A = the screens).
- `src/modules/organiser/p3/theme/p3.css` and `DESIGN.md` (the existing P3 look: use these tokens, no colour seams between surfaces; keep the current site accent colour).
- The earlier W4b stage-2 mockups on branch claude/p3-w4b-mockups (new account = option A; unfinished profile = option B with a "Finish profile" button).
- `.claude/rules/design-density.md` (compact layouts; 3-column grids, text-sm; the owner's later answers below win where they conflict with quiet density, but taps stay >= 44px and use explicit px, not rem, because the site's html font-size is about 13.5px on phones).

## Owner's decisions (binding)
Mood: clean and calm. Feeling: quick. Voice: playful. Audience: confident. Progress: dots or a thin bar. Every optional step skippable. Back button always. Light by default with a user toggle; dark mode = TRUE BLACK background. One big full-width main button stuck at the bottom. Small friendly icons only. Accent: keep the current site colour. Text comfortably large. Errors beside the field in plain words. Optional fields say "optional". Success feedback: a visual "Nice one" (small tick pop, button press bounce; Android vibration where supported via the Vibration API; do not promise haptics on iPhone). Animation amount: MEDIUM (slide between steps, short end celebration; honour prefers-reduced-motion). Level picker: big tap cards with a one-line plain explanation, tick several. Go-live: confetti plus "You're live", then View my page and Share buttons. Profile photo step: REQUIRED (the one required step; make it easy: camera or gallery, round preview, friendly crop). Grace period nudge: a friendly dismissible banner with a days-left count (14 days after screens ship). Languages: English only at launch, but layouts must survive longer words. Arrival: from an invite link, so the welcome screen can say who invited them.
Per-screen question count: you decide. Questions per screen: keep to the minimum.
Corner roundness and amount of text: SHOW VARIANTS. Give a small switcher at the top of the prototype (hidden in a "design options" drawer) for 2-3 corner-roundness settings and 2 text-amount settings (short vs explained) so the owner can try them live and pick.

## Also include (owner idea, same look and motion)
Dance role as big tap cards instead of a dropdown: Leader, Follower, Both (stored value 'Lead and Follow'; the Website calls it "Both"), and show a friendly "Not sure yet" card as a DESIGN ASSUMPTION (no such stored value exists; mark it clearly as needing a product/DB decision). Nationality: flags, type-to-jump, popular countries first, shown back as a chip. Languages: a short chip row of the likely few, "More languages" opening a search sheet, ticked languages as removable chips (stored as English names).

## Screens to cover (first screen = the three moods preview, see below)
0. Mood picker: three calm/playful/bold style previews of the same welcome screen (so the owner can click the mood he likes).
1. Welcome (invite aware), find your page / claim / create new (the three states).
2. Confirm contact (phone or email, plain wording).
3. Who you are: name, photo (required), dance role cards, nationality, languages.
4. Teaching levels (cards), skip-about step.
5. Sign-in email explanation (private, why we ask).
6. Review and go live (checklist of what is missing, each item tappable).
7. Go-live celebration.
8. The grace banner on the home screen (days left, dismissible) and the "finish your page" state for an unfinished profile.
9. Error, empty and loading state for each screen (actionable, plain words). Disabled buttons say why.
10. Dark mode (true black) of every screen via the toggle.

## Checks you must run on your own file (put results in the .md)
Contrast >= 4.5 in light and dark; every tap target >= 44px; no horizontal scroll at 390px and at 320px; no clipped text with 130% text scale; reduced motion removes slide/confetti; keyboard focus visible; every screen reachable by clicking from the start; Back works everywhere; no dead buttons (anything not wired says why).

## Stopping rule
You are the designer. One pass, then an independent critique worker reviews your file; at most one fix round. Do not add scope: ideas that are not in this brief go in a "Parked ideas" list in the .md.

## Hard limits
Docs-only: touch only `docs/design/onboarding-prototype.html` and `.md`. No bundle impact, no app code. Push once early (checkpoint) and again at the end; open the PR via the bot flow (claude/** branch). Keep your context under 35%.
