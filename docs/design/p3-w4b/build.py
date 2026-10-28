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
NAME_EMPTY = (BETA + '<div><p class="lbl">Page name</p><div class="field focus"></div>' + NAME_HINT + '</div>'
              '<div><button class="dis" disabled aria-describedby="w">Next</button><p class="why" id="w">Type the page name first.</p></div>')
NAME_ROW = '<div class="sumrow">Bachata Nights Harrogate <span>&#9998; Change</span></div>'
SIGNOUT = sheet('Sign out', '<p class="p">Sign out of sam@example.com on this device?</p><button class="ghost">No, stay signed in</button><button class="btn">Yes, sign out</button>')
CREATING = '<div class="card" role="status" aria-label="Creating your page"><div class="sk"><i></i><i></i></div></div>'
INVITE = ('<p class="h" style="font-size:18px">Events are not open to you yet</p><p class="p">New pages are approved by hand during the beta.</p>'
          '<button class="btn">Ask us to open it</button><button class="ghost">Back to Home</button>')
CITY_OPTS = ('<div class="card"><button class="opt">Harrogate, United Kingdom</button><button class="opt">Harrow, United Kingdom</button></div>')
def home(page, msg): return (f'<div class="top"><h3>{page}</h3></div><div class="main"><p class="ok" role="status">{msg}</p>'
    '<p class="p" style="font-weight:700">Your to-do list</p><p class="mut" style="border:1px solid var(--line);border-radius:16px;background:var(--card);padding:12px">Nothing to do right now. To put something on, tap New event below.</p>'
    '<button class="btn">+ New event</button><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="ghost sm" style="width:100%">Team</button><button class="ghost sm" style="width:100%">My page</button>'
    '<button class="ghost sm" style="width:100%">My events</button><button class="ghost sm" style="width:100%">More</button></div></div>')
HOME_DONE = home('Bachata Nights Harrogate', 'Bachata Nights Harrogate created')
HOME_CLAIMED = home('Bachata Nights Leeds', 'Bachata Nights Leeds is yours. You can now manage it.')
HOME_NOTE = 'Today&rsquo;s Home (home/index.tsx): the confirmation line, then the to-do list from organiser_home_v1 (the empty wording is drawn; real job rows replace it), New event and the four small buttons. No copy changes.'

def welcome(extra): return TOP + '<div class="main">' + extra + '</div>'


# ---------- frames both new-account options keep unchanged (today's copy) ----------
CLAIM_SUB = '<p class="h" style="font-size:17px">Claim Bachata Nights Leeds</p><p class="p">Your email matches the one on file.</p>'
OFFLINE = ('<div class="err" role="alert"><p class="p">You&rsquo;re offline</p><p class="mut">We cannot tell if this organiser is listed until the search works. Check your connection, then try again.</p>'
           '<button class="ghost sm" style="margin-top:8px">Try again</button></div>')
SHEETS = [
    ('Claim (6c), mailbox proven', welcome(STEPS) + sheet('Bachata Nights Leeds', CLAIM_SUB + '<button class="btn">Claim it</button><button class="ghost">Not this one</button>'), 'claim_organiser_v1. Loading label &ldquo;Claiming&rdquo;.'),
    ('Claim (6c), code step first (mailbox not proven)', welcome(STEPS) + sheet('Bachata Nights Leeds', CLAIM_SUB +
        '<p class="p">We&rsquo;ve emailed a code to <b>sam@example.com</b>. It can take a minute; check your spam folder too.</p>'
        '<div><p class="lbl">Code from your email</p><div class="field focus"></div></div><button class="btn">Confirm</button>'
        '<button class="dis" disabled>Resend in 24s</button><button class="ghost">Not this one</button>'), 'EmailCodeProof, unchanged (auth.signInWithOtp / verifyOtp).'),
    ('Claim refused (error)', welcome(STEPS) + sheet('Bachata Nights Leeds', '<p class="h" style="font-size:17px">Is Bachata Nights Leeds yours?</p><p class="p">Ask to join and we will check.</p><p class="alert" role="alert">Someone already manages this organiser. Ask them to add you, or request access.</p><button class="btn">Ask to join</button><button class="ghost">Not this one</button>'), 'A refusal turns the claim into a request (unknown hint). The red line is the server&rsquo;s refusal mapped by selfServeErrors.ts (here: already managed).'),
    ('Ask to join (6b)', welcome(STEPS) + sheet('Bachata Social Leeds', '<p class="h" style="font-size:17px">Bachata Social Leeds already has an owner</p><p class="p">You can ask to join the team.</p><div><p class="lbl">Who are you? (optional)</p><div class="field ph-t" style="min-height:88px;align-items:flex-start;padding-top:12px">I run the Tuesday classes with Ana</div></div><button class="btn">Ask to join</button><button class="ghost">Not this one</button>'), 'request_organiser_access_v1.'),
    ('Claimed: lands on Home', HOME_CLAIMED, 'After claim_organiser_v1, Home re-reads organiser_home_v1 and shows the done line. ' + HOME_NOTE),
    ('Asked to join: Done', '<div class="top"><h3>Done</h3></div><div class="main"><p class="ok" role="status">&check; Asked to join Bachata Social Leeds</p><p class="p">We will check your request and the page team will be in touch.</p><button class="btn">Back to Home</button></div>', 'The shared Done screen (askedToJoinDone).'),
    ('Your own page (6a), the ?add=1 variant only', welcome(STEPS) + sheet('Bachata Nights Leeds', '<p class="h" style="font-size:17px">Bachata Nights Leeds is yours</p><p class="p">You are already its owner.</p><button class="btn">Go to Home</button>'), 'Not reachable for a brand-new login (the yours hint needs a page the login already belongs to); shown for the Add a page entry (?add=1).'),
    ('City: searching, results, no match, error', welcome(STEPS) + sheet('City', NAME_ROW + '<button class="btn">Use Harrogate</button>' + search('Harro') + CITY_OPTS + '<p class="mut">No city matches. Check the spelling.</p><p class="alert" role="alert">The city search did not work. Check your connection, then try again.</p>', full=True, back=True), 'Four states stacked in one frame for brevity; on screen only one shows at a time. Searching = 3 skeleton rows.'),
    ('Create refused: name taken', welcome(STEPS) + sheet('New organiser page', '<p class="p">Bachata Nights Harrogate is already listed.</p><button class="btn">Ask to join Bachata Nights Harrogate</button>', full=True), 'Without a page to name: Find your page.'),
    ('Create refused: 3 a day', welcome(STEPS) + sheet('New organiser page', '<p class="p">You can create three pages in 24 hours. Try again tomorrow.</p><button class="btn">Back to Home</button>', full=True), ''),
    ('Ask us to open it: sent', welcome(STEPS) + sheet('New organiser page', '<p class="h" style="font-size:18px">We are checking</p><p class="p">We will email you when you can add events.</p><button class="ghost">Back to Home</button>', full=True), 'Rate limited: &ldquo;Try again later.&rdquo;; failed: &ldquo;That did not send. Check your connection and try again.&rdquo;'),
    ('Search offline (error)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds', False) + OFFLINE), ''),
    ('Sign out failed (error)', welcome(STEPS + WHO) + sheet('Sign out', '<p class="p">Sign out of sam@example.com on this device?</p><p class="alert" role="alert">Sign-out did not complete. Check your connection and try again.</p><button class="ghost">No, stay signed in</button><button class="btn">Yes, sign out</button>'), ''),
]
def numbered(frames, start): return [(f'{start + i}. {n}', h, note) for i, (n, h, note) in enumerate(frames)]

# ---------- Shape 1: brand-new account ----------
A_INTRO = ('<h1>Brand-new account &middot; A: Quiet steps &mdash; CHOSEN (owner, 2026-10-28)</h1><p>Today&rsquo;s one-scroll screen, tidied: the search is the first thing under the heading, '
           'create sits under it, nothing is hidden. Every step of the flow, top to bottom.</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
new_a = [
    ('1. First visit (empty)', welcome(STEPS + WHO + '<div><p class="h">Find your page</p>' + BETA + '</div>' + SEARCH_EMPTY + CREATE + BROWSE), 'Same controls as today, same order.'),
    ('2. Searching (loading)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + BETA + search('Bachata Leeds') + SKEL + CREATE + BROWSE), 'Beta note and Browse stay on every state, as today.'),
    ('3. Results (claim / ask to join / asked)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + BETA + search('Bachata Leeds') + RESULTS + CREATE + BROWSE), 'Row words come from claimStates.ts, unchanged.'),
    ('4. No match', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + BETA + search('Bachta Leds') + NO_MATCH + CREATE + BROWSE), ''),
    ('5. Search failed (error)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + BETA + search('Bachata Leeds', False) + SEARCH_ERR + CREATE + BROWSE), ''),
    ('6. Create: page name, Next disabled with reason', welcome(STEPS) + sheet('New page', NAME_EMPTY, full=True), ''),
    ('7. Create: city (sign-up city offered)', welcome(STEPS) + sheet('City', NAME_ROW + '<button class="btn">Use Harrogate</button>' + '<div class="field ph-t">&#128269;&nbsp; Or search another city</div>', full=True, back=True), 'Choosing the city IS the create (create_organiser_profile_v1).'),
    ('8. Creating (loading)', welcome(STEPS) + sheet('City', NAME_ROW + CREATING, full=True), ''),
    ('9. Refused: invite required', welcome(STEPS) + sheet('New organiser page', INVITE, full=True), 'request_signup_access_v1 behind &ldquo;Ask us to open it&rdquo;.'),
    ('10. Done: lands on Home', HOME_DONE, HOME_NOTE),
    ('11. Sign out sheet', welcome(STEPS + WHO) + SIGNOUT, ''),
] + numbered(SHEETS, 12)

B_INTRO = ('<h1>Brand-new account &middot; B: One card &mdash; not chosen</h1><p>One question first: is your page already listed? Two big answers. '
           'The search and the create each get a screen to themselves.</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
CHOOSE = ('<div style="background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:12px"><p class="h" style="font-size:18px">Is your page already on Bachata Calendar?</p>'
          '<p class="mut" style="margin-top:4px">Most organisers are. Claim yours instead of making a copy.</p></div>'
          '<button class="choice"><b>Yes, find it &rsaquo;</b><span>Search by name, then claim it or ask to join</span></button>'
          '<button class="choice"><b>No, create a new page &rsaquo;</b><span>We may need to open it for you during the beta</span></button>')
FIND_TOP = '<div class="top"><button class="x" aria-label="Back">&lsaquo;</button><h3>Find your page</h3></div>'
def find(extra): return FIND_TOP + '<div class="main">' + extra + '</div>'
PENDING = ('<div class="card"><p class="cl">Waiting for an answer</p><div class="row"><div class="t"><p class="n" style="font-weight:400">Bachata Social Leeds</p><p class="s">Asked 21 Oct</p></div></div></div>')
DECLINED = ('<div class="card"><p class="cl">Request declined</p><div style="padding:8px 12px"><p class="p">Leeds Sensual Sundays said no on 19 Oct.</p>'
            '<p class="mut">The reason is not shown here yet. If you are the organiser, search for it above and ask again with a note.</p></div></div>')
FIND_FOOT = '<p class="mut">Not listed? <button class="lnk">Create a new page</button></p>'
new_b = [
    ('1. First visit: one card', welcome(STEPS + WHO + CHOOSE + BETA + BROWSE), 'Beta note moves under the card, still before any name or city.'),
    ('2. Find: empty', find(search('', True).replace('&nbsp; ', '&nbsp; <span style="color:var(--mut)">Search pages by name</span>') + FIND_FOOT), ''),
    ('3. Find: searching (loading)', find(search('Bachata Leeds') + SKEL), ''),
    ('4. Find: results', find(search('Bachata Leeds') + RESULTS + FIND_FOOT), 'Row words unchanged (claimStates.ts).'),
    ('5. Find: no match', find(search('Bachta Leds') + NO_MATCH), ''),
    ('6. Find: search failed (error)', find(search('Bachata Leeds', False) + SEARCH_ERR + FIND_FOOT), ''),
    ('7. Create: page name, Next disabled with reason', welcome(STEPS) + sheet('New page', NAME_EMPTY, full=True), ''),
    ('8. Create: city (sign-up city offered)', welcome(STEPS) + sheet('City', NAME_ROW + '<button class="btn">Use Harrogate</button><div class="field ph-t">&#128269;&nbsp; Or search another city</div>', full=True, back=True), ''),
    ('9. Creating (loading)', welcome(STEPS) + sheet('City', NAME_ROW + CREATING, full=True), ''),
    ('10. Refused: invite required', welcome(STEPS) + sheet('New organiser page', INVITE, full=True), ''),
    ('11. Done: lands on Home', HOME_DONE, HOME_NOTE),
    ('12. Sign out sheet', welcome(STEPS + WHO + CHOOSE) + SIGNOUT, ''),
    ('12b. Open or declined request (2 + 1 accounts)', welcome(STEPS + WHO + CHOOSE + PENDING + DECLINED.replace('search for it above', 'tap Yes, find it') + BETA + BROWSE), 'The two existing cards sit under the choice card on screen 1 (in A they stay where they are today, under Create). Changes copy in B only: &ldquo;search for it above&rdquo; becomes &ldquo;tap Yes, find it&rdquo;, because B has no search box on screen 1.'),
] + numbered(SHEETS, 13)

# ---------- Shape 2: no city ----------
# Prod: no dancer city means an unfinished dancer profile (all 4 such accounts also miss
# name, role and photo), and claim / ask to join / create all raise profile_incomplete
# (_require_complete_dancer_profile_v1), which today navigates to /finish-profile only
# AFTER the tap (for create: after the name and the city were typed).
FIN_CARD = ('<div class="warn"><b style="font-size:15px">Finish your dancer profile first, then you can set up your organiser page.</b>'
            '<p style="margin:4px 0 0">Still to add: first name, city, dance role, photo.</p></div>')
FIN_BTN = '<button class="btn">Finish your profile</button>'
NO_PROFILE = ('<p class="mut"><b>Account has no dancer row (2 of 42 prod accounts, rare)</b> &mdash; To be replaced when Finish profile can create the row (server change queued).</p><div class="warn"><b style="font-size:15px">Finish your dancer profile first, then you can set up your organiser page.</b>'
              '<p style="margin:4px 0 0">Your account does not have a dancer profile yet. Message us and we&rsquo;ll set one up for you.</p></div>'
              '<button class="btn">Message us on WhatsApp</button>')
OFF_WHY = 'Finish your dancer profile first.'
RESULTS_OFF = ('<div class="card">'
    '<div class="row"><div class="t"><p class="n">Bachata Nights Leeds</p><p class="s">Email on file is yours</p></div><button class="dis sm" disabled>Claim</button></div>'
    '<div class="row"><div class="t"><p class="n">Bachata Social Leeds</p><p class="s">Has a team</p></div><button class="dis sm" disabled>Ask to join</button></div>'
    '</div><p class="why">Claim and Ask to join open once your profile is finished.</p>')
CREATE_OFF = f'<div><button class="dis" disabled>+ Create a new page</button><p class="why">{OFF_WHY}</p></div>'
NA_INTRO = ('<h1>Profile not finished (no city) &middot; A: Finish first &mdash; not chosen</h1><p>The screen says up front what is missing and links to the finish screen. '
            'Search still works so people can look; the buttons that would be refused are off, with the reason.</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
FIN_CARD2 = FIN_CARD.replace('first name, city, dance role, photo', 'city, photo')
nc_a = [
    ('1. First visit: what is missing', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + '<p class="h" style="font-size:18px">Find your page</p>' + BETA + SEARCH_EMPTY + CREATE_OFF + BROWSE), 'Today: no word about the profile until a button is refused.'),
    ('1b. Row exists, only city and photo missing', welcome(STEPS + WHO + FIN_CARD2 + FIN_BTN + '<p class="h" style="font-size:18px">Find your page</p>' + BETA + SEARCH_EMPTY + CREATE_OFF + BROWSE), 'Normal unfinished profile: the missing items are named and the primary button goes to Finish profile. No Message us.'),
    ('2. Searching (loading)', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + BETA + search('Bachata Leeds') + SKEL + BROWSE), 'Beta note and Browse stay on every state.'),
    ('3. Results, actions disabled with reason', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + BETA + search('Bachata Leeds') + RESULTS_OFF + BROWSE), 'Row words unchanged; only the buttons are off.'),
    ('4. Search failed (error)', welcome(STEPS + WHO + FIN_CARD + FIN_BTN + BETA + search('Bachata Leeds', False) + SEARCH_ERR + BROWSE), ''),
    ('5. Back from Finish profile (done)', welcome(STEPS + WHO + '<div><p class="h">Find your page</p>' + BETA + '</div>' + SEARCH_EMPTY + CREATE + BROWSE), 'The gated Finish screen says &ldquo;Saved.&rdquo; and goes back to /account/o by itself; Welcome is then today&rsquo;s screen (card gone, buttons on, search empty). No extra line: nothing carries one.'),
    ('6. Account has no dancer row (2 of 42 prod accounts, rare)', welcome(STEPS + WHO + NO_PROFILE + '<p class="h" style="font-size:18px">Find your page</p>' + BETA + SEARCH_EMPTY + CREATE_OFF + BROWSE), 'Today&rsquo;s NO_PROFILE_TEXT, kept only in this rare frame (2 of 42 prod accounts, 2 of the 10 unfinished). To be replaced when Finish profile can create the row (server change queued). Every other unfinished-profile frame sends the person to Finish profile.'),
    ('7. Completeness unknown (read failed)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + BETA + SEARCH_EMPTY + CREATE + BROWSE), 'If the shared completeness fact (useProfileCompletion / ProfileGateContext) is status error, the screen falls back to today&rsquo;s: buttons on, the server decides (profile_incomplete still routes to Finish profile).'),
]
GATE = ('<p class="p">Finish your dancer profile first, then you can set up your organiser page.</p><p class="mut">Still to add: first name, city, dance role, photo.</p>'
        + FIN_BTN + '<div><button class="dis" disabled>Ask to join</button><p class="why">' + OFF_WHY + '</p></div>'
        '<p class="mut">When you are done you come back to Welcome; search for your page again.</p>')
GATE_NEW = ('<p class="p">Finish your dancer profile first, then you can set up your organiser page.</p><p class="mut">Still to add: first name, city, dance role, photo.</p>'
            + FIN_BTN + '<p class="mut">When you are done you come back to Welcome; search for your page again.</p>')
NB_INTRO = ('<h1>Profile not finished (no city) &middot; B: Look first, finish on the tap &mdash; CHOSEN (owner, 2026-10-28)</h1><p>The screen looks like a brand-new account&rsquo;s. The first organiser tap opens one sheet '
            'that says what is missing, BEFORE any typing. Today the return is to Welcome; resuming the same task is stage-3 work (frame 5).</p><p><a class="lnk" href="index.html">&lsaquo; All options</a></p>')
nc_b = [
    ('1. First visit (as a new account)', welcome(STEPS + WHO + '<div><p class="h">Find your page</p>' + BETA + '</div>' + SEARCH_EMPTY + CREATE + BROWSE), 'Nothing says the profile is unfinished yet.'),
    ('2. Searching (loading)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds') + SKEL + CREATE), ''),
    ('3. Tap Ask to join: one thing first', welcome(STEPS) + sheet('Bachata Social Leeds', GATE), 'Ask to join is off with the reason until the profile is done. The return line is what exists today (the gated Finish screen goes back to /account/o); &ldquo;we bring you back to this screen&rdquo; needs the stage-3 carry. If the completeness fact is status error, the tap opens today&rsquo;s sheet and the server decides.'),
    ('4. Tap Create: asked before the name', welcome(STEPS) + sheet('New page', GATE_NEW, full=True), 'Today the refusal comes after the name and the city.'),
    ('4b. Tap Claim: same gate', welcome(STEPS) + sheet('Bachata Nights Leeds', GATE.replace('>Ask to join<', '>Claim it<')), 'claim_organiser_v1 raises profile_incomplete too.'),
    ('4c. Account has no dancer row (2 of 42 prod accounts, rare)', welcome(STEPS) + sheet('New page', NO_PROFILE, full=True), 'Today&rsquo;s NO_PROFILE_TEXT, only here. To be replaced when Finish profile can create the row (server change queued).'),
    ('5. Back from Finish profile: task resumed (ONLY with the stage-3 carry)', welcome(STEPS) + sheet('Bachata Social Leeds', '<p class="ok" role="status">&check; Profile finished.</p><p class="p">You can ask to join the team.</p><div><p class="lbl">Who are you? (optional)</p><div class="field ph-t" style="min-height:88px;align-items:flex-start;padding-top:12px">I run the Tuesday classes with Ana</div></div><button class="btn">Ask to join</button><button class="ghost">Not this one</button>'), 'Stage 3, conditional: without the carry, the person lands on frame 1 (Welcome, search empty), as the gate sheet says. returnTo restores the URL only; carrying the sheet task and note back is new work.'),
    ('6. Search failed (error)', welcome(STEPS + WHO + '<p class="h">Find your page</p>' + search('Bachata Leeds', False) + SEARCH_ERR + CREATE), ''),
]

FILES = {
    'new-account-A.html': ('New account: Quiet steps', A_INTRO, new_a),
    'new-account-B.html': ('New account: One card', B_INTRO, new_b),
    'no-city-A.html': ('No city: Finish first', NA_INTRO, nc_a),
    'no-city-B.html': ('No city: Finish on tap', NB_INTRO, nc_b),
}
for name, (t, intro, steps) in FILES.items():
    with open(os.path.join(HERE, name), 'w', encoding='ascii', newline='\r\n') as f:
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
       '<div class="intro" style="max-width:none"><h1>P3 W4b stage 2: onboarding mockups</h1><p>Two shapes, two options each. Each frame is 390&times;844. Owner picks (2026-10-28): new account = A, unfinished profile = B. Not-chosen options stay for reference.</p></div>'
       '<h2 class="shape">Shape 1: brand-new account</h2><div class="gal">'
       + col('new-account-A.html', 'A: Quiet steps (chosen)', 'Today&rsquo;s screen, tidied. Search first, create under it.')
       + col('new-account-B.html', 'B: One card (not chosen)', 'One question first, then a screen for find and one for create.')
       + '</div><h2 class="shape">Shape 2: dancer profile not finished (no city)</h2><div class="gal">'
       + col('no-city-A.html', 'A: Finish first (not chosen)', 'Says what is missing up front; refused buttons are off with the reason.')
       + col('no-city-B.html', 'B: Look first, finish on the tap (chosen)', 'Looks like a new account; the first organiser tap says what is missing.')
       + '</div></body></html>')
with open(os.path.join(HERE, 'index.html'), 'w', encoding='ascii', newline='\r\n') as f:
    f.write(idx)
print('built', len(FILES) + 1, 'files')
