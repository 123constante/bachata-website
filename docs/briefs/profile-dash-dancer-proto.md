# Brief: dancer dashboard, 2 design OPTIONS on the owner-confirmed prototype (admin #1545, parent #1531)
Lane normal, Opus. Docs/design only, no app code. Supersedes the old critique-fix briefs and the HOLD on #1544/#1545.

BASE: the owner-confirmed "Organiser Area Prototype" artifact https://claude.ai/artifact/9bQ7Dj7Qk6oJgZTommZaLN. Read it with the Artifact tool (action: read), copy its HTML to docs/design/dancer-dashboard/prototype-base.html, and build on its look, role strip and Switch sheet. Do not start from the old option-B files.

DELIVER: TWO options for the DANCER dashboard (dark theme, calm, clean, spacious), each one self-contained HTML file: docs/design/dancer-dashboard/option-1.html and option-2.html. Options must differ in layout/hierarchy, not just colour.
KEEP: role strip; top-right Switch sheet; dancer tabs Home / Going / Profile.
SHAPES (each option, all drawn, reachable by hash or toggle): dancer with 3 roles, 1 role, caught up, unfinished profile, door (at the door / check-in).
RULES: Stats-style numbers only when positive, never page views. No kicker labels above headings, SVG icons not text characters, dashed borders only for disabled/placeholder, every empty/loading/error state says what to do, disabled controls say why.
CHECKS: contrast >=4.5, taps >=44px, no clipping, no sideways scroll at 390x844. Shoot 390x844 per shape per option, put screenshots in the PR. Write docs/design/dancer-dashboard/DESIGN-proto.md (what differs, checks result). PR per docs/design rules (docs/design/<pr>.md). profile-dash then asks the owner to pick.
