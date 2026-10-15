# Brief: Dancer Rebuild W2c, Me (`/app/me`) + Edit (`/app/me/edit`) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC). Model Sonnet 5.5. NEVER run `gh api` in this repo; read
other branches with `git fetch origin <branch>` + `git show FETCH_HEAD:<path>`. Read
`briefs/dancer-rebuild-COMMON.md`, `briefs/dancer-rebuild-INTERFACE.md` (section 3 is your contract) and
`briefs/dancer-rebuild-W2-SHARED.md` on `arc/briefs-dancer-rebuild` FIRST, then the plan sections 1 (D2,
D5, decisions 1-2), 4.2, 8 (the field table) and change rows C3, C7. BRANCH: `arc/dancer-app-w2c`,
created FROM `claude/dancer-app-r1a` (SHA in the dispatch prompt). Push only this branch. Do NOT open a
PR. Siblings own their own `screens/` folders; W1's shared files are FROZEN.

## Files you OWN
`src/modules/dancer-app/screens/me/**`, `src/modules/dancer-app/screens/edit/**`,
`tests/e2e/dancer-app/me-edit.spec.ts`, `docs/handover/dancer-rebuild-w2c.md`.

## Me (mockup "5 Me")
Card: photo, display name (or first name), "Leader · London" line, strength meter + `next_step` copy +
ONE main button for the next missing step ("Add your photo" -> `/app/me/photo`; "Add your city" -> edit
with the city focused; at 100 the button is "Edit my profile"). Buttons "Edit my profile" and "See my
public page" (1a: opens today's public page `/dancers/:id` in the normal site; `/app/page` is release 1b).
Badges and year-in-review: render NOTHING in 1a. Paused: banner "Your profile is hidden" linking to
`/account/settings`.

## Edit (mockup "6 Edit"; the plan's section 8 table is the field list)
Fields in this order: photo row ("Change photo" -> `/app/me/photo?return=/app/me/edit`); Display name
(1-40, helper "shown on your page"); First name (required); Surname (optional) with the EXISTING
`HideSurnameSwitch` component mounted directly under it (D5; import from
`src/components/profile/HideSurnameSwitch.tsx`, never a copy; it writes through its own path, so the
Edit form treats `hide_surname_publicly` as read-only state and refreshes after the switch flips); City
(the real `CityPicker`); I dance as (Leader / Follower / Both chips); Nationality; Languages (chips input
over the existing languages vocabulary if one exists on `origin/main`, else free text split on commas,
trimmed, deduped: say which in the handover); Dancing since (the four bands mapped to a year by the SAME
helper W2a uses: import it from `screens/onboarding/` ONLY if W2a exported it by the time you start; else
write it in your folder and flag the duplicate in the handover for the orchestrator to unify); Favourite
styles (multi-chips, the public page's vocabulary); Favourite songs and Achievements (chips input);
About me (textarea, live counter `n/280`, links refused client-side with the same rule as the server:
`http://`, `https://`, `www.`); Instagram, Facebook, Website; WhatsApp + "Show my WhatsApp on my page"
switch shown ONLY when `other_roles` is non-empty (D2), with a one-line explanation of why it exists.
Save: disabled until the computed delta is non-empty, with the reason "Nothing has changed yet. Edit a
field above to save." An UNTOUCHED save is impossible (button disabled) and a programmatic submit with an
empty delta sends NO request (test it). Save sends ONLY changed keys; clearing a field sends `null`; the
three replace-only fields (first name, city, photo) cannot be cleared: the input refuses empty with the
reason inline. Per-field errors from `api/errors.ts` codes shown next to the field; a server code the
client did not predict is shown at the top with Retry. After save: refresh from the returned shape,
toast "Saved", Save disabled again.

## Tests (table-driven; red-first for bug-shaped ones)
Shapes: every plan section-3 shape through the fake backend, plus: person with teaching role (WhatsApp
shown), pure dancer (WhatsApp absent and NEVER sent), hidden surname, display name present/absent, bio
at 279/280/281, bio with a link, invalid handle, invalid URL, year band mapping both ways, languages
parsing. Assert: Save disabled-with-reason on an untouched form; exact delta keys per change; `null` for a
cleared optional; refused clear of first name/city/photo with inline reason; every error code has copy;
the same fact (strength, role, city) reads the same on Me and Edit (one mapping). Red-first: a mutant that
sends the whole form must red; a mutant that sends `whatsapp` for a pure dancer must red; a mutant that
enables Save on mount must red.

## Gates
Unit (Node 22), lint, typecheck, `npm run build`, Playwright spec (or NOT RUN + reason), isolation
check, `npm run pre-ship`, every applicable workflow job. 390x844 screenshots of Me and Edit (top and
bottom) on at least four shapes under `docs/handover/dancer-rebuild-w2c/`.

## Failures this brief exists to prevent
A whole-form save; "absent = delete"; a second hide-surname switch; WhatsApp for a pure dancer; Save
enabled with nothing changed; a 281-char bio reaching the server; a field error with no field.

## Done means
Everything above + handover. Commit, push ONCE with `[worker-done <ticket>]`. Stop after the push.
