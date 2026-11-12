#!/usr/bin/env python3
"""Generate the 3 organiser-dashboard mock options (docs only, no app code).

Usage: python3 docs/design/organiser-dashboard/tools/gen.py
Writes option-a.html, option-b.html, option-c.html next to tools/.
Each file holds the 6 required states; open it with #<state> to see one
(no-events, upcoming, selling, huge, all-zero, cancelled). Default: upcoming.
All numbers are placeholders shaped like production (opens 63,576 /
link clicks 7,392 / a 6,013 type count are the real magnitudes).
ASCII only: punctuation goes in as HTML entities.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
STATES = ["no-events", "upcoming", "selling", "huge", "all-zero", "cancelled"]
STATE_LABEL = {
    "no-events": "No events, no team",
    "upcoming": "Upcoming nights",
    "selling": "Selling via us",
    "huge": "Huge counts",
    "all-zero": "All zero",
    "cancelled": "Cancelled night",
}
CLICK_LABEL = {"ticket": "Ticket link", "share": "Share", "whatsapp": "WhatsApp", "directions": "Directions"}
CLICK_ACTION = {
    "ticket": "Add a ticket link",
    "share": "Share this night",
    "whatsapp": "Add a WhatsApp link",
    "directions": "Check the venue address",
}


def n(v):
    return f"{v:,}"


def night(day, dow, mon, name, time, venue, going=0, opens=0, clicks=None, sold=0, cancelled=False):
    return dict(day=day, dow=dow, mon=mon, name=name, time=time, venue=venue, going=going,
                opens=opens, clicks=clicks or {}, sold=sold, cancelled=cancelled)


def data(state):
    """Return the placeholder data for one state."""
    base = dict(name="Salsa &amp; Bachata Nights", team=3, profile=(4, 6, "Add a cover photo"),
                rating=(4.6, 23), level=("Mixed levels", 18), city=("London", 4.3, 41),
                tickets_on=False)
    if state == "no-events":
        base.update(team=1, profile=(2, 6, "Add your city and a photo"), rating=None, level=None,
                    city=("Leeds", None, 3), nights=[])
    elif state == "upcoming":
        base["nights"] = [
            night(14, "Fri", "NOV", "Friday Bachata Social", "21:00", "Bar Salsa Temple", going=3, opens=412,
                  clicks=dict(ticket=38, share=12, whatsapp=9, directions=21)),
            night(16, "Sun", "NOV", "Sensual Sunday Class + Party", "19:30", "The Dance Hub", going=0, opens=96,
                  clicks=dict(share=4, directions=7)),
            night(21, "Fri", "NOV", "Friday Bachata Social", "21:00", "Bar Salsa Temple", opens=31),
        ]
    elif state == "selling":
        base["tickets_on"] = True
        base["nights"] = [
            night(14, "Fri", "NOV", "Friday Bachata Social", "21:00", "Bar Salsa Temple", going=3, opens=412,
                  clicks=dict(ticket=38, share=12, whatsapp=9, directions=21), sold=47),
            night(16, "Sun", "NOV", "Sensual Sunday Class + Party", "19:30", "The Dance Hub", opens=96,
                  clicks=dict(ticket=5, directions=7), sold=0),
            night(21, "Fri", "NOV", "Friday Bachata Social", "21:00", "Bar Salsa Temple", opens=31, sold=2),
        ]
    elif state == "huge":
        base["tickets_on"] = True
        base.update(name="London Bachata Weekender &amp; Friday Socials Collective", team=14,
                    rating=(4.8, 1288), level=("Mostly strong dancers", 2604))
        base["nights"] = [
            night(14, "Fri", "NOV", "London Bachata Weekender 2026 &mdash; Opening Night Mega Social",
                  "21:00", "Grand Ballroom, Royal Exhibition Centre", going=2, opens=63576,
                  clicks=dict(ticket=6013, share=812, whatsapp=346, directions=221), sold=6013),
            night(15, "Sat", "NOV", "Weekender Day 2 &mdash; Workshops + All-Nighter", "12:00",
                  "Grand Ballroom, Royal Exhibition Centre", opens=18904,
                  clicks=dict(ticket=1990, share=102), sold=1874),
            night(21, "Fri", "NOV", "Friday Bachata Social", "21:00", "Bar Salsa Temple", opens=1203,
                  clicks=dict(directions=88)),
        ]
    elif state == "all-zero":
        base.update(team=2, rating=None, level=None, city=("Bristol", None, 2),
                    profile=(5, 6, "Add a WhatsApp link"))
        base["nights"] = [
            night(14, "Fri", "NOV", "Friday Bachata Social", "21:00", "The Old Fire Station"),
            night(21, "Fri", "NOV", "Friday Bachata Social", "21:00", "The Old Fire Station"),
        ]
    elif state == "cancelled":
        base["nights"] = [
            night(14, "Fri", "NOV", "Friday Bachata Social", "21:00", "Bar Salsa Temple", opens=140,
                  clicks=dict(share=6), cancelled=True),
            night(21, "Fri", "NOV", "Friday Bachata Social", "21:00", "Bar Salsa Temple", going=1, opens=58,
                  clicks=dict(directions=4)),
        ]
    return base


def total_clicks(nt):
    return sum(nt["clicks"].values())


# ---------------------------------------------------------------- shared CSS
CSS = """
:root{--bg:#0B0B0C;--s1:#151517;--s2:#1D1D20;--line:#2A2A2E;--text:#F4F1EA;--mute:#A7A29A;
--gold:#E0B252;--ink:#14110A;--ok:#7DDBB4;--okbg:#0F2A20;--warn:#F0A35E;--warnbg:#2A1D10;--bad:#F08A8A;--badbg:#2A1414}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text)}
body{font:14px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-variant-numeric:tabular-nums;overflow-x:hidden}
h1,h2,h3,p{margin:0}
a{color:var(--gold);text-decoration:none}
button{font:inherit;color:inherit;cursor:pointer}
section.state{display:none;min-height:844px;padding:12px 16px 24px;flex-direction:column;gap:12px}
section.state.on{display:flex}
.card{background:var(--s1);border:1px solid var(--line);border-radius:12px;min-width:0}
.pad{padding:12px}
.mute{color:var(--mute)}
.small{font-size:12px}
.row{display:flex;align-items:center;gap:10px;min-width:0}
.grow{flex:1;min-width:0}
.wrapt{overflow-wrap:anywhere}
.clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.btn{min-height:44px;min-width:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--s2);
 color:var(--text);font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
.btn.gold{background:var(--gold);border-color:var(--gold);color:var(--ink);font-weight:700}
.btn.full{width:100%}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}
.chip.ok{background:var(--okbg);color:var(--ok)}
.chip.warn{background:var(--warnbg);color:var(--warn)}
.chip.bad{background:var(--badbg);color:var(--bad)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.top{display:flex;align-items:center;gap:10px;min-height:44px}
.logo{width:36px;height:36px;flex:none;border-radius:10px;background:var(--gold);color:var(--ink);display:flex;align-items:center;justify-content:center;font-weight:800}
.oname{font-size:16px;font-weight:700}
.sech{display:flex;align-items:center;justify-content:space-between;min-height:24px}
.sech h2{font-size:15px;font-weight:700}
.datebox{width:48px;flex:none;border-radius:8px;background:var(--s2);text-align:center;padding:5px 0}
.datebox i{display:block;font-style:normal;font-size:11px;font-weight:700;color:var(--mute)}
.datebox b{font-size:18px}
.bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:var(--gold)}
.item{display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:56px;color:var(--text)}
.list>*+*{border-top:1px solid var(--line)}
.cta{font-size:14px;font-weight:700;color:var(--gold)}
.v{font-size:22px;font-weight:800;line-height:1.1}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tile{padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.hint{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:var(--s2);font-size:13px}
.hint .grow{color:var(--mute)}
.ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.tabs{position:sticky;bottom:0;margin:auto -16px -24px;border-top:1px solid var(--line);background:#101012;display:grid;grid-template-columns:repeat(4,1fr)}
.tabs a{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12px;font-weight:700;color:var(--mute)}
.tabs a.on{color:var(--gold)}
.statebar{font-size:12px;color:var(--mute);display:flex;justify-content:space-between}
"""

JS = """
<script>
(function(){
  function show(){
    var s=(location.hash||'#upcoming').slice(1);
    var all=document.querySelectorAll('section.state');var hit=false;
    for(var i=0;i<all.length;i++){var on=all[i].id===s;all[i].classList.toggle('on',on);if(on)hit=true;}
    if(!hit)document.getElementById('upcoming').classList.add('on');
  }
  window.addEventListener('hashchange',show);show();
})();
</script>
"""

ICON = {
    "copy": '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    "wa": '<svg class="ic" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z"/></svg>',
    "ig": '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>',
    "ext": '<svg class="ic" viewBox="0 0 24 24"><path d="M7 17L17 7M8 7h9v9"/></svg>',
    "chev": '<svg class="ic" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    "plus": '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    "star": '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
}

TABS = """<nav class="tabs" aria-label="Organiser">
<a class="on" href="#">Home</a><a href="#">Events</a><a href="#">Team</a><a href="#">Profile</a></nav>"""


# ---------------------------------------------------------------- shared blocks (one mapping per fact)
def header(d, compact=False):
    return f"""<div class="top"><div class="logo" aria-hidden="true">S</div>
<div class="grow"><div class="oname wrapt clamp2">{d['name']}</div>
<div class="small mute">Organiser &middot; {d['team']} {'person' if d['team'] == 1 else 'people'} in your team</div></div>
<a class="btn" href="#" aria-label="Open your public page">Page {ICON['ext']}</a></div>"""


def share_block(d, title="Share my page"):
    return f"""<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
<div class="sech"><h2>{title}</h2></div>
<p class="small mute">Dancers find your nights from your page. Send it to your group chats.</p>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
<button class="btn">{ICON['copy']}Copy</button><button class="btn">{ICON['wa']}WhatsApp</button><button class="btn">{ICON['ig']}Caption</button></div></div>"""


def profile_line(d):
    done, tot, nxt = d["profile"]
    pct = round(done * 100 / tot)
    return f"""<div class="row"><div class="grow" style="display:flex;flex-direction:column;gap:6px">
<span class="small mute">Profile {done} of {tot} done</span><div class="bar" role="img" aria-label="{pct} percent"><i style="width:{pct}%"></i></div></div>
<a class="btn" href="#">{nxt}</a></div>"""


def rating_lines(d):
    """Rating and Level rating are ALWAYS shown; city average only with 5+ organisers."""
    city, avg, count = d["city"]
    if d["rating"]:
        r, rn = d["rating"]
        rating = f'<b class="v" style="font-size:18px">{r}</b> <span class="small mute">from {n(rn)} ratings</span>'
    else:
        rating = '<span class="small mute">No ratings yet &mdash; dancers can rate you after a night</span>'
    if d["level"]:
        lname, ln = d["level"]
        level = f'<b style="font-size:16px">{lname}</b> <span class="small mute">from {n(ln)} dancer votes</span>'
    else:
        level = '<span class="small mute">No level votes yet &mdash; dancers vote on your event page</span>'
    cityline = ""
    if count >= 5 and avg is not None:
        cityline = f'<div class="small mute">{city} average {avg} &middot; {count} organisers</div>'
    return f"""<div style="display:flex;flex-direction:column;gap:8px">
<div><div class="small mute">Rating</div><div class="wrapt">{rating}</div></div>
<div><div class="small mute">Level rating</div><div class="wrapt">{level}</div></div>{cityline}</div>"""


def stat_parts(nt):
    """Positive-only metric list + suggested actions for zeros (one mapping, all options)."""
    stats, hints = [], []
    if nt["sold"] > 0:
        stats.append(("Tickets sold", nt["sold"]))
    if nt["going"] > 0:
        stats.append(("Going", nt["going"]))
    if nt["opens"] > 0:
        stats.append(("Opens", nt["opens"]))
    for k in ("ticket", "share", "whatsapp", "directions"):
        if nt["clicks"].get(k, 0) > 0:
            stats.append((CLICK_LABEL[k] + " taps", nt["clicks"][k]))
    if nt["opens"] == 0:
        hints.append(("Nobody has opened this night yet", "Share it"))
    elif nt["going"] == 0:
        hints.append(("Nobody has said they are going yet", "Share it"))
    if nt["opens"] > 0 and not nt["clicks"].get("ticket"):
        hints.append(("No ticket taps yet", "Add a ticket link"))
    return stats, hints


def hint_html(text, action):
    return f'<div class="hint"><span class="grow">{text}</span><a class="btn" href="#">{action}</a></div>'


def cancelled_card(nt, big=False):
    return f"""<div class="card pad" style="display:flex;flex-direction:column;gap:8px;border-color:#5A2A2A">
<div class="row"><div class="datebox"><i>{nt['mon']}</i><b>{nt['day']}</b></div>
<div class="grow"><span class="chip bad"><span class="dot"></span>Cancelled</span>
<div style="font-weight:700;margin-top:4px" class="wrapt clamp2">{nt['name']}</div>
<div class="small mute">{nt['dow']} {nt['time']} &middot; {nt['venue']}</div></div></div>
<p class="small mute">Dancers see &ldquo;Cancelled&rdquo; on this night. {n(nt['opens'])} opens before you cancelled.</p>
<div class="row"><a class="btn grow" href="#">Tell your dancers</a><a class="btn" href="#">Undo</a></div></div>"""


def empty_next_action(d):
    return f"""<div class="card pad" style="display:flex;flex-direction:column;gap:10px;border-color:#4A3D20">
<span class="chip warn" style="align-self:flex-start"><span class="dot"></span>Next step</span>
<h2 style="font-size:20px">Add your first night</h2>
<p class="mute">Your page is live but has no nights yet. Add one and dancers in {d['city'][0]} can find it on the calendar.</p>
<a class="btn gold full" href="#">{ICON['plus']}Add a night</a>
<a class="btn full" href="#">Invite someone to help</a></div>"""


def page(title, body_by_state, extra_css=""):
    secs = "\n".join(f'<section class="state" id="{s}" aria-label="{STATE_LABEL[s]}">\n{body_by_state[s]}\n</section>'
                     for s in STATES)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{CSS}{extra_css}</style></head>
<body>
{secs}
{JS}</body></html>
"""


def statebar(opt, s):
    return f'<div class="statebar"><span>Option {opt} mock</span><span>State: {STATE_LABEL[s]}</span></div>'


# ---------------------------------------------------------------- Option A: Feed (adapted from org-proto-dashboard)
def a_night(nt, first):
    if nt["cancelled"]:
        return cancelled_card(nt)
    stats, hints = stat_parts(nt)
    if not first:
        line = " &middot; ".join(f"{n(v)} {k.lower()}" for k, v in stats[:3]) or hints[0][0]
        return (f'<a class="item" href="#"><div class="datebox"><i>{nt["mon"]}</i><b>{nt["day"]}</b></div>'
                f'<span class="grow" style="display:flex;flex-direction:column"><b class="wrapt clamp2">{nt["name"]}</b>'
                f'<span class="small mute wrapt">{line}</span></span>{ICON["chev"]}</a>')
    tiles = "".join(f'<div class="card tile" style="background:var(--s2)"><span class="small mute">{k}</span><span class="v">{n(v)}</span></div>'
                    for k, v in stats[: (4 if first else 2)])
    more = len(stats) - (4 if first else 2)
    morel = f'<a class="cta" href="#" style="min-height:44px;display:flex;align-items:center">{more} more</a>' if more > 0 else ""
    hs = "".join(hint_html(*h) for h in hints[:1])
    return f"""<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
<div class="row"><div class="datebox"><i>{nt['mon']}</i><b>{nt['day']}</b></div>
<div class="grow"><div style="font-weight:700" class="wrapt clamp2">{nt['name']}</div>
<div class="small mute wrapt">{nt['dow']} {nt['time']} &middot; {nt['venue']}</div></div></div>
{('<div class="tiles">' + tiles + '</div>') if tiles else ''}{hs}{morel}</div>"""


def option_a(s):
    d = data(s)
    out = [statebar("A", s), header(d)]
    if not d["nights"]:
        out += [empty_next_action(d), share_block(d)]
    else:
        out.append('<div class="sech"><h2>Next nights</h2><a class="cta" href="#" style="min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:flex-end">All nights</a></div>')
        out.append(a_night(d["nights"][0], True))
        if d["nights"][1:]:
            out.append('<div class="card list" style="overflow:hidden">' + "".join(a_night(nt, False) for nt in d["nights"][1:]) + "</div>")
        out.append(share_block(d))
    out.append(f'<div class="card pad" style="display:flex;flex-direction:column;gap:12px"><div class="sech"><h2>Your profile</h2></div>{profile_line(d)}{rating_lines(d)}</div>')
    out.append(TABS)
    return "\n".join(out)


# ---------------------------------------------------------------- Option B: One night in focus
B_CSS = """
.hero{padding:14px;display:flex;flex-direction:column;gap:12px;background:linear-gradient(180deg,#1E1A12,#151517 60%);border-color:#4A3D20}
.big{font-size:40px;font-weight:800;line-height:1}
.pills{display:flex;flex-wrap:wrap;gap:6px}
.pill{display:inline-flex;align-items:baseline;gap:6px;padding:6px 10px;border-radius:999px;background:var(--s2);font-size:13px}
.pill b{font-size:14px}
"""


def b_hero(nt, d):
    if nt["cancelled"]:
        return cancelled_card(nt, big=True)
    stats, hints = stat_parts(nt)
    lead = next(((k, v) for k, v in stats if k in ("Tickets sold", "Opens")), None)
    rest = [x for x in stats if x != lead]
    leadh = (f'<div><div class="big">{n(lead[1])}</div><div class="mute">{lead[0].lower()} so far</div></div>' if lead else "")
    pills = "".join(f'<span class="pill"><b>{n(v)}</b><span class="mute">{k}</span></span>' for k, v in rest)
    hs = "".join(hint_html(*h) for h in hints[:2])
    return f"""<div class="card hero">
<span class="small mute">Your next night</span>
<div class="row"><div class="datebox"><i>{nt['mon']}</i><b>{nt['day']}</b></div>
<div class="grow"><div style="font-weight:700;font-size:16px" class="wrapt clamp2">{nt['name']}</div>
<div class="small mute wrapt">{nt['dow']} {nt['time']} &middot; {nt['venue']}</div></div></div>
{leadh}{('<div class="pills">' + pills + '</div>') if pills else ''}{hs}
<div class="row"><a class="btn gold grow" href="#">Share this night</a><a class="btn" href="#">Edit</a></div></div>"""


def option_b(s):
    d = data(s)
    out = [statebar("B", s), header(d)]
    if not d["nights"]:
        out.append(empty_next_action(d))
        later = '<span class="small mute">Nothing yet &mdash; add a night above</span>'
    else:
        out.append(b_hero(d["nights"][0], d))
        rest = d["nights"][1:]
        later = (f'<b>{len(rest)} more night{"s" if len(rest) != 1 else ""}</b><span class="small mute wrapt">Next: {rest[0]["dow"]} {rest[0]["day"]} {rest[0]["mon"].title()}</span>'
                 if rest else '<b>No more nights</b><span class="small mute">Add the next one</span>')
    done, tot, nxt = d["profile"]
    rate = (f'{d["rating"][0]} rating &middot; {d["level"][0]}' if d["rating"] else "No ratings yet")
    items = [
        (later, "Nights"),
        ('<b>Share my page</b><span class="small mute">Copy, WhatsApp or an Instagram caption</span>', "Share"),
        (f'<b>Profile {done} of {tot} done</b><span class="small mute">{rate}</span>', "Open"),
    ]
    out.append('<div class="card list" style="overflow:hidden">' + "".join(
        f'<a class="item" href="#"><span class="grow" style="display:flex;flex-direction:column">{t}</span><span class="cta">{c}</span>{ICON["chev"]}</a>'
        for t, c in items) + "</div>")
    # below the fold: the three items open in place (shown expanded in the mock)
    if d["nights"][1:]:
        rows = "".join(
            (f'<div class="item"><div class="datebox"><i>{nt["mon"]}</i><b>{nt["day"]}</b></div><span class="grow" style="display:flex;flex-direction:column">'
             f'<b class="wrapt clamp2">{nt["name"]}</b><span class="small mute">'
             + (" &middot; ".join(f'{n(v)} {k.lower()}' for k, v in stat_parts(nt)[0][:3]) or "Nobody has opened it yet &mdash; share it")
             + '</span></span></div>') for nt in d["nights"][1:])
        out.append(f'<div class="sech"><h2>Later nights</h2></div><div class="card list">{rows}</div>')
    out.append(share_block(d))
    out.append(f'<div class="card pad" style="display:flex;flex-direction:column;gap:12px"><div class="sech"><h2>Profile and ratings</h2></div>{profile_line(d)}{rating_lines(d)}</div>')
    out.append(TABS)
    return "\n".join(out)


# ---------------------------------------------------------------- Option C: Scoreboard + checklist
C_CSS = """
.score{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border-radius:12px;overflow:hidden;border:1px solid var(--line)}
.score>div{background:var(--s1);padding:10px 12px;min-width:0}
.nrow{display:flex;gap:10px;padding:10px 12px;align-items:flex-start}
.mini{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--mute);margin-top:4px}
.mini b{color:var(--text)}
.check{color:var(--text);display:flex;align-items:center;gap:10px;padding:8px 12px;min-height:56px}
.box{width:22px;height:22px;border-radius:6px;border:2px solid var(--line);flex:none;display:flex;align-items:center;justify-content:center}
.box.done{background:var(--okbg);border-color:var(--ok);color:var(--ok)}
"""


def option_c(s):
    d = data(s)
    out = [statebar("C", s), header(d)]
    live = [nt for nt in d["nights"] if not nt["cancelled"]]
    tot = dict(sold=sum(x["sold"] for x in live), going=sum(x["going"] for x in live),
               opens=sum(x["opens"] for x in live), clicks=sum(total_clicks(x) for x in live))
    cells = []
    if d["tickets_on"] and tot["sold"] > 0:
        cells.append(("Tickets sold", tot["sold"]))
    for k, lab in (("opens", "Opens"), ("clicks", "Link taps"), ("going", "Going")):
        if tot[k] > 0:
            cells.append((lab, tot[k]))
    if not d["nights"]:
        out.append(empty_next_action(d))
    elif cells:
        sc = "".join(f'<div><div class="small mute">{k}</div><div class="v">{n(v)}</div></div>' for k, v in cells)
        if len(cells) % 2:
            sc = sc[: sc.rfind("<div><div")] + sc[sc.rfind("<div><div"):].replace("<div>", '<div style="grid-column:1/-1">', 1)
        out.append(f'<div class="card pad" style="display:flex;flex-direction:column;gap:10px"><div class="sech"><h2>{"Your next night" if len(live) == 1 else f"Your next {len(live)} nights"}</h2><span class="small mute">so far</span></div><div class="score">{sc}</div></div>')
    else:
        out.append('<div class="card pad" style="display:flex;flex-direction:column;gap:10px"><div class="sech"><h2>Your next nights</h2></div>'
                   '<p class="mute">Nobody has opened your nights yet. Nights shared in a group chat usually get their first opens the same day.</p>'
                   '<a class="btn gold full" href="#">Share your next night</a></div>')
    # checklist: the 3 first-screen items
    done, totp, nxt = d["profile"]
    checks = []
    if not d["nights"]:
        checks.append((False, "Add your first night", "Add"))
    checks.append((False, "Share my page", "Share"))
    checks.append((done == totp, f"Profile {done} of {totp}: {nxt[0].lower() + nxt[1:]}", "Fix"))
    if d["team"] <= 1:
        checks.append((False, "Invite someone to your team", "Invite"))
    else:
        checks.append((True, f"Team of {d['team']}", "Manage"))
    out.append('<div class="sech"><h2>Next steps</h2></div><div class="card list">' + "".join(
        f'<a class="check" href="#"><span class="box{" done" if ok else ""}">{"&#10003;" if ok else ""}</span><span class="grow wrapt">{t}</span><span class="cta">{c}</span></a>'
        for ok, t, c in checks[:3]) + "</div>")
    if d["nights"]:
        rows = []
        for nt in d["nights"]:
            if nt["cancelled"]:
                rows.append(cancelled_card(nt))
                continue
            st, hints = stat_parts(nt)
            mini = "".join(f'<span><b>{n(v)}</b> {k.lower()}</span>' for k, v in st)
            h = hint_html(*hints[0]) if hints else ""
            rows.append(f'<div class="card"><div class="nrow"><div class="datebox"><i>{nt["mon"]}</i><b>{nt["day"]}</b></div><div class="grow"><b class="wrapt clamp2">{nt["name"]}</b>'
                        f'<div class="small mute wrapt">{nt["dow"]} {nt["time"]} &middot; {nt["venue"]}</div><div class="mini">{mini}</div></div></div>'
                        + (f'<div style="padding:0 12px 12px">{h}</div>' if h else "") + "</div>")
        out.append('<div class="sech"><h2>Night by night</h2></div>' + "".join(rows))
    out.append(share_block(d))
    out.append(f'<div class="card pad" style="display:flex;flex-direction:column;gap:12px"><div class="sech"><h2>Ratings</h2></div>{rating_lines(d)}</div>')
    out.append(TABS)
    return "\n".join(out)


def main():
    for key, fn, css, title in (("a", option_a, "", "Organiser home A"),
                                ("b", option_b, B_CSS, "Organiser home B"),
                                ("c", option_c, C_CSS, "Organiser home C")):
        html = page(title, {s: fn(s) for s in STATES}, css)
        assert all(ord(ch) < 128 for ch in html), "non-ASCII in output"
        (OUT / f"option-{key}.html").write_text(html, encoding="utf-8", newline="\n")
        print(f"wrote option-{key}.html ({len(html)} bytes)")


if __name__ == "__main__":
    main()
