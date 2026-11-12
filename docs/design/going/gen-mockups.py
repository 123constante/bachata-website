import sys, os
OUT = sys.argv[1]
NAMES = ["Ana","Leo","Mia","Sam","Kai","Zoe","Raf","In&eacute;s","Tom","Bea"]
HUES = [20,200,330,150,270,45,0,180,300,100]

def face(i, size=32, ring="#1A2E2A", me=False, tag="a"):
    n = NAMES[i % len(NAMES)]; h = HUES[i % len(HUES)]
    letter = n[0]
    b = "2px solid #FFC24B" if me else f"2px solid {ring}"
    href = ' href="#dancer"' if tag == "a" else ""
    return (f'<{tag} class="face"{href} title="{n} &rarr; dancer page" style="width:{size}px;height:{size}px;'
            f'background:linear-gradient(135deg,hsl({h} 55% 55%),hsl({(h+40)%360} 45% 32%));border:{b};font-size:{int(size*0.42)}px">{letter}</{tag}>')

def stack(n, size=32, ring="#1A2E2A", extra=0, start=0):
    s = "".join(face(start+i, size, ring) for i in range(n))
    if extra: s += f'<span class="face more" style="width:{size}px;height:{size}px;border:2px solid {ring}">+{extra}</span>'
    return f'<span class="stack">{s}</span>'

# Event states: (key, title, dict)
STATES = [
 ("out","Signed out", dict(count=3, faces=3, mode="signin")),
 ("unfinished","Signed in, profile unfinished", dict(count=3, faces=3, mode="unfinished")),
 ("can","Signed in, can tap", dict(count=3, faces=3, mode="can")),
 ("going","I&rsquo;m going (and how to undo)", dict(count=4, faces=4, mode="going", me_face=True)),
 ("ended","Night ended", dict(count=5, faces=5, mode="ended")),
 ("cancelled","Night cancelled", dict(count=2, faces=2, mode="cancelled")),
 ("zero","0 going", dict(count=0, faces=0, mode="can")),
 ("one","1 going", dict(count=1, faces=1, mode="can")),
 ("three","3 faces", dict(count=3, faces=3, mode="can")),
 ("nine","9+ faces (+N)", dict(count=12, faces=10, mode="can")),
 ("optout","Me going, switch OFF", dict(count=4, faces=3, mode="going", me_face=False)),
]

NIGHT = "Thu 29 Oct"
def count_line(d, past=False):
    c = d["count"]; f = d["faces"]
    verb = "went" if past else "going"
    if c == 0:
        return f'<span class="mut">Nobody has said they&rsquo;re going yet.</span>'
    hidden = c - f
    s = f'<b>{c} {verb}</b>'
    if hidden > 0: s += f' <span class="mut">&middot; {hidden} not shown</span>'
    return s

def zero_hint(d):
    if d["count"]==0 and d["mode"]=="can":
        return '<div class="hint">Be the first &mdash; tap <b>I&rsquo;m going</b> and your friends will see you here.</div>'
    return ""

def action(opt, d, size="blk"):
    m = d["mode"]
    if m == "signin":
        return ('<a class="btn primary" href="#signin">Sign in to say you&rsquo;re going</a>'
                '<div class="why">You need a free account with a finished dancer profile.</div>')
    if m == "unfinished":
        return ('<button class="btn primary" disabled>I&rsquo;m going</button>'
                '<div class="why warn">Add your <b>dance role</b> to say you&rsquo;re going. '
                '<a href="#me-edit">Finish your profile &rarr;</a></div>')
    if m == "can":
        return '<button class="btn primary">I&rsquo;m going</button>'
    if m == "going":
        extra = ('<div class="why">You&rsquo;re counted, but your face is hidden: &ldquo;Show me as going&rdquo; is OFF. '
                 '<a href="#settings">Change in Options &rarr;</a></div>') if not d.get("me_face") else \
                '<div class="why">Changed your mind? Tap again to undo.</div>'
        return '<button class="btn on">&#10003; You&rsquo;re going &middot; <u>Undo</u></button>' + extra
    if m == "ended":
        return '<button class="btn" disabled>Night ended</button><div class="why">This night is over. <a href="#next">See the next night &rarr;</a></div>'
    if m == "cancelled":
        return '<button class="btn" disabled>Night cancelled</button><div class="why">The organiser cancelled this night. <a href="#next">See the next night &rarr;</a></div>'

def faces_for(d, cap):
    f = d["faces"]; me = d.get("me_face")
    shown = min(f, cap); extra = f - shown
    s = ""
    if me: s += face(9, 32, me=True)
    s += "".join(face(i, 32) for i in range(shown - (1 if me else 0)))
    if extra: s += f'<span class="face more" style="width:32px;height:32px">+{extra}</span>'
    return f'<span class="stack">{s}</span>' if f else ""

def banner(d):
    if d["mode"]=="cancelled":
        return '<div class="cancel">&#9888; This night has been cancelled <span class="badge">CANCELLED</span></div>'
    if d["mode"]=="ended":
        return '<div class="ended"><span class="lbl">RAN</span> Thu 22 Oct</div>'
    return ""

# ---------------- Option A: inline tile ----------------
def A_block(d):
    past = d["mode"]=="ended"
    title = "WHO WENT" if past else "WHO&rsquo;S GOING"
    return (f'{banner(d)}<div class="tiletitle">{title}</div><div class="tile">'
            f'<div class="night">{"Thu 22 Oct" if past else NIGHT} &middot; 21:00</div>'
            f'<div class="row">{faces_for(d,7)}<span class="cl">{count_line(d,past)}</span></div>'
            f'{zero_hint(d)}{action("A",d)}</div>')

# ---------------- Option B: sticky bar + compact strip ----------------
def B_block(d):
    past = d["mode"]=="ended"
    strip = (f'{banner(d)}<div class="strip"><span class="night">{"Thu 22 Oct" if past else NIGHT}</span>'
             f'{faces_for(d,5)}<span class="cl">{count_line(d,past)}</span></div>{zero_hint(d)}')
    m = d["mode"]
    if m=="signin": bar='<a class="btn primary" href="#signin">Sign in &middot; I&rsquo;m going</a>'; note='You need an account with a finished dancer profile.'
    elif m=="unfinished": bar='<button class="btn primary" disabled>I&rsquo;m going</button>'; note='Add your <b>dance role</b> first. <a href="#me-edit">Finish your profile &rarr;</a>'
    elif m=="can": bar='<button class="btn primary">I&rsquo;m going</button>'; note=''
    elif m=="going":
        bar='<button class="btn on">&#10003; Going &middot; <u>Undo</u></button>'
        note = 'You&rsquo;re counted; your face is hidden (switch OFF). <a href="#settings">Options &rarr;</a>' if not d.get("me_face") else 'Tap again to undo.'
    elif m=="ended": bar='<button class="btn" disabled>Ended</button>'; note='This night is over. <a href="#next">Next night &rarr;</a>'
    else: bar='<button class="btn" disabled>Cancelled</button>'; note='Organiser cancelled this night. <a href="#next">Next night &rarr;</a>'
    sticky = (f'<div class="sticky">{"<div class=why>"+note+"</div>" if note else ""}<div class="barrow">{bar}'
              f'<button class="icon" title="Directions">&#10148;</button><button class="icon" title="Share">&#8599;</button></div></div>')
    return strip + sticky

# ---------------- Option C: night picker + face grid ----------------
def C_block(d):
    past = d["mode"]=="ended"
    chips = ""
    days = [("Thu","22 Oct","ended") if past else ("Thu","29 Oct","sel"),("Thu","5 Nov",""),("Thu","12 Nov",""),("Thu","19 Nov","")]
    if d["mode"]=="cancelled": days[0]=("Thu","29 Oct","sel x")
    cnts = [d["count"],1,0,0]
    for (w,dt,cls),c in zip(days,cnts):
        chips += f'<span class="chip {cls}"><b>{w} {dt.split()[0]}</b><small>{dt.split()[1]}</small><i>{c} going</i></span>'
    f = d["faces"]; shown=min(f,8); extra=f-shown; me=d.get("me_face")
    grid=""
    for i in range(shown):
        isme = me and i==0
        grid += f'<a class="gface" href="#dancer">{face(9 if isme else i,44,me=isme,tag="span")}<span>{"You" if isme else NAMES[i]}</span></a>'
    if extra: grid += f'<a class="gface" href="#all"><span class="face more" style="width:44px;height:44px">+{extra}</span><span>See all</span></a>'
    gridhtml = f'<div class="grid">{grid}</div>' if f else ""
    return (f'{banner(d)}<div class="tiletitle">PICK A NIGHT</div><div class="tile">'
            f'<div class="chips">{chips}</div>'
            f'<div class="row"><span class="cl">{count_line(d,past)}</span></div>{gridhtml}{zero_hint(d)}{action("C",d)}</div>')

CSS = """
*{box-sizing:border-box}body{margin:0;background:#0b0b0b;color:#fff;font:14px/1.4 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{width:390px;margin:0 auto;padding:12px 0 40px}
h1{font-size:20px;margin:8px 12px 4px;letter-spacing:-.02em}h2{font-size:15px;margin:22px 12px 6px;color:#FF9900;text-transform:uppercase;letter-spacing:.06em}
.lede{margin:0 12px 10px;color:#ABABAB;font-size:13px}
.state{margin:10px 8px 0;font:600 11px/1 Inter,sans-serif;color:#ABABAB;text-transform:uppercase;letter-spacing:.08em}
.phone{margin:6px 8px 0;border-radius:18px;overflow:hidden;border:1px solid #333}
.ev{background:#101F1C;color:#D8CCB0;padding:10px 8px;position:relative}
.ev a{color:#FFC24B}.mut{color:#A59474}
.tiletitle{text-align:center;font-weight:700;letter-spacing:.04em;color:#B38A4E;margin:4px 0 6px;font-size:13px}
.tile{background:#1A2E2A;border:1px solid hsla(38,39%,50%,.18);border-radius:22px;padding:10px;box-shadow:0 6px 14px rgba(0,0,0,.35)}
.night{font-size:12px;font-weight:700;color:#B38A4E;text-transform:uppercase;letter-spacing:.05em}
.row{display:flex;align-items:center;gap:8px;margin:8px 0;min-height:32px;flex-wrap:wrap}.cl{font-size:13px}
.stack{display:inline-flex}.stack .face+.face{margin-left:-8px}
.face{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;text-decoration:none;flex:none}
.face.more{background:#33473F;color:#D8CCB0;font-size:12px;font-weight:700}
.btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:48px;border-radius:999px;border:1px solid rgba(165,148,116,.35);background:#1A2E2A;color:#D8CCB0;font:700 14px Inter,sans-serif;text-decoration:none}
.btn.primary{background:linear-gradient(180deg,#FFD64B,#FFB200);color:#3A2603;border:0}
.btn.on{background:rgba(79,224,207,.14);color:#4fe0cf;border:1px solid rgba(79,224,207,.5)}
.btn[disabled]{opacity:.55}.btn.primary[disabled]{opacity:.5}
.why{font-size:12px;margin-top:6px;color:#A59474}.why.warn{color:#E8D9B5}
.hint{font-size:12px;color:#D8CCB0;background:rgba(255,194,75,.08);border:1px dashed rgba(255,194,75,.35);border-radius:12px;padding:6px 8px;margin:0 0 8px}
.cancel{background:linear-gradient(180deg,#DC2626,#991B1B);color:#fff;font-size:13px;font-weight:700;padding:8px 10px;border-radius:12px;margin-bottom:8px}
.badge{background:#fff;color:#B91C1C;font-size:9px;font-weight:900;letter-spacing:.1em;padding:2px 5px;border-radius:3px;margin-left:6px}
.ended{border:1px solid hsla(38,39%,50%,.18);background:#1A2E2A;border-radius:12px;padding:8px 10px;margin-bottom:8px;font-weight:800}
.ended .lbl{font-size:9px;font-weight:900;letter-spacing:.14em;color:#B38A4E;margin-right:6px}
.strip{display:flex;align-items:center;gap:8px;background:#1A2E2A;border:1px solid hsla(38,39%,50%,.18);border-radius:14px;padding:6px 8px;flex-wrap:wrap}
.strip .night{font-size:11px}
.sticky{margin-top:10px;padding:18px 4px 2px;background:linear-gradient(180deg,rgba(16,31,28,0),rgba(16,31,28,.94) 30%)}
.barrow{display:flex;gap:8px;align-items:center}.barrow .btn{flex:1}
.icon{width:44px;height:44px;border-radius:50%;background:#1A2E2A;color:#D8CCB0;border:1px solid rgba(165,148,116,.25);font-size:16px;flex:none}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.chip{flex:none;min-width:64px;min-height:56px;border-radius:14px;border:1px solid rgba(165,148,116,.3);padding:5px 7px;display:flex;flex-direction:column;font-size:12px;position:relative}
.chip small{color:#A59474}.chip i{font-style:normal;font-size:11px;color:#4fe0cf;font-weight:700}
.chip.sel{border-color:#FFC24B;background:rgba(255,194,75,.1)}.chip.x{border-color:#DC2626;text-decoration:line-through}.chip.ended{opacity:.7}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 10px}
.gface{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:#D8CCB0;text-decoration:none;min-height:44px}
/* hub (site black theme) */
.hub{background:#000;padding:10px 8px}
.fcard{background:linear-gradient(135deg,#121212,#121212 70%,rgba(255,153,0,.05));border:1px solid rgba(255,153,0,.2);border-radius:12px;overflow:hidden}
.fcard .top{height:4px;background:linear-gradient(90deg,#ec4899,#a855f7,#f97316)}
.fcard .in{padding:12px}.fname{font-weight:700;font-size:16px}.fmeta{font-size:12px;color:#ABABAB}
.nrow{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #333;min-height:52px}
.nrow .d{width:56px;font-size:12px;font-weight:700;color:#FF9900}.nrow .m{flex:1;font-size:12px;color:#ABABAB}
.pill{font-size:12px;font-weight:600;color:#FF9900;background:rgba(255,153,0,.1);padding:4px 8px;border-radius:999px;white-space:nowrap}
.sbtn{height:44px;min-width:44px;padding:0 12px;border-radius:999px;border:1px solid #FF9900;color:#FF9900;background:transparent;font:700 12px Inter,sans-serif}
.sbtn.on{background:#FF9900;color:#000}
/* dancer app ember */
.da{background:#202226;color:#fff;font-family:Outfit,Inter,sans-serif}
.dahead{height:52px;display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid #3D4148}
.dapill{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:#33373D;color:#C9ADFF}
.dabody{padding:12px}.card{background:#2a2d32;border:1px solid #3d4148;border-radius:20px;padding:14px}
.trow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}
.tlabel{font-size:15px;font-weight:600}.tsub{font-size:13px;color:#a3a9b3;margin-top:6px}
.tog{height:44px;width:56px;border-radius:999px;border:1px solid #7b828d;font-weight:700;background:#33373d;color:#fff;flex:none}
.tog.on{background:#f0703a;color:#1d0a03}
.sec{font-size:13px;font-weight:600;text-transform:uppercase;color:#a3a9b3;margin:14px 0 6px}
.nr{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid #3d4148}.nr:first-child{border-top:0}
.db{width:48px;border-radius:12px;background:#33373d;text-align:center;padding:4px 0;flex:none}
.db .w{font-size:11px;color:#a3a9b3}.db .n{font-size:20px;font-weight:800;line-height:1}.db .mo{font-size:11px;color:#a3a9b3}
.nn{font-size:15px;font-weight:700}.np{font-size:13px;color:#a3a9b3}
.tag{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-top:4px}
.tag.g{color:#4fe0cf;background:rgba(79,224,207,.14)}.tag.w{color:#c9adff;background:rgba(201,173,255,.14)}.tag.x{color:#ff7a6b;background:rgba(255,122,107,.14)}
.tabbar{height:60px;display:grid;grid-template-columns:repeat(4,1fr);background:#2A2D32;border-top:1px solid #3D4148;font-size:12px;font-weight:600;color:#A3A9B3;text-align:center;align-items:center}
.tabbar .a{color:#F5865A}
.da a{color:#F5865A}
.empty{font-size:13px;color:#a3a9b3;padding:8px 0}
/* organiser */
.orow{padding:10px 14px;border-top:1px solid #3d4148;min-height:56px}.orow:first-child{border-top:0}
.ohd{display:flex;align-items:center;gap:8px}.oname{flex:1;font-size:15px;font-weight:600}
.chipok{border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;background:rgba(62,207,142,.14);color:#7be6b4}
.chipn{border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;background:#33373d;color:#a3a9b3}
.chipbad{border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;background:#33373d;color:#ff7a6b}
.ofaces{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:13px;color:#a3a9b3}
.ogrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
.operson{display:flex;align-items:center;gap:6px;background:#33373d;border-radius:12px;padding:4px 6px;font-size:12px;min-height:44px;color:#fff;text-decoration:none}
.note{margin:8px 12px;font-size:12px;color:#ABABAB;border-left:3px solid #FF9900;padding-left:8px}
"""

def hub(opt):
    rows = [("Fri 13 Nov","Festival night 1 &middot; 3 going",3,0,False),("Sat 14 Nov","Festival night 2 &middot; nobody yet",0,0,True)]
    s = '<div class="hub"><div class="fcard"><div class="top"></div><div class="in"><div class="fname">London Bachata Festival</div><div class="fmeta">13&ndash;15 Nov &middot; London</div>'
    for d,m,c,e,mine in rows:
        if opt=="A":
            right = (stack(c,24,"#121212") if c else "") + f'<span class="pill">{c} going</span>' if c else '<span class="pill" style="color:#ABABAB;background:#212121">0 going</span>'
            s += f'<div class="nrow"><span class="d">{d}</span><span class="m">{right}</span><button class="sbtn">I&rsquo;m going</button></div>'
        elif opt=="B":
            right = f'{stack(c,24,"#121212")} <b>{c}</b>' if c else '<span>Be the first</span>'
            s += f'<a class="nrow" href="#event" style="text-decoration:none;color:inherit"><span class="d">{d}</span><span class="m">{right}</span><span class="pill">Open &rsaquo;</span></a>'
        else:
            right = f'{stack(c,24,"#121212")}' if c else '<span>No one yet &mdash; be first</span>'
            s += f'<div class="nrow"><span class="d">{d}<br><small style="color:#4fe0cf">{c} going</small></span><span class="m">{right}</span><button class="sbtn{" on" if c else ""}">{"&#10003; Going" if c else "I&rsquo;m going"}</button></div>'
    s += '</div></div></div>'
    notes = {"A":"Each night row has its own count, faces and button &mdash; you say going to the night, not the festival.",
             "B":"Rows show count + faces only; tapping a row opens that night&rsquo;s event page, where the button lives (one place to say going).",
             "C":"Rows show count under the date; the button toggles in place (first row shows the &ldquo;going&rdquo; state)."}
    return s + f'<div class="note">{notes[opt]}</div>'

def settings(opt):
    lines = {
     "A":"When ON, your photo and first name show on nights you&rsquo;re going to, and your dancer page shows &ldquo;Going next&rdquo;. When OFF, you&rsquo;re still counted in the number, but nobody sees it&rsquo;s you.",
     "B":"ON: your face appears on nights you&rsquo;re going to and in &ldquo;Going next&rdquo; on your dancer page. OFF: you only add 1 to the count.",
     "C":"Shows your photo on the nights you pick and a &ldquo;Going next&rdquo; list on your dancer page. Off = you&rsquo;re counted but stay anonymous.",
    }
    def one(on):
        return (f'<div class="card"><div class="trow"><span class="tlabel">Show me as going</span><button class="tog{" on" if on else ""}">{"On" if on else "Off"}</button></div>'
                f'<div class="tsub">{lines[opt]}</div></div>')
    extra = ""
    if opt=="C":
        extra = '<div class="tsub" style="margin-top:8px">Preview: <span class="stack">'+face(9,24,"#2a2d32",me=True)+'</span> this is how you&rsquo;ll appear.</div>'
    return (f'<div class="da"><div class="dahead"><b>BC</b><span class="dapill">Dancer</span></div><div class="dabody">'
            f'<div class="sec">Privacy</div>{one(False)}<div class="state" style="margin:10px 0 4px">Switched ON</div>{one(True)}{extra}'
            f'<div class="sec">Unfinished profile</div><div class="card"><div class="trow"><span class="tlabel">Show me as going</span><button class="tog" disabled style="opacity:.5">Off</button></div>'
            f'<div class="tsub">Finish your profile (add your <b>dance role</b>) before you can go to nights or show your face. <a href="#me-edit">Finish profile &rarr;</a></div></div>'
            f'</div><div class="tabbar"><span>Home</span><span>Nights</span><span>Me</span><span class="a">Options</span></div></div>')

def nights(opt):
    up = [("Thu","29","Oct","Thursday Social","Venue A &middot; 21:00","g","Going"),("Sat","14","Nov","Festival night 2","Venue B &middot; 20:00","g","Going")]
    past = [("Thu","22","Oct","Thursday Social","Venue A","w","Went"),("Fri","16","Oct","Friday Party","Venue C","x","Cancelled")]
    def rows(lst, upcoming):
        s=""
        for w,n,m,nm,pl,t,lab in lst:
            extra = ""
            if upcoming and opt=="B": extra = f' <span class="np">&middot; 4 going</span>'
            if upcoming and opt=="C": extra = f'<div style="margin-top:4px">{stack(3,22,"#2a2d32")} <span class="np">+ you</span></div>'
            undo = '<a href="#undo" style="font-size:13px;margin-left:8px">Not going</a>' if upcoming and opt!="C" else ""
            s += f'<div class="nr"><div class="db"><div class="w">{w}</div><div class="n">{n}</div><div class="mo">{m}</div></div><div style="flex:1"><div class="nn">{nm}</div><div class="np">{pl}</div><span class="tag {t}">{lab}</span>{undo}{extra}</div></div>'
        return s
    empty = '<div class="card"><div class="empty">No nights yet. Open any event and tap <b>I&rsquo;m going</b> &mdash; it lands here. <a href="#calendar">Browse this week &rarr;</a></div></div>'
    return (f'<div class="da"><div class="dahead"><b>BC</b><span class="dapill">Dancer</span></div><div class="dabody">'
            f'<div class="sec">Upcoming</div><div class="card" style="padding:6px 14px">{rows(up,True)}</div>'
            f'<div class="sec">Past</div><div class="card" style="padding:6px 14px">{rows(past,False)}</div>'
            f'<div class="state" style="margin:14px 0 4px">Empty state</div>{empty}'
            f'</div><div class="tabbar"><span>Home</span><span class="a">Nights</span><span>Me</span><span>Options</span></div></div>')

def organiser(opt):
    nights_ = [("Thu 29 Oct",12,10,"ok"),("Thu 5 Nov",1,1,"ok"),("Thu 12 Nov",0,0,"ok"),("Thu 19 Nov",0,0,"bad")]
    s = '<div class="da"><div class="dahead"><b>BC</b><span class="dapill" style="color:#7be6b4">Organiser</span></div><div class="dabody"><div class="sec">Thursday Social &middot; upcoming nights</div><div class="card" style="padding:0">'
    for d,c,f,tone in nights_:
        chip = '<span class="chipbad">Cancelled</span>' if tone=="bad" else f'<span class="chipok">{c} going</span>' if c else '<span class="chipn">0 going</span>'
        body=""
        if tone=="bad": body='<div class="ofaces">Cancelled &mdash; nobody can say going to this night any more.</div>'
        elif c==0: body='<div class="ofaces">Nobody yet. Share the night so dancers can say they&rsquo;re going. <a href="#share">Share &rarr;</a></div>'
        elif opt=="A": body=f'<div class="ofaces">{stack(min(f,6),28,"#2a2d32",extra=max(0,f-6))}<span>{c-f} going with face hidden</span></div>' if c-f else f'<div class="ofaces">{stack(f,28,"#2a2d32")}</div>'
        elif opt=="B": body=f'<div class="ofaces">{stack(min(f,4),28,"#2a2d32",extra=max(0,f-4))}<a href="#list">See who &rsaquo;</a></div>'
        else:
            g="".join(f'<a class="operson" href="#dancer">{face(i,28,"#33373d",tag="span")}{NAMES[i]}</a>' for i in range(min(f,5)))
            if f>5: g+=f'<a class="operson" href="#all">+{f-5} more</a>'
            body=f'<div class="ogrid">{g}</div>' + (f'<div class="ofaces">+ {c-f} going with face hidden</div>' if c-f else "")
        s += f'<div class="orow"><div class="ohd"><span class="oname">{d}</span>{chip}</div>{body}</div>'
    s += '</div><div class="tsub" style="margin-top:8px">You see the same faces visitors see. Dancers with &ldquo;Show me as going&rdquo; OFF are counted but never named &mdash; not even to you.</div></div></div>'
    return s

META = {
 "A":("Option A &mdash; &ldquo;Who&rsquo;s going&rdquo; tile","The Going block is its own bento tile in the event page, next to the other tiles. Faces overlap in a row with the count beside them; the button sits inside the tile. Simple, everything in one place.",A_block),
 "B":("Option B &mdash; Button in the sticky bar","A thin faces strip near the top of the event page, and &ldquo;I&rsquo;m going&rdquo; becomes the big button in the bottom sticky bar (next to Directions / Share), always under the thumb. Ticket link moves into its own tile when an event has one.",B_block),
 "C":("Option C &mdash; Pick a night + face wall","A night picker (chips with each night&rsquo;s count) makes it obvious which night you&rsquo;re going to. Below: a grid of faces with first names. Most social, takes most space.",C_block),
}

for opt,(title,lede,fn) in META.items():
    h = [f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Going {opt}</title>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Outfit:wght@400;600;700;800&display=swap">'
         f'<style>{CSS}</style></head><body><div class="wrap">',
         f'<h1>{title}</h1><p class="lede">{lede}</p><p class="lede">Mock data from <code>docs/going/shape-survey.md</code>. Faces are coloured initials, not real people. Tap targets &ge; 44px (explicit px).</p>',
         '<h2>1 &middot; Event page Going block</h2>']
    for key,label,d in STATES:
        h.append(f'<div class="state">{label}</div><div class="phone"><div class="ev">{fn(d)}</div></div>')
    h.append('<h2>2 &middot; Festival hub night rows</h2><div class="phone">'+hub(opt)+'</div>')
    h.append('<h2>3 &middot; Dancer settings switch</h2><div class="phone">'+settings(opt)+'</div>')
    h.append('<h2>4 &middot; Dancer app &ldquo;My nights&rdquo;</h2><div class="phone">'+nights(opt)+'</div>')
    h.append('<h2>5 &middot; Organiser view</h2><div class="phone">'+organiser(opt)+'</div>')
    h.append('</div></body></html>')
    open(os.path.join(OUT,f"option-{opt.lower()}.html"),"w").write("\n".join(h))
print("ok")
