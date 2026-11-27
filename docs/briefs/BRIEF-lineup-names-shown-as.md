# BRIEF: line-up names fit + "Dancers see" line (name audit fixes B + D, Website)

Repo: 123constante/bachata-website. Branch: claude/lineup-names-shown-as. One PR.
Design (owner picked 2026-11-27): https://claude.ai/artifact/KR5T49pSwVAYVbBFNM32nK
(D = "Option 1: wider, 2 lines"; B = "Website, DJ edits own profile" card). Clone it literally.

## Switch
Both changes behind ONE new env switch `VITE_ENABLE_NAME_FIXES`, default off
(follow the existing `VITE_ENABLE_*` pattern, e.g. VITE_ENABLE_HOME_POLISH).
Switch off = today's screens, byte-for-byte.

## D. Line-up name width
`src/modules/event-page/bento/blocks/schedule/PersonChip.tsx:278` sets
`maxWidth: t.avatarPx + 24` (64 px at the stacked size) with a 2-line clamp.
Switch on: name box 96 px wide, still `WebkitLineClamp: 2`, same word-break
rules, same visible ellipsis. Keep the wrap/flex row so a 360 px phone shows 3
chips per row without overlap. Update the "Settled 2026-08-23 ... NOT to be
widened" comment: owner re-decided 2026-11-27 (mockup link above), width 96 px,
still clamp 2 + ellipsis, still no shortening rule. Keep the rest of the comment.
Real names to test with: "DJ Carlos De La Cruz", "Simonliftslife",
"DJ Tony Spark", "Ricky".

## B. "Dancers see" line in the DJ's own profile editor
Field: `dj_name` in `src/modules/areas/shared/fieldRegistry.ts:48`, rendered by
the areas profile editor (RoleProfilePage.tsx / inputs.tsx). Switch on: under
the DJ name input, a soft box exactly as the mockup:
  "Dancers see <b>{shown}</b> · DJ"
  small line: "On every line-up you are on. Leave it empty to use your own name, {ownName}."
{shown} = what DJ slots show, from the existing rule
`nameFor('dj', ...)` in src/modules/person-page/badges.ts:116: the typed DJ name
when not blank, else the person's public name (resolvePublicName,
src/lib/publicName.ts). {ownName} = resolvePublicName without the dj_name.
Updates live as the person types. Reuse these helpers; do not write a new rule.
If the person has no own name resolvable, drop the second sentence.

## Tests (red on old code where it is a fix)
- PersonChip: switch on -> name box 96 px, clamp 2; switch off -> 64 px.
- Editor line: typed "DJ Carlos De La Cruz" -> "Dancers see DJ Carlos De La Cruz";
  empty -> own name; whitespace-only -> own name.
- Phone e2e 390x844 and 360x640 with switch on: no chip overlap, no page side-scroll.

Size: 4-5 files, under 250 lines.

PR BATCHING (docs/pr-batching-policy.md)
- ONE branch, ONE PR for this whole job. Push ONCE when finished.
- No follow-up PR for your own mistakes: fix them on this branch first.
- Docs / handover / memory / CI / test-only changes belong in this PR.
- Checkpoint progress in the PR description, not in extra pushes.
- UI PR: follow docs/ui-quality-bar.md. The PR body MUST have a ## Phone QA section: viewport sizes checked, measured results (overlap, tap size, contrast numbers), or NOT RUN with the reason. Never ask the owner to test what you could test.
- Open the PR with `gh pr create` using GH_BOT_TOKEN; NEVER the GitHub MCP create tool.
- Never merge or approve. Stop after the push and report.
