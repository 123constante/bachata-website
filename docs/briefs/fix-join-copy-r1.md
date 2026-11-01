# Brief: fix-join-copy-r1 (WEBSITE, normal lane, Sonnet). Branch claude/fix-join-copy-r1. One slice, one push.

Context line: stay under 35% of your context; at 45% start nothing new; push + handover by 50%. Never merge or approve. Never --no-verify. Plain git only. Supabase read-only.

## Goal
The organiser invite journey (src/modules/admin-organisers/join/*: joinCopy.ts, JoinScreens.tsx, joinModel.ts, InviteRedeemPage and its tests) is already good. Fix FOUR small rough edges, nothing else (no new features, no redeem/DB changes):

1. Step count is inconsistent: signed out shows "Step 1 of 3" and the email-code step, signed in shows "Step 2 of 2" on the Join card. Read joinModel.ts progress logic first. If the differing totals are deliberate (e.g. email, code, join vs join only), make the wording honest and stable for one person's whole journey (the total must not change mid-journey: a person who started at "Step 1 of 3" must see "Step 3 of 3" on the Join card). If it is a real inconsistency, fix it. State in the PR body which it was.
2. Possessive: "Alex Boneva Teachings's events" reads wrong when the name ends in "s". Use "the events of <name>" style wording, or one shared helper that gives a correct possessive (name ending in s -> apostrophe only). One helper, used wherever the join copy builds a possessive.
3. Email field: on the signed-out step the input shows as an empty black box. Add a visible placeholder (e.g. "you@example.com") and make sure the border/background contrast >= 3:1 against the page and text >= 16px px-sized (html font-size trap: use explicit px).
4. Invalid / used / expired link card: after the existing sentence, add one plain line telling the person what to do: "Ask the person who sent it for a new link." (check joinCopy / inviteModel REDEEM_COPY for the used, revoked and expired cards too; keep each card's own first sentence; "same signed-in person reopening a used link" must still be taken in, do not change that).

## Rules
- Copy names only controls that are on screen. British English. Plain words (no "series", "gate", "token").
- Use `&mdash;`/`&rsquo;` entities in JSX, never raw unicode punctuation (mojibake rule). Source files over 2 KB: use scripts/safe-edit.py.
- Table-driven test: every join screen/card state x the new copy (signed-out email, signed-in join, invalid, used, revoked, expired) asserts the helper possessive for names ending in s / not in s / with an apostrophe, and the step label total is constant across one journey. Red first.
- Walk at 390x844 light AND dark with laptop-walk (see ~/.claude/docs; you may use `node ~/.claude/bin/laptop-walk.mjs`), attach screenshots paths in the PR body.
- Run every CI job step that applies (read .github/workflows). PR body must carry the guard lines exactly: `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and a `## Phone QA` section.

## Done = pushed, PR opened by the bot (branch claude/**), handover note, report head SHA and per-job check table, honest Verified / Not verified.
