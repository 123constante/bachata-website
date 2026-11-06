# Brief: Stats empty state and Copy link honesty (PR #1428, claude/organiser-stats-v2-share-card)

Lane: normal (screen, no database change). Model: Sonnet. Branch: claude/organiser-stats-v2-share-card (PR #1428 exists, head e2d4a11; check it out from origin, do not recreate). 3 deliverables, ONE final push (subject must NOT carry [skip preview]; end it with the worker-done marker).

## Why (lead review of the pictures C:/tmp/walk-1428/01.png, C:/tmp/walk-1428b/01.png)
1. src/modules/organiser/p3/screens/StatsScreen.tsx (empty "No views yet" card, ~line 139 on the branch) says "Use Copy link below ...", but the share card (ShareLinkCard, rendered just above it, `<ShareLinkCard />` ~line 130) sits ABOVE the empty card. Copy that points at a control in the wrong place.
2. With no event the Copy link button looks enabled while the card says "Add an event to get a link". ShareLinkCard.tsx already sets `disabled={!!reason}`, but `.p3-btn-line` keeps a solid border so it reads as tappable.

## Left
1. Empty text says what the person CAN do and points the right way: with events: "Views show up as soon as dancers open your event. Copy your link above and share it on WhatsApp or Instagram to get the first ones." With no event: "Add an event first. Views start once an event is on the calendar." (no mention of Copy link). Use HTML entities / \u escapes, no raw punctuation.
2. Make the disabled state visible: in src/modules/organiser/p3/theme/p3.css add `.p3-theme .p3-btn-line:disabled` (muted text, dashed border, no hover) and keep the reason line right under the button; check the button is not below 44px.
3. Table-driven test (new file src/modules/organiser/p3/screens/__tests__/statsShare.matrix.test.tsx, copy mocks from the existing shareEvent.matrix.test.tsx): shapes = empty views + no event / empty views + with event / views + no event / views + with event / link switched off / link loading. For each: Copy link disabled state, the reason text, and empty-card copy never says "below" and never mentions Copy link when no event exists. Red first against the unfixed code (record the red run in the PR body).

## Limits
Touch only StatsScreen.tsx, ShareLinkCard.tsx if needed, p3.css, the new test. No dependency, no data change, never merge or approve. Run the unit tests for the P3 screens, check:mojibake, lint chain parts that apply. PR body: update Verified / Not verified (real organiser data and a real phone: Not verified). Report head SHA and the per-job CI table.
