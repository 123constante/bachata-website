Q: Chip has no remove button today (brief says 28px) | Default used: added optional `onRemove`/`removeLabel` props (additive), 28px disc inside a 44px hit area; default render unchanged | Cost if wrong: small | Where: src/modules/organiser/ui/Chip.tsx

Q: Tap/size tokens (--tap, --btn-h, --field-h)? Existing tests read literal h-[44px]/h-[52px] class strings | Default used: sizes stay literal px in components (44px minimum is the same in ember); only colours, radii, sheet radius, font are tokens | Cost if wrong: small | Where: src/modules/organiser/ui/ember.css

Q: Where does Outfit load? main.tsx is outside allowed files | Default used: <EmberWorld> injects the Outfit stylesheet once on mount (`loadEmberFont()`, also exported for pages that only add the class); no request on non-ember pages | Cost if wrong: small | Where: src/modules/organiser/ui/EmberWorld.tsx

Q: Ember values for --r-card/--r-ctl/--r-sheet/--btn/--warn-*: prototype gives :root colours and radii only in CSS rules, not as tokens | Default used: card 20, control 15, chip full round, sheet 28; accent #f0703a on ink #1d0a03; warn strip uses darkened ember | Cost if wrong: small | Where: src/modules/organiser/ui/ember.css
