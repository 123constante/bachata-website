#!/usr/bin/env python3
"""Builds the three P3 W4a mockups (A, B, C) as standalone HTML.

Run from the repo root:  python3 mockups/p3-w4a/build.py
The real tokens and classes are read from src/modules/organiser/p3/theme/p3.css
and inlined, so the mockups never carry a second token set. Extra layout CSS
below uses only var(--token) colours. Design only: nothing here is shipped.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P3_CSS = (ROOT / "src/modules/organiser/p3/theme/p3.css").read_text(encoding="utf-8")
OUT = Path(__file__).resolve().parent

EXTRA_CSS = """
body{margin:0;background:#e9e4df;font-family:system-ui,sans-serif;color:#1d0a03}
.wrap{padding:16px}
.wrap>h1{font-size:20px;margin:0 0 4px}
.wrap>p{max-width:860px;font-size:14px;margin:0 0 8px;line-height:1.45}
.toolbar{position:sticky;top:0;z-index:5;background:#e9e4df;padding:8px 0;display:flex;gap:8px;flex-wrap:wrap}
.toolbar button{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid #8a7d71;background:#fff;font:inherit;font-size:14px}
.grid{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
figure{margin:0;width:390px}
figcaption{font-size:13px;margin:6px 2px 0;line-height:1.35;color:#3a2d24}
figcaption b{display:block;font-size:14px}
h2.sec{width:100%;font-size:17px;margin:16px 0 0;border-top:1px solid #c9bdb2;padding-top:12px}
.phone{position:relative;width:390px;height:844px;overflow:hidden;border-radius:28px;box-shadow:0 0 0 1px #c9bdb2}
.phone .p3-frame{position:absolute}
.p3-theme .top-row{display:flex;align-items:center;gap:8px;width:100%}
.p3-theme .top-row h1{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p3-theme .back{min-height:44px;min-width:44px;display:inline-flex;align-items:center;gap:2px;color:var(--gold-fg);font-weight:600;font-size:16px;text-decoration:none;margin-left:-8px;padding:0 4px}
.p3-theme .pagechip{min-height:44px;max-width:180px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;border-radius:999px;border:1px solid var(--line-strong);background:var(--card);color:var(--fg);font:inherit;font-size:14px;font-weight:600}
.p3-theme .pagechip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p3-theme .av{flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--card2);color:var(--fg);font-weight:700}
.p3-theme .navrow{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 0;color:inherit;text-decoration:none}
.p3-theme .navrow + .navrow{border-top:1px solid var(--line)}
.p3-theme .navrow .grow{flex:1;min-width:0}
.p3-theme .chev{color:var(--mut);flex:none}
.p3-theme .sw{position:relative;flex:none;width:64px;height:44px;border-radius:999px;border:1px solid var(--line-strong);background:var(--card2)}
.p3-theme .sw i{position:absolute;top:5px;left:5px;width:32px;height:32px;border-radius:50%;background:var(--fg)}
.p3-theme .sw.on{background:var(--gold);border-color:var(--gold)}
.p3-theme .sw.on i{left:27px}
.p3-theme .sw[disabled]{opacity:.6}
.p3-theme .faces{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.p3-theme .face{min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:96px;padding:8px 4px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--card);font:inherit;color:var(--fg)}
.p3-theme .face .n{font-size:13px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p3-theme .face .f{font-size:12px;color:var(--mut)}
.p3-theme .search{width:100%;box-sizing:border-box;min-height:44px;border-radius:var(--r-ctl);border:1px solid var(--line-strong);background:var(--card);color:var(--fg);font:inherit;font-size:16px;padding:0 12px}
.p3-theme .full{width:100%}
.p3-theme .danger-t{color:var(--danger);font-size:var(--fs-small);margin:0}
.p3-theme .sk{height:56px;border-radius:12px;background:var(--card2)}
.p3-theme .seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;padding:4px;border-radius:var(--r-ctl);background:var(--card2)}
.p3-theme .seg button{min-height:44px;border:0;border-radius:11px;background:transparent;font:inherit;font-size:15px;font-weight:600;color:var(--mut)}
.p3-theme .seg button[aria-pressed=true]{background:var(--card);color:var(--fg)}
.p3-theme .pagehero{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.p3-theme .editrow{display:flex;align-items:flex-start;gap:12px;min-height:52px;padding:8px 0}
.p3-theme .editrow + .editrow{border-top:1px solid var(--line)}
.p3-theme .editrow .k{font-size:var(--fs-small);color:var(--mut)}
.p3-theme .editrow .v{font-size:var(--fs-body);color:var(--fg);overflow-wrap:anywhere}
.p3-theme .editrow .v.empty{color:var(--mut);font-style:italic}
.p3-theme .editrow .grow{flex:1;min-width:0}
.p3-theme .editbtn{min-height:44px;min-width:44px;border-radius:12px;border:1px solid var(--line-strong);background:transparent;color:var(--fg);font:inherit;font-size:14px;font-weight:600;padding:0 10px}
.p3-theme .req{display:flex;align-items:center;gap:8px;min-height:48px;padding:0 12px;border-radius:var(--r-ctl);border:1px solid var(--gold);background:var(--card);color:var(--fg);font-weight:600;font-size:15px;text-decoration:none}
.p3-theme .count{display:inline-flex;min-width:22px;height:22px;padding:0 6px;border-radius:999px;align-items:center;justify-content:center;background:var(--warn-bg);color:var(--warn-fg);font-size:12px;font-weight:700}
.p3-theme .stack-xs{display:flex;flex-direction:column;gap:6px}
.p3-theme .facesrow{display:flex;gap:0}
.p3-theme .facesrow .av{margin-right:-8px;border:2px solid var(--card)}
.p3-theme .sheetwrap{position:absolute;inset:0;background:var(--scrim);display:flex;align-items:flex-end;z-index:3}
.p3-theme .sheetwrap .p3-sheet{max-height:80%}
.p3-theme .x{min-height:44px;min-width:44px;border:0;background:none;color:var(--fg);font-size:22px}
"""

ICON = {
    "home": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    "events": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    "stats": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    "you": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
}
CHEV = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>'


def tabs(active="you"):
    out = []
    for t, label in (("home", "Home"), ("events", "Events"), ("stats", "Stats"), ("you", "You")):
        cur = ' aria-current="page"' if t == active else ""
        out.append(f'<a class="p3-tab" href="#"{cur}>{ICON[t]}{label}</a>')
    return '<nav class="p3-tabs">' + "".join(out) + "</nav>"


def phone(title, body, back=None, end="", sheet="", active="you"):
    b = f'<a class="back" href="#">&lsaquo; {back}</a>' if back else ""
    return (
        '<div class="phone"><div class="p3-theme p3-frame">'
        f'<header class="p3-top"><div class="top-row">{b}<h1>{title}</h1>{end}</div></header>'
        f'<main class="p3-main"><div class="p3-stack">{body}</div></main>'
        f"{tabs(active)}{sheet}</div></div>"
    )


def fig(cap, sub, html):
    return f"<figure>{html}<figcaption><b>{cap}</b>{sub}</figcaption></figure>"


def av(name, size=40):
    ini = "".join(w[0] for w in name.split()[:2]).upper()
    return f'<span class="av" style="width:{size}px;height:{size}px;font-size:{size*0.38:.0f}px" aria-hidden="true">{ini}</span>'


def card(inner, label=None):
    h = f'<p class="p3-note" style="margin:0 0 4px;font-weight:600">{label}</p>' if label else ""
    return f'{h}<section class="p3-card" style="color:var(--fg)">{inner}</section>'


def sheet(title, inner):
    return (
        '<div class="sheetwrap"><div class="p3-sheet">'
        f'<div class="p3-sheet-head"><h3>{title}</h3><button class="x" aria-label="Close">&times;</button></div>'
        f"{inner}</div></div>"
    )


def btn(text, kind="", disabled=False, desc=None):
    d = " disabled" if disabled else ""
    cls = {"": "p3-btn", "line": "p3-btn p3-btn-line", "danger": "p3-btn p3-btn-danger"}[kind]
    out = f'<button class="{cls} full"{d}>{text}</button>'
    if desc:
        out += f'<p class="p3-note">{desc}</p>'
    return out


def tag(text, kind="live"):
    return f'<span class="p3-tag p3-tag-{kind}">{text}</span>'


def skel(n=3):
    return "".join('<div class="sk"></div>' for _ in range(n))


def error(title, body="Check your connection, then try again."):
    return card(f'<div class="p3-state"><strong>{title}</strong><p>{body}</p><button class="p3-btn p3-btn-line">Try again</button></div>')


# ------------------------------------------------------------------ data shapes
SHORT = ["Priya Sharma", "Tom Okafor", "Lucia Fernandes", "Ben Hart"]
TWELVE = ["Priya Sharma", "Tom Okafor", "Lucia Fernandes", "Ben Hart", "Aisha Rahman", "Marco Bellini",
          "Sophie Laurent-Dubois", "Kwame Mensah", "Elena Petrova", "Dan Wu", "Rosa Martinez", "Jakub Nowak"]
LONGNAME = "Maximiliana Concepci&oacute;n Rodr&iacute;guez-Villanueva"
PAGES = [("Bachata Sensual London", "Owner", True), ("Ritmo Latino Sundays at The Old Dairy, Crouch End", "Manager", False),
         ("Dance Fusion Collective", "Manager", True)]


def member_row(name, role, me=False, added_by=None, link=True):
    sub = f'<span class="p3-row-s">Added by {added_by}</span>' if added_by else ""
    you = " (you)" if me else ""
    return (f'<a class="navrow" href="#">{av(name)}<span class="grow"><span class="p3-row-t">{name}{you}</span>{sub}</span>'
            f'<span class="p3-tag">{role}</span>{CHEV}</a>')


def team_list(names, me_role="Owner"):
    rows = [member_row("Ricky Constante", me_role, me=True, added_by=None if me_role == "Owner" else "Priya S.")]
    for i, n in enumerate(names):
        rows.append(member_row(n, "Manager" if i % 3 == 0 else "Contributor"))
    return card("".join(rows), f"Team &middot; {len(names)+1} people")


def public_toggle(on=True, no_profile=False):
    note = ("Finish your dancer profile first, then you can show on the public team."
            if no_profile else
            "Visitors to your page see your name and photo in its team." if on else
            "Visitors do not see you in the team on your page. You still help run it.")
    dis = " disabled" if no_profile else ""
    extra = '<a class="p3-link" href="#">Finish your profile</a>' if no_profile else ""
    return card(
        f'<div class="top-row" style="min-height:44px"><span class="grow" style="flex:1">Show me on the public team</span>'
        f'<button class="sw{" on" if on else ""}" role="switch" aria-checked="{str(on).lower()}"{dis}><i></i></button></div>'
        f'<p class="p3-note">{note}</p>{extra}', "Public team")


def join_request(blocked=False):
    b = '<p class="p3-note">This team is full (20). Remove someone to add them.</p>' if blocked else ""
    return card(
        f'<div class="top-row">{av("Nadia Ali")}<span style="flex:1"><span class="p3-row-t">Nadia Ali</span>'
        f'<span class="p3-row-s" style="display:block">&ldquo;I help with the door on Fridays&rdquo;</span></span></div>{b}'
        f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'
        f'<button class="p3-btn"{" disabled" if blocked else ""}>Add</button><button class="p3-btn p3-btn-line">Decline</button></div>',
        'Wants to join <span class="count">1</span>')


def add_button(role="Owner", full=False):
    if role == "Contributor":
        return btn("Add someone", disabled=True, desc="Only an owner or a manager adds people.")
    if full:
        return btn("Add someone", disabled=True, desc="This team is full (20). Remove someone to add another.")
    return btn("Add someone")


# ------------------------------------------------------------------ shared screens (all variants)
def screens_team(back, sheet_person=False):
    f = []
    f.append(fig("Team &middot; owner, team of 12, 1 join request", "Join request sits above the list (D9). Own row says who added you.",
                 phone("Team", join_request() + team_list(TWELVE[:11]) + public_toggle(True) + add_button(), back=back)))
    f.append(fig("Team &middot; owner, empty team (just you)", "Empty state says what to do and offers the action.",
                 phone("Team", card('<div class="p3-state"><strong>Just you so far</strong><p>Add a manager to help run your nights. They can edit events; only you hand the page over or remove people.</p></div>')
                       + team_list([]) + public_toggle(False) + add_button(), back=back)))
    f.append(fig("Team &middot; manager", "Managers add people. Leave is here, not only in More.",
                 phone("Team", team_list(SHORT, "Manager") + public_toggle(True) + add_button("Manager")
                       + '<a class="p3-link" href="#" style="align-self:center">Leave this page</a>', back=back)))
    f.append(fig("Team &middot; contributor, no dancer profile", "Add is disabled with its reason; the switch is disabled with its reason and a way out.",
                 phone("Team", team_list(SHORT[:2], "Contributor") + public_toggle(False, no_profile=True) + add_button("Contributor")
                       + '<a class="p3-link" href="#" style="align-self:center">Leave this page</a>', back=back)))
    f.append(fig("Team &middot; full (20) with a join request", "Add and the request's Add both disabled, both say why.",
                 phone("Team", join_request(blocked=True) + team_list(TWELVE + SHORT + ["Ola N", "Ivy K", "Sam R"]) + add_button(full=True), back=back)))
    f.append(fig("Team &middot; long names", "Names wrap (overflow-wrap:anywhere), role tag never squeezed.",
                 phone("Team", card(member_row("Ricky Constante", "Owner", me=True) + member_row(LONGNAME, "Manager")
                                    + member_row("Sophie Laurent-Dubois-Montgomery", "Contributor"), "Team &middot; 3 people") + add_button(), back=back)))
    f.append(fig("Team &middot; loading", "Skeleton rows keep the shape.", phone("Team", skel(4), back=back)))
    f.append(fig("Team &middot; did not load", "Retry, never a guess at the role.", phone("Team", error("Your team did not load"), back=back)))

    person_owner = (
        f'<div class="pagehero">{av("Tom Okafor", 72)}<p class="p3-hero-name" style="margin:0">Tom Okafor</p>{tag("Contributor","hidden")}</div>'
        + card('<p class="p3-note" style="color:var(--fg)">Owner: hands the page over, changes roles, removes people. Manager: adds people and edits events. Contributor: edits events.</p>')
        + btn("Make Manager", "line") + btn("Hand the page over", "line") + btn("Remove from the team", "line"))
    person_mgr = (
        f'<div class="pagehero">{av("Tom Okafor", 72)}<p class="p3-hero-name" style="margin:0">Tom Okafor</p>{tag("Contributor","hidden")}</div>'
        + card('<p class="p3-note" style="color:var(--fg)">Owner: hands the page over, changes roles, removes people. Manager: adds people and edits events. Contributor: edits events.</p>')
        + btn("Change role", "line", disabled=True, desc="Only the owner changes roles or removes people."))
    confirm = ('<p style="margin:0">Remove Tom Okafor? They will no longer see or edit these events.</p>'
               + btn("Remove", "danger") + btn("Keep them", "line"))
    if sheet_person:
        f.append(fig("Person (sheet) &middot; owner viewing a contributor", "Opens over Team; Escape and the scrim close it.",
                     phone("Team", team_list(SHORT), back=back, sheet=sheet("Tom Okafor", person_owner.replace('<div class="pagehero">', '<div class="pagehero" hidden>') + ""))))
        f.append(fig("Person (sheet) &middot; manager viewing", "Change role disabled with the reason.",
                     phone("Team", team_list(SHORT, "Manager"), back=back, sheet=sheet("Tom Okafor", person_mgr))))
        f.append(fig("Person (sheet) &middot; remove confirm", "Inline confirm, focus moves in; Keep returns to Remove.",
                     phone("Team", team_list(SHORT), back=back, sheet=sheet("Remove Tom?", confirm))))
    else:
        f.append(fig("Person &middot; owner viewing a contributor", "Make Manager / Hand over / Remove (parity with C26).",
                     phone("Tom Okafor", person_owner, back="Team")))
        f.append(fig("Person &middot; manager viewing", "Change role disabled with the reason.",
                     phone("Tom Okafor", person_mgr, back="Team")))
        f.append(fig("Person &middot; remove confirm", "Inline confirm, no Undo; Done offers &lsquo;Add them back&rsquo;.",
                     phone("Tom Okafor", f'<div class="pagehero">{av("Tom Okafor", 72)}</div>' + confirm, back="Team")))
    f.append(fig("Person &middot; yourself (manager)", "Your own row: role, Leave.",
                 phone("Ricky Constante", f'<div class="pagehero">{av("Ricky Constante", 72)}<p class="p3-hero-name" style="margin:0">Ricky Constante</p>{tag("Manager &middot; you","hidden")}</div>'
                       + '<a class="p3-link" href="#" style="align-self:center">Leave this page</a>', back="Team")))
    f.append(fig("Person &middot; no longer on the team", "Says what happened and where to go.",
                 phone("Team", card('<div class="p3-state"><strong>They are not on the team any more</strong><p>Someone may have removed them.</p><a class="p3-link" href="#">Back to the team</a></div>'), back="Team")))

    wall = "".join(f'<button class="face">{av(n,48)}<span class="n">{n}</span><span class="f">{fct}</span></button>'
                   for n, fct in zip(TWELVE[:9], ["Teacher", "DJ", "Add", "Invite", "Teacher", "Add", "DJ", "Invite", "Add"]))
    f.append(fig("Add someone &middot; dancer wall", "3-column faces; &lsquo;Invite&rsquo; = no account yet, shares a named invite.",
                 phone("Add someone", '<input class="search" placeholder="Search by name" aria-label="Search dancers by name">'
                       + f'<div class="faces">{wall}</div>' + btn("Show more", "line") + btn("Share an invite link", "line"), back="Team")))
    f.append(fig("Add someone &middot; no results", "Empty says what to do next.",
                 phone("Add someone", '<input class="search" value="Zebedee">'
                       + card('<div class="p3-state"><strong>No one found</strong><p>They may not be on Bachata Calendar yet. Send them an invite link.</p></div>')
                       + btn("Share an invite link"), back="Team")))
    f.append(fig("Add someone &middot; error after a tap", "Refusal worded for this screen; the wall stays.",
                 phone("Add someone", '<input class="search" placeholder="Search by name">'
                       + '<p class="danger-t" role="alert">Only the owner can add people to this page.</p>'
                       + f'<div class="faces">{wall[: len(wall)//3]}</div>' + btn("Share an invite link", "line"), back="Team")))
    f.append(fig("Add someone &middot; contributor", "Read-only: says who can, link back.",
                 phone("Add someone", card('<div class="p3-state"><strong>Only an owner or a manager adds people</strong><p>Ask the owner to add them, or send them the invite link.</p><a class="p3-link" href="#">Back to the team</a></div>'), back="Team")))

    f.append(fig("Hand over &middot; to whom", "Only managers with a confirmed email can take over.",
                 phone("Hand over", '<p style="margin:0">Hand Bachata Sensual London over to:</p>'
                       + card(member_row("Priya Sharma", "Manager") + member_row("Ben Hart", "Manager")), back="Team")))
    f.append(fig("Hand over &middot; no one can take over", "Empty + action.",
                 phone("Hand over", card('<div class="p3-state"><strong>No one can take over yet</strong><p>Add a Manager with a confirmed email first, then hand the page over to them.</p></div>')
                       + btn("Add someone"), back="Team")))
    f.append(fig("Hand over &middot; confirm", "Warning in full; error if their email is unconfirmed.",
                 phone("Hand over", f'<div class="pagehero">{av("Priya Sharma",56)}<p class="p3-row-t" style="margin:0">Priya S.</p></div>'
                       + '<p style="margin:0">Hand Bachata Sensual London over to Priya S.? You become a Manager: you can still edit events but no longer hand the page over or remove people. Priya S. can hand it back.</p>'
                       + '<p class="danger-t" role="alert">Priya has not confirmed their email address yet. Ask them to confirm it, then hand the page over.</p>'
                       + btn("Hand over") + btn("Keep it", "line"), back="Back")))
    f.append(fig("Hand over &middot; manager", "Owner-only, said plainly.",
                 phone("Hand over", card('<div class="p3-state"><strong>Only the owner can hand the page over</strong><p>Ask the owner if this page should change hands.</p></div>'), back="Team")))
    return f


def screens_welcome():
    return [
        fig("Welcome 1d &middot; first page", "Where an accepted invite lands, once.",
            phone("Welcome", '<p class="p3-hero-name" style="margin:0">You manage Bachata Sensual London</p><p style="margin:0">Add your first event whenever you are ready.</p>'
                  + btn("Add an event") + btn("Look around first", "line"), active="home")),
        fig("Welcome 7c &middot; another page", "Names the other pages and where Switch is.",
            phone("Welcome", '<p class="p3-hero-name" style="margin:0">You now manage Ritmo Latino Sundays</p><p style="margin:0">You also manage Bachata Sensual London and Dance Fusion Collective. Switch any time from You.</p>'
                  + btn("Go to Home"), active="home")),
        fig("Welcome &middot; Home did not load", "Still leads on.",
            phone("Welcome", '<p style="margin:0">You joined the team. Your pages are on You.</p>' + btn("Go to Home"), active="home")),
    ]


def page_editor(state="live", name="Bachata Sensual London"):
    rows = []
    def r(k, v, empty=False):
        cls = "v empty" if empty else "v"
        rows.append(f'<div class="editrow"><span class="grow"><span class="k">{k}</span><span class="{cls}" style="display:block">{v}</span></span><button class="editbtn">Edit</button></div>')
    draft = state == "draft"
    r("Photo", "Logo uploaded" if not draft else "No photo yet &mdash; dancers see your initials", draft)
    r("Name", name)
    r("City", "London")
    r("About", "Weekly sensual socials in Camden. Beginners welcome; class 8pm, party till 1am." if not draft else "Not written yet &mdash; say who it&rsquo;s for and when", draft)
    r("Links", "@bachatasensual.ldn &middot; bachatasensual.co.uk" if not draft else "None yet", draft)
    r("Contact", "Phone hidden from visitors" if not draft else "None yet", draft)
    head = (f'<div class="pagehero">{av(name, 88)}<p class="p3-hero-name" style="margin:0">{name}</p>'
            + (tag("Live") if not draft else tag("Draft (only you see it)", "draft")) + "</div>")
    req = '<a class="req" href="#"><span style="flex:1">Required to publish: photo and about</span>' + CHEV + "</a>" if draft else ""
    view = '<a class="p3-link" href="#" style="align-self:center">See it as dancers do</a>' if not draft else ""
    return head + req + card("".join(rows)) + view


def screens_page(back, title="Organiser page"):
    return [
        fig("Organiser page &middot; published", "Tap-to-edit rows, one Save per sheet; Live tag is the only status mark (D22).",
            phone(title, page_editor("live"), back=back)),
        fig("Organiser page &middot; not published yet", "Required-to-publish line opens the existing wizard.",
            phone(title, page_editor("draft"), back=back)),
        fig("Organiser page &middot; edit sheet (About)", "Save disabled until the value differs; untouched save sends nothing.",
            phone(title, page_editor("live"), back=back, sheet=sheet("About",
                  '<textarea class="search" style="min-height:140px;padding:12px">Weekly sensual socials in Camden. Beginners welcome; class 8pm, party till 1am.</textarea>'
                  + btn("Save", disabled=True, desc="Change something to save.")))),
        fig("Organiser page &middot; no page yet", "Empty + the way to add one.",
            phone(title, card('<div class="p3-state"><strong>You don&rsquo;t run a page yet</strong><p>A new page needs an invite from the Bachata Calendar team &mdash; message us and we&rsquo;ll set you up. Or ask an owner to add you to their team.</p></div>') + btn("Message us"), back=back)),
        fig("Organiser page &middot; no longer on it", "Old &lsquo;page-missing&rsquo; state.",
            phone(title, card('<div class="p3-state"><strong>This page is not available</strong><p>You may no longer help run it. Pick another page.</p><a class="p3-link" href="#">Switch page</a></div>'), back=back)),
        fig("Organiser page &middot; did not load", "Retry.", phone(title, error("Your page did not load"), back=back)),
        fig("Event flyer (cover/:seriesId)", "Moves to the event page in Events (W2a), not You. Locked while profiles are unfinished.",
            phone("Flyer", card('<div style="height:220px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center" class="p3-mut">No flyer yet</div>')
                  + btn("Choose a photo") + '<p class="p3-note">Dancers see this on the event and in the calendar.</p>', back="Friday Social", active="events")),
    ]


def switch_rows(pages, current=0):
    out = []
    for i, (n, role, live) in enumerate(pages):
        cur = ' aria-current="true"' if i == current else ""
        tick = '<span class="p3-tag" style="background:var(--btn);color:var(--btnfg)">Showing</span>' if i == current else ""
        lv = tag("Live") if live else ""
        out.append(f'<a class="navrow" href="#"{cur}><span class="grow"><span class="p3-row-t">{n}</span><span class="p3-row-s" style="display:block">{role}</span></span>{lv}{tick}</a>')
    return "".join(out)


# ------------------------------------------------------------------ variant-specific
def you_card(page, role, live=True):
    return card(f'<div class="top-row">{av(page,48)}<span style="flex:1;min-width:0"><span class="p3-row-t" style="display:block">{page}</span>'
                f'<span class="p3-row-s">{role}</span></span>{tag("Live") if live else tag("Draft","draft")}</div>')


def nav(label, sub="", badge=""):
    s = f'<span class="p3-row-s" style="display:block">{sub}</span>' if sub else ""
    return f'<a class="navrow" href="#"><span class="grow"><span class="p3-row-t">{label}</span>{s}</span>{badge}{CHEV}</a>'


def variant_a():
    f = ['<h2 class="sec">You tab (the hub)</h2>']
    f.append(fig("You &middot; single page, owner, live", "One card for the page, then a row per area. No Switch row when there is one page; &lsquo;Add a page&rsquo; stays in reach.",
                 phone("You", you_card("Bachata Sensual London", "Owner") + card(nav("Organiser page", "Photo, about, links, contact") + nav("Team", "5 people", '<span class="count">1</span>')
                       + nav("Add another page")) + card(nav("Account and help", "Sign out, help, leave a page")))))
    f.append(fig("You &middot; 3 pages, manager on this one, long name", "Switch row names the page shown; other tabs already show all pages&rsquo; events.",
                 phone("You", you_card(PAGES[1][0], "Manager", False) + card(nav("Switch page", "Showing 1 of 3 pages") + nav("Organiser page", "Required to publish: 2 left") + nav("Team", "12 people"))
                       + card(nav("Account and help")))))
    f.append(fig("You &middot; no page yet", "Says what to do; Team is shown disabled with why.",
                 phone("You", card('<div class="p3-state"><strong>You don&rsquo;t run a page yet</strong><p>A new page needs an invite from the Bachata Calendar team &mdash; message us and we&rsquo;ll set you up. Or ask an owner to add you to their team.</p></div>')
                       + btn("Message us") + card('<div class="navrow" aria-disabled="true"><span class="grow"><span class="p3-row-t p3-mut">Team</span><span class="p3-row-s" style="display:block">A team belongs to a page. Add one first.</span></span></div>')
                       + card(nav("Account and help")))))
    f.append(fig("You &middot; loading", "", phone("You", skel(4))))
    f.append(fig("You &middot; did not load", "", phone("You", error("Your pages did not load"))))
    f.append('<h2 class="sec">Switch page (pushed screen)</h2>')
    f.append(fig("Switch page &middot; 3 pages", "Tap = choose; you return to You on that page. Live tag only status mark.",
                 phone("Switch page", card(switch_rows(PAGES, 1)) + btn("Add a page", "line"), back="You")))
    f.append(fig("Switch page &middot; offline", "", phone("Switch page", error("You&rsquo;re offline", "Your pages show when you&rsquo;re back online.") + btn("Add a page", "line"), back="You")))
    f.append('<h2 class="sec">Team and its screens</h2>')
    f += screens_team("You")
    f.append('<h2 class="sec">Organiser page</h2>')
    f += screens_page("You")
    f.append('<h2 class="sec">Welcome (after an accepted invite)</h2>')
    f += screens_welcome()
    return f


def variant_b():
    chip = lambda name: f'<button class="pagechip" aria-label="Switch page, showing {name}"><span>{name}</span>&#9662;</button>'
    f = ['<h2 class="sec">You tab = your page, team on it</h2>']
    teaser = lambda n, req=False: card(
        f'<a class="navrow" href="#"><span class="facesrow">{"".join(av(x,36) for x in TWELVE[:4])}</span><span class="grow" style="padding-left:12px"><span class="p3-row-t">Team</span>'
        f'<span class="p3-row-s" style="display:block">{n} people{" &middot; 1 wants to join" if req else ""}</span></span>{CHEV}</a>')
    f.append(fig("You &middot; single page, owner", "Page facts on top (tap Edit), team teaser, then account. No page chip with one page.",
                 phone("You", page_editor("live") + teaser(5, True) + card(nav("Add another page") + nav("Account and help")))))
    f.append(fig("You &middot; 3 pages (chip in the top bar)", "Chip shows the page; tap opens the Switch sheet.",
                 phone("You", page_editor("draft", PAGES[1][0]) + teaser(12) + card(nav("Account and help")), end=chip(PAGES[1][0]))))
    f.append(fig("Switch sheet &middot; 3 pages", "Bottom sheet (P3 pattern); Add a page at the foot.",
                 phone("You", page_editor("live"), end=chip(PAGES[0][0]), sheet=sheet("Switch page", switch_rows(PAGES, 0) + btn("Add a page", "line")))))
    f.append(fig("Switch sheet &middot; did not load", "",
                 phone("You", page_editor("live"), end=chip(PAGES[0][0]), sheet=sheet("Switch page", error("Your pages did not load")))))
    f.append(fig("You &middot; no page yet", "",
                 phone("You", card('<div class="p3-state"><strong>You don&rsquo;t run a page yet</strong><p>A new page needs an invite from the Bachata Calendar team &mdash; message us and we&rsquo;ll set you up. Or ask an owner to add you to their team.</p></div>')
                       + btn("Message us") + card(nav("Account and help")))))
    f.append(fig("You &middot; loading", "", phone("You", skel(5))))
    f.append('<h2 class="sec">Page editing details</h2>')
    f += screens_page("You", title="You")[1:6]
    f.append('<h2 class="sec">Team (pushed) &mdash; person opens as a sheet</h2>')
    f += screens_team("You", sheet_person=True)
    f.append('<h2 class="sec">Welcome</h2>')
    f += screens_welcome()
    return f


def variant_c():
    def seg(active):
        return '<div class="seg">' + "".join(f'<button aria-pressed="{str(x==active).lower()}">{x}</button>' for x in ("Page", "Team", "Account")) + "</div>"
    chip = f'<button class="pagechip" aria-label="Switch page"><span>{PAGES[0][0]}</span>&#9662;</button>'
    f = ['<h2 class="sec">You tab with Page / Team / Account inside</h2>']
    f.append(fig("You &middot; Page (single page)", "Segmented control under the bar; page is the first segment.",
                 phone("You", seg("Page") + page_editor("live"))))
    f.append(fig("You &middot; Team (owner, 12, request)", "Team lives in the same tab; no extra push.",
                 phone("You", seg("Team") + join_request() + team_list(TWELVE[:11]) + public_toggle(True) + add_button(), end=chip)))
    f.append(fig("You &middot; Team (contributor)", "", phone("You", seg("Team") + team_list(SHORT[:2], "Contributor") + public_toggle(False, True) + add_button("Contributor"), end=chip)))
    f.append(fig("You &middot; Account", "Switch, add a page, help, sign out, leave.",
                 phone("You", seg("Account") + card(nav("Switch page", "Showing 1 of 3 pages") + nav("Add a page") + nav("Help") + nav("Leave this page")) + btn("Sign out", "line"), end=chip)))
    f.append(fig("Switch sheet", "", phone("You", seg("Page") + page_editor("live"), end=chip, sheet=sheet("Switch page", switch_rows(PAGES, 0) + btn("Add a page", "line")))))
    f.append(fig("You &middot; no page yet", "Page and Team segments disabled with why.",
                 phone("You", '<div class="seg"><button aria-pressed="false" disabled>Page</button><button aria-pressed="false" disabled>Team</button><button aria-pressed="true">Account</button></div>'
                       + card('<div class="p3-state"><strong>You don&rsquo;t run a page yet</strong><p>A new page needs an invite from the Bachata Calendar team &mdash; message us and we&rsquo;ll set you up. Or ask an owner to add you to their team.</p></div>') + btn("Message us"))))
    f.append('<h2 class="sec">Shared: page states, team states, person, add, hand over</h2>')
    f += screens_page("You")[1:]
    f += screens_team("You")[1:]
    f += screens_welcome()
    return f


VARIANTS = {
    "A": ("You hub: rows to pushed screens",
          "The You tab is a short list: a page card, then Switch page (only with 2+ pages), Organiser page, Team, Account. Each opens its own screen with a back link to You; every old route maps 1:1 onto a P3 route. Lowest risk; most taps.", variant_a),
    "B": ("Page-first You, switch chip in the bar",
          "The You tab IS your organiser page (tap-to-edit rows), with a team teaser under it. With 2+ pages a chip in the top bar opens a Switch sheet. Team is one push; a person opens as a sheet over it. Fewest taps for the common job (edit my page).", variant_b),
    "C": ("Segments inside You",
          "The You tab carries a Page / Team / Account control. Everything is one tab deep; the page chip opens the Switch sheet. Densest; the segment control is a new P3 pattern.", variant_c),
}


def build(key):
    title, blurb, fn = VARIANTS[key]
    body = "".join(fn())
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P3 W4a mockup {key}</title>
<style>/* copied verbatim from src/modules/organiser/p3/theme/p3.css at build time */
{P3_CSS}
{EXTRA_CSS}</style></head><body><div class="wrap">
<h1>P3 W4a &middot; Mockup {key}: {title}</h1>
<p>{blurb}</p>
<p>Design only (Phase A). Every phone is 390&times;844. Colours come from p3.css tokens. Roles are the stored ones: Owner / Manager / Contributor. Toggle the theme to check dark.</p>
<div class="toolbar"><button onclick="document.querySelectorAll('.p3-theme').forEach(e=>e.dataset.theme='light')">Light</button><button onclick="document.querySelectorAll('.p3-theme').forEach(e=>e.dataset.theme='dark')">Dark</button></div>
<div class="grid">{body}</div></div></body></html>
"""


if __name__ == "__main__":
    for k in VARIANTS:
        (OUT / f"{k}.html").write_text(build(k), encoding="utf-8")
        print("wrote", OUT / f"{k}.html")
