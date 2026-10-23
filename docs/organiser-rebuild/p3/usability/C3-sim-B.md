# C3 simulated organiser B (Dee, 34, DJ, three events) on mockup C3 @ be017c5a

Method per `R-C3-sim.md`: Playwright Chromium 390x844, light theme, fresh load per task, "Show me my week" first, acting only
on screenshot plus accessibility snapshot. Shots in `shots-B/`.
Hard-nosed note: Dee reads headings and button words, never grey helper lines.

## 1. Results

| # | Task | Outcome | Taps used / shortest | Wrong taps | Stalls |
|---|------|---------|----------------------|-----------|--------|
| 1 | Tonight's Fridays: teacher + going | done with trouble | 0 / 0 (opened "14 going" once to check: +1) | 0 | 1 (teacher vs DJ) |
| 2 | Friday class 8:30pm from now on | done with trouble | 4 / 4 (event row, Class row, Starts field, Save for all dates) | 0 | 1 (stale header) |
| 3 | Cancel Sat 31 Oct, venue closed | done | 6 / 6 (event, date tile, Cancel this date, Next, reason, Cancel) | 0 | 0 |
| 4 | Sofia Ramos on Fri 30 Oct class only | done with trouble | 8 / 8 (event, 30 tile, Change line-up, Next, Add someone, Add, Save + name typing) | 0 | 1 (Sofia/Sofie/"Marco & Sofia") |
| 5 | Sat ticket link change | done with trouble | 4 / 4 (event, Ticket link, field, Save) | 0 | 1 (no Save while typing) |
| 6 | Hide Mambo City x LLB | done | 4 / 4 (See all 12, event, Pause this event, Pause it) | 0 | 0 |
| 7 | New monthly social, first Sat, 9pm, Studio 68, class before | done with trouble | 13 / 13 (Events tab, Add, monthly, name, Next, Sat, Next, Add one before, Add this session, Next, Studio 68, Next, Skip, Put it live = 14 with my second Next) | 0 | 2 (no Next while typing; "8pm" on review) |
| 8 | Views of Sensual Fridays, 30 days | done | 1 / 1 (Stats tab) | 0 | 1 (big 893 is all events) |

No give-ups, no wrong taps, no returns to start. (The mockup was kind about words; see friction for what a 5-minute-between-sets person still trips on.)

## 2. Friction list, worst first

1. **Review screen says "8pm" for a 9pm party** (task 7, step 6 "Looks good?", `shots-B/t7-review-8pm.png`).
   I set "Starts at 9pm", added a class before it, and the review's When row reads "Every month on the first Saturday, 8pm".
   Dee: "I said 9pm. Did it lose that?" I expected 9pm, or the party time. Sessions row says "8pm Class, 9pm Party", so it is
   explainable, but Dee reads the bold line only. **Major** (unsure it saved the right thing). Same pattern on event page headers
   ("Every Saturday, 8pm", "Starts 8pm (from the first session)").
2. **Header line not updated after changing the class time** (task 2, `shots-B/t2-saved-stale-header.png`).
   After "Saved for every date. Dancers see it now." the line under the title still reads "Every Friday, 8pm · Colab Tower",
   while "Starts 8:30pm" and the Class row say 8:30pm. Dee: "Did it save? It still says 8." Expected one time everywhere.
   **Major** (unsure it saved). Also the Home card and Events list still say 8pm (not rechecked after save).
3. **No Next / Save button while a text field is focused** (task 5 `shots-B/t5-no-save-while-typing.png`; task 7
   `shots-B/t7-no-continue-while-typing.png`). After typing the link / the name, the bottom button vanished; Dee looked for
   "Save"/"Next" and found nothing, then tapped blank text to get it back. Possibly deliberate (keyboard open) and my headless
   run has no real keyboard, so unverified on a phone. **Major if real** (two screens without progress = back to start).
4. **Who is teacher vs DJ on the Home card** (task 1, `shots-B/t1-home.png`). "Marco & Sofia, DJ Kizzy" is a small grey
   line with no role words. Dee reads headings and buttons only, so would answer "Marco & Sofia, DJ Kizzy teach" or skip it.
   Expected "Teachers: / DJ:". **Minor** (right answer only by reading the grey line).
5. **Name collision for the task 4 person** (`shots-B/t4-saved.png`). Class is "Marco & Sofia", the extra masterclass is
   "Sofie Lane", the person to add is "Sofia Ramos". Typing "Sofia" showed only Sofia Ramos (good) but the page afterwards
   reads "Marco & Sofia, teachers" with her. Dee: "which Sofia is on?" **Minor**; data-driven, not the UI's fault.
6. **Which tap for the line-up on a single date** (task 4). Three plausible doors: the 30 Oct tile's Class row, "Change line-up
   Who teaches or DJs, per session", and the event-level "Line-up · 3 people". Dee picked "Change line-up" and it worked
   (it opened "Fri 30 Oct only"). **Minor** (a choice among three, no harm).
7. **Big "893 views" is all events, Fridays' 300 sits below** (task 8, `shots-B/t8-stats.png`). Dee reads the big number first.
   "893 views" next to the 30 days switch looks like the answer. Expected the event name on the number. **Minor**
   (wrong-number risk; right one found by the "By event" heading).
8. **After "Put it live" the screen is Home with a toast** (task 7, `shots-B/t7-after-live-home.png`). The new event is not on
   screen; "Dancers can find it now" is the only sign. Dee: "where is it?" **Minor**.
9. **"Add one before"** (task 7). Reads incomplete ("one what?"). It was the right button for "a class before the party" and
   the sheet opened pre-set to Class 8pm to 9pm, so Dee got there. **Minor** guessed word.
10. **"No name yet" on the new class row** (task 7). Dee did not understand whether the class needed a name. **Minor**.
11. **"Pause this event" for "hide it"** (task 6): the word "Pause" is not "hide", but the sub-line is grey. The sheet says
    "It disappears from the calendar until you turn it back on." Dee trusted it. **Minor**.
12. **Cancel sheet toast omits the reason** (task 3, `shots-B/t3-cancelled.png`): "Sat 31 Oct is cancelled. Dancers see it
    now." The tile turns "Cancelled", good, but nothing re-states "venue isn't available". **Minor** (Dee trusts it anyway).

## 3. What worked without any thought

- Home card shows tonight's night, teachers/DJ and "14 going · see who" with no tap (task 1).
- "Cancel this date" -> "This date only" pre-selected -> reasons as plain sentences; "venue isn't available" matched my words
  exactly; the struck-through "31 Cancelled" tile is a clear result (task 3).
- Line-up screen headed "FRI 30 OCT ONLY" and "Line-up saved for Fri 30 Oct only. Dancers see it now." (task 4).
- "Pause this event / Hidden until you turn it back on. Dates kept." plus a confirm that says it disappears (task 6).
- Monthly social wizard: "1 of 6", plain questions, 9pm default, summary line "Every month on the first Saturday, 9pm",
  place list with Studio 68 present, "Skip for now" on payment (task 7).
- Stats tab opens on 30 days with the event list sorted into rows (task 8).
- Every save gave a plain "Saved. Dancers see it now." toast with Undo.

## 4. Honest limits

- One simulated persona driven by an AI that reads every word; Dee's impatience is imitated, not measured. Real thumbs would
  likely miss more (grey helper lines, the bottom-bar behaviour, the 13.5px phone scaling not applying to a mockup).
- Headless Chromium has no on-screen keyboard: friction 3 may be the mockup hiding the bar deliberately for the keyboard.
- Some taps used selectors on the accessibility snapshot rather than a pixel tap; tap counts are therefore a floor. A few
  harness misfires (a substring text match hitting a different button) were my tool's, not Dee's, and are not counted.
- "Shortest path" is the path I found; I did not search for shorter. Mockup data only, no real-data shapes.
- Tasks 1 to 8 were each started from a fresh load; state (e.g. the 8:30 change) did not carry between tasks.
- The mockup and its notes were not modified.
