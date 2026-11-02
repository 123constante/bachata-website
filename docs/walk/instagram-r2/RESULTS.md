# Walk of PR #1272 at 390x844 (brief walk-instagram-r2)

Spec: `tests/e2e/walk-instagram-r2.spec.ts` (36 tests, all pass). Run:
`VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-instagram-r2.spec.ts --project=chromium --workers=2`

Branch cut from `claude/instagram-refusal-r2` at 1dea71d. No file under `src/` and no existing test changed.
Every answer is a network-boundary mock (`page.route`) on the real app and its real router; the clock is frozen
and animations are switched off by test-only CSS. Measured per picture: controls under 44px that a finger can
reach, sideways scroll, lowest text contrast (>= 4.5 required), console errors, the focused element.

## Result

**No contradiction of the PR's behaviour. No FINDING against `src/`.** Every case below behaves as PR #1272 says.

What the walk shows, in words:

1. **Website field.** A profile link typed over an empty Website with Instagram empty sends `{instagram}` only
   (there is no stored Website to clear, so no `website_url:null`); over a stored site it sends
   `{instagram, website_url:null}` in ONE call. `m.instagram.com/x` moves the same way. The same handle already in
   Instagram sends `{website_url:null}` over a stored site, with no error. A **different** handle in Instagram blocks
   Save (0 calls) and says under Website: "This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram."
   An `instagram.com/p/abc` post link and a normal website are saved as typed (`{website_url: link}` only).
   Before Save, a link that will move shows the note "This is an Instagram link, so saving puts it in your Instagram instead."
2. **Refusals.** `invalid_instagram` and a 23505 on `dancer_profiles_instagram_normalized_uidx` show the exact PR wording under
   Instagram, nothing at the top. A 23505 on another index (`dancer_profiles_slug_key`) shows only the top message
   "Something went wrong. Check your connection and try again." with Try again, and nothing under Instagram.
3. **Checklist rows.** `instagram` opens `/app/me/edit?focus=instagram&returnTo=...` with `input#instagram` focused (base-incomplete and base-complete);
   `dj_answer` opens "Do you DJ?", `dj_genres` opens "Music you play", an unknown code opens the in-flow "elsewhere" screen. no_profile: Instagram lands on the
   dancer app's "could not find your dancer profile" screen (`load-error`), the DJ rows land on the no-dancer screen. Each one still there 1.5 s later (no bounce back to Review).
   After saving Instagram the page returns to Review, the Instagram row is gone, and there was **no page load** (0 loads after the tap). Body: `{instagram:"simon.dances"}`.
4. **DJ steps.** Limits and reasons are exactly: empty "Type at least one to continue."; 21 items "Up to 20, separated by commas."; an 81-character item
   "Keep each one to 80 characters or fewer."; 20 items and an 80-character item are accepted. Untouched answers send nothing (0 calls).

## Notes (not defects of this PR)

- Known and left by the PR, seen again here: a same-name link typed into an EMPTY stored Website leaves Save off with "Nothing has changed yet." and the link stays in the box (F6); a post/reel link is saved in Website with no note (F5).
- The shared toast's close button (`button.absolute`, 20x20) appears after every save but is `opacity:0` until hover, so it is not counted as a tap target on a phone. It is the shared primitive, not this PR.
- Console: the dev server prints a React "Extra attributes from the server (nonce)" hydration warning, and the app logs its own `Mutation error: DancerApiError` / `Query error` line when a mocked refusal or no_profile answer arrives. These are excluded from the count above because the case is the test; nothing else was logged (0 other errors in every picture).
- The Review row for Instagram under no_profile lands on a screen with no field (there is no profile to edit). That is the PR's choice (matrix test says the same) and is noted, not changed.

## Pictures and measurements

| Picture (docs/walk/instagram-r2/) | Case | Result on screen | Taps under 44px | Sideways scroll | Lowest contrast | Console errors | Focused element | Request bodies |
|---|---|---|---|---|---|---|---|---|
| `dj-no-selected.png` | Do you DJ? "No" chosen | before Continue | none | no | 5.35 | 0 | button |  |
| `dj-yes-then-genres.png` | after "Yes": Music you play | calls: set_my_role_intent_v1 | none | no | 5.35 | 0 | h1#p3-ob-title |  |
| `dj-yesno-untouched.png` | Do you DJ? untouched, Continue tapped | Continue aria-disabled=true; reason: Answer to continue.; calls sent: 0 | none | no | 5.35 | 0 | button | calls=[] |
| `genres-20-items-ok.png` | Music you play: 20-items-ok | Continue on; reason: ""; calls: 0 | none | no | 5.35 | 0 | none |  |
| `genres-21-items.png` | Music you play: 21-items | Continue OFF; reason: "Up to 20, separated by commas."; calls: 0 | none | no | 5.35 | 0 | none |  |
| `genres-empty.png` | Music you play: empty | Continue OFF; reason: "Type at least one to continue."; calls: 0 | none | no | 5.35 | 0 | none |  |
| `genres-item-80-chars-ok.png` | Music you play: item-80-chars-ok | Continue on; reason: ""; calls: 0 | none | no | 5.35 | 0 | none |  |
| `genres-item-81-chars.png` | Music you play: item-81-chars | Continue OFF; reason: "Keep each one to 80 characters or fewer."; calls: 0 | none | no | 5.35 | 0 | none |  |
| `genres-untouched.png` | Music you play: stored genres, untouched | Continue tapped | none | no | 5.35 | 0 | none |  |
| `instagram-saved-back-on-review.png` | Instagram saved, back on Review | row gone: yes; page loads after tap: 0 | none | no | 5.35 | 0 | none | body=[{"instagram":"simon.dances"}] |
| `refusal-instagram_taken-23505.png` | server answers instagram_taken-23505 | under Instagram: That Instagram is already on another profile. Check the spelling, or message us if it is yours.; top: - | none | no | 4.81 | 0 | none | body=[{"instagram":"simon.dances"}] |
| `refusal-invalid_instagram.png` | server answers invalid_instagram | under Instagram: Enter your Instagram handle (like @yourname) or a full instagram.com link.; top: - | none | no | 4.81 | 0 | none | body=[{"instagram":"simon.dances"}] |
| `refusal-other-23505-slug.png` | server answers other-23505-slug | under Instagram: -; top: Something went wrong. Check your connection and try again.Try again | none | no | 4.66 | 0 | none | body=[{"instagram":"simon.dances"}] |
| `row-dj_answer-base-complete.png` | row `dj_answer` / base-complete | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [dj] | none | no | 5.35 | 0 | none |  |
| `row-dj_answer-base-incomplete.png` | row `dj_answer` / base-incomplete | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [dj] | none | no | 5.35 | 0 | none |  |
| `row-dj_answer-no_profile.png` | row `dj_answer` / no_profile | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [person-nodancer] | none | no | 5.35 | 0 | none |  |
| `row-dj_genres-base-complete.png` | row `dj_genres` / base-complete | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [djgenres] | none | no | 5.35 | 0 | none |  |
| `row-dj_genres-base-incomplete.png` | row `dj_genres` / base-incomplete | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [djgenres] | none | no | 5.35 | 0 | none |  |
| `row-dj_genres-no_profile.png` | row `dj_genres` / no_profile | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [person-nodancer] | none | no | 5.35 | 0 | none |  |
| `row-instagram-base-complete.png` | row `instagram` / base-complete | landed /app/me/edit?focus=instagram&returnTo=%2Faccount%2Fp3%2Fstart%3Fo%3Da0000000-0000-4000-8000-000000000001%26at%3Dreview | none | no | 4.81 | 0 | input#instagram |  |
| `row-instagram-base-incomplete.png` | row `instagram` / base-incomplete | landed /app/me/edit?focus=instagram&returnTo=%2Faccount%2Fp3%2Fstart%3Fo%3Da0000000-0000-4000-8000-000000000001%26at%3Dreview | none | no | 4.81 | 0 | input#instagram |  |
| `row-instagram-no_profile.png` | row `instagram` / no_profile | landed /app/me/edit?focus=instagram&returnTo=%2Faccount%2Fp3%2Fstart%3Fo%3Da0000000-0000-4000-8000-000000000001%26at%3Dreview | none | no | 5.84 | 0 | none |  |
| `row-later_item-base-complete.png` | row `later_item` / base-complete | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [elsewhere] | none | no | 5.35 | 0 | none |  |
| `row-later_item-base-incomplete.png` | row `later_item` / base-incomplete | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [elsewhere] | none | no | 5.35 | 0 | none |  |
| `row-later_item-no_profile.png` | row `later_item` / no_profile | landed /account/p3/start?o=a0000000-0000-4000-8000-000000000001&at=review [elsewhere] | none | no | 5.35 | 0 | none |  |
| `website-m-link-ig-empty-stored-empty-after.png` | same, after Save | Instagram box `x`; Website box ``; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"instagram":"x"}] |
| `website-m-link-ig-empty-stored-empty-typed.png` | Website `https://m.instagram.com/x` over an empty Website, Instagram empty: typed, before Save | note: This is an Instagram link, so saving puts it in your Instagram instead.; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-m-link-ig-empty-stored-site-after.png` | same, after Save | Instagram box `x`; Website box ``; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"instagram":"x","website_url":null}] |
| `website-m-link-ig-empty-stored-site-typed.png` | Website `https://m.instagram.com/x` over a stored site, Instagram empty: typed, before Save | note: This is an Instagram link, so saving puts it in your Instagram instead.; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-normal-site-ig-empty-stored-empty-after.png` | same, after Save | Instagram box ``; Website box `https://simonliftslife.com`; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"website_url":"https://simonliftslife.com"}] |
| `website-normal-site-ig-empty-stored-empty-typed.png` | Website `https://simonliftslife.com` over an empty Website, Instagram empty: typed, before Save | note: -; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-normal-site-ig-empty-stored-site-after.png` | same, after Save | Instagram box ``; Website box `https://simonliftslife.com`; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"website_url":"https://simonliftslife.com"}] |
| `website-normal-site-ig-empty-stored-site-typed.png` | Website `https://simonliftslife.com` over a stored site, Instagram empty: typed, before Save | note: -; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-post-link-ig-empty-stored-empty-after.png` | same, after Save | Instagram box ``; Website box `https://www.instagram.com/p/abc`; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"website_url":"https://www.instagram.com/p/abc"}] |
| `website-post-link-ig-empty-stored-empty-typed.png` | Website `https://www.instagram.com/p/abc` over an empty Website, Instagram empty: typed, before Save | note: -; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-post-link-ig-empty-stored-site-after.png` | same, after Save | Instagram box ``; Website box `https://www.instagram.com/p/abc`; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"website_url":"https://www.instagram.com/p/abc"}] |
| `website-post-link-ig-empty-stored-site-typed.png` | Website `https://www.instagram.com/p/abc` over a stored site, Instagram empty: typed, before Save | note: -; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-profile-link-ig-different-stored-empty-after.png` | same, after Save | Instagram box `someoneelse`; Website box `https://www.instagram.com/simonliftslife/`; error: This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram. | none | no | 4.81 | 0 | none | calls=0 body=[] |
| `website-profile-link-ig-different-stored-empty-typed.png` | Website `https://www.instagram.com/simonliftslife/` over an empty Website, Instagram someoneelse: typed, before Save | note: -; error: This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram.; Save OFF (Fix the fields marked above, then save.) | none | no | 4.81 | 0 | none |  |
| `website-profile-link-ig-different-stored-site-after.png` | same, after Save | Instagram box `someoneelse`; Website box `https://www.instagram.com/simonliftslife/`; error: This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram. | none | no | 4.81 | 0 | none | calls=0 body=[] |
| `website-profile-link-ig-different-stored-site-typed.png` | Website `https://www.instagram.com/simonliftslife/` over a stored site, Instagram someoneelse: typed, before Save | note: -; error: This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram.; Save OFF (Fix the fields marked above, then save.) | none | no | 4.81 | 0 | none |  |
| `website-profile-link-ig-empty-stored-empty-after.png` | same, after Save | Instagram box `simonliftslife`; Website box ``; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"instagram":"simonliftslife"}] |
| `website-profile-link-ig-empty-stored-empty-typed.png` | Website `https://www.instagram.com/simonliftslife/` over an empty Website, Instagram empty: typed, before Save | note: This is an Instagram link, so saving puts it in your Instagram instead.; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-profile-link-ig-empty-stored-site-after.png` | same, after Save | Instagram box `simonliftslife`; Website box ``; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"instagram":"simonliftslife","website_url":null}] |
| `website-profile-link-ig-empty-stored-site-typed.png` | Website `https://www.instagram.com/simonliftslife/` over a stored site, Instagram empty: typed, before Save | note: This is an Instagram link, so saving puts it in your Instagram instead.; error: -; Save on | none | no | 4.81 | 0 | none |  |
| `website-profile-link-ig-same-stored-empty-after.png` | same, after Save | Instagram box `simonliftslife`; Website box `https://www.instagram.com/simonliftslife/`; error: - | none | no | 4.81 | 0 | none | calls=0 body=[] |
| `website-profile-link-ig-same-stored-empty-typed.png` | Website `https://www.instagram.com/simonliftslife/` over an empty Website, Instagram simonliftslife: typed, before Save | note: Your Instagram is already this name, so it is not kept here.; error: -; Save OFF (Nothing has changed yet. Edit a field above to save.) | none | no | 4.81 | 0 | none |  |
| `website-profile-link-ig-same-stored-site-after.png` | same, after Save | Instagram box `simonliftslife`; Website box ``; error: - | none | no | 4.81 | 0 | none | calls=1 body=[{"website_url":null}] |
| `website-profile-link-ig-same-stored-site-typed.png` | Website `https://www.instagram.com/simonliftslife/` over a stored site, Instagram simonliftslife: typed, before Save | note: Your Instagram is already this name, so it is not kept here.; error: -; Save on | none | no | 4.81 | 0 | none |  |

Calls with no picture of their own (DJ steps):

- "Do you DJ?" untouched, Continue tapped: Continue is `aria-disabled`, reason "Answer to continue.", **0 calls**.
- "No" then Continue: exactly one call, `set_my_role_declined_v1 {p_role:"dj", p_declined:true}`, back on Review.
- "Yes" then "Bachata, Kizomba" then Continue: `set_my_role_intent_v1 {p_roles:["dj"]}` then `save_my_role_v1 {p_role:"dj", p_patch:{genres:["Bachata","Kizomba"]}}`.
- "Music you play" with stored genres, untouched, Continue tapped: **0 calls**.

## Vitest

`npx vitest run src/modules/dancer-app src/modules/organiser/p3/onboarding`: **59 files, 1802 tests, all pass.**

## Verified / Not verified

**Verified:** the 36 walk tests above at 390x844 in Chromium, the request body of every save, the exact wording of every refusal, no bounce on any row x state cell, the no-reload return to Review, zero calls on untouched DJ answers, no sideways scroll, lowest contrast 4.66 (limit 4.5), no controls under 44px that a finger can reach; the vitest count above.

**Not verified:** anything on production data (no prod access, no Supabase read); a real account or real sign-in; a real server (every answer is a mock written from the handover's account of `save_my_dancer_profile_v2`, so a real `invalid_instagram`, a real 23505 or the real DETAIL text is not proved here); a real phone or Safari (Chromium only); dark mode; the `org_city`, `city` and other rows (the brief names four); desktop widths.
