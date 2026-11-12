# Brief: Dancer dashboard, 2 design OPTIONS on the owner-confirmed prototype (admin #1545, parent #1531)
Lane normal, Opus. Docs/design only, no app code. Supersedes the old critique-fix briefs and the HOLD on #1544/#1545.

BASE: the owner-confirmed "Organiser Area Prototype". You cannot read artifact URLs, so its HTML is stored on this brief branch as a .md file (inert copy): git fetch origin brief/profile-dash-dancer-proto then git show FETCH_HEAD:docs/design/prototype/organiser-area-prototype.html.md > docs/design/dancer-dashboard/prototype-base.html . Build on its look, role strip and Switch sheet. Do not start from the old option files.

DELIVER: TWO options for the Dancer dashboard (dark theme, calm, clean, spacious), each one self-contained HTML file: docs/design/dancer-dashboard/option-1.html and option-2.html. Options must differ in layout/hierarchy, not just colour.
KEEP: role strip; top-right Switch sheet; Dancer tabs Home / Going / Profile.
SHAPES (each option, all drawn, reachable by hash or toggle): 3 roles, 1 role, caught up, unfinished profile/setup, door (door/check-in).
RULES: Stats: NO page views; numbers only when positive. No kicker labels above headings, SVG icons not text characters, dashed borders only for disabled/placeholder, every empty/loading/error state says what to do, disabled controls say why.
CHECKS: contrast >=4.5, taps >=44px, no clipping, no sideways scroll at 390x844. Shoot 390x844 per shape per option, put screenshots in the PR. Write docs/design/dancer-dashboard/DESIGN-proto.md (what differs, checks result). PR per docs/design rules (docs/design/<pr>.md). profile-dash then asks the owner to pick.
