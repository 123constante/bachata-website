#!/usr/bin/env python3
"""Writes the P3 create-event mockups (a.html, b.html, c.html, index.html).
Plain HTML that links the REAL tokens file, so open the output from a checkout:
no build. Re-run with `python3 docs/design/p3-create-event/build.py`."""
import datetime as dt, os

HERE = os.path.dirname(os.path.abspath(__file__))
TOKENS = "../../../src/modules/organiser/p3/theme/p3.css"
TODAY = dt.date(2026, 10, 30)

def day(d):  # full weekday, no abbreviations
    return f"{d:%A} {d.day} {d:%B}"

FRI = TODAY + dt.timedelta(days=7)          # Friday 6 November
TUE = dt.date(2026, 11, 3)                  # Tuesday 3 November
NAME_LONG = "Bachata Sensual Social &amp; Workshop Night at The Loft"  # 53 chars, the prod max

# ---------- pieces ----------
def top(title, left="Cancel", right=""):
    r = f'<button class="m-x">{right}</button>' if right else '<span style="width:44px"></span>'
    return f'<header class="p3-top"><button class="m-x">{left}</button><h1>{title}</h1>{r}</header>'

def steps(n, of):
    return '<div class="m-steps">' + "".join(f'<i class="{"on" if i < n else ""}"></i>' for i in range(of)) + "</div>"

def foot(primary, second="", off=""):
    note = f'<p class="p3-note" style="padding:0 16px 8px">{off}</p>' if off else ""
    dis = " disabled" if off else ""
    s = f'<button class="p3-btn p3-btn-line">{second}</button>' if second else ""
    return f'{note}<div class="m-foot">{s}<button class="p3-btn"{dis}>{primary}</button></div>'

def row(t, s="", end="Change", cls=""):
    sub = f'<span class="p3-row-s">{s}</span>' if s else ""
    e = f'<span class="m-row-end">{end}</span>' if end else ""
    return (f'<li class="p3-row {cls}"><button class="p3-status-row" style="background:none;padding:0">'
            f'<span class="p3-grow"><span class="p3-row-t" style="display:block">{t}</span>'
            f'<span class="p3-row-s" style="display:block">{s}</span></span>{e}</button></li>')

def card(h, body, flush=False):
    return f'<section><h2 class="p3-h2">{h}</h2><div class="p3-card p3-tight"><ul class="p3-list p3-flush">{body}</ul></div></section>' if not flush else f'<section><h2 class="p3-h2">{h}</h2><div class="p3-card">{body}</div></section>'

def g3(items, picked=None):
    return '<div class="m-g3">' + "".join(
        f'<button class="p3-choice" aria-checked="{"true" if i == picked else "false"}"><span class="p3-row-t">{t}</span><span class="p3-row-s">{s}</span></button>'
        for i, (t, s) in enumerate(items)) + "</div>"

def chips(items, picked=()):
    return '<div class="p3-chips">' + "".join(
        f'<button aria-pressed="{"true" if i in picked else "false"}">{t}</button>' for i, t in enumerate(items)) + "</div>"

def field(label, value="", ph="", hint=""):
    h = f'<p class="p3-note p3-gap-t">{hint}</p>' if hint else ""
    return f'<label class="p3-field">{label}<input class="p3-in p3-gap-t" value="{value}" placeholder="{ph}"></label>{h}'

def sheet(title, body, close="Close"):
    return (f'<div class="p3-scrim"><div class="p3-sheet" role="dialog"><div class="p3-sheet-head"><h3>{title}</h3>'
            f'<button class="m-x">{close}</button></div>{body}</div></div>')

def phone(inner, main="", foot_html="", over="", tabs=False):
    tb = ('<nav class="p3-tabs"><a class="p3-tab" aria-current="page">Home</a><a class="p3-tab">Events</a>'
          '<a class="p3-tab">Stats</a><a class="p3-tab">You</a></nav>') if tabs else ""
    return f'<div class="p3-theme p3-frame m-phone">{inner}<main class="p3-main"><div class="p3-stack">{main}</div></main>{foot_html}{tb}{over}</div>'

def shot(title, note, html):
    return f'<figure class="m-shot" style="margin:0"><h2>{title}</h2>{html}<p>{note}</p></figure>'

KINDS = [("One night", "A single date"), ("Weekly", "Same night every week"), ("Course", "Set number of weeks")]
WHAT = [("Party", "Social dancing"), ("Class", "Teaching"), ("Class, then party", "Two sessions"),]
WHAT_MORE = ["Masterclass", "Performance"]

# ---------- shared sheets (same in every approach) ----------
def s_page_pick():
    b = ('<p class="p3-note">You run more than one page. The event shows under the page you pick.</p><div class="p3-stack-s">'
         '<button class="p3-choice" aria-checked="true"><span class="p3-row-t">Latin Fire London</span><span class="p3-row-s">Live &middot; 4 events</span></button>'
         '<button class="p3-choice"><span class="p3-row-t">Bachata Lab Brixton</span><span class="p3-row-s">Live &middot; 1 event</span></button></div>'
         '<button class="p3-btn">Continue</button>')
    return sheet("Which page is this for?", b, "Cancel")

def s_venue(state):
    head = field("Search venues", "loft" if state == "list" else ("salsa lab" if state == "none" else ""), "Type part of the venue name")
    if state == "loading":
        body = '<div class="m-skel"></div><div class="m-skel" style="width:70%"></div><div class="m-skel"></div><p class="p3-note">Loading venues&hellip;</p>'
    elif state == "error":
        body = ('<p class="p3-error" role="alert">We could not load the venue list. Check your signal and try again.</p>'
                '<button class="p3-btn p3-btn-line">Try again</button>')
    elif state == "none":
        body = ('<div class="p3-card p3-inset p3-state"><strong>No venue matches &ldquo;salsa lab&rdquo;</strong>'
                '<p>Try another word from its name, or tell us about it. We add new venues within a day and fill it in on your event.</p></div>'
                + field("Venue name", "Salsa Lab") + field("Address or postcode", "", "For example SE1 7PB") +
                '<button class="p3-btn">Send us this venue</button>'
                '<button class="p3-link">Skip for now &mdash; save the event as a draft without a venue</button>')
    else:
        body = '<ul class="p3-list p3-flush">' + row("The Loft", "Shoreditch &middot; London", "Pick") + row("The Loft Studios", "Camden &middot; London", "Pick") + row("Loftus Hall", "Croydon &middot; London", "Pick") + "</ul><p class=\"p3-note\">3 venues match. Not here? Keep typing or scroll to &ldquo;Tell us about it&rdquo;.</p>"
    return sheet("Where is it?", head + body)

def s_when(kind):
    d = FRI if kind != "course" else TUE
    base = (field("First date", day(d), hint="Pick any date &mdash; not only the next 30 days.") +
            '<div class="p3-pair">' + field("Starts", "20:00") + field("Ends", "02:00", hint="Ends the next day") + "</div>")
    if kind == "weekly":
        nxt = ", ".join(day(d + dt.timedelta(weeks=i)) for i in range(1, 4))
        base += ('<fieldset class="p3-ask"><legend>Repeats</legend>' + chips(["Every Friday", "Every other Friday"], (0,)) +
                 '</fieldset><fieldset class="p3-ask"><legend>Runs until</legend>' + chips(["Keeps going", "A date I pick"], (0,)) +
                 f'</fieldset><p class="p3-note">Next: {nxt}. We list 30 dates ahead and keep adding.</p>')
    if kind == "course":
        last = d + dt.timedelta(weeks=7)
        base += ('<fieldset class="p3-ask"><legend>How many weeks?</legend>' + chips(["4", "6", "8", "10", "12", "Other"], (2,)) +
                 f'</fieldset><p class="p3-note">8 sessions, every Tuesday: {day(d)} to {day(last)}. Skip a week later from the event page.</p>')
    return sheet("When is it?", base + '<button class="p3-btn">Done</button>')

def s_what():
    b = ('<p class="p3-note">This becomes the first session. You can add more, a line-up and levels later.</p>' + g3(WHAT, 2) +
         chips(WHAT_MORE) + '<div class="p3-card p3-inset"><strong>Class 20:00&ndash;21:00</strong>Party 21:00&ndash;02:00</div>'
         '<fieldset class="p3-ask"><legend>Level (class)</legend>' + chips(["Beginner", "Improver", "Intermediate", "Advanced", "Open level"], (0, 1)) +
         '</fieldset><button class="p3-btn">Done</button>')
    return sheet("What happens?", b)

def s_gate():
    b = ('<p class="p3-note">&ldquo;Friday Bachata at The Loft&rdquo; is saved as a draft. Before it goes live, answer 2 quick questions so dancers know who runs it.</p>'
         '<ul class="p3-list p3-flush">' + row("About you", "Your name as dancers see it", "1 left") + row("About your page", "City and a short line", "1 left") +
         '</ul><button class="p3-btn">Continue</button><button class="p3-btn p3-btn-line">Not now &mdash; keep it as a draft</button>')
    return sheet("A few details first", b, "Close")

def s_leave():
    b = ('<p class="p3-note">We keep what you have done as a draft. Pick it up any time from Home, under Drafts. Nobody else can see it.</p>'
         '<button class="p3-btn">Keep as draft and leave</button><button class="p3-btn p3-btn-line">Keep going</button>'
         '<button class="p3-btn p3-btn-danger">Delete this draft</button>')
    return sheet("Leave this event?", b, "Close")

def home_after_leave():
    m = ('<section><h2 class="p3-h2">Drafts <span class="p3-count">1</span></h2><div class="p3-card p3-tight"><ul class="p3-list p3-flush">'
         + row("Friday Bachata at The Loft", "Weekly &middot; first date " + day(FRI) + " &middot; needs a photo", "Finish") +
         '</ul></div></section><section><h2 class="p3-h2">Coming up</h2><div class="p3-card"><strong>Latin Fire Sundays</strong>Sunday 1 November, 19:00</div></section>')
    over = '<div class="p3-toast" style="bottom:76px">Draft kept. Finish it from here.<button class="p3-link p3-toast-act">Open</button></div>'
    return phone('<header class="p3-top"><h1>Home</h1></header>', m, "", over, tabs=True)

def blocked(kind):
    if kind == "nopage":
        t, p, b = "Set up your page first", "An event belongs to a page. Create or claim yours, then come back here.", "Set up my page"
    else:
        t, p, b = "You cannot start an event yet", "Latin Fire London is not live yet, so it cannot take events. We check new pages within a day.", "See my page"
    m = f'<div class="p3-card p3-state"><strong>{t}</strong><p>{p}</p><button class="p3-btn">{b}</button></div>'
    return phone(top("New event", "Back"), m)

def offline_banner():
    return '<p class="p3-error" role="alert">Your phone seems to be offline, so this may not have saved. What you typed is still here. <button class="p3-link" style="min-height:44px">Try again</button></p>'

def done(live=True):
    if live:
        m = ('<div class="m-ph on">Photo</div><div class="p3-head"><span class="p3-row-tags"><span class="p3-tag p3-tag-live"><span class="p3-dot"></span>Live</span><span class="p3-chip">Weekly</span></span>'
             f'<p class="p3-name">Friday Bachata at The Loft</p><p class="p3-when">{day(FRI)}, 20:00 &middot; then every Friday</p></div>'
             '<div class="p3-card"><strong>It is on the calendar</strong>Dancers can find it now. Add a line-up, a ticket link or more sessions any time.</div>')
        return phone(top("Event", "Home"), m, foot("Open event page", "Share"))
    m = ('<div class="p3-card p3-state"><strong>Saved as a draft</strong><p>Going live needs the next platform update. Your draft is safe on Home.</p></div>')
    return phone(top("Event", "Home"), m, foot("Open event page"))

def loading_page():
    return phone(top("New event"), '<div class="p3-card"><div class="m-skel" style="width:40%"></div><div class="m-skel"></div><div class="m-skel" style="width:80%"></div></div><p class="p3-note">Getting your page&hellip;</p>')

# ---------- Approach A: one scrolling page with sheets ----------
def a_page(stage, kind=1, extra=""):
    kinds = g3(KINDS, kind)
    filled = stage != "empty"
    name = field("What is it called?", NAME_LONG if stage == "long" else ("Friday Bachata at The Loft" if filled else ""), "For example Friday Bachata at The Loft", "Up to 120 letters." if not filled else "")
    k = ["one", "weekly", "course"][kind or 0]
    when_s = {"one": f"{day(FRI)}, 20:00&ndash;02:00", "weekly": f"Every Friday from {day(FRI)}, 20:00&ndash;02:00 &middot; keeps going",
              "course": f"8 Tuesdays, {day(TUE)} to {day(TUE + dt.timedelta(weeks=7))}, 19:00&ndash;20:30"}[k]
    rows = (row("Where", "The Loft, Shoreditch" if filled else "Pick a venue", "Change" if filled else "Pick", "m-done" if filled else "") +
            row("When", when_s if filled else "Date and time", "Change" if filled else "Pick", "m-done" if filled else "") +
            row("What happens", ("Class 19:00&ndash;20:30 &middot; Beginner" if k == "course" else "Class, then party") if filled else "First session", "Change" if filled else "Pick", "m-done" if filled else "") +
            row("Photo", "Added" if stage == "ready" else "Needed to go live", "Add", "m-done" if stage == "ready" else ""))
    m = (extra + '<section><h2 class="p3-h2">What are you listing?</h2>' + kinds + "</section><section>" + name + "</section>" +
         card("Details", rows) +
         ('<div class="m-ph on">Photo added</div>' if stage == "ready" else '<button class="m-ph">Add a photo &mdash; JPEG, PNG or WebP under 10 MB</button>'))
    left = 4 - (0 if stage == "empty" else (3 if stage == "ready" else 2 if stage == "long" else 1 if stage == "part" else 2))
    off = "" if stage == "ready" else ("Add a name, where, when and a photo to go live." if stage == "empty" else "Add a photo to go live.")
    return phone(top("New event", "Cancel"), m, foot("Go live", "Save draft", off))

def approach_a():
    S = []
    S.append(shot("A1 &middot; Empty page", "Everything on one screen. Rows open sheets; nothing is lost when a sheet closes.", a_page("empty", None)))
    S.append(shot("A2 &middot; Page picker (2+ pages only)", "Shown before the page when a login runs more than one page.", phone(top("New event"), "", "", s_page_pick())))
    S.append(shot("A3 &middot; Where: results", "Search narrows as you type; one tap picks.", phone(top("New event"), "", "", s_venue("list"))))
    S.append(shot("A4 &middot; Where: loading", "Skeleton rows while venues load.", phone(top("New event"), "", "", s_venue("loading"))))
    S.append(shot("A5 &middot; Where: could not load", "Error with a way out.", phone(top("New event"), "", "", s_venue("error"))))
    S.append(shot("A6 &middot; Venue not found", "New: tell us the venue, or skip and keep a draft. Today the wizard dead-ends here.", phone(top("New event"), "", "", s_venue("none"))))
    S.append(shot("A7 &middot; When: weekly", "Repeat and end are on the same sheet as date and time.", phone(top("New event"), "", "", s_when("weekly"))))
    S.append(shot("A8 &middot; When: course", "Number of weeks; the sheet spells out first and last date.", phone(top("New event"), "", "", s_when("course"))))
    S.append(shot("A9 &middot; What happens (first session)", "Seeds the first session(s); the event kind word comes from these.", phone(top("New event"), "", "", s_what())))
    S.append(shot("A10 &middot; Filled, photo missing", "Go live is off and says why.", a_page("part", 1)))
    S.append(shot("A11 &middot; Long name, offline", "53-letter name (longest in production) wraps; offline note keeps the typing.", a_page("long", 0, offline_banner())))
    S.append(shot("A12 &middot; Course, ready", "All four rows ticked.", a_page("ready", 2)))
    S.append(shot("A13 &middot; A few details first", "Onboarding gate on Go live. The draft is already saved.", phone(top("New event"), "", "", s_gate())))
    S.append(shot("A14 &middot; Cancel mid-way", "Cancel asks; keeping the draft is the first button.", phone(top("New event"), "", "", s_leave())))
    S.append(shot("A15 &middot; Draft kept on Home", "The draft says what it still needs.", home_after_leave()))
    S.append(shot("A16 &middot; Live", "", done(True)))
    S.append(shot("A17 &middot; Loading the page", "", loading_page()))
    S.append(shot("A18 &middot; No page yet", "", blocked("nopage")))
    S.append(shot("A19 &middot; Page not live", "", blocked("notlive")))
    S.append(shot("A20 &middot; Saved as draft (no Go live yet)", "While the platform cannot publish.", done(False)))
    return S

# ---------- Approach B: a short three-step stepper ----------
def b_step(n, kind=1, extra=""):
    if n == 1:
        m = (extra + '<section><h2 class="p3-h2">What are you listing?</h2>' + g3(KINDS, kind) + "</section>" +
             field("What is it called?", "Friday Bachata at The Loft", hint="Up to 120 letters."))
        f, t = foot("Next"), "1 of 3 &middot; What"
    elif n == 2:
        k = ["one", "weekly", "course"][kind or 0]
        m = (extra + card("Where", row("The Loft", "Shoreditch &middot; London", "Change", "m-done")) +
             '<section><h2 class="p3-h2">When</h2><div class="p3-card">' + field("First date", day(TUE if k == "course" else FRI)) +
             '<div class="p3-pair">' + field("Starts", "20:00") + field("Ends", "02:00", hint="Ends the next day") + "</div>" +
             ('<p class="p3-field">Repeats</p>' + chips(["Every Friday", "Every other Friday"], (0,)) + '<p class="p3-field">Runs until</p>' + chips(["Keeps going", "A date I pick"], (0,)) if k == "weekly" else "") +
             ('<p class="p3-field">How many weeks?</p>' + chips(["4", "6", "8", "10", "12", "Other"], (2,)) + f'<p class="p3-note p3-gap-t">8 Tuesdays, {day(TUE)} to {day(TUE + dt.timedelta(weeks=7))}.</p>' if k == "course" else "") +
             "</div></section>")
        f, t = foot("Next", "Back"), "2 of 3 &middot; Where and when"
    else:
        m = (extra + '<section><h2 class="p3-h2">What happens?</h2>' + g3(WHAT, 2) + '<div class="p3-gap-t">' + chips(WHAT_MORE) + "</div></section>" +
             '<div class="p3-card p3-inset"><strong>Class 20:00&ndash;21:00</strong>Party 21:00&ndash;02:00 &middot; change times later on the event page</div>' +
             '<section><h2 class="p3-h2">Photo</h2><button class="m-ph">Add a photo &mdash; JPEG, PNG or WebP under 10 MB</button></section>')
        f, t = foot("Go live", "Back", "Add a photo to go live."), "3 of 3 &middot; What happens"
    return phone(top(t, "Cancel") + steps(n, 3), m, f)

def approach_b():
    S = [shot("B1 &middot; Step 1: what and name", "Kind and name together: the draft is created when you press Next.", b_step(1, 1)),
         shot("B2 &middot; Page picker (2+ pages only)", "", phone(top("New event") + steps(0, 3), "", "", s_page_pick())),
         shot("B3 &middot; Step 2: where and when (weekly)", "One step holds venue, date, time and repeat.", b_step(2, 1)),
         shot("B4 &middot; Step 2: course", "Number of weeks replaces Repeats.", b_step(2, 2)),
         shot("B5 &middot; Where: results", "", phone(top("2 of 3 &middot; Where and when") + steps(2, 3), "", "", s_venue("list"))),
         shot("B6 &middot; Where: loading", "", phone(top("2 of 3 &middot; Where and when") + steps(2, 3), "", "", s_venue("loading"))),
         shot("B7 &middot; Where: could not load", "", phone(top("2 of 3 &middot; Where and when") + steps(2, 3), "", "", s_venue("error"))),
         shot("B8 &middot; Venue not found", "", phone(top("2 of 3 &middot; Where and when") + steps(2, 3), "", "", s_venue("none"))),
         shot("B9 &middot; Step 3: what happens and photo", "", b_step(3)),
         shot("B10 &middot; Step 3 offline", "", b_step(3, 1, offline_banner())),
         shot("B11 &middot; A few details first", "", phone(top("3 of 3 &middot; What happens") + steps(3, 3), "", "", s_gate())),
         shot("B12 &middot; Cancel mid-way", "", phone(top("2 of 3 &middot; Where and when") + steps(2, 3), "", "", s_leave())),
         shot("B13 &middot; Draft kept on Home", "", home_after_leave()),
         shot("B14 &middot; Live", "", done(True)),
         shot("B15 &middot; Loading", "", loading_page()),
         shot("B16 &middot; No page yet", "", blocked("nopage")),
         shot("B17 &middot; Page not live", "", blocked("notlive")),
         shot("B18 &middot; Saved as draft", "", done(False))]
    return S

# ---------- Approach C: pick what it is first, then a short page shaped to it ----------
def c_fork():
    big = "".join(f'<button class="p3-choice" style="padding:12px"><span class="p3-row-t">{t}</span><span class="p3-row-s">{s}</span></button>' for t, s in [
        ("One night", "A party or workshop on one date. For example a Saturday social."),
        ("Weekly night", "The same night every week, keeps going. For example Friday Bachata."),
        ("Course", "A set number of weekly classes. For example 8 Tuesdays for beginners."),
        ("Class, then party", "A weekly class followed by social dancing.")])
    return phone(top("New event"), '<h2 class="p3-h2">What are you listing?</h2><div class="p3-stack-s">' + big + "</div>")

def c_form(kind, extra="", stage="part"):
    title = {"one": "New one night", "weekly": "New weekly night", "course": "New course"}[kind]
    when = {"one": row("When", f"{day(FRI)}, 20:00&ndash;02:00", "Change", "m-done"),
            "weekly": row("Every", "Friday, 20:00&ndash;02:00", "Change", "m-done") + row("Starts", day(FRI) + " &middot; keeps going", "Change", "m-done"),
            "course": row("Every", "Tuesday, 19:00&ndash;20:30", "Change", "m-done") + row("Weeks", f"8 &middot; {day(TUE)} to {day(TUE + dt.timedelta(weeks=7))}", "Change", "m-done") +
                      row("Level", "Beginner", "Change", "m-done")}[kind]
    what = row("What happens", "Party", "Change", "m-done") if kind == "one" else ("" if kind == "course" else row("What happens", "Party", "Change", "m-done"))
    m = (extra + field("Name", "Friday Bachata at The Loft" if kind != "course" else "Beginners Bachata, 8 weeks") +
         card("Details", row("Where", "The Loft, Shoreditch", "Change", "m-done") + when + what) +
         ('<div class="m-ph on">Photo added</div>' if stage == "ready" else '<button class="m-ph">Add a photo &mdash; JPEG, PNG or WebP under 10 MB</button>'))
    return phone(top(title, "Back"), m, foot("Go live", "Save draft", "" if stage == "ready" else "Add a photo to go live."))

def approach_c():
    T = top("New weekly night", "Back")
    return [shot("C1 &middot; Pick what it is", "First tap decides the page that follows. Course is new (today only One night and Weekly).", c_fork()),
            shot("C2 &middot; Page picker (2+ pages only)", "", phone(top("New event"), "", "", s_page_pick())),
            shot("C3 &middot; One night", "Only the rows a one night needs.", c_form("one")),
            shot("C4 &middot; Weekly night", "Weekday and start date are separate rows.", c_form("weekly")),
            shot("C5 &middot; Course, ready", "Weeks and level replace What happens: every session is a class.", c_form("course", stage="ready")),
            shot("C6 &middot; Weekly: when sheet", "", phone(T, "", "", s_when("weekly"))),
            shot("C7 &middot; Course: when sheet", "", phone(top("New course", "Back"), "", "", s_when("course"))),
            shot("C8 &middot; Where: results", "", phone(T, "", "", s_venue("list"))),
            shot("C9 &middot; Where: loading", "", phone(T, "", "", s_venue("loading"))),
            shot("C10 &middot; Where: could not load", "", phone(T, "", "", s_venue("error"))),
            shot("C11 &middot; Venue not found", "", phone(T, "", "", s_venue("none"))),
            shot("C12 &middot; What happens", "", phone(T, "", "", s_what())),
            shot("C13 &middot; Offline", "", c_form("weekly", offline_banner())),
            shot("C14 &middot; A few details first", "", phone(T, "", "", s_gate())),
            shot("C15 &middot; Cancel mid-way", "Back from the form asks the same question.", phone(T, "", "", s_leave())),
            shot("C16 &middot; Draft kept on Home", "", home_after_leave()),
            shot("C17 &middot; Live", "", done(True)),
            shot("C18 &middot; Loading", "", loading_page()),
            shot("C19 &middot; No page yet", "", blocked("nopage")),
            shot("C20 &middot; Page not live", "", blocked("notlive")),
            shot("C21 &middot; Saved as draft", "", done(False))]

# ---------- pages ----------
NAV = '<a href="index.html">Compare</a><a href="a.html">A &middot; One page</a><a href="b.html">B &middot; Three steps</a><a href="c.html">C &middot; Pick first</a>'
THEME_JS = """<button onclick="setT('light')">Light</button><button onclick="setT('dark')">Dark</button>
<script>function setT(t){document.querySelectorAll('.p3-theme').forEach(function(e){e.setAttribute('data-theme',t)});document.body.style.background=t==='dark'?'#111':'#8f8a86'}
var q=new URLSearchParams(location.search).get('theme');if(q)setT(q);</script>"""

def page(fname, title, shots, intro=""):
    html = (f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{title}</title><link rel="stylesheet" href="{TOKENS}"><link rel="stylesheet" href="mock.css"></head><body>'
            f'<div class="m-top"><h1>{title}</h1>{NAV}</div>{intro}<div class="m-grid">{"".join(shots)}</div>'
            f'<div class="m-top" style="margin-top:16px">{THEME_JS}</div></body></html>\n')
    html = html.replace('<div class="m-top"><h1>', '<div class="m-top"><button onclick="setT(\'light\')">Light</button><button onclick="setT(\'dark\')">Dark</button><h1>', 1)
    with open(os.path.join(HERE, fname), "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

CMP = """<table class="m-cmp"><tr><th></th><th>Old wizard (today)</th><th>A &middot; One page</th><th>B &middot; Three steps</th><th>C &middot; Pick first</th></tr>
<tr><th>Screens to finish</th><td>6 steps (what, name, where, first date, time, photo)</td><td>1 page + 4 sheets</td><td>3 steps + 2 sheets</td><td>1 fork + 1 page + 3 sheets</td></tr>
<tr><th>Taps to finish a one night (not counting typing the name, filling date and time, and picking the photo &mdash; the same in every column)</th><td>7 from Home, then blocked: no session, so Go live stays off</td><td>9: New event, One night, Where, venue, When, Done, What happens, Done, Go live</td><td>8: New event, One night, Next, Where, venue, Next, Class then party, Go live</td><td>7: New event, One night, Where, venue, When, Done, Go live (What happens defaults to Party)</td></tr>
<tr><th>Kinds it can create</th><td>One night, Weekly</td><td>One night, Weekly, Course</td><td>One night, Weekly, Course</td><td>One night, Weekly, Course, Class then party</td></tr>
<tr><th>Which page (2+ pages)</th><td>Kept</td><td>Kept</td><td>Kept</td><td>Kept</td></tr>
<tr><th>Name, max 120</th><td>Kept</td><td>Kept</td><td>Kept</td><td>Kept</td></tr>
<tr><th>Venue search</th><td>Kept; dead end on no match</td><td colspan="3">Kept + &ldquo;Send us this venue&rdquo; or skip and keep a draft</td></tr>
<tr><th>First date</th><td>Next 30 days only</td><td colspan="3">Any future date</td></tr>
<tr><th>Start time / end time</th><td>Start only</td><td colspan="3">Start + end (ends next day shown)</td></tr>
<tr><th>Repeat / runs until</th><td>Every weekday of the first date, no end</td><td colspan="3">Every / every other week; keeps going or until a date</td></tr>
<tr><th>Course length</th><td>Not possible</td><td colspan="3">4&ndash;12 weeks or other (prod max 16)</td></tr>
<tr><th>First session (kind, times, level)</th><td>Missing &mdash; why Go live is blocked</td><td colspan="2">Seeded from &ldquo;What happens&rdquo;</td><td>Seeded; course is always a class with a level</td></tr>
<tr><th>Photo, JPEG/PNG/WebP &lt; 10 MB</th><td>Kept</td><td>Kept</td><td>Kept</td><td>Kept</td></tr>
<tr><th>Onboarding gate</th><td>&ldquo;Almost live&rdquo; bridge</td><td colspan="3">&ldquo;A few details first&rdquo; sheet, draft already saved</td></tr>
<tr><th>Cancel mid-way</th><td>&ldquo;Save as draft and leave&rdquo; (from step 3); no delete</td><td colspan="3">Ask: keep as draft (default), keep going, or delete draft; draft shows on Home with what it still needs</td></tr>
<tr><th>Offline / error</th><td>Inline alert, typing kept</td><td colspan="3">Same copy, kept</td></tr>
<tr><th>Left for the event page (all options)</th><td colspan="4">Description, music styles, ticket link, extra organisers, gallery, video, line-up, rooms, per-date changes &mdash; owner-ticked editor fields (ARC.md), not create fields</td></tr>
</table>"""

if __name__ == "__main__":
    page("a.html", "P3 create A: one page", approach_a())
    page("b.html", "P3 create B: three steps", approach_b())
    page("c.html", "P3 create C: pick first", approach_c())
    page("index.html", "P3 create event: compare", [], '<div style="overflow-x:auto">' + CMP + "</div>")
