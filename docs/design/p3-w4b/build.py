#!/usr/bin/env python3
"""Builds the P3 W4b stage-2 mockups (docs only). Run: python3 docs/design/p3-w4b/build.py
Writes the four option files and index.html beside this script. ASCII only: every
punctuation mark in the copy is an HTML entity (CLAUDE.md, mojibake rule)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# Tokens copied from src/modules/organiser/p3/theme/p3.css (light + dark). No new palette.
CSS = """
:root{--bg:#f7f3ef;--card:#ffffff;--card2:#f1ebe5;--sheet:#ffffff;--line:#e4dbd2;--line-strong:#8a7d71;
--fg:#1d0a03;--mut:#5f5248;--gold:#f0703a;--gold-fg:#a8461a;--btn:#f0703a;--btnfg:#1d0a03;--danger:#b3261e;
--ok-bg:#e2f4ea;--ok-fg:#17663f;--warn-bg:#fde8dc;--warn-fg:#8a3510;--scrim:rgba(29,10,3,.45);
--r-card:20px;--r-ctl:15px;--r-sheet:28px;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#202226;--card:#2a2d32;--card2:#33373d;--sheet:#2a2d32;--line:#3d4148;
--line-strong:#7b828d;--fg:#f1f2f4;--mut:#a3a9b3;--gold-fg:#f5865a;--danger:#ff7a6b;--ok-bg:#1f3a30;--ok-fg:#7be6b4;
--warn-bg:#3b2a22;--warn-fg:#ff9a6a;--scrim:rgba(0,0,0,.6);color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.4}
.intro{padding:12px 16px;max-width:390px}
.intro h1{font-size:20px;margin:0 0 4px}.intro p{margin:0 0 8px;font-size:14px;color:var(--mut)}
.step{max-width:390px;padding:12px 0 0}
.step h2{font-size:14px;margin:0 16px 6px;color:var(--mut);font-weight:600}
.ph{position:relative;width:100%;max-width:390px;height:844px;overflow:hidden;background:var(--bg);border-top:1px solid var(--line-strong);border-bottom:1px solid var(--line-strong)}
.top{min-height:56px;display:flex;align-items:center;gap:8px;padding:0 16px}
.top h3{margin:0;font-size:22px;font-weight:700}
.main{padding:0 16px 12px}
.main>*+*{margin-top:12px}
.mut{color:var(--mut);font-size:14px;margin:0}
.p{margin:0;font-size:15px}
.h{margin:0;font-size:20px;font-weight:700}
.steps{display:flex;flex-wrap:wrap;gap:8px;font-size:14px;color:var(--mut);list-style:none;padding:0;margin:0}
.steps .on{color:var(--fg);font-weight:600}.steps .did{color:var(--ok-fg)}
.who{display:flex;flex-wrap:wrap;align-items:center;gap:4px;font-size:14px;color:var(--mut);margin:0}
.lnk{display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:0 4px;color:var(--gold-fg);font-weight:600;text-decoration:underline;background:none;border:0;font:inherit;font-size:inherit}
.btn,.ghost,.dis{display:flex;width:100%;min-height:48px;align-items:center;justify-content:center;gap:8px;border-radius:var(--r-ctl);font:inherit;font-weight:700;font-size:16px;padding:8px 12px}
.btn{background:var(--btn);color:var(--btnfg);border:0}
.ghost{background:var(--card);color:var(--fg);border:1px solid var(--line-strong)}
.dis{background:var(--card2);color:var(--mut);border:1px dashed var(--line-strong)}
.sm{width:auto;min-height:44px;min-width:44px;font-size:14px;padding:6px 12px}
.why{font-size:14px;color:var(--mut);margin:4px 0 0}
.field{display:flex;align-items:center;width:100%;min-height:48px;border:1px solid var(--line-strong);border-radius:var(--r-ctl);background:var(--card);padding:0 12px;font-size:16px;color:var(--fg)}
.field.ph-t{color:var(--mut)}.field.focus{outline:2px solid var(--gold-fg);outline-offset:1px}
.lbl{font-size:14px;font-weight:600;margin:0 0 4px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden}
.card>*+*{border-top:1px solid var(--line)}
.card .cl{font-size:14px;font-weight:600;color:var(--mut);padding:8px 12px;margin:0}
.row{display:flex;align-items:center;gap:12px;padding:8px 12px;min-height:56px}
.row .t{flex:1;min-width:0}.row .n{margin:0;font-size:15px;font-weight:600}.row .s{margin:0;font-size:14px;color:var(--mut)}
.opt{display:flex;align-items:center;width:100%;min-height:52px;padding:0 12px;font:inherit;font-size:15px;color:var(--fg);background:var(--card);border:0;text-align:left}
.sk{height:56px;padding:12px}.sk i{display:block;height:12px;border-radius:6px;background:var(--card2);margin-bottom:8px}.sk i+i{width:50%}
.err{background:var(--card);border:1px solid var(--line-strong);border-radius:var(--r-card);padding:12px}
.err .p{font-weight:700}.alert{color:var(--danger);font-size:14px;margin:0}
.ok{background:var(--ok-bg);color:var(--ok-fg);border-radius:12px;padding:12px;font-size:14px;margin:0}
.warn{background:var(--warn-bg);color:var(--warn-fg);border-radius:12px;padding:12px;font-size:14px;margin:0}
.choice{display:block;width:100%;text-align:left;background:var(--card);border:1px solid var(--line-strong);border-radius:var(--r-card);padding:12px;font:inherit;color:var(--fg);min-height:72px}
.choice b{display:block;font-size:16px}.choice span{display:block;font-size:14px;color:var(--mut)}
.scrim{position:absolute;inset:0;background:var(--scrim)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--sheet);border-radius:var(--r-sheet) var(--r-sheet) 0 0;padding:8px 16px 16px}
.sheet.full{top:24px}
.sheet .bar{display:flex;align-items:center;gap:8px;min-height:52px}
.sheet .bar h3{flex:1;margin:0;font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x{min-width:44px;min-height:44px;border:0;background:none;font:inherit;font-size:22px;color:var(--fg)}
.sheet>*+*{margin-top:12px}
.sumrow{display:flex;align-items:center;justify-content:space-between;min-height:48px;padding:0 12px;border:1px solid var(--line);border-radius:12px;font-size:15px}
.sumrow span{color:var(--mut);font-size:14px}
.chk{display:flex;align-items:flex-start;gap:12px;min-height:48px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;font-size:15px}
.chk input{width:24px;height:24px;margin:2px 0 0;accent-color:var(--gold-fg)}
.chk.off{color:var(--mut)}
.note{font-size:13px;color:var(--mut);margin:0;padding:0 16px 8px;max-width:390px}
"""

def page(title, intro, steps):
    body = ''.join(
        f'<section class="step"><h2>{n}</h2><div class="ph" role="img" aria-label="{n}">{html}</div>{note and f"<p class=note>{note}</p>"}</section>'
        for n, html, note in steps)
    return (f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{title}</title><style>{CSS}</style></head><body><div class="intro">{intro}</div>{body}</body></html>')

# ---------- shared pieces (copy is today's copy unless the note says otherwise) ----------
BETA = '<p class="mut">During the beta, new pages are approved by hand. Find your page first; if you create a new one, we may need to open it for you.</p>'
WHO = '<p class="who">Signed in as sam@example.com. <span>Not you?</span><button class="lnk">Sign out</button></p>'
STEPS = '<ol class="steps" aria-label="Steps"><li class="did">&check; Signed in</li><li aria-hidden="true">&rsaquo;</li><li class="on" aria-current="step">Your organiser</li><li aria-hidden="true">&rsaquo;</li><li>Your events</li></ol>'
TOP = '<div class="top"><h3>Welcome</h3></div>'
SEARCH_EMPTY = '<div class="field ph-t">&#128269;&nbsp; Search pages by name</div>'
def search(v, focus=True): return f'<div class="field{" focus" if focus else ""}">&#128269;&nbsp; {v}</div>'
CREATE = '<button class="btn">+ Create a new page</button>'
BROWSE = '<a class="lnk" style="width:100%;justify-content:center" href="#">Just here to dance? Browse events</a>'
SKEL = '<div class="card" aria-label="Searching organisers">' + '<div class="sk"><i></i><i></i></div>' * 3 + '</div>'
RESULTS = ('<div class="card">'
    '<div class="row"><div class="t"><p class="n">Bachata Nights Leeds</p><p class="s">Email on file is yours</p></div><button class="ghost sm">Claim</button></div>'
    '<div class="row"><div class="t"><p class="n">Bachata Social Leeds</p><p class="s">Has a team</p></div><button class="ghost sm">Ask to join</button></div>'
    '<div class="row"><div class="t"><p class="n">Leeds Sensual Sundays</p><p class="s">Ask to join</p></div><span class="s" style="color:var(--mut);font-size:14px">Asked</span></div>'
    '</div>')
NO_MATCH = '<p class="p" style="color:var(--mut)">No organiser matches &ldquo;Bachta Leds&rdquo;. Check the spelling, or <button class="lnk">create it as a new organiser</button>.</p>'
SEARCH_ERR = ('<div class="err" role="alert"><p class="p">The search did not work</p><p class="mut">We cannot tell if this organiser is listed until the search works. Check your connection, then try again.</p>'
              '<button class="ghost sm" style="margin-top:8px">Try again</button></div>')
def sheet(title, inner, full=False, back=False):
    b = '<button class="x" aria-label="Back">&lsaquo;</button>' if back else ''
    return f'<div class="scrim"></div><div class="sheet{" full" if full else ""}"><div class="bar">{b}<h3>{title}</h3><button class="x" aria-label="Close">&times;</button></div>{inner}</div>'
NAME_HINT = '<p class="why">The name dancers know you by: your school, brand or event series.</p>'
NAME_EMPTY = ('<div><p class="lbl">Page name</p><div class="field focus"></div>' + NAME_HINT + '</div>'
              '<div><button class="dis" disabled aria-describedby="w">Next</button><p class="why" id="w">Type the page name first.</p></div>')
NAME_ROW = '<div class="sumrow">Bachata Nights Harrogate <span>&#9998; Change</span></div>'
SIGNOUT = sheet('Sign out', '<p class="p">Sign out of sam@example.com on this device?</p><button class="ghost">No, stay signed in</button><button class="btn">Yes, sign out</button>')
CREATING = '<div class="card" aria-label="Creating your page"><div class="sk"><i></i><i></i></div></div><p class="mut" role="status">Creating your page&hellip;</p>'
INVITE = ('<p class="h" style="font-size:18px">Events are not open to you yet</p><p class="p">New pages are approved by hand during the beta.</p>'
          '<button class="btn">Ask us to open it</button><button class="ghost">Back to Home</button>')
CITY_OPTS = ('<div class="card"><button class="opt">Harrogate, United Kingdom</button><button class="opt">Harrow, United Kingdom</button></div>')
HOME_DONE = ('<div class="top"><h3>Home</h3></div><div class="main"><p class="ok" role="status">&check; Bachata Nights Harrogate created</p>'
             '<p class="p">Next: add your first event.</p><button class="btn">+ New event</button></div>')

def welcome(extra): return TOP + '<div class="main">' + extra + '</div>'

# ---------- Shape 1: brand-new account ----------
A_INTRO = ('<h1>Brand-new account &middot; A: Quiet steps</h1><p>Today&rsquo;s one-scroll screen, tidied: the search is the first thing under the heading, '
           'create sits under it, nothing is hidden. Every step of the flow, top to bottom.</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
new_a = [
    ('1. First visit (empty)', welcome(STEPS + WHO + '<div><p class="h">Find your page</p>' + BETA + '</div>' + SEARCH_EMPTY + CREATE + BROWSE), 'Same controls as today, same order.'),
    ('2. Searching (loading)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds') + SKEL + CREATE), ''),
    ('3. Results (claim / ask to join / asked)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds') + RESULTS + CREATE), 'Row words come from claimStates.ts, unchanged.'),
    ('4. No match', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachta Leds') + NO_MATCH + CREATE), ''),
    ('5. Search failed (error)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds', False) + SEARCH_ERR + CREATE), ''),
    ('6. Create: page name, Next disabled with reason', welcome(STEPS) + sheet('New page', NAME_EMPTY, full=True), ''),
    ('7. Create: city (sign-up city offered)', welcome(STEPS) + sheet('Where is it?', NAME_ROW + '<button class="btn">Use Harrogate</button>' + '<div class="field ph-t">&#128269;&nbsp; Or search another city</div>', full=True, back=True), 'Choosing the city IS the create (create_organiser_profile_v1).'),
    ('8. Creating (loading)', welcome(STEPS) + sheet('Where is it?', NAME_ROW + CREATING, full=True), ''),
    ('9. Refused: invite required', welcome(STEPS) + sheet('New page', INVITE, full=True), 'request_signup_access_v1 behind &ldquo;Ask us to open it&rdquo;.'),
    ('10. Done: lands on Home', HOME_DONE, ''),
    ('11. Sign out sheet', welcome(STEPS + WHO) + SIGNOUT, ''),
]

B_INTRO = ('<h1>Brand-new account &middot; B: One card</h1><p>One question first: is your page already listed? Two big answers. '
           'The search and the create each get a screen to themselves.</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
CHOOSE = ('<div style="background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:12px"><p class="h" style="font-size:18px">Is your page already on Bachata Calendar?</p>'
          '<p class="mut" style="margin-top:4px">Most organisers are. Claim yours instead of making a copy.</p></div>'
          '<button class="choice"><b>Yes, find it &rsaquo;</b><span>Search by name, then claim it or ask to join</span></button>'
          '<button class="choice"><b>No, create a new page &rsaquo;</b><span>We may need to open it for you during the beta</span></button>')
FIND_TOP = '<div class="top"><button class="x" aria-label="Back">&lsaquo;</button><h3>Find your page</h3></div>'
def find(extra): return FIND_TOP + '<div class="main">' + extra + '</div>'
FIND_FOOT = '<p class="mut">Not listed? <button class="lnk">Create a new page</button></p>'
new_b = [
    ('1. First visit: one card', welcome(STEPS + WHO + CHOOSE + BETA + BROWSE), 'Beta note moves under the card, still before any name or city.'),
    ('2. Find: empty', find(search('', True).replace('&nbsp; ', '&nbsp; <span style="color:var(--mut)">Search pages by name</span>') + FIND_FOOT), ''),
    ('3. Find: searching (loading)', find(search('Bachata Leeds') + SKEL), ''),
    ('4. Find: results', find(search('Bachata Leeds') + RESULTS + FIND_FOOT), 'Row words unchanged (claimStates.ts).'),
    ('5. Find: no match', find(search('Bachta Leds') + NO_MATCH), ''),
    ('6. Find: search failed (error)', find(search('Bachata Leeds', False) + SEARCH_ERR), ''),
    ('7. Create: page name, Next disabled with reason', welcome(STEPS) + sheet('New page', NAME_EMPTY, full=True), ''),
    ('8. Create: city (sign-up city offered)', welcome(STEPS) + sheet('Where is it?', NAME_ROW + '<button class="btn">Use Harrogate</button><div class="field ph-t">&#128269;&nbsp; Or search another city</div>', full=True, back=True), ''),
    ('9. Creating (loading)', welcome(STEPS) + sheet('Where is it?', NAME_ROW + CREATING, full=True), ''),
    ('10. Refused: invite required', welcome(STEPS) + sheet('New page', INVITE, full=True), ''),
    ('11. Done: lands on Home', HOME_DONE, ''),
    ('12. Sign out sheet', welcome(STEPS + WHO + CHOOSE) + SIGNOUT, ''),
]

# ---------- Shape 2: no city ----------
# Prod: no dancer city means an unfinished dancer profile (all 4 such accounts also miss
# name, role and photo), and claim / ask to join / create all raise profile_incomplete
# (_require_complete_dancer_profile_v1), which today navigates to /finish-profile only
# AFTER the tap (for create: after the name and the city were typed).
MISSING = ('<ul style="margin:4px 0 0;padding-left:20px;font-size:14px;color:var(--warn-fg)">'
           '<li>Your city</li><li>Your first name</li><li>Your dance role</li><li>A photo</li></ul>')
FIN_CARD = ('<div class="warn"><b style="font-size:15px">First, finish your dancer profile</b>'
            '<p style="margin:4px 0 0">Organiser tools need it. It is missing:</p>' + MISSING + '</div>')
FIN_BTN = '<button class="btn">Finish my profile</button>'
OFF_WHY = 'Finish your dancer profile first.'
RESULTS_OFF = ('<div class="card">'
    '<div class="row"><div class="t"><p class="n">Bachata Nights Leeds</p><p class="s">Email on file is yours</p></div><button class="dis sm" disabled>Claim</button></div>'
    '<div class="row"><div class="t"><p class="n">Bachata Social Leeds</p><p class="s">Has a team</p></div><button class="dis sm" disabled>Ask to join</button></div>'
    '</div><p class="why">Claim and Ask to join open once your profile is finished.</p>')
CREATE_OFF = f'<div><button class="dis" disabled>+ Create a new page</button><p class="why">{OFF_WHY}</p></div>'
BACK_OK = '<p class="ok" role="status">&check; Profile finished. You can claim, ask to join or create now.</p>'
NA_INTRO = ('<h1>No city &middot; A: Finish first</h1><p>The screen says up front what is missing and links to the finish screen. '
            'Search still works so people can look; the buttons that would be refused are off, with the reason.</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
nc_a = [
    ('1. First visit: what is missing', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + '<p class="h" style="font-size:18px">Find your page</p>' + SEARCH_EMPTY + CREATE_OFF), 'Today: no word about the profile until a button is refused.'),
    ('2. Searching (loading)', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + search('Bachata Leeds') + SKEL), ''),
    ('3. Results, actions disabled with reason', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + search('Bachata Leeds') + RESULTS_OFF), 'Row words unchanged; only the buttons are off.'),
    ('4. Search failed (error)', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + search('Bachata Leeds', False) + SEARCH_ERR), ''),
    ('5. Back from Finish profile (done)', welcome(STEPS + WHO + BACK_OK + '<p class="h">Find your page</p>' + search('Bachata Leeds') + RESULTS + CREATE), 'Returns here with the search kept (finishProfileHref next=).'),
    ('6. Finish profile could not load (error)', welcome(STEPS + WHO + FIN_CARD + '<p class="alert" role="alert">That did not open. Check your connection and try again.</p>' + FIN_BTN), ''),
]
GATE = ('<p class="p">Before you ask to join Bachata Social Leeds, finish your dancer profile. It is missing:</p>'
        '<ul style="margin:0;padding-left:20px;font-size:14px;color:var(--mut)"><li>Your city</li><li>Your first name</li><li>Your dance role</li><li>A photo</li></ul>'
        + FIN_BTN + '<div><button class="dis" disabled>Ask to join</button><p class="why">' + OFF_WHY + '</p></div>'
        '<p class="mut">We bring you back here and keep your place.</p>')
GATE_NEW = ('<p class="p">Before you create a page, finish your dancer profile. It is missing:</p>'
            '<ul style="margin:0;padding-left:20px;font-size:14px;color:var(--mut)"><li>Your city</li><li>Your first name</li><li>Your dance role</li><li>A photo</li></ul>'
            + FIN_BTN + '<p class="mut">You have not typed anything yet, so nothing is lost.</p>')
NB_INTRO = ('<h1>No city &middot; B: Look first, finish on the tap</h1><p>The screen looks like a brand-new account&rsquo;s. The first organiser tap opens one sheet '
            'that says what is missing, BEFORE any typing, and comes back to the same task.</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
nc_b = [
    ('1. First visit (as a new account)', welcome(STEPS + WHO + '<div><p class="h">Find your page</p>' + BETA + '</div>' + SEARCH_EMPTY + CREATE + BROWSE), 'Nothing says the profile is unfinished yet.'),
    ('2. Searching (loading)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds') + SKEL + CREATE), ''),
    ('3. Tap Ask to join: one thing first', welcome(STEPS) + sheet('Bachata Social Leeds', GATE), 'Ask to join is off with the reason until the profile is done.'),
    ('4. Tap Create: asked before the name', welcome(STEPS) + sheet('New page', GATE_NEW, full=True), 'Today the refusal comes after the name and the city.'),
    ('5. Back from Finish profile: task resumed', welcome(STEPS) + sheet('Bachata Social Leeds', '<p class="ok" role="status">&check; Profile finished.</p><p class="p">You can ask to join the team.</p><div><p class="lbl">Who are you? (optional)</p><div class="field ph-t" style="min-height:88px;align-items:flex-start;padding-top:12px">I run the Tuesday classes with Ana</div></div><button class="btn">Ask to join</button><button class="ghost">Not this one</button>'), ''),
    ('6. Search failed (error)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds', False) + SEARCH_ERR + CREATE), ''),
]

FILES = {
    'new-account-A.html': ('New account: Quiet steps', A_INTRO, new_a),
    'new-account-B.html': ('New account: One card', B_INTRO, new_b),
    'no-city-A.html': ('No city: Finish first', NA_INTRO, nc_a),
    'no-city-B.html': ('No city: Finish on tap', NB_INTRO, nc_b),
}
for name, (t, intro, steps) in FILES.items():
    with open(os.path.join(HERE, name), 'w', encoding='ascii', newline='\n') as f:
        f.write(page(t, intro, steps))

INDEX_CSS = CSS + """
.gal{display:flex;flex-wrap:wrap;gap:12px;padding:0 16px 16px}
.col{flex:1 1 358px;max-width:420px}
.col h2{font-size:16px;margin:0 0 4px}.col p{font-size:14px;color:var(--mut);margin:0 0 8px}
.col iframe{width:100%;height:844px;border:1px solid var(--line-strong);border-radius:12px;background:var(--bg)}
.shape{font-size:18px;margin:12px 16px 8px}
"""
def col(f, h, p): return f'<div class="col"><h2><a class="lnk" href="{f}">{h}</a></h2><p>{p}</p><iframe src="{f}" title="{h}"></iframe></div>'
idx = (f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P3 W4b Mockups</title><style>{INDEX_CSS}</style></head><body>'
       '<div class="intro" style="max-width:none"><h1>P3 W4b stage 2: onboarding mockups</h1><p>Two shapes, two options each. Each frame is 390&times;844. Pick one per shape; nothing is built until then.</p></div>'
       '<h2 class="shape">Shape 1: brand-new account</h2><div class="gal">'
       + col('new-account-A.html', 'A: Quiet steps', 'Today&rsquo;s screen, tidied. Search first, create under it.')
       + col('new-account-B.html', 'B: One card', 'One question first, then a screen for find and one for create.')
       + '</div><h2 class="shape">Shape 2: no city</h2><div class="gal">'
       + col('no-city-A.html', 'A: Finish first', 'Says what is missing up front; refused buttons are off with the reason.')
       + col('no-city-B.html', 'B: Look first, finish on the tap', 'Looks like a new account; the first organiser tap says what is missing.')
       + '</div></body></html>')
with open(os.path.join(HERE, 'index.html'), 'w', encoding='ascii', newline='\n') as f:
    f.write(idx)
print('built', len(FILES) + 1, 'files')
