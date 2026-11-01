#!/usr/bin/env python3
"""Approach C, round 3: "Pick first", redrawn to cover the whole field inventory
(INVENTORY.md). Reuses the shared pieces in build.py, so A and B stay as they
were. build.py calls write_c3() for c.html; nothing else writes c.html."""
import datetime as dt
from build import (FRI, TUE, day, top, foot, row, card, chips, field, sheet, phone, shot,
                   s_page_pick, s_venue, s_gate, s_leave, home_after_leave, done, blocked,
                   offline_banner, loading_page)

SAT = dt.date(2026, 11, 7)      # first Saturday of November
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
CAP_NOTE = "We list the next 30 dates and add more as they pass."  # dateCap.ts MAX_UPCOMING
GAP = '<span class="p3-tag p3-tag-warn">New here</span>'  # in admin / the database, not yet in the Website


def g3b(items, picked=()):
    """3-column grid of choices; each is (title, line)."""
    return '<div class="m-g3">' + "".join(
        f'<button class="p3-choice" aria-checked="{"true" if i in picked else "false"}"><span class="p3-row-t">{t}</span>'
        f'<span class="p3-row-s">{s}</span></button>' for i, (t, s) in enumerate(items)) + "</div>"


def ask(legend, body):
    return f'<fieldset class="p3-ask"><legend>{legend}</legend>{body}</fieldset>'


def note(t):
    return f'<p class="p3-note">{t}</p>'


def err(t):
    return f'<p class="p3-error" role="alert">{t}</p>'


def btn(t, cls="", dis=""):
    return f'<button class="p3-btn {cls}"{" disabled" if dis else ""}>{t}</button>' + (note(dis) if dis else "")


# ---------- C1: the fork ----------
KINDS = [
    ("One date", "A party or social on one night"),
    ("Weekly", "Same night every week, or a few weekdays"),
    ("Monthly", "For example the first Saturday"),
    ("Course", "Set number of classes, for example 8 Tuesdays"),
    ("Workshop", "One day of classes with teachers"),
    ("Festival", "Several days, passes, a line-up"),
    ("Class, then party", "Two sessions on the same night"),
    ("Online", "A class or talk on a video link"),
    ("Other dates", "Dates that follow no pattern"),
]


def c_fork(picked=()):
    m = ('<h2 class="p3-h2">What are you listing?</h2>' + g3b(KINDS, picked) +
         note("You can change the dates later. Repeating events can also stop repeating."))
    return phone(top("New event"), m)


# ---------- the form, shaped by the kind ----------
FORMS = {
    "one": dict(title="New one date", name="Saturday Social at The Loft", where="The Loft, Shoreditch",
                when=[("Date", day(SAT))], sess="Party 21:00&ndash;02:00", price="Free"),
    "weekly": dict(title="New weekly", name="Bachata Tuesdays and Thursdays", where="Studio 68, Hackney",
                   when=[("Repeats", "Every Tuesday and Thursday"), ("Starts", day(TUE)), ("Ends", "Keeps going")],
                   sess="Class 19:00&ndash;20:00, Party 20:00&ndash;23:00", price="&pound;12 at the door", level="Beginner, Improver"),
    "monthly": dict(title="New monthly", name="First Saturday Bachata Social", where="Rumba Bar, Soho",
                    when=[("Repeats", "The first Saturday of each month"), ("Starts", day(SAT)), ("Ends", "Keeps going")],
                    sess="Party 21:00&ndash;02:00", price="Ticket link &middot; &pound;15"),
    "course": dict(title="New course", name="Beginners Bachata, 8 weeks", where="Studio 68, Hackney",
                   when=[("Repeats", "Every Tuesday"), (f"Classes {GAP}", f"8 &middot; {day(TUE)} to {day(TUE + dt.timedelta(weeks=7))}")],
                   sess="Class 19:00&ndash;20:30", price="&pound;80 for the course", level="Beginner"),
    "workshop": dict(title="New workshop", name="Sensual Footwork Day with Ana &amp; Leo", where="Pineapple Studios, Covent Garden",
                     when=[("Date", day(SAT + dt.timedelta(weeks=2)))],
                     sess="3 sessions &middot; 12:00&ndash;17:00", price="Sell tickets here &middot; &pound;45", level="Intermediate"),
    "festival": dict(title="New festival", name="London Bachata Weekender", where="Hilton Metropole, Paddington",
                     when=[("Days", "Friday 5 March to Sunday 7 March &middot; 3 days")],
                     sess="14 sessions over 3 days", price="Ticket link &middot; festivals sell through their own site"),
    "online": dict(title="New online", name="Bachata Musicality, live online", where="Online &middot; video link added",
                   when=[("Repeats", "Every other Wednesday"), ("Starts", "Wednesday 4 November")],
                   sess="Class 19:00&ndash;20:00", price="&pound;6 ticket link"),
}


def c_form(kind, stage="ready", extra="", lead=""):
    f = FORMS[kind]
    done_cls = "m-done"
    where_t = "Link" if kind == "online" else "Where"
    whens = "".join(row(t, s, "Change", done_cls) for t, s in f["when"])
    body = row(where_t, f["where"], "Change", done_cls) + whens + row("Sessions", f["sess"] + " &middot; times live on sessions", "Change", done_cls)
    if f.get("level"):
        body += row("Level", f["level"], "Change", done_cls)
    body += row("Price", f["price"], "Change", done_cls)
    more = (row("Description, styles, age, dress code", "Optional", "Add") + row("Line-up", "DJs and teachers", "Add") +
            row("Organisers", "Latin Fire London &middot; add a co-host", "Add") + row("Contact and links", "Group chat, Instagram, website", "Add") +
            row("Gallery and video", "Up to 30 photos, 10 video links", "Add") +
            row("Guest list, raffle, promo codes", "Optional", "Add"))
    if kind in ("weekly", "monthly", "course", "online"):
        more += row("Dates taken off", "None yet", "Add")
    photo = ('<div class="m-ph on">Photo added</div>' if stage == "ready"
             else '<button class="m-ph">Add a photo &mdash; JPEG, PNG or WebP under 10 MB</button>')
    m = (lead + extra + field("Name", f["name"], hint="Up to 120 letters.") + card("Needed to go live", body) + photo +
         card("Optional, now or later", more))
    off = "" if stage == "ready" else "Add a photo to go live."
    return phone(top(f["title"], "Back"), m, foot("Go live", "Save draft", off))


def c_empty():
    """Nothing filled yet: every required row says what is missing; Go live says why it is off."""
    body = (row("Where", "Not set", "Pick", "") + row("Repeats", "Not set", "Pick") + row("Sessions", "Add at least one session with its times", "Add") +
            row("Price", "Free, at the door or tickets", "Pick"))
    m = (field("Name", "", "For example First Saturday Bachata Social", "Up to 120 letters.") + card("Needed to go live", body) +
         '<button class="m-ph">Add a photo &mdash; JPEG, PNG or WebP under 10 MB</button>')
    return phone(top("New monthly", "Back"), m, foot("Go live", "Save draft", "Go live needs: a name, where, when, one session and a photo. Save draft works now."))


def c_name_error():
    m = (field("Name", "", "") + err("Give the event a name. Dancers search by it.") +
         card("Needed to go live", row("Where", "The Loft, Shoreditch", "Change", "m-done") + row("Date", day(SAT), "Change", "m-done")))
    return phone(top("New one date", "Back"), m, foot("Go live", "Save draft", "Add a name to save or go live."))


# ---------- repeat sheets (every rule the database holds) ----------
def interval_ask(unit, picked):
    opts = {"weeks": ["Every week", "Every 2 weeks", "Every 3 weeks", "Every 4 weeks"],
            "months": ["Every month", "Every 2 months", "Every 3 months", "Every 4 months"]}[unit]
    return ask("How often", chips(opts, (picked,)))


def repeat_tabs(on):
    return chips(["Weekly", "Monthly", "Chosen dates", "One date"], (on,))


def s_rep_weekly(interval=0):
    days = chips(DAYS, (1, 3) if interval == 0 else (4,))
    nxt = ("Tuesday 3 November, Thursday 5 November, Tuesday 10 November" if interval == 0
           else "Friday 6 November, Friday 20 November, Friday 4 December")
    b = (repeat_tabs(0) + ask("On which days", days) + interval_ask("weeks", interval) +
         note(f"Next: {nxt}. {CAP_NOTE}") + btn("Done"))
    return sheet("How does it repeat?", b)


def s_rep_monthly_nth(every=0):
    b = (repeat_tabs(1) + ask("Pattern", chips(["A weekday of the month", "A day number", "A weekday, except the last"], (0,))) +
         ask("Which one", chips(["First", "Second", "Third", "Fourth", "Last"], (0,))) +
         ask("Weekday", chips(DAYS, (5,))) + interval_ask("months", every) +
         note(("The first Saturday of each month. Next: Saturday 7 November, Saturday 5 December, Saturday 2 January."
               if every == 0 else "The first Saturday of every 3 months. Next: Saturday 7 November, Saturday 6 February, Saturday 1 May.")) + btn("Done"))
    return sheet("How does it repeat?", b)


def s_rep_monthly_multi():
    b = (repeat_tabs(1) + ask("Pattern", chips(["A weekday of the month", "A day number", "A weekday, except the last"], (0,))) +
         ask("Which ones (pick one or more)", chips(["First", "Second", "Third", "Fourth", "Last"], (0, 2))) +
         ask("Weekday", chips(DAYS, (5,))) + interval_ask("months", 0) +
         note("The first and third Saturday of each month. Next: Saturday 7 November, Saturday 21 November, Saturday 5 December.") + btn("Done"))
    return sheet("How does it repeat?", b)


def s_rep_monthly_day(day_n=15):
    grid = '<div class="m-g7">' + "".join(
        f'<button aria-pressed="{"true" if n == day_n else "false"}">{n}</button>' for n in range(1, 32)) + "</div>"
    warn = ("" if day_n < 29 else
            '<p class="p3-warn">Not every month has a 31st. Those months get no date: we will show you which before you go live.</p>')
    nxt = ("The 15th of each month. Next: Sunday 15 November, Tuesday 15 December, Friday 15 January." if day_n < 29
           else "The 31st of each month. Next: Saturday 31 October, Thursday 31 December, Sunday 31 January (no date in November).")
    b = (repeat_tabs(1) + ask("Pattern", chips(["A weekday of the month", "A day number", "A weekday, except the last"], (1,))) +
         ask("Day of the month", grid) + interval_ask("months", 0) + warn + note(nxt) + btn("Done"))
    return sheet("How does it repeat?", b)


def s_rep_except_last():
    b = (repeat_tabs(1) + ask(f"Pattern {GAP}", chips(["A weekday of the month", "A day number", "A weekday, except the last"], (2,))) +
         ask("Weekday", chips(DAYS, (4,))) +
         note("Every Friday, except the last Friday of the month (that night the big monthly party runs instead). "
              "Next: Friday 6 November, Friday 13 November, Friday 20 November, then Friday 4 December.") + btn("Done"))
    return sheet("How does it repeat?", b)


def s_rep_custom(state="list"):
    picked = ["Saturday 7 November", "Saturday 21 November", "Friday 18 December", "Saturday 9 January"]
    rows = "".join(row(p, "21:00&ndash;02:00 from your sessions", "Remove") for p in picked)
    b = repeat_tabs(2) + note("Pick each date. Each one gets the same sessions; change one date later on the event page.")
    if state == "empty":
        b += '<div class="p3-card p3-inset p3-state"><strong>No dates yet</strong><p>Add the first date. Up to 30 upcoming dates can be listed at once.</p></div>'
    else:
        b += f'<div class="p3-card p3-tight"><ul class="p3-list p3-flush">{rows}</ul></div>'
    b += '<button class="p3-btn p3-btn-line">Add a date</button>' + btn("Done", dis="" if state != "empty" else "Add at least one date.")
    return sheet(f"Which dates? {GAP}", b)


def s_ends(state="never"):
    ends = chips(["Keeps going", "On a date", "After a number of dates"], ({"never": 0, "date": 1, "bad": 1, "count": 2, "toomany": 2}[state],))
    b = ask("Ends", ends)
    if state == "never":
        b += note(f"Keeps going. {CAP_NOTE} Stop it any time from the event page.")
    elif state == "date":
        b += field("Last date", "Saturday 5 June 2027", hint="8 dates: Saturday 7 November to Saturday 5 June. Up to 24 months ahead.")
    elif state == "bad":
        b += field("Last date", "Saturday 31 October 2026") + err("The last date is before the first date, Saturday 7 November. Pick a later one.")
    elif state == "count":
        b += field("Number of dates", "16", hint="16 dates: Tuesday 3 November to Tuesday 16 February.")
    else:
        b += field("Number of dates", "600") + err("Up to 500 dates. Pick 500 or fewer, or Keeps going. We list the next 30 at a time.")
    b += btn("Done", dis="" if state in ("never", "date", "count") else "Fix the date first.")
    return sheet("When does it end?", b)


def s_taken_off():
    rows = (row("Thursday 24 December", "Christmas Eve", "Put back") + row("Thursday 31 December", "New Year&rsquo;s Eve", "Put back"))
    b = (note("Dates you skip stay off the calendar. Dancers who saved them are told.") +
         f'<div class="p3-card p3-tight"><ul class="p3-list p3-flush">{rows}</ul></div>' +
         '<button class="p3-btn p3-btn-line">Take a date off</button>' + btn("Done"))
    return sheet("Dates taken off", b)


# ---------- sessions: times live here, not on the event ----------
SECTION = ["Class", "Masterclass", "Party", "Performance"]  # programmeModel.ts session types


def sess_card(i, kind, start, end, level="", warn=""):
    lv = ask("Level", chips(["Beginner", "Improver", "Intermediate", "Advanced", "Open level"], (0,))) if level else ""
    return (f'<div class="p3-card p3-inset"><strong>Session {i}</strong>' + chips(SECTION, (SECTION.index(kind),)) +
            '<div class="p3-pair">' + field("Starts", start) + field("Ends", end, hint="Ends the next day" if end < start else "") + "</div>" +
            (err(warn) if warn else "") + lv + "</div>")


def s_sessions(state="two"):
    if state == "two":
        b = (note("An event has no start or end of its own. It shows <strong>19:00 to 23:00</strong>: first session start to last session end.") +
             sess_card(1, "Class", "19:00", "20:00", level=True) + sess_card(2, "Party", "20:00", "23:00") +
             '<button class="p3-btn p3-btn-line">Add a session</button>' + btn("Done"))
    elif state == "error":
        b = (sess_card(1, "Class", "19:00", "19:00", warn="A session must end after it starts.") +
             btn("Done", dis="Fix the session times first."))
    else:  # empty
        b = ('<div class="p3-card p3-inset p3-state"><strong>No sessions yet</strong><p>Add one with its start and end. '
             'A party night is one session; a class and a party are two.</p></div>' +
             '<button class="p3-btn">Add a session</button>')
    return sheet("Sessions", b)


def s_festival_days():
    rows = (row("Friday 5 March", "5 sessions &middot; 20:00&ndash;04:00", "Edit") + row("Saturday 6 March", "6 sessions &middot; 12:00&ndash;05:00", "Edit") +
            row("Sunday 7 March", "3 sessions &middot; 13:00&ndash;23:00", "Edit"))
    b = (note("Each day has its own sessions and rooms. The festival shows first day to last day.") +
         '<div class="p3-pair">' + field("First day", "Friday 5 March") + field("Last day", "Sunday 7 March") + "</div>" +
         f'<div class="p3-card p3-tight"><ul class="p3-list p3-flush">{rows}</ul></div>' +
         field("Rooms", "Main room, Workshop room A, Workshop room B") + btn("Done"))
    return sheet(f"Festival days {GAP}", b)


# ---------- price ----------
def s_price(state="door"):
    opts = chips(["Free", "Pay at the door", "Ticket link", "Sell tickets here"], ({"free": 0, "door": 1, "link": 2, "stripe": 3, "nostripe": 3}[state],))
    b = ask("How do dancers pay?", opts)
    if state == "free":
        b += note("Shows as Free on the event.")
    elif state == "door":
        b += field("Price", "12", hint="In pounds. Add a lower price for students below.") + field("Student price (optional)", "", "For example 10") + \
             ask("They can pay by", chips(["Cash", "Bank transfer"], (0, 1)))
    elif state == "link":
        b += field("Ticket link", "https://www.eventbrite.co.uk/e/first-saturday", hint="Must start with https://") + field("Price from", "15")
    elif state == "stripe":
        b += ('<div class="p3-card p3-tight"><ul class="p3-list p3-flush">' + row("Full day", "&pound;45 &middot; 60 places", "Edit") +
              row("Morning only", "&pound;25 &middot; 30 places", "Edit") + '</ul></div><button class="p3-btn p3-btn-line">Add a ticket type</button>')
    else:
        b += '<p class="p3-warn">Selling tickets here needs a payout account on your page first. It takes about 5 minutes.</p>' + \
             '<button class="p3-btn p3-btn-line">Set up payouts</button>'
    b += btn("Done", dis="Set up payouts or pick another way to pay." if state == "nostripe" else "")
    return sheet("Price", b)


# ---------- optional details (all optional; none blocks Go live) ----------
def s_details():
    b = (field("Description", "Social dancing all night: 70% bachata, 30% salsa. Beginners welcome.", hint="Up to 4,000 letters.") +
         ask("Music styles", chips(["Bachata", "Sensual", "Dominican", "Salsa", "Kizomba", "Brazilian Zouk", "Merengue", "Reggaeton", "Urban Kiz", "Cuban"], (0, 1, 3))) +
         ask("Levels", chips(["Beginner", "Improver", "Intermediate", "Advanced", "Open level"], (4,))) +
         ask(f"Age {GAP}", chips(["All ages", "18+", "21+"], (1,))) +
         field(f"Dress code {GAP}", "", "For example Smart casual") +
         field(f"Places {GAP}", "", "Leave empty for no limit") +
         ask(f"Taught in {GAP}", chips(["English", "Spanish", "Portuguese"], (0,))) + btn("Done"))
    return sheet("Description and details", b)


def s_lineup(state="list"):
    rows = (row("DJ Kali", "DJ &middot; on Bachata Calendar", "Remove") + row("Ana &amp; Leo", "Teachers &middot; on Bachata Calendar", "Remove"))
    b = note("People sit on a session: teaching, DJing, MC or performing.") + field("Search DJs and teachers", "kal" if state == "list" else "Marco Ruiz")
    if state == "list":
        b += f'<div class="p3-card p3-tight"><ul class="p3-list p3-flush">{rows}</ul></div>'
    else:
        b += ('<div class="p3-card p3-inset p3-state"><strong>No profile called &ldquo;Marco Ruiz&rdquo;</strong>'
              '<p>Add the name as plain text now. It links up when Marco makes a profile.</p></div><button class="p3-btn p3-btn-line">Add &ldquo;Marco Ruiz&rdquo; as text</button>')
    return sheet("Line-up", b + btn("Done"))


def s_orgs():
    rows = row("Latin Fire London", "Your page &middot; main organiser", "") + row("Bachata Lab Brixton", "Co-host &middot; waiting for them to accept", "Remove")
    b = (f'<div class="p3-card p3-tight"><ul class="p3-list p3-flush">{rows}</ul></div>' + field("Add a co-host", "", "Search organiser pages") +
         note("A co-host can edit this event and it shows on their page too.") + btn("Done"))
    return sheet("Organisers", b)


def s_media(state="ok"):
    b = '<div class="m-ph on">Cover photo</div>' if state == "ok" else '<button class="m-ph">Add a cover photo</button>'
    if state == "big":
        b += err("That photo is 14 MB. Pick one under 10 MB (JPEG, PNG or WebP).")
    b += (ask("Gallery", '<div class="m-g3"><div class="m-ph on"></div><div class="m-ph on"></div><button class="m-ph">Add</button></div>') +
          field("Video link", "https://youtu.be/abc123", hint="YouTube or Instagram.") + btn("Done"))
    return sheet("Photos and video", b)


def s_links():
    b = (field("Group chat", "https://chat.whatsapp.com/&hellip;", hint="WhatsApp or Telegram invite.") + field("Instagram", "@firstsaturdaybachata") +
         field("Website", "") + field("Facebook", "") + field("TikTok", "") + btn("Done"))
    return sheet("Contact and links", b)


def s_online():
    b = (field("Video link", "https://zoom.us/j/&hellip;", hint="Only dancers with a ticket see it, from 1 hour before.") +
         ask("Time zone", chips(["London", "Other"], (0,))) + note("No venue needed. The event shows &ldquo;Online&rdquo; instead of a place.") + btn("Done"))
    return sheet(f"Online {GAP}", b)


def s_extras():
    b = (ask("Guest list", chips(["Off", "On"], (1,))) + field("Guest list places", "40") + ask("When it is full", chips(["Closed", "Waiting list"], (1,))) +
         ask("Raffle", chips(["Off", "On"], (0,))) + field("Promo code", "", "For example EARLYBIRD") + btn("Done"))
    return sheet("Guest list, raffle, promo codes", b)


# ---------- after create: copy and cancel ----------
def s_copy():
    b = (note("Copies the name, place, sessions, price and details into a new draft. Pick its dates next.") +
         field("Name of the copy", "First Saturday Bachata Social (copy)") + btn("Make the copy"))
    return sheet(f"Copy this event {GAP}", b)


def s_cancel(kind="date"):
    if kind == "date":
        b = (note("Only Saturday 5 December is cancelled. The rest of the series stays live.") +
             field("Reason dancers see (optional)", "Venue closed for a private party") +
             '<button class="p3-btn p3-btn-danger">Cancel Saturday 5 December</button><button class="p3-btn p3-btn-line">Keep it</button>')
        return sheet("Cancel one date?", b)
    b = (note("All future dates are cancelled and marked Cancelled on the calendar. Past dates stay as a record.") +
         '<button class="p3-btn p3-btn-danger">Cancel the whole event</button><button class="p3-btn p3-btn-line">Keep it</button>')
    return sheet("Cancel this event?", b)


def event_page_after():
    m = ('<div class="m-ph on">Photo</div><div class="p3-head"><span class="p3-row-tags"><span class="p3-tag p3-tag-live"><span class="p3-dot"></span>Live</span>'
         '<span class="p3-chip">Monthly</span></span><p class="p3-name">First Saturday Bachata Social</p>'
         '<p class="p3-when">The first Saturday of each month, 21:00 to 02:00, from your sessions</p></div>' +
         card("This event", row("Copy this event", "A new draft with the same details", "Copy") + row("Cancel a date", "Saturday 5 December and others", "Pick") +
              row("Pause", "Hide it from the calendar for a while", "Pause") + row("End the run", "Stops future dates, keeps the record", "End") +
              row("Cancel the whole event", "Future dates only", "Cancel")))
    return phone(top("Event", "Home"), m)


def approach_c3():
    """Numbered in order, so inserting a phone never leaves a gap or a 15b."""
    import re
    return [re.sub(r"<h2>C\d+b? &middot; ", f"<h2>C{i} &middot; ", h, count=1).replace("m-phone\"", "m-phone m-long\"", 1)
            for i, h in enumerate(_shots(), 1)]


def _shots():
    W = top("New weekly", "Back")
    M = top("New monthly", "Back")
    O = top("New one date", "Back")
    sh = shot
    return [
        sh("C1 &middot; Pick what it is", "Nine kinds in a 3-column grid. Monthly, Workshop, Festival, Online and Other dates are new.", c_fork()),
        sh("C2 &middot; Page picker (2+ pages only)", "", phone(top("New event"), "", "", s_page_pick())),
        sh("C3 &middot; Empty form", "Every required row says what is missing; Go live says why it is off. Save draft works.", c_empty()),
        sh("C4 &middot; Name missing", "Error state: nothing saves without a name.", c_name_error()),
        sh("C5 &middot; One date, free", "", c_form("one", "part")),
        sh("C6 &middot; Weekly class, two weekdays, paid", "Weekly with Tuesday and Thursday, class then party.", c_form("weekly")),
        sh("C7 &middot; Monthly social", "", c_form("monthly")),
        sh("C8 &middot; Course, 8 classes", "", c_form("course")),
        sh("C9 &middot; Workshop day with a line-up", "", c_form("workshop")),
        sh("C10 &middot; Festival, 3 days", "Admin-only today: a GAP drawn so it can be planned.", c_form("festival")),
        sh("C11 &middot; Online", "GAP: livestream_url exists in the database, no Website field.", c_form("online")),
        sh("C12 &middot; Repeat: weekly, several weekdays", "", phone(W, "", "", s_rep_weekly(0))),
        sh("C13 &middot; Repeat: every other week", "", phone(W, "", "", s_rep_weekly(1))),
        sh("C14 &middot; Repeat: monthly, nth weekday", "First / Second / Third / Fourth / Last.", phone(M, "", "", s_rep_monthly_nth(0))),
        sh("C15 &middot; Repeat: every 3 months", "", phone(M, "", "", s_rep_monthly_nth(2))),
        sh("C15b &middot; Repeat: first and third Saturday", "Several weekdays of the month (multi_nth_weekday).", phone(M, "", "", s_rep_monthly_multi())),
        sh("C16 &middot; Repeat: monthly, day of month", "", phone(M, "", "", s_rep_monthly_day(15))),
        sh("C17 &middot; Repeat: the 31st (warning)", "Months without that day get no date, said before going live.", phone(M, "", "", s_rep_monthly_day(31))),
        sh("C18 &middot; Repeat: every Friday except the last", "A real production rule (weekday_except_last).", phone(W, "", "", s_rep_except_last())),
        sh("C19 &middot; Repeat: chosen dates", "", phone(O, "", "", s_rep_custom())),
        sh("C20 &middot; Chosen dates, none yet", "Empty state; Done disabled with a reason.", phone(O, "", "", s_rep_custom("empty"))),
        sh("C21 &middot; Ends: keeps going", "Within the 12-month listing cap.", phone(M, "", "", s_ends("never"))),
        sh("C22 &middot; Ends: on a date", "", phone(M, "", "", s_ends("date"))),
        sh("C23 &middot; Ends: last date before first", "Error state.", phone(M, "", "", s_ends("bad"))),
        sh("C24 &middot; Ends: after 16 dates", "", phone(W, "", "", s_ends("count"))),
        sh("C25 &middot; Ends: over the cap", "Error state.", phone(W, "", "", s_ends("toomany"))),
        sh("C26 &middot; Dates taken off", "", phone(W, "", "", s_taken_off())),
        sh("C27 &middot; Sessions: class then party", "Times live on sessions. Level sits on the class session.", phone(W, "", "", s_sessions("two"))),
        sh("C28 &middot; Sessions: none yet", "", phone(O, "", "", s_sessions("empty"))),
        sh("C29 &middot; Sessions: end not after start", "", phone(O, "", "", s_sessions("error"))),
        sh("C30 &middot; Festival days and rooms", "GAP: admin-only today.", phone(top("New festival", "Back"), "", "", s_festival_days())),
        sh("C31 &middot; Price: free", "", phone(O, "", "", s_price("free"))),
        sh("C32 &middot; Price: at the door", "", phone(W, "", "", s_price("door"))),
        sh("C33 &middot; Price: ticket link", "", phone(M, "", "", s_price("link"))),
        sh("C34 &middot; Price: sell tickets here", "Stripe ticket types (behind the ticketing switch today).", phone(top("New workshop", "Back"), "", "", s_price("stripe"))),
        sh("C35 &middot; Price: no payout account", "Disabled with a reason.", phone(O, "", "", s_price("nostripe"))),
        sh("C36 &middot; Description and details", "Age, dress code, places and language are GAPs (no column today).", phone(M, "", "", s_details())),
        sh("C37 &middot; Line-up", "", phone(top("New workshop", "Back"), "", "", s_lineup())),
        sh("C38 &middot; Line-up: no profile", "", phone(top("New workshop", "Back"), "", "", s_lineup("none"))),
        sh("C39 &middot; Organisers and co-hosts", "", phone(M, "", "", s_orgs())),
        sh("C40 &middot; Photos and video", "", phone(M, "", "", s_media())),
        sh("C41 &middot; Photo too big", "", phone(M, "", "", s_media("big"))),
        sh("C42 &middot; Contact and links", "", phone(M, "", "", s_links())),
        sh("C43 &middot; Online link", "", phone(top("New online", "Back"), "", "", s_online())),
        sh("C44 &middot; Guest list, raffle, promo codes", "", phone(M, "", "", s_extras())),
        sh("C45 &middot; Where: results", "", phone(W, "", "", s_venue("list"))),
        sh("C46 &middot; Where: loading", "", phone(W, "", "", s_venue("loading"))),
        sh("C47 &middot; Where: could not load", "", phone(W, "", "", s_venue("error"))),
        sh("C48 &middot; Venue not found", "", phone(W, "", "", s_venue("none"))),
        sh("C49 &middot; Offline", "", c_form("weekly", extra=offline_banner())),
        sh("C50 &middot; A few details first", "", phone(W, "", "", s_gate())),
        sh("C51 &middot; Cancel mid-way", "", phone(W, "", "", s_leave())),
        sh("C52 &middot; Draft kept on Home", "", home_after_leave()),
        sh("C53 &middot; Live", "", done(True)),
        sh("C54 &middot; Saved as draft", "", done(False)),
        sh("C55 &middot; Loading", "", loading_page()),
        sh("C56 &middot; No page yet", "", blocked("nopage")),
        sh("C57 &middot; Page not live", "", blocked("notlive")),
        sh("C58 &middot; After create: copy, cancel", "", event_page_after()),
        sh("C59 &middot; Copy this event", "", phone(top("Event", "Home"), "", "", s_copy())),
        sh("C60 &middot; Cancel one date", "", phone(top("Event", "Home"), "", "", s_cancel("date"))),
        sh("C61 &middot; Cancel the whole event", "", phone(top("Event", "Home"), "", "", s_cancel("all"))),
    ]


def write_c3(page):
    page("c.html", "P3 create C r3: pick first, full inventory", approach_c3(),
         '<p style="color:#fff;max-width:900px">Round 3: every row of <a style="color:#fff" href="INVENTORY.md">INVENTORY.md</a> is drawn. '
         'A gold &ldquo;New here&rdquo; tag marks a GAP: the admin app or the database has it, the Website does not yet.</p>')
