# Dancer dashboard: 3 prototype options (queue-website#1533, child of #1531)

Docs / design only. No app code, no DB. Read [INVENTORY.md](INVENTORY.md) first (77 items, 74 covered, gaps listed). The owner picks ONE; nothing is built.

Open an option on a phone-width window, or on a wide window use the buttons under the frame. States by link: `#new`, `#partial`, `#complete`, `#unclaimed`, `#empty` (complete, nothing planned), `#loading`, `#error`.

- `option-a.html` **A, Feed** (from organiser option A): a finish-profile card with the short checklist, then rows for the next night, Share my page and nights attended.
- `option-b.html` **B, One thing in focus** (from organiser option B): one big card for the single thing that matters now (profile step, else the next night, else "find events"), then up to 3 rows.
- `option-c.html` **C, Checklist and glance** (from organiser option C): positive-only count tiles on top, the full 7-step checklist as the main card, then plans.

Shared rules: dark tokens from the organiser prototypes, px sizes, taps 44px min, no page-view stats, a count appears only above 0, every empty/loading/error state has an action, Share is disabled with a reason until the profile has its 4 required steps (G-9, owner call).
Rebuild: `python3 docs/design/dancer-dash-protos/tools/gen.py && node docs/design/dancer-dash-protos/tools/check-shots.mjs` (writes `shots/`, 390x844 at 2x, plus `--full` shots).
