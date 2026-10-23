# Going P2 -- Website: 390x844 screenshots (Design Gate stages 5-6 input)

Every state of every going surface, rendered with the going switch ON. Produced by the walk in
`docs/design/going-p2-website.md` (section "How these were made"). The app-*, my-attendance-- and calendar-list-- shots are full page (app-edit is viewport); the rest are the 390x844 viewport.
Stage 4 columns are measured in the same run (see the design record for the method):
**contrast** = lowest ratio of any going text in the state; **taps** = every going control >= 44x44 px;
**h-scroll** = documentElement.scrollWidth - clientWidth; **clipped** = text cut by its box (ellipsis by design is listed).

| File | Surface | State | What to look at | Contrast (min) | Taps | h-scroll | Clipped |
|---|---|---|---|---|---|---|---|
| [event-tile--event-not-live.png](event-tile--event-not-live.png) | event-tile | event-not-live | paused series: disabled + "isn't taking names" | 4.96 | pass | 0 | none |
| [event-tile--event-not-live-was-going.png](event-tile--event-not-live-was-going.png) | event-tile | event-not-live-was-going | paused, going: Undo still works | 4.96 | pass | 0 | none |
| [event-tile--going-0-finished.png](event-tile--going-0-finished.png) | event-tile | going-0-finished | "No one going yet" + "Be the first" invite; gold I'm going button (most common real state) | 4.96 | pass | 0 | none |
| [event-tile--going-1.png](event-tile--going-1.png) | event-tile | going-1 | one person with photo, linked | 4.96 | pass | 0 | none |
| [event-tile--going-12-plus-more.png](event-tile--going-12-plus-more.png) | event-tile | going-12-plus-more | "+4 more" chip after 8 people | 4.96 | pass | 0 | Maximiliana (ellipsis) |
| [event-tile--going-200.png](event-tile--going-200.png) | event-tile | going-200 | "200 going", "+192 more" fits the 52px chip | 4.96 | pass | 0 | Maximiliana (ellipsis) |
| [event-tile--going-3-mixed-people.png](event-tile--going-3-mixed-people.png) | event-tile | going-3-mixed-people | photo / initials circle / null-id (no link) side by side; initials circle = switch OFF redraw | 4.96 | pass | 0 | none |
| [event-tile--going-8.png](event-tile--going-8.png) | event-tile | going-8 | 8 people wrap to two rows; long name "Maximiliana" truncates with ellipsis | 4.96 | pass | 0 | Maximiliana (ellipsis) |
| [event-tile--night-cancelled.png](event-tile--night-cancelled.png) | event-tile | night-cancelled | disabled "Night cancelled" + organiser cancelled line | 4.96 | pass | 0 | none |
| [event-tile--night-cancelled-was-going.png](event-tile--night-cancelled-was-going.png) | event-tile | night-cancelled-was-going | can take name off: pressed Undo enabled | 4.96 | pass | 0 | none |
| [event-tile--night-ended.png](event-tile--night-ended.png) | event-tile | night-ended | "Who went", "5 went", disabled "Night ended" + reason | 4.96 | pass | 0 | none |
| [event-tile--night-ended-no-end-time.png](event-tile--night-ended-no-end-time.png) | event-tile | night-ended-no-end-time | no end time: closed at 04:00 next morning; "No one went" | 4.96 | pass | 0 | none |
| [event-tile--night-ended-was-going.png](event-tile--night-ended-was-going.png) | event-tile | night-ended-was-going | "You said you were going" | 4.96 | pass | 0 | none |
| [event-tile--people-error.png](event-tile--people-error.png) | event-tile | people-error | "Couldn't load who's going" + Try again (44px); NO count claimed (no "Be the first" / "No one going yet"); button still taps | 4.96 | pass | 0 | none |
| [event-tile--people-loading.png](event-tile--people-loading.png) | event-tile | people-loading | people read in flight: blank line holds height; button usable | 4.96 | pass | 0 | none |
| [event-tile--people-unknown-night.png](event-tile--people-unknown-night.png) | event-tile | people-unknown-night | database dropped the id: same as the read failing (Try again), never "0 going" | 4.96 | pass | 0 | none |
| [event-tile--placeholder-chunk-loading.png](event-tile--placeholder-chunk-loading.png) | event-tile | placeholder-chunk-loading | Suspense fallback: same box, disabled ghost button, no seam when the tile lands | 4.96 | pass | 0 | none |
| [event-tile--signed-out-sign-in-prompt.png](event-tile--signed-out-sign-in-prompt.png) | event-tile | signed-out-sign-in-prompt | sign-in prompt title/body from GOING_COPY | 9.14 | pass | 0 | none |
| [event-tile--tap-network-error.png](event-tile--tap-network-error.png) | event-tile | tap-network-error | rolled back; "Check your connection"; button still usable | 4.96 | pass | 0 | none |
| [event-tile--tap-profile-incomplete-refusal.png](event-tile--tap-profile-incomplete-refusal.png) | event-tile | tap-profile-incomplete-refusal | server refusal folds into the unfinished state with Finish link | 4.96 | pass | 0 | none |
| [event-tile--tap-rate-limited.png](event-tile--tap-rate-limited.png) | event-tile | tap-rate-limited | rolled back; rate-limit line; button still usable | 4.96 | pass | 0 | none |
| [event-tile--tap-saving.png](event-tile--tap-saving.png) | event-tile | tap-saving | optimistic "You're going" + "Saving…"; count 4 at once, the viewer is NOT shown as "+1 more" (people list unchanged until re-read) | 4.96 | pass | 0 | none |
| [event-tile--tap-success.png](event-tile--tap-success.png) | event-tile | tap-success | after a successful tap: pressed + count 4 | 4.96 | pass | 0 | none |
| [event-tile--time-tbc.png](event-tile--time-tbc.png) | event-tile | time-tbc | night line shows the date alone (no time) | 4.96 | pass | 0 | none |
| [event-tile--viewer-anonymous.png](event-tile--viewer-anonymous.png) | event-tile | viewer-anonymous | guest session copy; sign-in button | 4.96 | pass | 0 | none |
| [event-tile--viewer-finished-not-going.png](event-tile--viewer-finished-not-going.png) | event-tile | viewer-finished-not-going | enabled gold I'm going, no line | 4.96 | pass | 0 | none |
| [event-tile--viewer-going.png](event-tile--viewer-going.png) | event-tile | viewer-going | pressed "You're going · Undo" with check + undo hint | 4.96 | pass | 0 | none |
| [event-tile--viewer-loading.png](event-tile--viewer-loading.png) | event-tile | viewer-loading | my-going read in flight: disabled "I'm going" + "Checking…" | 4.96 | pass | 0 | none |
| [event-tile--viewer-no-profile.png](event-tile--viewer-no-profile.png) | event-tile | viewer-no-profile | no dancer profile: WhatsApp link (external) | 4.96 | pass | 0 | none |
| [event-tile--viewer-signed-out.png](event-tile--viewer-signed-out.png) | event-tile | viewer-signed-out | button reads "Sign in to say you're going"; line explains it is free | 4.96 | pass | 0 | none |
| [event-tile--viewer-unfinished-all-four.png](event-tile--viewer-unfinished-all-four.png) | event-tile | viewer-unfinished-all-four | all four fields listed; line wraps without clipping | 4.96 | pass | 0 | none |
| [event-tile--viewer-unfinished-but-going.png](event-tile--viewer-unfinished-but-going.png) | event-tile | viewer-unfinished-but-going | going always undoable even with an unfinished profile | 4.96 | pass | 0 | none |
| [event-tile--viewer-unfinished-city.png](event-tile--viewer-unfinished-city.png) | event-tile | viewer-unfinished-city | names "city" | 4.96 | pass | 0 | none |
| [event-tile--viewer-unfinished-dance-role.png](event-tile--viewer-unfinished-dance-role.png) | event-tile | viewer-unfinished-dance-role | the 4-in-5 real case: 0 going + "Add your dance role" | 4.96 | pass | 0 | none |
| [event-tile--viewer-unfinished-first-name.png](event-tile--viewer-unfinished-first-name.png) | event-tile | viewer-unfinished-first-name | disabled ghost button; names the missing field; "Finish your profile" link | 4.96 | pass | 0 | none |
| [event-tile--viewer-unfinished-photo.png](event-tile--viewer-unfinished-photo.png) | event-tile | viewer-unfinished-photo | names "photo" | 4.96 | pass | 0 | none |
| [event-tile--viewer-unfinished-unknown-fields.png](event-tile--viewer-unfinished-unknown-fields.png) | event-tile | viewer-unfinished-unknown-fields | general "Finish your dancer profile" copy | 4.96 | pass | 0 | none |
| [festival-hub--event-not-live.png](festival-hub--event-not-live.png) | festival-hub | event-not-live | disabled + reason | 7.01 | pass | 0 | none |
| [festival-hub--going-0-finished.png](festival-hub--going-0-finished.png) | festival-hub | going-0-finished | hub theme tokens; "Be the first" + primary button | 7.59 | pass | 0 | none |
| [festival-hub--going-12-plus-more.png](festival-hub--going-12-plus-more.png) | festival-hub | going-12-plus-more | +4 more | 7.59 | pass | 0 | Maximiliana (ellipsis) |
| [festival-hub--going-200.png](festival-hub--going-200.png) | festival-hub | going-200 | +192 more | 7.59 | pass | 0 | Maximiliana (ellipsis) |
| [festival-hub--going-3-mixed-people.png](festival-hub--going-3-mixed-people.png) | festival-hub | going-3-mixed-people | photo / initials / null-id on the card | 7.59 | pass | 0 | none |
| [festival-hub--night-cancelled.png](festival-hub--night-cancelled.png) | festival-hub | night-cancelled | disabled + reason | 7.01 | pass | 0 | none |
| [festival-hub--night-ended.png](festival-hub--night-ended.png) | festival-hub | night-ended | "5 went", disabled | 7.01 | pass | 0 | none |
| [festival-hub--night-read-failed.png](festival-hub--night-read-failed.png) | festival-hub | night-read-failed | snapshot read failed: Try again, never a made-up "0 going" | 7.59 | pass | 0 | none |
| [festival-hub--people-error.png](festival-hub--people-error.png) | festival-hub | people-error | Try again; no count claimed, button still taps | 7.59 | pass | 0 | none |
| [festival-hub--tap-rate-limited.png](festival-hub--tap-rate-limited.png) | festival-hub | tap-rate-limited | rate-limit line | 7.59 | pass | 0 | none |
| [festival-hub--tap-saving.png](festival-hub--tap-saving.png) | festival-hub | tap-saving | count 4 at once, no "+1 more" | 7.59 | pass | 0 | none |
| [festival-hub--viewer-going.png](festival-hub--viewer-going.png) | festival-hub | viewer-going | pressed state on the hub theme | 7.59 | pass | 0 | none |
| [festival-hub--viewer-signed-out.png](festival-hub--viewer-signed-out.png) | festival-hub | viewer-signed-out | sign-in button | 7.59 | pass | 0 | none |
| [festival-hub--viewer-unfinished-dance-role.png](festival-hub--viewer-unfinished-dance-role.png) | festival-hub | viewer-unfinished-dance-role | disabled + Finish link | 7.01 | pass | 0 | none |
| [calendar-list--counts-0-1-3-200.png](calendar-list--counts-0-1-3-200.png) | calendar-list | counts-0-1-3-200 | chip shows only when > 0; "1 going", "3 going", "200 going"; no layout change | 4.77 | pass | 0 | none |
| [dancer-page--going-next-0.png](dancer-page--going-next-0.png) | dancer-page | going-next-0 | no Going next section at all (no empty heading) | 8.49 | pass | 0 | none |
| [dancer-page--going-next-1.png](dancer-page--going-next-1.png) | dancer-page | going-next-1 | 1 card full width | 6.27 | pass | 0 | none |
| [dancer-page--going-next-2.png](dancer-page--going-next-2.png) | dancer-page | going-next-2 | 2 cards side by side | 6.27 | pass | 0 | none |
| [dancer-page--going-next-3.png](dancer-page--going-next-3.png) | dancer-page | going-next-3 | 2 cards + "See all 3" | 6.27 | pass | 0 | none |
| [dancer-page--going-next-3-see-all-open.png](dancer-page--going-next-3-see-all-open.png) | dancer-page | going-next-3-see-all-open | third card opens below | 6.27 | pass | 0 | none |
| [app-home--going-0.png](app-home--going-0.png) | app-home | going-0 | "Upcoming nights" tile 0 + how to say going | 5.33 | pass | 0 | none |
| [app-home--going-loading.png](app-home--going-loading.png) | app-home | going-loading | tile while get_my_going_v1 is in flight | 5.34 | pass | 0 | none |
| [app-home--going-upcoming.png](app-home--going-upcoming.png) | app-home | going-upcoming | tile count and strip Going cell are one number (get_my_going_v1 upcoming) | 5.33 | pass | 0 | none |
| [app-nights--empty.png](app-nights--empty.png) | app-nights | empty | one empty state that says what to do | 5.84 | pass | 0 | none |
| [app-nights--error.png](app-nights--error.png) | app-nights | error | read failed: retry action | 5.71 | pass | 0 | none |
| [app-nights--full.png](app-nights--full.png) | app-nights | full | Going / Cancelled / Went tags; full weekday names; paused series night | 5.33 | pass | 0 | none |
| [app-nights--loading.png](app-nights--loading.png) | app-nights | loading | loading state | 5.71 | pass | 0 | none |
| [app-me--going-upcoming.png](app-me--going-upcoming.png) | app-me | going-upcoming | no "unlock at 70%" line; next step leads to finishing | 4.54 | pass | 0 | none |
| [app-edit--photo-switch-off.png](app-edit--photo-switch-off.png) | app-edit | photo-switch-off | "Show my photo when I'm going" Off + the honest line | 5.84 | pass | 0 | none |
| [app-edit--photo-switch-on.png](app-edit--photo-switch-on.png) | app-edit | photo-switch-on | "Show my photo when I'm going" On + the honest line | 5.84 | pass | 0 | none |
| [my-attendance--empty.png](my-attendance--empty.png) | my-attendance | empty | empty state names what to do | 6.72 | pass | 0 | none |
| [my-attendance--error.png](my-attendance--error.png) | my-attendance | error | error + Try again | 8.66 | pass | 0 | none |
| [my-attendance--full.png](my-attendance--full.png) | my-attendance | full | upcoming + past lists with tags | 7.19 | pass | 0 | Camden Social Bachata Night  (line-clamp) |
| [my-attendance--loading.png](my-attendance--loading.png) | my-attendance | loading | loading | 8.66 | pass | 0 | none |
