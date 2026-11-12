# Existing organiser prototype: area (HTML in fence; tile numbers are placeholders)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organiser area mockup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#F5F3EE;--s1:#FFFFFF;--s2:#EFEBE3;--line:#E1DBCF;--text:#1F1D1A;--mute:#625D54;--gold:#E0B252;--goldt:#7A4E00;--ok:#17684A;--okbg:#DDF1E7;--warn:#8A5200;--warnbg:#FBEBD2;--bad:#A3231B;--badbg:#F8DEDB;--ink:#14110A}
*{box-sizing:border-box}
body{margin:0;background:#D9D4C8;color:var(--text);font:14px/1.4 'DM Sans',system-ui,sans-serif}
h1,h2,h3{font-family:'Sora',sans-serif;margin:0}
a{color:var(--goldt);text-decoration:none;font-weight:700}
button{font:inherit;color:inherit;cursor:pointer}
.wrap{max-width:1900px;margin:0 auto;padding:20px 12px 64px}
.intro{max-width:700px;margin:0 0 20px;color:#4A463F}
.intro h1{font-size:22px;color:var(--text);margin-bottom:6px}
.grid{display:flex;flex-wrap:wrap;gap:28px 24px;align-items:flex-start}
.lab{font:700 12px 'DM Sans';letter-spacing:.08em;text-transform:uppercase;color:#4A463F;margin:0 0 6px}
.phone{width:390px;min-height:760px;background:var(--bg);border:1px solid #B9B2A3;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;gap:12px;padding:12px 12px 0}
.phone>.fill{flex:1}
.card{background:var(--s1);border:1px solid var(--line);border-radius:12px}
.pad{padding:12px}
.sec{display:flex;flex-direction:column;gap:8px}
.sech{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.sech h2{font-size:15px;font-weight:600}
.sech a,.sech span{font-size:13px;font-weight:700}
.m{color:var(--mute);font-weight:400!important;font-size:12px!important}
.mute{color:var(--mute)}
.small{font-size:12px}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap}
.chip.ok{background:var(--okbg);color:var(--ok)}
.chip.warn{background:var(--warnbg);color:var(--warn)}
.chip.bad{background:var(--badbg);color:var(--bad)}
.chip.n{background:var(--s2);color:var(--mute)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.btn{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid #CFC8B8;background:var(--s1);font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--text)}
.btn.gold{background:var(--gold);border-color:var(--gold);color:var(--ink)}
.btn.sm{min-height:36px;padding:0 10px}
.btn.full{width:100%}
.list>*{border-bottom:1px solid var(--line)}
.list>*:last-child{border-bottom:0}
.item{display:flex;align-items:center;gap:10px;padding:8px 12px;min-height:56px;color:var(--text)}
.item .t{flex:1;min-width:0;display:flex;flex-direction:column}
.item .t b{font-size:14px}
.cta{font-size:13px;font-weight:700;color:var(--goldt)}
.pip{width:8px;height:8px;border-radius:50%;flex:none}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tile{padding:12px;display:flex;flex-direction:column;gap:2px}
.tile .v{font:700 22px 'Sora'}
.delta{font-size:12px;font-weight:700}
.delta.up{color:var(--ok)}.delta.dn{color:var(--bad)}
.datebox{width:44px;flex:none;border-radius:8px;background:var(--s2);text-align:center;padding:4px 0}
.datebox i{display:block;font:700 11px 'DM Sans';font-style:normal;color:var(--mute)}
.datebox b{font:700 17px 'Sora'}
.av{width:36px;height:36px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--ink)}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.tabs{margin:0 -12px;border-top:1px solid var(--line);background:var(--s1);display:grid;grid-template-columns:repeat(5,1fr)}
.tabs a{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;font-weight:700;color:var(--mute)}
.tabs a.on{color:var(--goldt)}
.top{display:flex;align-items:center;gap:8px;min-height:44px}
.top .ttl{flex:1;min-width:0}
.top .ttl b{display:block;font:600 16px 'Sora'}
.back{width:44px;padding:0}
.bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:var(--gold)}
.seg{display:grid;gap:3px;background:var(--s2);border-radius:10px;padding:3px}
.seg a{min-height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:13px;color:var(--mute)}
.seg a.on{background:var(--s1);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.kv{display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:52px}
.kv .k{flex:1;display:flex;flex-direction:column;min-width:0}
.kv .k b{font-size:14px}
.rows .r{display:grid;grid-template-columns:84px 1fr 38px;align-items:center;gap:8px;font-size:12px;padding:4px 0}
.rows .r div{height:8px;border-radius:4px;background:var(--s2);overflow:hidden}
.rows .r div i{display:block;height:100%;background:var(--gold)}
.pills{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
.pills a{min-height:36px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;border:1px solid #CFC8B8;background:var(--s1);font-size:13px;white-space:nowrap;color:var(--text);font-weight:500}
.pills a.on{background:var(--ink);border-color:var(--ink);color:#fff}
.sw{width:46px;height:28px;border-radius:14px;background:#BDB6A6;position:relative;flex:none}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff}
.sw.on{background:var(--ok)}.sw.on::after{left:21px}
.sheet{margin:0 -12px;background:var(--s1);border-top:1px solid #CFC8B8;border-radius:18px 18px 0 0;padding:14px 12px 16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 -8px 24px rgba(0,0,0,.12)}
.grab{width:40px;height:4px;border-radius:2px;background:#CFC8B8;margin:0 auto}
.field{display:flex;flex-direction:column;gap:4px}
.field label{font-size:12px;font-weight:700;color:var(--mute)}
.input{min-height:44px;border:1px solid #CFC8B8;border-radius:10px;background:#fff;padding:0 12px;display:flex;align-items:center;font-size:14px}
.chart{width:100%;height:96px;display:block}
.legend{display:flex;gap:12px;font-size:12px;color:var(--mute)}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.tick{width:30px;height:30px;border-radius:8px;border:2px solid #BDB6A6;flex:none;display:flex;align-items:center;justify-content:center}
.tick.on{background:var(--ok);border-color:var(--ok);color:#fff}
.qr{width:150px;height:150px;background:
 conic-gradient(from 90deg at 50% 50%,#14110A 0 25%,#fff 0 50%,#14110A 0 75%,#fff 0) 0 0/20px 20px;border:8px solid #fff;outline:1px solid var(--line)}
.flyer{aspect-ratio:4/5;border-radius:12px;background:linear-gradient(160deg,#2A2418,#14110A);color:#F4F1EA;padding:18px;display:flex;flex-direction:column;justify-content:space-between}
</style>
</head>
<body>
<div class="wrap">
<div class="intro">
<h1>Organiser area: full phone set (light, calm)</h1>
<p style="margin:0">14 screens in a scrolling row. All numbers are placeholders (000) and names are in [brackets]. Classes are deliberately not drawn yet. Scroll sideways on a phone, pinch to zoom.</p>
</div>
<div class="grid">

<!-- 1 HOME -->
<div><p class="lab">1 &middot; Home (all organisers)</p>
<div class="phone">
<div class="top">
<div class="av" style="background:var(--gold);border-radius:10px">R</div>
<button style="flex:1;min-height:44px;display:flex;align-items:center;gap:6px;background:none;border:0;text-align:left;padding:0"><span style="font:600 16px 'Sora'">[Organiser A]</span><svg class="ic" style="width:16px;height:16px;stroke:var(--mute)" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
<a class="btn" href="#">Public page</a>
</div>
<div class="sec">
<div class="sech"><h2>Needs you</h2><span class="m">4 items across 2 organisers</span></div>
<div class="card list" style="overflow:hidden">
<a class="item" href="#"><span class="pip" style="background:var(--gold)"></span><span class="t"><b>2 requests to join your team</b><span class="small mute">[Organiser A]</span></span><span class="cta">Review</span></a>
<a class="item" href="#"><span class="pip" style="background:var(--bad)"></span><span class="t"><b>1 date taken off</b><span class="small mute">[Organiser A] &middot; check it is right</span></span><span class="cta">Check</span></a>
<a class="item" href="#"><span class="pip" style="background:var(--warn)"></span><span class="t"><b>New low rating</b><span class="small mute">[Organiser B] &middot; [Class name]</span></span><span class="cta">Read</span></a>
<a class="item" href="#"><span class="pip" style="background:var(--ok)"></span><span class="t"><b>Door list ready for tonight</b><span class="small mute">[Organiser A] &middot; 000 going</span></span><span class="cta">Open</span></a>
</div></div>
<div class="sec">
<div class="sech"><h2>Today</h2><span class="m">[Weekday] 00 Oct</span></div>
<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
<div style="display:flex;align-items:center;gap:10px"><div class="datebox"><i>TONIGHT</i><b>20:30</b></div><div style="flex:1"><b>[Weekly social]</b><div class="small mute">[Venue] &middot; 000 going &middot; 000 checked in</div></div></div>
<div style="display:flex;gap:8px"><a class="btn gold" href="#" style="flex:1">Check-in</a><a class="btn" href="#" style="flex:1">Share</a><a class="btn" href="#" style="flex:1">Change</a></div>
</div></div>
<div class="sec">
<div class="sech"><h2>Last 30 days</h2><a href="#">Insights</a></div>
<div class="tiles">
<div class="card tile"><span class="small mute">Page views</span><span class="v">000</span><span class="delta up">+0% vs previous</span></div>
<div class="card tile"><span class="small mute">Link clicks</span><span class="v">000</span><span class="delta up">+0%</span></div>
<div class="card tile"><span class="small mute">Going</span><span class="v">000</span><span class="delta dn">-0%</span></div>
<div class="card tile"><span class="small mute">Rating</span><span class="v">0.0</span><span class="delta up">+0.0</span></div>
</div></div>
<div class="card pad" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b>First steps</b><div class="small mute">3 of 6 done</div><div class="bar" style="margin-top:6px"><i style="width:50%"></i></div></div><a class="btn" href="#">Continue</a></div>
<div class="fill"></div>
<nav class="tabs" aria-label="Organiser">
<a class="on" href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v17H5zM5 9h14M9 2v4M15 2v4"/></svg>Events</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>Insights</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9"/></svg>Team</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>More</a>
</nav></div></div>

<!-- 2 SWITCHER -->
<div><p class="lab">2 &middot; Switch organiser</p>
<div class="phone" style="background:#8E887C">
<div style="flex:1"></div>
<div class="sheet">
<div class="grab"></div>
<h2 style="font-size:16px">Your organisers</h2>
<div class="card list" style="overflow:hidden">
<a class="item" href="#" style="background:var(--s2)"><span class="av" style="background:var(--gold);border-radius:10px">A</span><span class="t"><b>[Organiser A]</b><span class="small mute">Owner &middot; 3 events</span></span><span class="chip ok">Viewing</span></a>
<a class="item" href="#"><span class="av" style="background:#8FB7E8;border-radius:10px">B</span><span class="t"><b>[Organiser B]</b><span class="small mute">Manager &middot; 2 classes</span></span><span class="chip warn">1 needs you</span></a>
<a class="item" href="#"><span class="av" style="background:#C9A6E4;border-radius:10px">C</span><span class="t"><b>[Organiser C]</b><span class="small mute">Door staff &middot; check-in only</span></span></a>
</div>
<a class="btn full" href="#">All organisers: combined Needs you</a>
<a class="btn full" href="#">+ Claim or create another organiser</a>
</div></div></div>

<!-- 3 EVENTS -->
<div><p class="lab">3 &middot; Events</p>
<div class="phone">
<div class="top"><div class="ttl"><b>Events</b></div><a class="btn gold" href="#">+ New event</a></div>
<div class="pills"><a class="on" href="#">All 00</a><a href="#">Live 00</a><a href="#">Draft 00</a><a href="#">Ended 00</a></div>
<div class="card list" style="overflow:hidden">
<a class="item" href="#" style="min-height:72px"><span style="width:56px;height:56px;border-radius:8px;background:#E8DCC0;flex:none"></span><span class="t"><b>[Weekly social]</b><span class="small mute">Every [weekday] 20:30 &middot; [Venue]</span><span class="small" style="margin-top:2px"><span class="chip ok">Live</span> <span class="mute">next: 00 Oct</span></span></span></a>
<a class="item" href="#" style="min-height:72px"><span style="width:56px;height:56px;border-radius:8px;background:#CBD6E8;flex:none"></span><span class="t"><b>[Monthly party]</b><span class="small mute">Monthly &middot; [Venue]</span><span class="small" style="margin-top:2px"><span class="chip ok">Live</span> <span class="mute">next: 00 Nov</span></span></span></a>
<a class="item" href="#" style="min-height:72px"><span style="width:56px;height:56px;border-radius:8px;background:#E8CBCB;flex:none"></span><span class="t"><b>[Festival weekend]</b><span class="small mute">One-off &middot; 3 days</span><span class="small" style="margin-top:2px"><span class="chip n">Draft</span> <span class="mute">not public yet</span></span></span></a>
<a class="item" href="#" style="min-height:72px"><span style="width:56px;height:56px;border-radius:8px;background:#D5D0C4;flex:none"></span><span class="t"><b>[Old workshop]</b><span class="small mute">One-off</span><span class="small" style="margin-top:2px"><span class="chip n">Ended</span> <span class="mute">00 Sep</span></span></span></a>
</div>
<div class="fill"></div>
<nav class="tabs" aria-label="Organiser">
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
<a class="on" href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v17H5zM5 9h14M9 2v4M15 2v4"/></svg>Events</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>Insights</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9"/></svg>Team</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>More</a>
</nav></div></div>

<!-- 4 EVENT DATES -->
<div><p class="lab">4 &middot; One event: Dates</p>
<div class="phone">
<div class="top"><a class="btn back" href="#" aria-label="Back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>[Weekly social]</b><span class="small mute">Every [weekday] 20:30</span></div><span class="chip ok"><span class="dot"></span>Live</span></div>
<div class="seg" style="grid-template-columns:repeat(4,1fr)"><a class="on" href="#">Dates</a><a href="#">Guests</a><a href="#">Stats</a><a href="#">Details</a></div>
<div class="sech"><h2>Upcoming</h2><a href="#">+ Add a date</a></div>
<div class="card list" style="overflow:hidden">
<div class="item" style="min-height:68px"><div class="datebox"><i>OCT</i><b>00</b></div><span class="t"><b>[Weekday] 20:30</b><span class="small mute">[Venue] &middot; 000 going</span></span><button class="btn sm">Change</button></div>
<div class="item" style="min-height:68px"><div class="datebox"><i>OCT</i><b>00</b></div><span class="t"><b>[Weekday] 20:30</b><span class="small mute">[Venue] &middot; 000 going</span></span><button class="btn sm">Change</button></div>
<div class="item" style="min-height:68px;background:#FBF3F2"><div class="datebox" style="opacity:.6"><i>NOV</i><b>00</b></div><span class="t"><b>[Weekday] 20:30</b><span class="chip bad" style="align-self:flex-start;margin-top:2px">Taken off</span></span><button class="btn sm">Put back</button></div>
</div>
<div class="sheet" style="margin-top:auto">
<div class="grab"></div>
<h2 style="font-size:16px">Change [Weekday] 00 Oct</h2>
<div class="field"><label>Time</label><div class="input">20:30</div></div>
<div class="field"><label>Place for this date only</label><div class="input">[Venue] (usual)</div></div>
<div style="display:flex;gap:8px"><a class="btn" href="#" style="flex:1;color:var(--bad)">Take this date off</a><a class="btn gold" href="#" style="flex:1">Save: live now</a></div>
</div></div></div>

<!-- 5 EVENT STATS -->
<div><p class="lab">5 &middot; One event: Stats</p>
<div class="phone">
<div class="top"><a class="btn back" href="#" aria-label="Back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>[Weekly social]</b><span class="small mute">Every [weekday] 20:30</span></div><span class="chip ok"><span class="dot"></span>Live</span></div>
<div class="seg" style="grid-template-columns:repeat(4,1fr)"><a href="#">Dates</a><a href="#">Guests</a><a class="on" href="#">Stats</a><a href="#">Details</a></div>
<div class="pills"><a href="#">7 days</a><a class="on" href="#">30 days</a><a href="#">90 days</a><a href="#">Custom</a></div>
<div class="tiles">
<div class="card tile"><span class="small mute">Page views</span><span class="v">000</span><span class="delta up">+0% vs previous</span></div>
<div class="card tile"><span class="small mute">Link clicks</span><span class="v">000</span><span class="delta up">+0%</span></div>
<div class="card tile"><span class="small mute">Going</span><span class="v">000</span><span class="delta dn">-0%</span></div>
<div class="card tile"><span class="small mute">Level rating</span><span class="v">0.0</span><span class="small mute">from 00 ratings</span></div>
</div>
<div class="card pad">
<div class="sech"><h2 style="font-size:14px">Views and going, by day</h2></div>
<svg class="chart" viewBox="0 0 300 96" preserveAspectRatio="none" aria-label="Line chart placeholder"><path d="M0 70 L30 60 L60 66 L90 40 L120 48 L150 30 L180 38 L210 22 L240 30 L270 14 L300 20" fill="none" stroke="#E0B252" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 84 L30 80 L60 82 L90 70 L120 74 L150 62 L180 66 L210 56 L240 60 L270 48 L300 52" fill="none" stroke="#17684A" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="5 4"/></svg>
<div class="legend"><span><i style="background:#E0B252"></i>Views</span><span><i style="background:#17684A"></i>Going</span><span style="margin-left:auto">1 Oct &ndash; 30 Oct</span></div>
</div>
<div class="card pad rows">
<div class="sech"><h2 style="font-size:14px">Where clicks go</h2></div>
<div class="r"><span>Tickets</span><div><i style="width:70%"></i></div><b>000</b></div>
<div class="r"><span>Map</span><div><i style="width:45%"></i></div><b>000</b></div>
<div class="r"><span>Instagram</span><div><i style="width:30%"></i></div><b>000</b></div>
<div class="r"><span>WhatsApp</span><div><i style="width:20%"></i></div><b>000</b></div>
</div>
<div class="card pad rows">
<div class="sech"><h2 style="font-size:14px">Where visitors come from</h2></div>
<div class="r"><span>Search</span><div><i style="width:55%"></i></div><b>00%</b></div>
<div class="r"><span>Instagram</span><div><i style="width:25%"></i></div><b>00%</b></div>
<div class="r"><span>WhatsApp</span><div><i style="width:15%"></i></div><b>00%</b></div>
<div class="r"><span>Direct</span><div><i style="width:10%"></i></div><b>00%</b></div>
</div>
<div class="fill"></div></div></div>

<!-- 6 INSIGHTS -->
<div><p class="lab">6 &middot; Insights: compare events</p>
<div class="phone">
<div class="top"><div class="ttl"><b>Insights</b><span class="small mute">[Organiser A]</span></div><a class="btn" href="#">Compare</a></div>
<div class="pills"><a href="#">7 days</a><a class="on" href="#">30 days</a><a href="#">90 days</a><a href="#">12 months</a></div>
<div class="card pad">
<div class="sech"><h2 style="font-size:14px">Going, month by month</h2></div>
<svg class="chart" viewBox="0 0 300 96" preserveAspectRatio="none" aria-label="Bar chart placeholder"><g fill="#E0B252"><rect x="6" y="50" width="30" height="46"/><rect x="48" y="40" width="30" height="56"/><rect x="90" y="56" width="30" height="40"/><rect x="132" y="30" width="30" height="66"/><rect x="174" y="36" width="30" height="60"/><rect x="216" y="20" width="30" height="76"/></g><rect x="258" y="26" width="30" height="70" fill="#17684A"/></svg>
<div class="legend"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span style="color:var(--ok);font-weight:700">Nov (booked)</span></div>
</div>
<div class="sech"><h2>By event</h2><span class="m">sorted by going</span></div>
<div class="card list" style="overflow:hidden">
<div class="item"><span class="t"><b>[Weekly social]</b><span class="small mute">000 views &middot; 000 clicks</span></span><span style="text-align:right"><b>000</b><div class="delta up">+0%</div></span></div>
<div class="item"><span class="t"><b>[Monthly party]</b><span class="small mute">000 views &middot; 000 clicks</span></span><span style="text-align:right"><b>000</b><div class="delta dn">-0%</div></span></div>
<div class="item"><span class="t"><b>[Beginner night]</b><span class="small mute">000 views &middot; 000 clicks</span></span><span style="text-align:right"><b>000</b><div class="delta up">+0%</div></span></div>
</div>
<div class="sech"><h2>Best and worst</h2></div>
<div class="tiles">
<div class="card tile"><span class="small mute">Best weekday</span><span class="v" style="font-size:18px">[Friday]</span><span class="small mute">000 avg going</span></div>
<div class="card tile"><span class="small mute">Quietest weekday</span><span class="v" style="font-size:18px">[Tuesday]</span><span class="small mute">000 avg going</span></div>
</div>
<div class="fill"></div>
<nav class="tabs" aria-label="Organiser">
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v17H5zM5 9h14M9 2v4M15 2v4"/></svg>Events</a>
<a class="on" href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>Insights</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9"/></svg>Team</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>More</a>
</nav></div></div>

<!-- 7 GUEST LIST -->
<div><p class="lab">7 &middot; Guests and check-in</p>
<div class="phone">
<div class="top"><a class="btn back" href="#" aria-label="Back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>[Weekly social]</b><span class="small mute">Tonight 20:30</span></div><a class="btn gold" href="#">Scan</a></div>
<div class="card pad" style="display:flex;align-items:center;gap:12px">
<div style="flex:1"><div class="small mute">Checked in</div><div style="font:700 26px 'Sora'">000 <span class="small mute" style="font-weight:400">of 000 going</span></div><div class="bar" style="margin-top:6px"><i style="width:40%"></i></div></div>
</div>
<div class="input" style="background:var(--s1)"><svg class="ic" viewBox="0 0 24 24" style="margin-right:8px;stroke:var(--mute)"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><span class="mute">Search a name</span></div>
<div class="pills"><a class="on" href="#">Everyone</a><a href="#">Not in yet</a><a href="#">Checked in</a></div>
<div class="card list" style="overflow:hidden">
<div class="item" style="min-height:60px"><span class="av" style="background:#E8CBCB">AB</span><span class="t"><b>[First name]</b><span class="small mute">Going &middot; shared profile</span></span><span class="tick on"><svg class="ic" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span></div>
<div class="item" style="min-height:60px"><span class="av" style="background:#CBD6E8">CD</span><span class="t"><b>[First name]</b><span class="small mute">Going &middot; shared profile</span></span><span class="tick"></span></div>
<div class="item" style="min-height:60px"><span class="av" style="background:#D5D0C4">?</span><span class="t"><b>Private guest</b><span class="small mute">Going &middot; chose not to be shown</span></span><span class="tick"></span></div>
<div class="item" style="min-height:60px"><span class="av" style="background:#DCCFE8">EF</span><span class="t"><b>[First name]</b><span class="small mute">Going &middot; shared profile</span></span><span class="tick on"><svg class="ic" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span></div>
</div>
<div class="card pad" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b>Add someone at the door</b><div class="small mute">Not on the list? Add a name; it counts in the total.</div></div><a class="btn sm" href="#">Add</a></div>
<div class="fill"></div></div></div>

<!-- 8 SCAN -->
<div><p class="lab">8 &middot; Scan to check in</p>
<div class="phone" style="background:#1B1915;color:#fff">
<div class="top"><a class="btn back" href="#" aria-label="Back" style="background:#2A2722;border-color:#3A362F;color:#fff"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>Scan</b><span class="small" style="color:#CFC8B8">[Weekly social] &middot; 000 of 000 in</span></div></div>
<div style="aspect-ratio:1/1;border-radius:16px;background:#0E0D0B;position:relative;border:1px solid #3A362F;display:flex;align-items:center;justify-content:center">
<div style="width:62%;height:62%;border:3px solid var(--gold);border-radius:18px"></div>
<span class="small" style="position:absolute;bottom:12px;color:#CFC8B8">Point at the dancer's code</span>
</div>
<div style="border-radius:12px;background:var(--okbg);color:var(--ok);padding:12px;display:flex;align-items:center;gap:10px">
<span class="av" style="background:#E8CBCB">AB</span><div style="flex:1"><b>[First name] checked in</b><div class="small">Just now &middot; tap to undo</div></div>
<svg class="ic" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></div>
<div style="display:flex;gap:8px"><a class="btn" href="#" style="flex:1;background:#2A2722;border-color:#3A362F;color:#fff">Torch</a><a class="btn" href="#" style="flex:1;background:#2A2722;border-color:#3A362F;color:#fff">Use the list instead</a></div>
<div class="fill"></div></div></div>

<!-- 9 SHARE -->
<div><p class="lab">9 &middot; Share card and QR flyer</p>
<div class="phone">
<div class="top"><a class="btn back" href="#" aria-label="Back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>Share</b><span class="small mute">[Weekly social] &middot; [Weekday] 00 Oct</span></div></div>
<div class="seg" style="grid-template-columns:repeat(3,1fr)"><a class="on" href="#">Story</a><a href="#">Square post</a><a href="#">Poster + QR</a></div>
<div class="flyer" style="max-width:260px;align-self:center;width:100%">
<div><div class="small" style="color:#E0B252;font-weight:700;letter-spacing:.08em">[WEEKDAY] 00 OCT</div><div style="font:700 26px/1.1 'Sora';margin-top:6px">[Weekly social]</div><div class="small" style="margin-top:6px;color:#CFC8B8">[Venue] &middot; 20:30</div></div>
<div style="display:flex;align-items:flex-end;justify-content:space-between"><div class="small" style="color:#CFC8B8">bachatacalendar.co.uk</div><div class="qr" style="width:64px;height:64px;border-width:4px;background-size:8px 8px"></div></div>
</div>
<div class="field"><label>Your event's link</label><div class="input" style="justify-content:space-between"><span>bachatacalendar.co.uk/event/[id]</span><b style="color:var(--goldt)">Copy</b></div></div>
<div style="display:flex;gap:8px"><a class="btn gold" href="#" style="flex:1">Share image</a><a class="btn" href="#" style="flex:1">Save to photos</a></div>
<a class="btn full" href="#">Download poster (PDF) with QR</a>
<div class="fill"></div></div></div>

<!-- 10 TEAM -->
<div><p class="lab">10 &middot; Team and roles</p>
<div class="phone">
<div class="top"><div class="ttl"><b>Team</b><span class="small mute">[Organiser A]</span></div><a class="btn gold" href="#">+ Invite</a></div>
<div class="card list" style="overflow:hidden">
<div class="item" style="min-height:64px"><span class="av" style="background:var(--gold)">JD</span><span class="t"><b>[Name] (you)</b><span class="small mute">Does everything, incl. team</span></span><span class="chip ok">Owner</span></div>
<div class="item" style="min-height:64px"><span class="av" style="background:#8FB7E8">AB</span><span class="t"><b>[Name]</b><span class="small mute">Events, guests, stats</span></span><a class="btn sm" href="#">Manager</a></div>
<div class="item" style="min-height:64px"><span class="av" style="background:#C9A6E4">CD</span><span class="t"><b>[Name]</b><span class="small mute">Edits events, no team</span></span><a class="btn sm" href="#">Contributor</a></div>
<div class="item" style="min-height:64px"><span class="av" style="background:#E8CBCB">EF</span><span class="t"><b>[Name]</b><span class="small mute">Check-in at the door only</span></span><a class="btn sm" href="#">Door staff</a></div>
</div>
<div class="sech"><h2>Who can do what</h2></div>
<div class="card pad" style="font-size:12px">
<div style="display:grid;grid-template-columns:1fr repeat(4,44px);gap:6px 4px;align-items:center;text-align:center">
<span></span><b>Owner</b><b>Mgr</b><b>Contr.</b><b>Door</b>
<span style="text-align:left">Change dates</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span class="mute">&ndash;</span>
<span style="text-align:left">Guests, check-in</span><span>&#10003;</span><span>&#10003;</span><span class="mute">&ndash;</span><span>&#10003;</span>
<span style="text-align:left">Stats</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span class="mute">&ndash;</span>
<span style="text-align:left">Team and roles</span><span>&#10003;</span><span class="mute">&ndash;</span><span class="mute">&ndash;</span><span class="mute">&ndash;</span>
</div></div>
<div class="card pad" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b>2 requests to join</b><div class="small mute">Waiting for you</div></div><a class="btn gold sm" href="#">Review</a></div>
<div class="fill"></div>
<nav class="tabs" aria-label="Organiser">
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v17H5zM5 9h14M9 2v4M15 2v4"/></svg>Events</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>Insights</a>
<a class="on" href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9"/></svg>Team</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>More</a>
</nav></div></div>

<!-- 11 REQUESTS -->
<div><p class="lab">11 &middot; Join requests</p>
<div class="phone">
<div class="top"><a class="btn back" href="#" aria-label="Back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>Requests to join</b><span class="small mute">[Organiser A]</span></div></div>
<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
<div style="display:flex;align-items:center;gap:10px"><span class="av" style="background:#8FB7E8">GH</span><div style="flex:1"><b>[Name]</b><div class="small mute">Dancer profile complete &middot; [City] &middot; asked 00 Oct</div></div></div>
<div class="small" style="background:var(--s2);border-radius:8px;padding:8px">&ldquo;[Their message to you]&rdquo;</div>
<div class="field"><label>Let them join as</label><div class="pills"><a class="on" href="#">Manager</a><a href="#">Contributor</a><a href="#">Door staff</a></div></div>
<div style="display:flex;gap:8px"><a class="btn" href="#" style="flex:1;color:var(--bad)">Decline</a><a class="btn gold" href="#" style="flex:1">Accept</a></div>
</div>
<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
<div style="display:flex;align-items:center;gap:10px"><span class="av" style="background:#E8CBCB">IJ</span><div style="flex:1"><b>[Name]</b><div class="small mute">Dancer profile complete &middot; [City] &middot; asked 00 Oct</div></div></div>
<div class="field"><label>Let them join as</label><div class="pills"><a href="#">Manager</a><a class="on" href="#">Contributor</a><a href="#">Door staff</a></div></div>
<div style="display:flex;gap:8px"><a class="btn" href="#" style="flex:1;color:var(--bad)">Decline</a><a class="btn gold" href="#" style="flex:1">Accept</a></div>
</div>
<div class="sech"><h2>Invite by link</h2></div>
<div class="card pad" style="display:flex;flex-direction:column;gap:8px"><div class="small mute">One link, works once, runs out in 7 days. They sign in, add a few profile details, and they are in.</div><a class="btn full" href="#">Create invite link</a></div>
<div class="fill"></div></div></div>

<!-- 12 PUBLIC PAGE -->
<div><p class="lab">12 &middot; Your public page: tap to edit</p>
<div class="phone">
<div class="top"><a class="btn back" href="#" aria-label="Back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>Your public page</b><span class="small mute">Edits go live straight away</span></div><span class="chip ok"><span class="dot"></span>Live</span></div>
<div class="card" style="overflow:hidden">
<div style="height:96px;background:linear-gradient(160deg,#E8DCC0,#E0B252);position:relative"><a class="btn sm" href="#" style="position:absolute;right:8px;top:8px">Change cover</a></div>
<div style="padding:0 12px 12px;margin-top:-28px">
<span class="av" style="width:56px;height:56px;border-radius:14px;background:var(--gold);border:3px solid #fff;font:700 20px 'Sora'">R</span>
<div class="sech" style="margin-top:6px"><h2>[Organiser name]</h2><a href="#">Edit</a></div>
<div class="small mute">[City] &middot; [One-line description]</div>
</div></div>
<div class="card list" style="overflow:hidden">
<div class="kv"><span class="k"><b>About</b><span class="small mute">[Two lines about you]</span></span><a class="cta" href="#">Edit</a></div>
<div class="kv"><span class="k"><b>City</b><span class="small mute">[City]</span></span><a class="cta" href="#">Edit</a></div>
<div class="kv"><span class="k"><b>Links</b><span class="small mute">Instagram, website, WhatsApp</span></span><a class="cta" href="#">Edit</a></div>
<div class="kv"><span class="k"><b>Contact details</b><span class="small mute">Phone: hidden &middot; Email: shown</span></span><a class="cta" href="#">Edit</a></div>
</div>
<div class="sech"><h2>Your events on the page</h2><span class="m">tap one to edit</span></div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
<div class="card" style="padding:8px;display:flex;flex-direction:column;gap:6px"><div style="aspect-ratio:4/3;border-radius:8px;background:#E8DCC0"></div><b class="small">[Weekly social]</b></div>
<div class="card" style="padding:8px;display:flex;flex-direction:column;gap:6px"><div style="aspect-ratio:4/3;border-radius:8px;background:#CBD6E8"></div><b class="small">[Monthly party]</b></div>
<div class="card" style="padding:8px;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;border-style:dashed"><b class="small" style="color:var(--goldt)">+ New</b></div>
</div>
<a class="btn full" href="#">Open as the public sees it</a>
<div class="fill"></div></div></div>

<!-- 13 FIRST STEPS -->
<div><p class="lab">13 &middot; First steps</p>
<div class="phone">
<div class="top"><a class="btn back" href="#" aria-label="Back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a><div class="ttl"><b>First steps</b><span class="small mute">3 of 6 done</span></div></div>
<div class="card pad"><div class="bar"><i style="width:50%"></i></div><div class="small mute" style="margin-top:6px">Organisers with all six get found more often.</div></div>
<div class="card list" style="overflow:hidden">
<div class="item"><span class="tick on"><svg class="ic" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span><span class="t"><b>Finish your dancer profile</b><span class="small mute">Name, city, role, photo</span></span></div>
<div class="item"><span class="tick on"><svg class="ic" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span><span class="t"><b>Add your organiser photo</b></span></div>
<div class="item"><span class="tick on"><svg class="ic" style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span><span class="t"><b>Write two lines about you</b></span></div>
<a class="item" href="#" style="background:#FFF9EA"><span class="tick"></span><span class="t"><b>Add your first event</b><span class="small mute">Takes about two minutes</span></span><span class="cta">Start</span></a>
<a class="item" href="#"><span class="tick"></span><span class="t"><b>Invite a teammate</b><span class="small mute">Share the work</span></span><span class="cta">Invite</span></a>
<a class="item" href="#"><span class="tick"></span><span class="t"><b>Share your first card</b><span class="small mute">Story, post or poster with QR</span></span><span class="cta">Share</span></a>
</div>
<div class="fill"></div></div></div>

<!-- 14 MORE / SETTINGS -->
<div><p class="lab">14 &middot; More: settings and contact</p>
<div class="phone">
<div class="top"><div class="ttl"><b>More</b><span class="small mute">[Organiser A]</span></div></div>
<div class="sech"><h2>Contact details on your page</h2></div>
<div class="card list" style="overflow:hidden">
<div class="kv" style="min-height:64px"><span class="k"><b>Show my phone number</b><span class="small mute">[Number] &middot; visitors can call or WhatsApp</span></span><span class="sw"></span></div>
<div class="kv" style="min-height:64px"><span class="k"><b>Show my email</b><span class="small mute">[Email] &middot; visitors can write to you</span></span><span class="sw on"></span></div>
</div>
<div class="sech"><h2>Guest list</h2></div>
<div class="card list" style="overflow:hidden">
<div class="kv" style="min-height:64px"><span class="k"><b>Show who is going on my events</b><span class="small mute">Dancers still choose whether they appear</span></span><span class="sw on"></span></div>
</div>
<div class="sech"><h2>Account</h2></div>
<div class="card list" style="overflow:hidden">
<a class="kv" href="#" style="color:var(--text)"><span class="k"><b>First steps</b></span><span class="cta">3 of 6</span></a>
<a class="kv" href="#" style="color:var(--text)"><span class="k"><b>My dancer profile</b></span><span class="cta">Open</span></a>
<a class="kv" href="#" style="color:var(--text)"><span class="k"><b>Hand over ownership</b><span class="small mute">Make someone else the owner</span></span><span class="cta">Choose</span></a>
<a class="kv" href="#" style="color:var(--bad)"><span class="k"><b>Leave [Organiser A]</b></span></a>
</div>
<div class="fill"></div>
<nav class="tabs" aria-label="Organiser">
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v17H5zM5 9h14M9 2v4M15 2v4"/></svg>Events</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>Insights</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9"/></svg>Team</a>
<a class="on" href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>More</a>
</nav></div></div>

</div></div>
</body>
</html>
```
