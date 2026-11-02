# Brief: join "First name" help text (normal lane, Sonnet, Website only, no DB)

Branch `claude/join-firstname-help`. Owner board item 2026-11-02: Daniel asked on the About step whether "First name" means his own name or the organisation name (Cumbaye). Fix decided by the program lead: keep the label, add one help line under the field: "Your own first name, not the page name." (the page name is shown when the screen knows it, e.g. "Your own first name, not the page name (Cumbaye)."; plain version when it does not).

Standing headers: prove the data source first (where the About step gets the page name, if at all; read the component, do not assume). Zero bytes to the /app first load (this is not /app, but run `npm run check:bundle-budget` on main and branch and report). Stopping rule: one independent review, one fix round.

## Do
1. Copy lives in `src/modules/admin-organisers/join/joinCopy.ts` (`about.firstName`); the screen is the About step in `src/modules/admin-organisers/join/` (find the component that renders `about.firstName`). Add `about.firstNameHelp` (string, or function of the page name) to joinCopy.ts and render it under the field, linked to the input with `aria-describedby`. Use HTML entities / the file's APOS constants, never raw Unicode punctuation. Explicit px sizes for text, contrast >= 4.5, no new tap targets.
2. RED FIRST: a table-driven test for the About step across {page name known, page name unknown} x {first name empty, filled, linked-to-existing-profile (the `linked` state)}: the help line is present in every cell and never mentions a control that is not on screen. Run it on the unfixed code first and paste the red count in the handover.
3. Only copy and one render line change. No other copy on the screen changes. Untouched Continue behaviour: no new command is sent.
4. Run `npm run lint`, the unit tests under `src/modules/admin-organisers/join`, tsc errors only in touched files. PR body: Verified on real data / Phone QA sections (Phone QA: say honestly it was not walked at 390x844; the orchestrator walks it).

Handover at `docs/handover/join-firstname-help.md`. Last commit subject ends with the done marker from your prompt.
