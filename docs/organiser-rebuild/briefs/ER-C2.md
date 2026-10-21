# ER-C2 (website-screen): ER-UI, the Ember look as variables

Branch `claude/er-ui-ember` from `main`. Own bot PR. Plan section SHARED EMBER WORLD is binding. Sonnet author.

## Do
1. Add `src/modules/organiser/ui/ember.css`: CSS custom properties for colour, font, radii, sizes, tap targets. DEFAULTS = TODAY's values (read `src/modules/organiser/theme.css` and the components) so nothing changes on screen. Override all of them under ONE class `.ember-world` using the prototype's `:root` values (Ember `#f0703a`, ink `#1d0a03`, Outfit, graphite ground, Monzo radii/sizes). Load Outfit the way the site loads other fonts (check `index.html` / existing font loading; no new request on non-ember pages).
2. Make the components in `src/modules/organiser/ui/*` read those variables. Props and exports unchanged (additive only). Pure refactor of values: a snapshot/visual test must show the default (no `.ember-world`) render identical to today.
3. `ui/Chip.tsx`: the remove button gets a 44px hit area (today 28px) without changing how it looks.
4. Add `ui/EmberWorld.tsx`: a tiny wrapper (`<EmberWorld>` renders a div with `ember-world`) and export it from `ui/index.ts`. Release B imports from `@/modules/organiser/ui` and may also just add the class.
5. Tests: unit test that default tokens equal the old values (table), that `.ember-world` overrides each token, that Chip remove has a 44px hit area. RUN BOTH `src/modules/organiser/**` AND `src/modules/areas/**` tests.

## Not
No file outside `src/modules/organiser/ui/**` and `theme.css`. Do not touch `src/modules/areas/**` or `src/pages/Auth.tsx` (Release B owns them; they will add the class). No screen changes.

## Output
After the bot opens the PR, the orchestrator messages the Release B session with the PR number. Do not.
