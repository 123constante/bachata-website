# C3 simulated organiser A: Maria, 52

Mockup C3 at be017c5a, 390x844, light theme, fresh load per task, start via "Show me my week". Persona: slow reader, taps the first thing that looks roughly right, afraid a wrong tap tells 300 dancers something false. All eight tasks finished; no wrong taps, no give-ups. Taps below count from the home screen (after "Show me my week"), typing and scrolling not counted.

## 1. Table

| # | Task | Outcome | Taps used / shortest | Wrong taps | Stalls |
|---|------|---------|----------------------|-----------|--------|
| 1 | Tonight's Fridays: teacher and going | done with trouble | 0 / 0 | 0 | 1 (who is "teaching"?) |
| 2 | Friday class 8pm -> 8:30pm from now on | done with trouble | 6 / 5 (Events, Sensual Fridays, 8pm Class row, time field, Save for all dates) | 0 | 3 |
| 3 | Cancel Sat 31 Oct, venue closed | done | 7 / 7 | 0 | 0 |
| 4 | Add Sofia Ramos to Fri 30 Oct class only | done | 9 / 9 | 0 | 0 |
| 5 | Saturdays ticket link to sat-new | done with trouble | 7 / 6 (Events, Saturdays, Ticket link, field, tap away, Save) | 0 | 2 |
| 6 | Pause Mambo City x LLB | done | 4 / 4 | 0 | 0 |
| 7 | New monthly social, first Sat, 9pm, Studio 68, class before | done with trouble | 14 / 13 | 0 | 2 |
| 8 | Views of Sensual Fridays, 30 days | done | 1 / 1 (Stats) | 0 | 0 |


## 2. Friction list, worst first

1. **Task 2, major: the page contradicts itself after saving.** After "Save for all dates" (toast: "Saved for every date. Dancers see it now.") the heading still reads "Every Friday, 8pm · Colab Tower" while the line under it says "Starts 8:30pm (from the first session)". Maria: "Which one do the dancers see? Did it save?" She would go back and check. Shot: `shots-A/t2-header-still-8pm.png`.
2. **Task 2, major: "from the next one" is not answered.** The sheet only offers "Save for all dates". Maria asked for "every Friday from the next one" and the next date is tonight, Fri 23 Oct, so she cannot tell whether tonight changes too. She expected words like "from Fri 23 Oct on" or "this and later ones" (the Cancel and Line-up sheets offer that choice; this one does not). Also the earlier rows say "Different on 1 date: 6 Nov" and she cannot tell whether those dates also moved.
3. **Task 5, major (unsure it saved): no Save button while typing.** Once the cursor is in the Link field the bottom button disappears (it said "Nothing changed yet" before). Maria: "Where do I press?" Only after tapping empty space does "Save" appear. Shot: `shots-A/t5-no-save-button.png`. After saving she is returned to the top of the event page and has to scroll to the bottom to see the new link.
4. **Task 7, minor-to-major: the review says 8pm for a 9pm night.** She picked 9pm as the start; the summary says "Every month on the first Saturday, 8pm" and "8pm Class, 9pm Party · 8pm to 1am". Also the new class shows "No name yet" in grey. Maria: "I said nine. Is that wrong?" Shot: `shots-A/t7-review-8pm-vs-9pm.png`. Also after "Put it live" she lands on Home with a toast that disappears quickly, and the first card is still Sensual Fridays; she would open Events to check it exists.
5. **Task 1, minor: "who is teaching".** Home shows "Marco & Sofia, DJ Kizzy" in small grey text with no labels. She had to guess that Marco & Sofia teach and DJ Kizzy plays music. Shot: `shots-A/t1-home-next-up.png`.
6. **Task 2, minor: dead taps.** Tapping the big "Sensual Fridays" title on Home, and the "Every Friday, 8pm" line on the event page, does nothing. She expected either to open the event / edit the time. Shot: `shots-A/t2-dead-tap-home-title.png`. She then scrolled and found "Sessions every date".
7. **Task 4, minor: lookalike names.** The same sheet lists "Masterclass with Sofie Lane" (extra, 30 Oct) next to the class she was adding "Sofia Ramos" to. A second of doubt that she had the right person.
8. **Words guessed at:** "Sessions every date", "Repeats", "Extra, this date only" (understood from context); "Ran 52 times since 2024" on Stats (she read it as "ran" like a race).

## 3. What worked without any thought

- Cancel flow (task 3): "Cancel this date" -> "This date only" already ticked -> reasons in plain words ("The venue isn't available") -> toast "Sat 31 Oct is cancelled. Dancers see it now." with Bring it back. She felt safe.
- "Pause this event: Hidden until you turn it back on. Dates kept." matched her goal word for word (task 6); the confirm sheet and the "Paused" label made it obvious.
- Line-up flow (task 4): "Type a name, e.g. Sofia", "Add", "Save line-up" and the toast "Line-up saved for Fri 30 Oct only"; the date sheet afterwards shows "Sofia Ramos, teacher" and "Only this date".
- Stats (task 8): 30 days is already selected, "By event" lists Sensual Fridays with "300 views" at once.
- "What are you adding?" with "A monthly social: E.g. the first Saturday of every month" (task 7), and the wizard defaults (First, 9pm, class one hour before the party).
- Every save gave a toast that says "Dancers see it now."

## 4. Honest limits

- This is an AI playing Maria: it reads every word and does not slow down, mishear or mis-tap, so real stumbles will be more frequent. Nothing was a give-up, but that does not mean a 52-year-old would not give up.
- I used coordinate taps from screenshots and the accessibility snapshot. The bottom sheets did not show up in the snapshot, so for them I relied on the screenshot only.
- Headless Chromium has no on-screen keyboard, so the "Save disappears" finding on a phone may be worse (keyboard on top) or hidden by the keyboard in a different way.
- Time inputs were typed with the keyboard, not the native picker wheel.
- Task 7 needed a name that the task did not give ("First Saturday Social"). Verification of "dancers see it" is limited to the toasts and lists inside the mockup.
- Screenshots were renumbered when my driver restarted; the cited ones were re-captured from the same steps.
- Only the cited screenshots are included.
