# Brief: organiser dashboard, 2 design OPTIONS on the owner-confirmed prototype (admin #1544, parent #1531)
Lane normal, Opus. Docs/design only, no app code. Supersedes the old critique-fix briefs and the HOLD on #1544/#1545.

BASE: the owner-confirmed "Organiser Area Prototype" artifact https://claude.ai/artifact/9bQ7Dj7Qk6oJgZTommZaLN. Read it with the Artifact tool (action: read), copy its HTML to docs/design/organiser-dashboard/prototype-base.html, and build on its look, role strip and Switch sheet. Do not start from the old option-A files.

DELIVER: TWO options for the ORGANISER dashboard (light theme, calm, clean, spacious), each one self-contained HTML file: docs/design/organiser-dashboard/option-1.html and option-2.html. Options must differ in layout/hierarchy, not just colour.
KEEP: role strip; top-right Switch sheet; organiser tabs Home / Events / Tickets / Stats / Team.
SHAPES (each option, all drawn, reachable by hash or toggle): organiser with 3 roles, 1 role, caught up, unfinished setup, door (door/check-in mode).
RULES: Stats: NO page views; numbers only when positive. One gold primary action per screen ("Share this night" on Home). "Going" is never a headline tile. No kicker labels above headings, SVG icons not text characters, dashed borders only for disabled/placeholder, every empty/loading/error state says what to do, disabled controls say why.
CHECKS: contrast >=4.5, taps >=44px, no clipping, no sideways scroll at 390x844. Shoot 390x844 per shape per option, put screenshots in the PR. Write docs/design/organiser-dashboard/DESIGN-proto.md (what differs, checks result). PR per docs/design rules (docs/design/<pr>.md). profile-dash then asks the owner to pick.
