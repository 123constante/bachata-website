# Existing organiser prototype: dashboard (HTML in fence; tile numbers are placeholders)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organiser dashboard mockup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0B0B0C;--s1:#151517;--s2:#1D1D20;--line:#2A2A2E;--text:#F4F1EA;--mute:#A7A29A;--gold:#E0B252;--ok:#7DDBB4;--okbg:#0F2A20;--warn:#F0A35E;--bad:#F08A8A}
*{box-sizing:border-box}
body{margin:0;background:#050506;color:var(--text);font:14px/1.4 'DM Sans',system-ui,sans-serif}
h1,h2,h3{font-family:'Sora',sans-serif;margin:0}
a{color:var(--gold);text-decoration:none}
button{font:inherit;color:inherit;cursor:pointer}
.wrap{max-width:1500px;margin:0 auto;padding:24px 16px 64px}
.intro{max-width:760px;margin:0 0 28px;color:var(--mute)}
.intro h1{color:var(--text);font-size:22px;margin-bottom:6px}
.row{display:flex;flex-wrap:wrap;gap:40px;align-items:flex-start}
.label{font:700 12px 'DM Sans';letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 8px}
.phone{width:390px;background:var(--bg);border:1px solid var(--line);border-radius:22px;overflow:hidden;display:flex;flex-direction:column;gap:12px;padding:12px 12px 0}
.card{background:var(--s1);border:1px solid var(--line);border-radius:12px}
.pad{padding:12px}
.sec{display:flex;flex-direction:column;gap:8px}
.sech{display:flex;align-items:baseline;justify-content:space-between}
.sech h2{font-size:15px;font-weight:600}
.sech a,.sech span{font-size:13px;font-weight:700}
.sech span.m{color:var(--mute);font-weight:400;font-size:12px}
.mute{color:var(--mute)}
.small{font-size:12px}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}
.chip.ok{background:var(--okbg);color:var(--ok)}
.chip.warn{background:#2A1D10;color:var(--warn)}
.chip.bad{background:#2A1414;color:var(--bad)}
.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.btn{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:none;font-size:13px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn.gold{background:var(--gold);border-color:var(--gold);color:#14110A;font-weight:700}
.list>*{border-bottom:1px solid var(--line)}
.list>*:last-child{border-bottom:0}
.item{display:flex;align-items:center;gap:10px;padding:8px 12px;min-height:56px;color:var(--text)}
.item .t{flex:1;min-width:0;display:flex;flex-direction:column}
.item .t b{font-size:14px}
.cta{font-size:13px;font-weight:700;color:var(--gold)}
.pip{width:8px;height:8px;border-radius:50%;flex:none}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tile{padding:12px;display:flex;flex-direction:column;gap:4px}
.tile .v{font:700 22px 'Sora'}
.spark{width:100%;height:22px}
.datebox{width:44px;flex:none;border-radius:8px;background:var(--s2);text-align:center;padding:4px 0}
.datebox i{display:block;font:700 11px 'DM Sans';font-style:normal;color:var(--mute)}
.datebox b{font:700 17px 'Sora'}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ev{padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0;color:var(--text)}
.ev .img{aspect-ratio:4/3;border-radius:8px;display:flex;align-items:flex-end;padding:6px}
.ev .img span{font-size:10px;font-weight:700;background:var(--bg);border-radius:999px;padding:2px 7px}
.ev b{font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.av{width:32px;height:32px;border-radius:50%;border:2px solid var(--s1);margin-right:-8px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#14110A}
.tabs{margin:0 -12px;border-top:1px solid var(--line);background:#101012;display:grid;grid-template-columns:repeat(4,1fr)}
.tabs a{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;font-weight:700;color:var(--mute)}
.tabs a.on{color:var(--gold)}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:var(--gold)}
.seg{display:grid;grid-template-columns:repeat(3,1fr);background:var(--s1);border:1px solid var(--line);border-radius:10px;padding:3px;gap:3px}
.seg a{min-height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-weight:700;font-size:13px;color:var(--mute)}
.seg a.on{background:var(--s2);color:var(--text)}
.kv{display:flex;align-items:center;gap:10px;padding:10px 12px;min-height:52px}
.kv .k{flex:1;display:flex;flex-direction:column}
.kv .k b{font-size:14px}
.bars{display:flex;flex-direction:column;gap:8px;padding:12px}
.bars .r{display:grid;grid-template-columns:92px 1fr 34px;align-items:center;gap:8px;font-size:12px}
.bars .r div{height:8px;border-radius:4px;background:var(--line);overflow:hidden}
.bars .r div i{display:block;height:100%;background:var(--gold)}
/* desktop */
.desk{width:100%;max-width:1320px;background:var(--bg);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-wrap:wrap}
.side{flex:0 0 220px;border-right:1px solid var(--line);background:#101012;padding:16px 12px;display:flex;flex-direction:column;gap:4px;min-width:0}
.side a{min-height:44px;display:flex;align-items:center;gap:10px;padding:0 10px;border-radius:10px;color:var(--mute);font-weight:700;font-size:14px}
.side a.on{background:var(--s2);color:var(--text)}
.main{flex:999 1 640px;min-width:0;padding:20px;display:flex;flex-direction:column;gap:16px}
.cols{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px}
@media (max-width:900px){.cols{grid-template-columns:1fr}}
.tiles4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:700px){.tiles4{grid-template-columns:repeat(2,minmax(0,1fr))}}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:12px;color:var(--mute);font-weight:700;padding:8px 12px;border-bottom:1px solid var(--line)}
td{padding:10px 12px;border-bottom:1px solid var(--line)}
tr:last-child td{border-bottom:0}
.table-scroll{overflow-x:auto}
</style>
</head>
<body>
<div class="wrap">

<div class="intro">
<h1>Organiser dashboard mockup</h1>
<p style="margin:0">Three screens: phone home, one event on a phone, and desktop home. Every block is a screen or data source that already exists in the app. All numbers are placeholders (000) and all names are in [brackets]: nothing here is real or invented data. Black ground and gold accent match the public site.</p>
</div>

<div class="row">

<!-- ============ 1 PHONE HOME ============ -->
<div>
<p class="label">1 &middot; Phone: Home</p>
<div class="phone">

<div style="display:flex;align-items:center;gap:10px;min-height:44px">
<div style="width:36px;height:36px;border-radius:10px;background:var(--gold);color:#14110A;display:flex;align-items:center;justify-content:center;font:700 15px 'Sora'">O</div>
<button style="flex:1;min-height:44px;display:flex;align-items:center;gap:6px;background:none;border:0;text-align:left;padding:0"><span style="font:600 16px 'Sora'">[Organiser name]</span><svg class="ic" style="width:16px;height:16px;stroke:var(--mute)" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
<a class="btn" href="#">Public page <svg class="ic" style="width:14px;height:14px" viewBox="0 0 24 24"><path d="M7 17L17 7M8 7h9v9"/></svg></a>
</div>

<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
<span class="chip ok" style="align-self:flex-start"><span class="dot"></span>Live on Bachata Calendar</span>
<div style="display:flex;align-items:center;gap:10px">
<div style="flex:1;display:flex;flex-direction:column;gap:6px"><span class="mute" style="font-size:13px">Profile: 4 of 5 details done</span><div class="bar"><i style="width:80%"></i></div></div>
<a class="btn gold" href="#">Add contact details</a>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Needs you</h2><span class="m">3 items</span></div>
<div class="card list" style="overflow:hidden">
<a class="item" href="#"><span class="pip" style="background:var(--gold)"></span><span class="t"><b>2 requests to join your team</b><span class="small mute">People asking for access</span></span><span class="cta">Review</span></a>
<a class="item" href="#"><span class="pip" style="background:var(--warn)"></span><span class="t"><b>1 event waiting for review</b><span class="small mute">Sent to the Bachata Calendar team</span></span><span class="cta">View</span></a>
<a class="item" href="#"><span class="pip" style="background:var(--bad)"></span><span class="t"><b>1 date taken off</b><span class="small mute">Check it is still right</span></span><span class="cta">Check</span></a>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Last 30 days</h2><a href="#">See all</a></div>
<div class="tiles">
<div class="card tile"><span class="small mute">Page views</span><span class="v">000</span><span class="small mute">vs previous 30 days: 0%</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 16 L14 12 L28 14 L42 8 L56 10 L70 5 L84 7 L100 3"/></svg></div>
<div class="card tile"><span class="small mute">Link clicks</span><span class="v">000</span><span class="small mute">tickets, maps, socials</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 14 L14 15 L28 10 L42 12 L56 7 L70 9 L84 4 L100 6"/></svg></div>
<div class="card tile"><span class="small mute">Going</span><span class="v">000</span><span class="small mute">people marked attending</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 18 L14 16 L28 13 L42 14 L56 9 L70 8 L84 5 L100 4"/></svg></div>
<div class="card tile"><span class="small mute">Level rating</span><span class="v">0.0</span><span class="small mute">from 00 ratings</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 11 L14 10 L28 11 L42 9 L56 10 L70 9 L84 9 L100 8"/></svg></div>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Next dates</h2><a href="#">All events</a></div>
<div class="card list" style="overflow:hidden">
<div class="item" style="min-height:64px"><div class="datebox"><i>OCT</i><b>00</b></div><span class="t"><b>[Event name]</b><span class="small mute">[Weekday] 00:00 at [Venue]</span></span><button class="btn">Change</button></div>
<div class="item" style="min-height:64px"><div class="datebox"><i>OCT</i><b>00</b></div><span class="t"><b>[Event name]</b><span class="small mute">[Weekday] 00:00 at [Venue]</span></span><button class="btn">Change</button></div>
<div class="item" style="min-height:64px"><div class="datebox"><i>NOV</i><b>00</b></div><span class="t"><b>[Event name]</b><span class="small mute">[Weekday] 00:00 at [Venue]</span></span><button class="btn">Change</button></div>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Your events</h2><a href="#" style="min-height:44px;display:flex;align-items:center">+ New event</a></div>
<div class="grid3">
<a class="card ev" href="#"><div class="img" style="background:#2A2418"><span style="color:var(--ok)">Live</span></div><b>[Weekly social]</b><span class="small mute">Every [weekday]</span></a>
<a class="card ev" href="#"><div class="img" style="background:#1B2230"><span style="color:var(--ok)">Live</span></div><b>[Monthly party]</b><span class="small mute">Monthly</span></a>
<a class="card ev" href="#"><div class="img" style="background:#2A1D1D"><span style="color:var(--warn)">In review</span></div><b>[New class]</b><span class="small mute">Draft</span></a>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Team</h2><a href="#">Manage</a></div>
<div class="card pad" style="display:flex;align-items:center;gap:10px">
<div style="display:flex"><span class="av" style="background:#E0B252">JD</span><span class="av" style="background:#8FB7E8">AB</span><span class="av" style="background:#C9A6E4">CD</span></div>
<span class="small mute" style="flex:1;padding-left:12px;font-size:13px">1 owner, 1 manager, 1 contributor</span>
<button class="btn">Invite</button>
</div>
</div>

<div style="height:4px"></div>
<nav class="tabs" aria-label="Organiser">
<a class="on" href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v17H5zM5 9h14M9 2v4M15 2v4"/></svg>Events</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9"/></svg>Team</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/></svg>Profile</a>
</nav>
</div>
</div>

<!-- ============ 2 PHONE EVENT ============ -->
<div>
<p class="label">2 &middot; Phone: One event</p>
<div class="phone">

<div style="display:flex;align-items:center;gap:8px;min-height:44px">
<a class="btn" href="#" aria-label="Back" style="width:44px;padding:0"><svg class="ic" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></a>
<div style="flex:1;min-width:0"><div style="font:600 16px 'Sora'">[Weekly social]</div><div class="small mute">Every [weekday] at [Venue]</div></div>
<span class="chip ok"><span class="dot"></span>Live</span>
</div>

<div class="seg"><a href="#">Dates</a><a class="on" href="#">Performance</a><a href="#">Details</a></div>

<div class="sec">
<div class="sech"><h2>Last 30 days</h2><span class="m">this event only</span></div>
<div class="tiles">
<div class="card tile"><span class="small mute">Page views</span><span class="v">000</span><span class="small mute">0% vs previous</span></div>
<div class="card tile"><span class="small mute">Link clicks</span><span class="v">000</span><span class="small mute">0% vs previous</span></div>
<div class="card tile"><span class="small mute">Going</span><span class="v">000</span><span class="small mute">next date: 000</span></div>
<div class="card tile"><span class="small mute">Level rating</span><span class="v">0.0</span><span class="small mute">from 00 ratings</span></div>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Where clicks go</h2></div>
<div class="card bars">
<div class="r"><span>Tickets</span><div><i style="width:70%"></i></div><b>000</b></div>
<div class="r"><span>Map</span><div><i style="width:45%"></i></div><b>000</b></div>
<div class="r"><span>Instagram</span><div><i style="width:30%"></i></div><b>000</b></div>
<div class="r"><span>WhatsApp</span><div><i style="width:20%"></i></div><b>000</b></div>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Upcoming dates</h2><a href="#">Add a date</a></div>
<div class="card list" style="overflow:hidden">
<div class="item" style="min-height:64px"><div class="datebox"><i>OCT</i><b>00</b></div><span class="t"><b>[Weekday] 00:00</b><span class="small mute">[Venue] &middot; 000 going</span></span><button class="btn">Change</button></div>
<div class="item" style="min-height:64px"><div class="datebox"><i>OCT</i><b>00</b></div><span class="t"><b>[Weekday] 00:00</b><span class="small mute">[Venue] &middot; 000 going</span></span><button class="btn">Change</button></div>
<div class="item" style="min-height:64px"><div class="datebox" style="opacity:.6"><i>NOV</i><b>00</b></div><span class="t"><b>[Weekday] 00:00</b><span class="chip bad" style="align-self:flex-start;margin-top:2px">Taken off</span></span><button class="btn">Put back</button></div>
</div>
</div>

<div class="sec">
<div class="sech"><h2>Event details</h2><a href="#">Edit</a></div>
<div class="card list" style="overflow:hidden">
<div class="kv"><span class="k"><b>Flyer</b><span class="small mute">Shown on the event page</span></span><span class="chip ok">Added</span></div>
<div class="kv"><span class="k"><b>Venue</b><span class="small mute">[Venue], [City]</span></span><span class="chip ok">Set</span></div>
<div class="kv"><span class="k"><b>Lineup</b><span class="small mute">Teachers and DJs</span></span><a class="cta" href="#">Add</a></div>
<div class="kv"><span class="k"><b>Links</b><span class="small mute">Tickets, socials</span></span><span class="chip ok">2 added</span></div>
</div>
</div>

<div style="display:flex;gap:8px"><a class="btn" href="#" style="flex:1">View public page</a><a class="btn gold" href="#" style="flex:1">Edit event</a></div>
<div style="height:8px"></div>
</div>
</div>

</div><!-- row -->

<!-- ============ 3 DESKTOP ============ -->
<div style="margin-top:40px">
<p class="label">3 &middot; Desktop: Home</p>
<div class="desk">
<aside class="side" aria-label="Organiser">
<div style="display:flex;align-items:center;gap:10px;padding:4px 6px 14px">
<div style="width:36px;height:36px;border-radius:10px;background:var(--gold);color:#14110A;display:flex;align-items:center;justify-content:center;font:700 15px 'Sora'">O</div>
<div style="min-width:0"><div style="font:600 14px 'Sora'">[Organiser name]</div><a class="small" href="#">Switch organiser</a></div>
</div>
<a class="on" href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Home</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M5 4h14v17H5zM5 9h14M9 2v4M15 2v4"/></svg>Events</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M3 3v18h18M7 15l4-4 3 3 5-6"/></svg>Performance</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9"/></svg>Team <span class="chip warn" style="margin-left:auto;padding:1px 8px">2</span></a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/></svg>Profile</a>
<a href="#"><svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 7l8 6 8-6"/></svg>Contact details</a>
</aside>

<div class="main">
<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px">
<div style="flex:1;min-width:240px"><h1 style="font-size:22px">Home</h1><div class="small mute">[Organiser name] &middot; <span class="chip ok" style="padding:1px 8px"><span class="dot"></span>Live on Bachata Calendar</span></div></div>
<a class="btn" href="#">View public page</a><a class="btn gold" href="#">+ New event</a>
</div>

<div class="card list" style="overflow:hidden">
<a class="item" href="#"><span class="pip" style="background:var(--gold)"></span><span class="t"><b>2 requests to join your team</b><span class="small mute">People asking for access</span></span><span class="cta">Review</span></a>
<a class="item" href="#"><span class="pip" style="background:var(--warn)"></span><span class="t"><b>1 event waiting for review</b><span class="small mute">Sent to the Bachata Calendar team</span></span><span class="cta">View</span></a>
<a class="item" href="#"><span class="pip" style="background:var(--bad)"></span><span class="t"><b>1 date taken off</b><span class="small mute">Check it is still right</span></span><span class="cta">Check</span></a>
</div>

<div class="tiles4">
<div class="card tile"><span class="small mute">Page views, 30 days</span><span class="v">000</span><span class="small mute">0% vs previous</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 16 L14 12 L28 14 L42 8 L56 10 L70 5 L84 7 L100 3"/></svg></div>
<div class="card tile"><span class="small mute">Link clicks</span><span class="v">000</span><span class="small mute">tickets, maps, socials</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 14 L14 15 L28 10 L42 12 L56 7 L70 9 L84 4 L100 6"/></svg></div>
<div class="card tile"><span class="small mute">Going</span><span class="v">000</span><span class="small mute">people marked attending</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 18 L14 16 L28 13 L42 14 L56 9 L70 8 L84 5 L100 4"/></svg></div>
<div class="card tile"><span class="small mute">Level rating</span><span class="v">0.0</span><span class="small mute">from 00 ratings</span><svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" fill="none" stroke="#E0B252" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 11 L14 10 L28 11 L42 9 L56 10 L70 9 L84 9 L100 8"/></svg></div>
</div>

<div class="cols">
<div class="sec">
<div class="sech"><h2>Next dates</h2><a href="#">All events</a></div>
<div class="card table-scroll">
<table>
<thead><tr><th>Date</th><th>Event</th><th>Venue</th><th>Going</th><th>Status</th><th></th></tr></thead>
<tbody>
<tr><td><b>[Wkd] 00 Oct</b></td><td>[Weekly social]</td><td>[Venue]</td><td>000</td><td><span class="chip ok">Live</span></td><td><button class="btn" style="min-height:36px">Change</button></td></tr>
<tr><td><b>[Wkd] 00 Oct</b></td><td>[Monthly party]</td><td>[Venue]</td><td>000</td><td><span class="chip ok">Live</span></td><td><button class="btn" style="min-height:36px">Change</button></td></tr>
<tr><td><b>[Wkd] 00 Nov</b></td><td>[Weekly social]</td><td>[Venue]</td><td>000</td><td><span class="chip bad">Taken off</span></td><td><button class="btn" style="min-height:36px">Put back</button></td></tr>
<tr><td><b>[Wkd] 00 Nov</b></td><td>[New class]</td><td>[Venue]</td><td>&mdash;</td><td><span class="chip warn">In review</span></td><td><button class="btn" style="min-height:36px">View</button></td></tr>
</tbody>
</table>
</div>

<div class="sech" style="margin-top:8px"><h2>Your events</h2><a href="#">+ New event</a></div>
<div class="grid3" style="grid-template-columns:repeat(4,minmax(0,1fr))">
<a class="card ev" href="#"><div class="img" style="background:#2A2418"><span style="color:var(--ok)">Live</span></div><b>[Weekly social]</b><span class="small mute">Every [weekday]</span></a>
<a class="card ev" href="#"><div class="img" style="background:#1B2230"><span style="color:var(--ok)">Live</span></div><b>[Monthly party]</b><span class="small mute">Monthly</span></a>
<a class="card ev" href="#"><div class="img" style="background:#2A1D1D"><span style="color:var(--warn)">In review</span></div><b>[New class]</b><span class="small mute">Draft</span></a>
<a class="card ev" href="#" style="align-items:center;justify-content:center;min-height:120px;border-style:dashed"><b style="color:var(--gold)">+ New event</b></a>
</div>
</div>

<div style="display:flex;flex-direction:column;gap:16px">
<div class="sec">
<div class="sech"><h2>Profile</h2><a href="#">Edit</a></div>
<div class="card pad" style="display:flex;flex-direction:column;gap:10px">
<span class="small mute">4 of 5 details done</span><div class="bar"><i style="width:80%"></i></div>
<a class="btn gold" href="#">Add contact details</a>
</div>
</div>
<div class="sec">
<div class="sech"><h2>Team</h2><a href="#">Manage</a></div>
<div class="card list" style="overflow:hidden">
<div class="item"><span class="av" style="background:#E0B252;margin:0">JD</span><span class="t"><b>[Name]</b><span class="small mute">Owner</span></span></div>
<div class="item"><span class="av" style="background:#8FB7E8;margin:0">AB</span><span class="t"><b>[Name]</b><span class="small mute">Manager</span></span></div>
<div class="item"><span class="av" style="background:#C9A6E4;margin:0">CD</span><span class="t"><b>[Name]</b><span class="small mute">Contributor</span></span></div>
<div class="item" style="min-height:52px"><button class="btn" style="flex:1">Invite someone</button></div>
</div>
</div>
</div>
</div>

</div>
</div>
</div>

</div>
</body>
</html>
```
