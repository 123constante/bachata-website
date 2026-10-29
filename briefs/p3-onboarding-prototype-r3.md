# Brief: onboarding prototype FIX ROUND (final one) after the round-2 critique

Branch claude/p3-onboarding-prototype (PR #1124); continue ON it (git fetch, checkout, build on top). Read the critique first: `git fetch origin claude/review-onboarding-prototype-r2` then `git show FETCH_HEAD:docs/review/onboarding-prototype-r2.md`. Verdict was PASS with should-fix. Edit only `docs/design/onboarding-prototype.html` and `.md`.

Do these, in order:
1. (fix 1) Make no-scroll hold at the REAL browser viewport, not just the device size: add the browser-viewport sizes from the critique's section 2 (390 -> 664/410 with keyboard, 360 -> 560/290, 320 -> 460/244) to the measured table and make every screen fit with 0 page scroll at all of them (compact step at max-height 480px; drop the helper line on field screens under ~300px of visible height). Note in section 5: size the app shell to 100dvh / visualViewport.height, never 100vh.
2. (fix 2) `.scrollbox` pickers get min-height 52px; hide the search helper / "All countries" link under max-height 520px before shrinking the list. Re-measure the 12 tightest cells and the picker boxes.
3. (fix 3) Photo copy: "Add a photo to continue." plus a friendly one-liner; fix the Home row wording the same way.
4. (fix 4) Light by default stays (owner decision: "Light by default with a user toggle"); say so in the .md and keep the Settings switch.
5. (fix 5) Add the iOS keyboard build requirement (visualViewport resize listener, scrollTo(0,0), test on a real iPhone) to section 5.
6. (fix 6) `.sheet-close{flex:none}` keeps 44x44 at 130%; zoom slider thumb >= 3:1.
7. (fix 7) Owner decision: ACCEPT five categories; shrink the tiles to 56px on compact so Category fits with no scroll at every size; remove the "max four" note.
8. (fix 8) Progress bar counts the path actually ahead (alternatives count as one step).
9. (fix 9) Display-map Title Case values to sentence case on cards ("Dance school") without changing stored values.
10. (fix 10) State "px only, no rem" in section 5.
Also shorten the Years "More (optional)" line.

Then re-run the measured fit table for ALL screens at the old three sizes AND the three browser-viewport sizes, 100% and 130% text, with and without the keyboard, and write the result (0 scroll everywhere, or list any exception honestly). Push once at the end; final commit subject ends [worker-done <ticket>]. Context under 35%.
