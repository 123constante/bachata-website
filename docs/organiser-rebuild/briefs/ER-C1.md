# ER-C1 (docs, Website): prototype, mockups and the organiser DESIGN.md world

Branch `claude/er-c1-docs` from `main`. Lane docs. Docs only, so a Website PR under 400 lines is eligible for the `automerge-ok` label per the dispatch prompt rule: DO NOT add it; this arc merges nothing.

## Do
1. Copy from the briefs branch into `docs/organiser-rebuild/`: `er/organiser-prototype.html`, `er/organiser-colour-pick.html`, `er/organiser-events-mockup.html`, `er/organiser-style-pick.html`, `er/PLAN.md`, and `briefs/ER-INTERFACE.md`. Add `docs/organiser-rebuild/er/README.md`: one page saying what each file is and that the prototype v7 is the approved build target (published at https://claude.ai/artifact/6zQZeapwq45Vs9kwnbdzcC).
2. Create `DESIGN.md` at the repo root (it is untracked on the owner's PC and absent from `main`): start from `docs/organiser-rebuild/er/DESIGN-base.md` byte for byte, then ADD one section "Organiser world (Ember)" and change nothing above it. The section records: scope line (`src/modules/organiser/**`, `src/modules/areas/**`, the "What do you do?" step in `src/pages/Auth.tsx`, `src/pages/Account.tsx`, `src/components/account/DancerHome.tsx`, `src/components/account/profiles/ContinueAsPage.tsx`, `src/pages/AccountSettings.tsx` and its sub-views); that it is an off-brand world on purpose (like bento/venue worlds) overriding the amber + Inter One Frequency Rule ONLY inside `.ember-world`; tokens read from the prototype's `:root` (Ember `#f0703a`, ink `#1d0a03`, Outfit, graphite ground, radii, sizes, tap targets); the Monzo card rules; the room-hidden-until-needed rule; the Edit bar is orange on purpose (owner 2026-10-21, do not tone down); how components read variables (`ui/ember.css`, built by ER-C2).
3. Derive every token VALUE by reading the prototype, never from memory.

## Not
No source under `src/`. No change to the base text of DESIGN.md.

## Checks
`npm run test:unit` and `npm run lint` unchanged-green; the repo's markdown/mojibake checks (`check:mojibake`) pass; list every `docs/` guard that applies and its result.
