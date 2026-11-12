#!/usr/bin/env python3
"""Builds option-a/b/c.html for the dancer dashboard (docs only, no app code).
One shared data model + shared blocks; the three options differ only in layout.
ASCII only; punctuation is written as HTML entities."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)

# ---- shared model (server shape: src/modules/dancer-app/api/types.ts, nextStep.ts) ----
STEPS = [  # (key, label of the item, button label = NEXT_STEP[...].label, required)
    ('first_name', 'First name', 'Add your first name', True),
    ('city', 'Home city', 'Add your city', True),
    ('role', 'How you dance', 'Choose how you dance', True),
    ('photo', 'Photo', 'Add your photo', True),
    ('started_year', 'When you started', 'Add when you started dancing', False),
    ('styles', 'Favourite styles', 'Pick your favourite styles', False),
    ('bio_social', 'Bio and a link', 'Add a bio and a link', False),
]
NIGHTS = {
    'going': [('Fri 14 Nov', 'Bachata Sensual Social', 'The Loft, London', 'Going', True)],
    'complete': [('Fri 14 Nov', 'Bachata Sensual Social', 'The Loft, London', 'Going', True),
                 ('Sat 22 Nov', 'Sunset Bachata Night with a long name that wraps', 'Riverside Club, London', 'Interested', False)],
}
STATES = {
    'new':       dict(kind='own', name=None, done=0, nights=[], saved=0, attended=0),
    'partial':   dict(kind='own', name='Maya', done=3, nights=NIGHTS['going'], saved=0, attended=0),
    'complete':  dict(kind='own', name='Maya', done=7, nights=NIGHTS['complete'], saved=1, attended=12),
    'unclaimed': dict(kind='unclaimed', name=None, done=0, nights=[], saved=0, attended=0),
    'empty':     dict(kind='own', name='Maya', done=7, nights=[], saved=0, attended=0),
    'loading':   dict(kind='loading'),
    'error':     dict(kind='error'),
}
ORDER = ['new', 'partial', 'complete', 'unclaimed', 'empty', 'loading', 'error']
LABEL = {'new': 'New', 'partial': 'Partial', 'complete': 'Complete', 'unclaimed': 'Unclaimed',
         'empty': 'Nothing planned', 'loading': 'Loading', 'error': 'Error'}

def ic(name):
    p = {
     'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
     'home': '<path d="M3 11l9-8 9 8v10H3z"/>',
     'cal': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
     'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
     'check': '<path d="M5 12l5 5 9-10"/>',
     'plus': '<path d="M12 5v14M5 12h14"/>',
     'share': '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>',
     'cam': '<path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
     'alert': '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
     'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.700l1-1"/>',
    }[name]
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % p

def first_missing(done):
    return STEPS[done] if done < len(STEPS) else None

def bar(done, total=4):
    d = min(done, total)
    return '<div class="bar" role="img" aria-label="%d of %d done">%s</div>' % (
        d, total, ''.join('<i class="%s"></i>' % ('on' if i < d else '') for i in range(total)))

def avatar(name, photo):
    if photo:
        return '<span class="av">%s</span>' % name[0]
    return '<span class="av none" aria-hidden="true">%s</span>' % ic('cam')

def greeting(s):
    return 'Hi %s' % s['name'] if s['name'] else 'Welcome'

def night_row(n, big=False):
    date, title, venue, status, ticket = n
    chip = '<span class="chip ok">%s</span>' % status if status == 'Going' else '<span class="chip">%s</span>' % status
    return ('<a class="row" href="#night"><span class="date">%s</span><span class="grow"><b class="t2">%s</b>'
            '<span class="sub">%s</span></span>%s</a>') % (date, title, venue, chip)

def empty_nights():
    return ('<div class="empty"><b>Nothing planned yet</b><p>Tap Going on a night and it shows up here.</p>'
            '<a class="btn" href="#find">Find events this week</a></div>')

def share_row():
    return ('<a class="row" href="#share"><span class="ico">%s</span><span class="grow"><b class="t2">Share my page</b>'
            '<span class="sub">Send your page to a dance partner.</span></span></a>') % ic('share')

def share_blocked():
    return ('<div class="row off"><span class="ico">%s</span><span class="grow"><b class="t2">Share my page</b>'
            '<span class="sub">Add photo, home city and how you dance first, so people know it is you.</span></span></div>') % ic('share')

def attended_row(n):
    if n > 0:
        return '<div class="row"><span class="ico">%s</span><span class="grow"><b class="t2">%d nights attended</b><span class="sub">Nights you went to.</span></span></div>' % (ic('cal'), n)
    return ('<a class="row" href="#find"><span class="ico">%s</span><span class="grow"><b class="t2">Your first night out</b>'
            '<span class="sub">Nights you attend are counted here.</span></span></a>') % ic('cal')

def claim_card():
    return ('<section class="card hero"><span class="chip gold">Found a match</span>'
            '<h2>Is this your page?</h2><p class="lead">We found a dancer page that looks like yours: <b>Maya R., London</b>. '
            'It was made by an organiser, and nobody has claimed it yet.</p>'
            '<a class="btn primary" href="#claim">Claim your page</a>'
            '<a class="btn ghost" href="#notme">This is not me</a>'
            '<p class="fine">Claiming links this page to your sign-in. Nothing changes on the page itself.</p></section>')

def state_loading():
    return ('<section class="card" aria-busy="true"><div class="sk w60"></div><div class="sk w90"></div><div class="sk w40"></div>'
            '<p class="fine">Loading your dashboard&hellip; If it takes long, check your connection.</p></section>')

def state_error():
    return ('<section class="card"><span class="ico bad">%s</span><h2>We could not load your dashboard</h2>'
            '<p class="lead">Nothing is lost. Check your connection and try again.</p>'
            '<a class="btn primary" href="#retry">Try again</a><a class="btn ghost" href="#help">Message us</a></section>') % ic('alert')

def checklist(done, full=True):
    out = ['<ul class="ck">']
    nxt = first_missing(done)
    for i, (k, lab, btn, req) in enumerate(STEPS):
        if not full and not req:
            continue
        st = 'done' if i < done else ('next' if i == done else '')
        mark = ic('check') if i < done else ''
        tag = '<span class="chip gold">Next</span>' if i == done else ('' if i < done else '<span class="chip">Optional</span>' if not req else '')
        out.append('<li class="%s"><span class="tick">%s</span><span class="grow">%s</span>%s</li>' % (st, mark, lab, tag))
    out.append('</ul>')
    return ''.join(out)

def next_btn(done):
    m = first_missing(done)
    return '<a class="btn primary" href="#%s">%s</a>' % (m[0], m[2]) if m else ''

def tabs(active='Home'):
    items = [('Home', 'home'), ('Nights', 'cal'), ('Me', 'user'), ('Options', 'menu')]
    return '<nav class="tabs" aria-label="Main">%s</nav>' % ''.join(
        '<a href="#%s" class="%s">%s<span>%s</span></a>' % (n.lower(), 'cur' if n == active else '', ic(i), n) for n, i in items)

def topbar(s, role_count=1):
    if s['kind'] in ('loading', 'error'):
        nm, photo = 'Dancer', False
    else:
        nm, photo = (s.get('name') or 'New dancer'), s.get('done', 0) >= 4
    btn = 'Switch' if role_count > 1 else 'Account'
    sub = 'Dancer' if s['kind'] != 'unclaimed' else 'Dancer &middot; not claimed yet'
    return ('<header class="top">%s<span class="grow"><b>%s</b><span class="sub">%s</span></span>'
            '<button class="btn small" type="button">%s</button></header>') % (avatar(nm, photo), nm, sub, btn)

CSS = """
:root{--bg:#0B0B0C;--s1:#151517;--s2:#1D1D20;--line:#2A2A2E;--text:#F4F1EA;--mute:#A7A29A;--gold:#E0B252;--ink:#14110A;--ok:#7DDBB4;--bad:#F08A8A}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.phone{width:390px;height:844px;margin:0 auto;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;position:relative}
.scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding:0 16px 16px}
.top{display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:64px}
.top b{font-size:16px;display:block}.sub{display:block;font-size:12px;color:var(--mute)}
.grow{flex:1;min-width:0}.av{width:40px;height:40px;border-radius:50%;background:var(--s2);display:grid;place-items:center;font-weight:700;color:var(--gold);flex:none}
.av.none{border:1px dashed var(--mute);color:var(--mute)}.av .ic{width:20px;height:20px}
.ic{width:22px;height:22px;flex:none}
h1{font-size:22px;margin:4px 0 12px}h2{font-size:20px;margin:8px 0}h3{font-size:15px;margin:20px 0 8px}
.card{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 12px}
.card.hero{padding:20px}.lead{font-size:14px;margin:4px 0 12px;color:var(--text)}.fine{font-size:12px;color:var(--mute);margin:10px 0 0}
.btn{display:flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 16px;border-radius:10px;border:1px solid var(--line);background:var(--s2);color:var(--text);font:600 14px system-ui;text-decoration:none;margin:8px 0 0;cursor:pointer}
.btn.primary{background:var(--gold);color:var(--ink);border-color:var(--gold)}.btn.ghost{background:transparent}
.btn.small{margin:0;padding:0 14px}.btn.off{border-style:dashed;color:var(--mute);background:transparent}
.row{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 12px;background:var(--s1);border:1px solid var(--line);border-radius:12px;margin:0 0 8px;color:var(--text);text-decoration:none}
.row.off{border-style:dashed}.t2{font-size:14px;display:block}.ico{width:36px;height:36px;border-radius:10px;background:var(--s2);display:grid;place-items:center;color:var(--gold);flex:none}
.ico.bad{color:var(--bad)}.date{font-size:12px;color:var(--gold);font-weight:700;width:52px;flex:none}
.chip{display:inline-flex;align-items:center;min-height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--line);background:var(--s2);color:var(--mute);font-size:12px;flex:none}
.chip.ok{color:var(--ok);border-color:var(--ok)}.chip.gold{color:var(--gold);border-color:var(--gold)}
.bar{display:flex;gap:4px;margin:8px 0 12px}.bar i{flex:1;height:6px;border-radius:3px;background:var(--line)}.bar i.on{background:var(--gold)}
.ck{list-style:none;margin:0 0 4px;padding:0}.ck li{display:flex;align-items:center;gap:12px;min-height:44px;border-bottom:1px solid var(--line);color:var(--mute)}
.ck li:last-child{border:0}.ck li.next{color:var(--text);font-weight:600}.ck li.done{color:var(--text)}
.tick{width:24px;height:24px;border-radius:50%;border:1px solid var(--mute);display:grid;place-items:center;flex:none}.done .tick{background:var(--ok);border-color:var(--ok);color:var(--ink)}
.tick .ic{width:14px;height:14px}.next .tick{border-color:var(--gold)}
.empty{background:var(--s1);border:1px dashed var(--line);border-radius:12px;padding:16px;margin:0 0 8px}.empty p{margin:4px 0 4px;color:var(--mute)}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}.tile{background:var(--s2);border-radius:12px;padding:12px}
.tile b{font-size:24px;display:block;font-variant-numeric:tabular-nums}.tile span{font-size:12px;color:var(--mute)}.tile.wide{grid-column:1/3}
.big{font-size:40px;font-weight:700;color:var(--gold);line-height:1.1}
.sk{height:14px;border-radius:7px;background:var(--s2);margin:12px 0}.w60{width:60%}.w90{width:90%}.w40{width:40%}
.tabs{display:flex;border-top:1px solid var(--line);background:var(--s1)}.tabs a{flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--mute);text-decoration:none;font-size:12px}
.tabs a.cur{color:var(--gold)}
.st{display:none}.st.on{display:block}
.ctl{display:none}
@media(min-width:431px){body{padding:16px 0}.phone{border:1px solid var(--line);border-radius:24px}.ctl{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:560px;margin:16px auto 0}
.ctl a{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border:1px solid var(--line);border-radius:10px;color:var(--text);text-decoration:none}}
"""
JS = """<script>(function(){var ids=%s;function go(){var h=(location.hash||'#new').slice(1);if(ids.indexOf(h)<0)h='new';
document.querySelectorAll('.st').forEach(function(e){e.classList.toggle('on',e.id===h)});}
addEventListener('hashchange',go);go();})();</script>"""

def page(title, body_fn):
    secs = []
    for sid in ORDER:
        s = STATES[sid]
        secs.append('<div class="st" id="%s"><div class="phone">%s<main class="scroll">%s</main>%s</div></div>' % (
            sid, topbar(s), body_fn(sid, s), tabs()))
    ctl = '<div class="ctl">%s</div>' % ''.join('<a href="#%s">%s</a>' % (i, LABEL[i]) for i in ORDER)
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>%s</title><style>%s</style></head><body>%s%s%s</body></html>') % (
            title, CSS, ''.join(secs), ctl, JS % repr(ORDER))

# ---- Option A: Feed (adapted from organiser option A) ----
def body_a(sid, s):
    if s['kind'] == 'loading': return state_loading()
    if s['kind'] == 'error': return state_error()
    if s['kind'] == 'unclaimed':
        return claim_card() + '<h3>Meanwhile</h3>' + '<a class="row" href="#find"><span class="ico">%s</span><span class="grow"><b class="t2">Find events this week</b><span class="sub">You can browse without a page.</span></span></a>' % ic('cal')
    h = '<h1>%s</h1>' % greeting(s)
    if s['done'] < 4:
        m = first_missing(s['done'])
        h += ('<section class="card hero"><h2>Finish your profile</h2><p class="lead">Step %d of 4. People can find you once these are done.</p>%s%s%s</section>'
              % (s['done'] + 1, bar(s['done']), checklist(s['done'], False), next_btn(s['done'])))
    elif s['done'] < 7:
        h += '<section class="card"><b>Your profile is ready.</b><p class="lead">%d more things make your page stand out.</p>%s</section>' % (7 - s['done'], next_btn(s['done']))
    h += '<h3>Next night</h3>'
    h += night_row(s['nights'][0]) if s['nights'] else empty_nights()
    if len(s['nights']) > 1: h += '<a class="row" href="#going"><span class="grow"><b class="t2">%d more plans</b></span></a>' % (len(s['nights']) - 1)
    h += '<h3>You</h3>' + (share_row() if s['done'] >= 4 else share_blocked()) + attended_row(s['attended'])
    return h

# ---- Option B: One thing in focus (adapted from organiser option B) ----
def body_b(sid, s):
    if s['kind'] == 'loading': return state_loading()
    if s['kind'] == 'error': return state_error()
    if s['kind'] == 'unclaimed':
        return claim_card() + '<h3>Also</h3><a class="row" href="#find"><span class="grow"><b class="t2">Find events this week</b></span></a><a class="row" href="#help"><span class="grow"><b class="t2">Not sure? Message us</b></span></a>'
    if s['done'] < 7 and s['done'] < 4:
        hero = ('<section class="card hero"><div class="big">%d of 4</div><h2>to finish your profile</h2>%s<p class="lead">Next: %s.</p>%s</section>'
                % (s['done'], bar(s['done']), first_missing(s['done'])[2][0].lower() + first_missing(s['done'])[2][1:], next_btn(s['done'])))
    elif s['nights']:
        n = s['nights'][0]
        hero = ('<section class="card hero"><span class="chip gold">Next night</span><h2>%s</h2><p class="lead">%s &middot; %s</p>%s<a class="btn primary" href="#night">Open the night</a></section>'
                % (n[1], n[0], n[2], '<span class="chip ok">%s</span>' % n[3]))
    else:
        hero = ('<section class="card hero"><h2>Nothing planned yet</h2><p class="lead">Tap Going on a night and it shows up here.</p><a class="btn primary" href="#find">Find events this week</a></section>')
    items = ('<h3>Also</h3>')
    if 4 <= s['done'] < 7: items += '<a class="row" href="#next"><span class="grow"><b class="t2">%s</b><span class="sub">%d of 3 extras done</span></span></a>' % (first_missing(s['done'])[2], s['done'] - 4)
    items += (share_row() if s['done'] >= 4 else share_blocked())
    if s['nights'] and len(s['nights']) > 1: items += '<a class="row" href="#going"><span class="grow"><b class="t2">%d more plans</b></span></a>' % (len(s['nights']) - 1)
    items += attended_row(s['attended'])
    return '<h1>%s</h1>' % greeting(s) + hero + items

# ---- Option C: Checklist + at a glance (adapted from organiser option C) ----
def body_c(sid, s):
    if s['kind'] == 'loading': return state_loading()
    if s['kind'] == 'error': return state_error()
    if s['kind'] == 'unclaimed':
        return claim_card() + '<section class="card"><b>What claiming gives you</b>' + checklist(0, True).replace('class="ck"', 'class="ck" aria-label="Preview"') + '</section>'
    t = []
    if s['nights']: t.append(('%d' % len(s['nights']), 'Plans coming up'))
    if s['saved']: t.append(('%d' % s['saved'], 'Saved'))
    if s['attended']: t.append(('%d' % s['attended'], 'Nights attended'))
    if t:
        tiles = '<div class="tiles">%s</div>' % ''.join('<div class="tile%s"><b>%s</b><span>%s</span></div>' % (' wide' if (len(t) % 2 and i == len(t) - 1) else '', a, b) for i, (a, b) in enumerate(t))
    else:
        tiles = '<section class="card"><b>Your numbers start after your first night out</b><a class="btn" href="#find">Find events this week</a></section>'
    h = '<h1>%s</h1>' % greeting(s) + tiles
    h += '<section class="card"><h2>%s</h2>%s%s%s</section>' % (
        'Next steps' if s['done'] < 7 else 'Profile complete', bar(s['done'], 7) if False else '', checklist(s['done'], True), next_btn(s['done']))
    h += '<h3>Plans</h3>' + ''.join(night_row(n) for n in s['nights']) if s['nights'] else '<h3>Plans</h3>' + empty_nights()
    h += share_row() if s['done'] >= 4 else share_blocked()
    return h

for fn, ttl, b in (('option-a.html', 'Dancer dashboard A: Feed', body_a), ('option-b.html', 'Dancer dashboard B: One thing in focus', body_b), ('option-c.html', 'Dancer dashboard C: Checklist and glance', body_c)):
    html = page(ttl, b)
    assert all(ord(c) < 128 for c in html), fn
    open(os.path.join(OUT, fn), 'w').write(html)
print('ok')
