# C3 simulated organiser C (Sam, 27, first social next month)

Mockup `C3.html` at be017c5a, read-only. Chromium 390x844, light theme, fresh load per task, "Show me my week"
first, no Tour. I acted only on a screenshot plus the accessibility snapshot of the current screen. The harness
replayed my tap list from a fresh load each step, so each screen was seen at the moment I acted on it.
Shots: `shots-C/` (only the ones cited).

## 1. Results

| Task | Outcome | Taps used / shortest | Wrong taps | Stalls |
|---|---|---|---|---|
| 1 Tonight's Sensual Fridays: teacher, going | done with trouble | 1 / 1 (Show me my week; answer is on Home) | 0 | 1 (who "teaches"?) |
| 2 Friday class 8:30pm from now on | done with trouble | 5 / 5 (Show, Events, Sensual Fridays, Class row, Save for all dates; time typed) | 0 | 2 |
| 3 Cancel Sat 31 Oct, venue closed, say why | done | 8 / 8 (Show, Events, Saturdays, 31, Cancel this date, Next, reason, Yes cancel) | 0 | 0 |
| 4 Sofia Ramos on Fri 30 Oct class only | done with trouble | 9 / 9 (Show, Events, Fridays, 30, Change line-up, Next, Add someone (Class), Sofia Ramos, Save line-up; name typed) | 0 | 2 |
| 5 Sat ticket link to sat-new | done with trouble | 6 / 6 (Show, Events, Saturdays, Ticket link row, type, tap off field, Save) | 0 | 2 |
| 6 Hide Mambo City x LLB, keep it | done | 5 / 5 (Show, Events, Mambo City, Pause this event, Pause it) | 0 | 1 (two rows both say Pause/Live) |
| 7 New monthly social, 1st Sat, 9pm, Studio 68, class before | done with trouble | 15 / 15 (Show, Events, Add an event, monthly social, tap off the name field, Next, Sat, Next, Add one before, Add this session, Next, Studio 68, Next, Skip for now, Put it live; name typed) | 0 | 2 |
| 8 Views of Sensual Fridays, 30 days | done | 2 / 2 (Show, Stats) | 0 | 1 (300 vs table) |

Taps count every tap including Show me my week; typing is not counted, tapping off a field is. No give-ups, no wrong taps. The words matched
my goals every time, so every finding below is a stall or a doubt, not a detour. I did not search for the task
words; I picked the visible control whose words matched.

## 2. Friction list, worst first

1. **Task 2, major: the page contradicts itself after the save.** Fri 23 Oct card header still reads "Every
   Friday, 8pm · Colab Tower" while the line under it says "Starts 8:30pm (from the first session)" and the Class
   row says 8:30pm. Sam: "which is it? I just changed it, why does the big line still say 8pm? Did it save?"
   I went back to check the Class row and date chips. Expected the headline to say 8:30pm.
   Shot: `t2-header-8pm-vs-830.png`. (I did not check the Home card or the event list rows for this.)
2. **Task 7, major: "When" on the review screen says 8pm, and I typed 9pm.** Step 2 asked "Starts at 9pm".
   Step 3 added a class one hour before. The review shows "When: Every month on the first Saturday, 8pm",
   and the new event page header also says 8pm. Sam: "I said 9pm. Is 9pm gone? Is the party at 8pm now?"
   The Sessions row below ("8pm Class, 9pm Party") clears it up, but only if I read it. Expected "9pm" next to
   "When", or the word "class" in it. Also at step 2 "Starts at" (9pm already filled in) did not say whether
   that is the class or the party; I only learned it from step 3 ("We started one for you: Party").
   Shots: `t7-starts-at-9pm.png`, `t7-review-when-8pm.png`.
3. **Task 5, major: the save button vanishes while the cursor is in the field.** Before typing the footer said
   "Nothing changed yet". After typing the new link the footer was empty (both fill and real keystrokes). Sam:
   "where's Save? did I break it?" I tapped the grey helper text to leave the field and "Save" appeared. Expected
   the footer to turn into Save the moment I typed. On a real phone the on-screen keyboard may cover this
   anyway; I could not test that. Shots: `t5-save-button-gone.png`, `t5-save-after-blur.png`.
4. **Task 4, minor: three near-identical names.** The same page has "Sofie Lane" (extra masterclass),
   "Marco & Sofia" (Class) and the person I wanted, "Sofia Ramos". Sam: "which Sofia is already on? Is Sofia
   Ramos the Sofia in Marco & Sofia?" I typed "Sofia" and the result list showed only Sofia Ramos, which settled
   it. After saving, the Class row on the event page still reads "Marco & Sofia, teachers" and does not name
   Sofia Ramos (that is correct, it is date-only; the row says "Different on 2 dates: 30 Oct, 6 Nov", which I
   could not tie to my change). Shot: `t4-sofia-search.png`.
5. **Task 4, minor: "Add someone to this session" appears under every session.** I had to read the card
   headings to know which session I was adding to. The label under the field ("Add someone to: 8pm Class")
   confirmed it after the tap, not before.
6. **Task 2, minor: the Class row says "Every date" but Sam still asked "every week or just this one?"**
   The sheet subtitle "Sensual Fridays · Every date" and the button "Save for all dates" answered it, but a
   cancel on the same event asks "Cancel which dates?". Here no choice was offered, so I could not say "from the
   next one". It also changed tonight (Fri 23 Oct, "Next") to 8:30pm. I wanted "from the next one" to leave
   tonight at 8pm; nothing let me say that. (Tonight is the next one, so the result is right for the task.)
7. **Task 1, minor: "Marco & Sofia, DJ Kizzy" has no word saying who teaches.** I guessed Marco & Sofia teach
   and Kizzy DJs. "14 going · see who" answered the second half. Shot: `t1-home-next-up.png`.
8. **Task 5, minor: toast "Saved. Dancers see it now." doesn't name what was saved.** I checked the Ticket link
   row to see the new link. It was there.
9. **Task 6, minor: "Live · Pause or end it" and "Pause this event" sit one under the other.** I paused for a
   second over "end it" (does it delete?). "Dates kept" and the confirmation sheet ("Your dates and line-up are
   kept") settled it.
10. **Task 8, minor: "300 views" on the Fridays row vs the "date by date" table.** The table rows I could see
    (2, 9, 16, 23, 30 Oct) add up to 197, not 300. Sam: "where are the other 103?" The 30 days toggle was already
    on, so the number itself was easy to find.
11. **Task 3, minor: "Keep it" on the cancel sheet.** It means "don't cancel". I read it as "keep the reason".

## 3. What worked without any thought

- The "What are you adding?" sheet: "Same night every week" / "Just one date" / "E.g. the first Saturday of every
  month" answered "every week or just this one?" at once. Picked "A monthly social" without a pause.
- Cancel flow: "Cancel which dates?" with "This date only Sat 31 Oct" already ticked, then the reason list, then
  a red "Yes, cancel this date". After it: the 31 chip struck through, toast "Dancers see it now", and the date
  sheet states "Dancers see 'Cancelled: The venue isn't available'". I trusted that fully.
- Pause flow: "Paused · dancers can't see it", "Your dates are kept". Trusted.
- The monthly-social wizard: 6 steps with "1 of 6", "Add one before" for the class, "Start one hour before
  Party, so it ends when that starts", the review screen with Change links, and "Put it live" /
  "Save for later (only you see it)". The word "session" is explained on screen the first time it appears.
- The Sofia Ramos search by first name, and "Teaches" already ticked on a new teacher.
- Stats opens on "30 days"; the By event list names Sensual Fridays with a number.
- Home "Next up · Tonight" card answered task 1 with zero taps.

## 4. Honest limits

- I am an AI that reads every word, so I stall less than a person; I reported every hesitation anyway. I did not
  explain any away. Real people may skim past things I read (the Sessions row on the review screen).
- Desktop Chromium at 390x844: no real touch, no on-screen keyboard. The save-button finding (3) may look
  different on a phone, where the keyboard hides the footer. Native time pickers were filled by script
  (value set), not by tapping the clock.
- A fresh load per task means I never saw the effect of one task on the next (e.g. task 2's 8:30pm is not there
  in task 4's screens).
- I did not scroll the event page by hand: Playwright scrolled to the control it clicked. For tasks 5 and the
  Ticket link row a person has to scroll about two screens past "About this event" first; I did not measure
  how long that takes or whether a person finds it.
- I did not look at the dancer-facing page ("See what dancers see") in any task; "dancers see it" is only what
  the toasts and sheets say. I did not check the Home card or event list for 8:30pm after task 2.
- In task 7 I did not look at the Sessions screen after "Add this session" (I tapped Next straight away); I saw
  the result on the review screen and on the new event page.
- Task 4: the Class row text did not show Sofia Ramos on the event page; I checked the saved toast
  ("Line-up saved for Fri 30 Oct only") and did not open the date to read the line-up back.
- Persona C only. Maria and Dee will hit different things.
