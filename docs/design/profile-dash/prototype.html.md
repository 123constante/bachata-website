<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>
<title>Organiser Area Prototype</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: control strip, one 390x844 phone frame, caption. Structure A: role-coloured identity strip + page switcher.
   Organiser tabs: Home (to do), Events, Tickets, Stats, Team (+ Scan when placement = tab). */
:root{
  --bg:#f3f1ee; --fg:#1d1f24; --muted:#5d6068; --card:#ffffff; --line:#dedad4; --ink-soft:#ebe8e3; --bar:#1f5c7a;
  --danger:#b3261e; --on-danger:#ffffff; --ok:#1b6b3a;
  --c-org:#1f5c7a; --c-teacher:#8a5a00; --c-dj:#5b3fa0; --c-dancer:#b02a5b;
  --f-display:'Bricolage Grotesque','Segoe UI',sans-serif; --f-body:'DM Sans','Segoe UI',sans-serif;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#14161a; --fg:#eceae6; --muted:#a5a8b0; --card:#1e2127; --line:#32363e; --ink-soft:#262a31; --bar:#6fb3d6;
  --danger:#ff8a80; --on-danger:#14161a; --ok:#7fd6a0;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#14161a; --fg:#eceae6; --muted:#a5a8b0; --card:#1e2127; --line:#32363e; --ink-soft:#262a31; --bar:#6fb3d6;
  --danger:#ff8a80; --on-danger:#14161a; --ok:#7fd6a0;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--f-body);padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px));padding-block:16px}
*{box-sizing:border-box}
button{font:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0;text-align:left}
button:focus-visible{outline:3px solid var(--fg);outline-offset:2px}
.wrap{max-width:430px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
h1{font:700 20px var(--f-display);margin:0}
.ctl{display:flex;flex-direction:column;gap:8px}
.seg{display:flex;flex-wrap:wrap;gap:4px;background:var(--ink-soft);padding:3px;border-radius:10px}
.seg button{flex:1 1 30%;text-align:center;padding:9px 4px;border-radius:8px;font-size:13px;font-weight:600;min-height:44px}
.seg button[aria-pressed=true]{background:var(--fg);color:var(--bg)}
.lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.frame{width:min(390px,100%);height:844px;flex:none;margin:0 auto;background:var(--bg);border:1px solid var(--line);border-radius:28px;overflow:hidden;display:flex;flex-direction:column;position:relative}
#screen{flex:1;min-height:0;display:flex;flex-direction:column}
.scroll{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.cap{font-size:13px;color:var(--muted);line-height:1.5;margin:0}
.cap b{color:var(--fg)}
.r-org{--rc:var(--c-org)}.r-teacher{--rc:var(--c-teacher)}.r-dj{--rc:var(--c-dj)}.r-dancer{--rc:var(--c-dancer)}
.badge{width:var(--s,36px);height:var(--s,36px);border-radius:10px;background:var(--rc);color:#fff;display:inline-grid;place-items:center;font:700 14px var(--f-display);flex:none}
.idbar{display:flex;align-items:center;gap:8px;width:100%;background:var(--rc);color:#fff;padding:12px 16px;min-height:64px}
.idbar .badge{background:rgba(0,0,0,.22)}
.idmain{display:flex;align-items:center;gap:12px;flex:1;min-width:0;min-height:44px;color:#fff}
.idtxt{display:flex;flex-direction:column;min-width:0;flex:1}
.idtxt small{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.idtxt b{font:700 17px var(--f-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sw{font-size:13px;font-weight:600;color:#fff;background:rgba(0,0,0,.2);padding:0 12px;min-height:44px;border-radius:999px;white-space:nowrap;flex:none}
.sw.scan{background:#fff;color:var(--rc);font-weight:700}.sw+.sw{margin-left:4px}
.inp{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:0 14px;background:var(--card);color:var(--fg);font:inherit}
.tabs{display:flex;border-top:1px solid var(--line);background:var(--card)}
.tabs button{flex:1;text-align:center;padding:12px 2px 14px;font-size:13px;font-weight:600;color:var(--muted);border-top:3px solid transparent;margin-top:-1px;min-height:48px}
.tabs button[aria-current=true]{color:var(--fg);border-top-color:var(--fg)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px}
.row{display:flex;align-items:center;gap:12px;padding:12px 14px;width:100%;min-height:56px}
.row+.row{border-top:1px solid var(--line)}
.row .t{display:flex;flex-direction:column;flex:1;min-width:0}
.row .t b{font-size:15px}.row .t span{font-size:13px;color:var(--muted);line-height:1.4}
.evrow{padding:0;gap:0}
.evrow .main{display:flex;align-items:center;gap:12px;padding:12px 14px;flex:1;min-width:0;min-height:56px}
.menub{width:48px;min-height:56px;font-size:22px;text-align:center;flex:none;font-weight:700}
.tag{font-size:12px;font-weight:600;border:1px solid var(--line);border-radius:999px;padding:3px 9px;color:var(--muted);white-space:nowrap}
h2{font:700 22px var(--f-display);margin:0}
h3{font:600 12px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:4px 0 0}
.btn{background:var(--fg);color:var(--bg);font-weight:600;border-radius:12px;padding:14px 16px;text-align:center;min-height:48px;width:100%}
.btn.alt{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn.dng{background:var(--danger);color:var(--on-danger)}
.btn[disabled]{opacity:.55;cursor:not-allowed}
.act{background:var(--fg);color:var(--bg);font-weight:600;font-size:13px;border-radius:999px;padding:0 14px;min-height:44px;white-space:nowrap;flex:none}
.banner{border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.45;background:var(--ink-soft);border:1px solid var(--line)}
.soon .t b{color:var(--muted);font-weight:500}.soon .t span{color:var(--muted)}
.danger{color:var(--danger);font-weight:700}
.qa{display:flex;gap:8px}
.qa button{flex:1;min-height:48px;border:1px solid var(--line);background:var(--card);border-radius:12px;font-weight:600;font-size:14px;text-align:center;padding:0 8px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{min-height:44px;border:1px solid var(--line);border-radius:999px;padding:0 14px;font-weight:600;font-size:14px;background:var(--card)}
.chip[aria-pressed=true]{background:var(--fg);color:var(--bg)}
.sheetbg{position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end}
.sheet{background:var(--bg);width:100%;max-height:82%;overflow-y:auto;border-radius:20px 20px 0 0;padding:16px;display:flex;flex-direction:column;gap:10px}
.sheet .x{align-self:flex-end;font-weight:600;font-size:14px;padding:8px 4px;min-height:44px;min-width:44px}
.head{padding:28px 16px 12px;display:flex;flex-direction:column;gap:8px}
.back{font-weight:600;font-size:14px;min-height:44px;display:flex;align-items:center;gap:6px;padding:0 4px;align-self:flex-start}
.linkrow{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.linkrow b{color:var(--fg);font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sm{font-size:13px;font-weight:600;border:0;background:none;text-decoration:underline;color:var(--fg);padding:0 10px;min-height:44px;margin:-14px -10px -14px 0}
.big{font:700 44px/1 var(--f-display);font-variant-numeric:tabular-nums}
.stat{padding:16px;display:flex;flex-direction:column;gap:6px}
.stat small{font-size:13px;color:var(--muted)}
.bars{display:flex;align-items:flex-end;gap:8px;height:130px;padding:8px 16px 12px}
.bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%}
.bar i{display:block;width:100%;background:var(--bar);border-radius:4px 4px 0 0}
.bv{font-size:11px;font-variant-numeric:tabular-nums}.bl{font-size:11px;color:var(--muted)}
.src{padding:10px 14px;display:flex;flex-direction:column;gap:6px}
.src .l{display:flex;justify-content:space-between;font-size:14px}
.src .tr{height:8px;background:var(--ink-soft);border-radius:4px;overflow:hidden}
.src .tr i{display:block;height:100%;background:var(--bar)}
.scanbox{border:2px dashed var(--line);border-radius:16px;height:190px;display:grid;place-items:center;text-align:center;padding:16px;color:var(--muted);font-size:14px}
.res{border-radius:14px;padding:18px 16px;text-align:center;border:2px solid var(--fg);display:flex;flex-direction:column;gap:6px}
.res b{font:700 26px var(--f-display)}
.res.ok b{color:var(--ok)}.res.bad b{color:var(--danger)}
.toast{position:absolute;left:16px;right:16px;bottom:76px;background:var(--fg);color:var(--bg);padding:12px 14px;border-radius:12px;font-size:14px;font-weight:600;text-align:center}
@media (prefers-reduced-motion:no-preference){.sheet{animation:up .18s ease-out}@keyframes up{from{transform:translateY(24px);opacity:.6}}}
</style>
<div class="wrap">
  <h1>Organiser area prototype</h1>
  <div class="ctl">
    <span class="lbl">Who is signed in</span>
    <div class="seg" id="pseg"></div>
    <span class="lbl">Scanner placement</span>
    <div class="seg" id="sseg"></div>
    <span class="lbl">Day</span>
    <div class="seg" id="dseg"></div>
    <button class="btn alt" data-act="restart">Restart from sign-in</button>
  </div>
  <div class="frame" id="frame"><div id="screen"></div></div>
  <p class="cap"><b>Structure A.</b> Five tabs: Home (to do), Events, Tickets, Stats, Team. Cancel is the ... menu on each event row, with a confirm step. Try the scanner in each placement on <b>Event day</b> as Ritmo London. Try <b>Door</b> to see a door person's view. Numbers, names and the link address are examples. Judge: where would you reach for the scanner at 8pm with a queue, and does the door person ever see the organiser area?</p>
</div>
<script>
const ROLES={org:{n:'Organiser',ic:'ORG'},teacher:{n:'Teacher',ic:'TCH'},dj:{n:'DJ',ic:'DJ'},dancer:{n:'Dancer',ic:'DNC'}};
const ORDER=['org','teacher','dj','dancer'];
const DOOR={ev:'Friday Social',org:'Ritmo London'};
const PERSONAS={
  three:{n:'3 roles',pages:[
    {id:'o1',role:'org',name:'Ritmo London',seat:'Owner'},
    {id:'o2',role:'org',name:'Bristol Socials',seat:'Manager'},
    {id:'t1',role:'teacher',name:'Ricky Constante'},
    {id:'j1',role:'dj',name:'DJ Ricky'},
    {id:'n1',role:'dancer',name:'Ricky Constante'}]},
  one:{n:'1 role',pages:[{id:'o1',role:'org',name:'Ritmo London',seat:'Owner'}]},
  clear:{n:'Caught up',pages:[{id:'o4',role:'org',name:'Casa Bachata',seat:'Owner'}]},
  draft:{n:'Unfinished',pages:[
    {id:'o3',role:'org',name:'Salsa Nights',seat:'Claim pending',state:'pending'},
    {id:'n2',role:'dancer',name:'Ricky Constante',state:'unfinished',door:DOOR}]},
  door:{n:'Door person',pages:[{id:'n3',role:'dancer',name:'Sam Okoye',door:DOOR}]}
};
const PLACES={home:'Home + event',strip:'Top strip',tab:'Sixth tab'};
const DAYS={normal:'Normal day',event:'Event day'};
const TABS={org:[['home','Home'],['events','Events'],['tickets','Tickets'],['stats','Stats'],['team','Team']],
 teacher:[['home','Home'],['classes','Classes'],['bookings','Bookings']],
 dj:[['home','Home'],['sets','Sets'],['profile','Profile']],
 dancer:[['home','Home'],['going','Going'],['profile','Profile']]};
function tabsFor(p){
  if(p.role==='org'&&S.place==='tab'&&canScan(p)){const t=TABS.org.slice();t.splice(3,0,['scan','Scan']);return t}
  return TABS[p.role];
}
const ITEMS={
 'teacher.home':[['Beginner Monday','Mon 7pm, 9 booked'],['Sensual Basics','Wed 8pm, 6 booked']],
 'teacher.classes':[['Beginner Monday','Weekly, Hackney'],['Sensual Basics','Weekly, Camden']],
 'teacher.bookings':[['Ana Lopez','Beginner Monday'],['Tom Reed','Sensual Basics']],
 'dj.home':[['Friday Social','Sets this month: 3']],
 'dj.sets':[['Friday Social','Fri 14 Nov, 10pm'],['Summer Weekender','Sat 7 Feb']],
 'dj.profile':[['Mixes','2 linked'],['Genres','Sensual, Dominican']],
 'dancer.home':[['Going','2 events'],['Saved','5 events']],
 'dancer.going':[['Friday Social','Fri 14 Nov'],['Summer Weekender','Sat 7 Feb']],
 'dancer.profile':[['Home city','London'],['Dancing since','2016']]
};
const LINKS={o1:'bc.link/ritmo',o2:'bc.link/bristol',o4:'bc.link/casa'};
const EVENTS={
 o1:[{n:'Friday Social',w:'Fri 14 Nov, 8pm',s:'Published',m:'Sensual bachata',go:62,tk:41,cap:80,rev:410,today:1,l:'bc.link/ritmo/friday'},
     {n:'Sunday Workshop',w:'Sun 16 Nov, 3pm',s:'Published',m:'',go:18,tk:12,cap:30,rev:180,l:'bc.link/ritmo/sunday'},
     {n:'Summer Weekender',w:'No date yet',s:'Draft',m:'',go:0,tk:0,cap:0,rev:0}],
 o2:[{n:'Bristol Salsa Night',w:'Sat 15 Nov, 9pm',s:'Published',m:'',go:34,tk:0,cap:0,rev:0,l:'bc.link/bristol/salsa'},
     {n:'Bristol Bachata Brunch',w:'Sun 23 Nov, 11am',s:'Draft',m:'',go:0,tk:0,cap:0,rev:0}],
 o4:[]
};
const TIX={o1:{on:true,base:{n:1,amt:10}},o2:{on:false},o4:{on:false}};
const TEAM={o1:[['You','Owner'],['Maya','Manager'],['Jan','Asked to join']],o2:[['You','Manager'],['Jan','Owner']],o4:[['You','Owner']]};
const TODOS={
 o1:[
  {g:'Today',t:'Finish Summer Weekender',d:'It is a draft. It still needs a date and a venue.',b:'Finish',a:'event:2'},
  {g:'This week',t:'Share Friday Social',d:'3 days away. Your link was opened 248 times in the last 7 days.',b:'Copy link',a:'copy',pre:1},
  {g:'This week',t:'Add a music style to Sunday Workshop',d:'Dancers can find events by music style.',b:'Add',a:'event:1',mus:1},
  {g:'This week',t:'DJ Marco has not accepted for Friday Social',d:'Asked 4 days ago.',b:'Remind',a:'stub'},
  {g:'This week',t:'Jan asked to join your team',d:'Open the request on the Team tab to answer it.',b:'Review',a:'tab:team',jan:1},
  {g:'Later',t:'Monday class runs out of dates',d:'There are no dates after 24 Nov.',b:'Add dates',a:'stub'}],
 o2:[
  {g:'Today',t:'Bristol Bachata Brunch has no location',d:'Open it to add a venue.',b:'Fix',a:'event:1'},
  {g:'This week',t:'Add a music style to Bristol Salsa Night',d:'Dancers can find events by music style.',b:'Add',a:'event:0',mus:1},
  {g:'This week',t:'Share Bristol Salsa Night',d:'Saturday. Your link was opened 96 times in the last 7 days.',b:'Copy link',a:'copy'},
  {g:'Later',t:'Connect payouts to sell tickets',d:'Set up once, about 5 minutes.',b:'Set up',a:'tab:tickets'},
  {g:'Later',t:'Add a profile photo',d:'Pages with a photo get more opens.',b:'Add photo',a:'stub'}],
 o4:[]
};
const SOON=[
 ['Raffle','Donate tickets and draw winners at the door.'],
 ['Guest list','See who is coming and check them in at the door.']];
const STATS={
 o1:{opens:{7:248,30:910,all:3420},going:{7:61,30:224,all:801},delta:'+18% on the 7 days before',
  src:[['Instagram',54],['WhatsApp',31],['Search',9],['Direct',6]],
  bars:{7:[['Mon',22],['Tue',31],['Wed',28],['Thu',40],['Fri',52],['Sat',44],['Sun',31]],30:[['Wk 1',190],['Wk 2',226],['Wk 3',246],['Wk 4',248]],all:[['Aug',410],['Sep',820],['Oct',1230],['Nov',960]]}},
 o2:{opens:{7:96,30:340,all:1210},going:{7:22,30:80,all:276},delta:'+4% on the 7 days before',
  src:[['WhatsApp',48],['Instagram',36],['Search',10],['Direct',6]],
  bars:{7:[['Mon',9],['Tue',12],['Wed',10],['Thu',16],['Fri',21],['Sat',18],['Sun',10]],30:[['Wk 1',70],['Wk 2',84],['Wk 3',90],['Wk 4',96]],all:[['Aug',120],['Sep',310],['Oct',480],['Nov',300]]}}
};
const REASONS=['Venue problem','Low numbers','Weather or travel','Something else'];
const S={p:'three',screen:'signin',page:null,tab:'home',sheet:false,detail:null,event:null,scan:false,door:null,modal:null,reason:null,cx:{},period:'7',evFrom:null,from:null,place:'home',day:'normal',scanRes:null,scanIn:{},doorList:{'o1:0':['Sam Okoye']},music:{},mpick:null,jan:null,scanEv:0,q:''};
const $=s=>document.querySelector(s);
const pages=()=>PERSONAS[S.p].pages;
const badge=(r,sz)=>`<span class="badge r-${r}" style="--s:${sz||36}px">${ROLES[r].ic}</span>`;
const sub=p=>p.seat||ROLES[p.role].n;
const key=(p,i)=>p.id+':'+i;
const evW=e=>S.day==='event'&&e.today?'Today, 8pm':e.w;
const isGone=(p,i)=>!!S.cx[key(p,i)];
const liveIdx=p=>(EVENTS[p.id]||[]).map((e,i)=>i).filter(i=>!isGone(p,i));
const canScan=p=>p.role==='org'&&liveIdx(p).some(i=>EVENTS[p.id][i].tk>0);
const scanDefault=p=>{const l=liveIdx(p).filter(i=>EVENTS[p.id][i].tk>0);const t=l.find(i=>EVENTS[p.id][i].today);return t!==undefined?t:l[0]};
const mus=(p,i)=>S.music[key(p,i)]||EVENTS[p.id][i].m;
const inCount=(p,i)=>{const v=S.scanIn[key(p,i)];return v!==undefined?v:(S.day==='event'&&EVENTS[p.id][i].today?37:0)};
const doorOf=(p,i)=>S.doorList[key(p,i)]||(S.doorList[key(p,i)]=[]);

function resetNav(){S.detail=null;S.event=null;S.scan=false;S.door=null;S.modal=null;S.reason=null;S.evFrom=null}
function restart(){S.from=null;S.screen='signin';S.page=null;S.tab='home';S.sheet=false;S.period='7';S.scanRes=null;S.cx={};S.scanIn={};S.doorList={'o1:0':['Sam Okoye']};S.music={};S.jan=null;S.q='';resetNav();clearTimeout(tt);const o=document.querySelector('.toast');if(o)o.remove();render()}
var tt;
function showToast(m){clearTimeout(tt);let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');$('#frame').appendChild(el)}el.textContent=m;tt=setTimeout(()=>el.remove(),1800)}
function copyLink(l){l=l||LINKS[S.page.id];try{navigator.clipboard&&navigator.clipboard.writeText(l).catch(()=>{})}catch(x){}showToast('Link copied: '+l)}
function backToPage(){return S.page?`<button class="back" data-act="open" data-id="${S.page.id}" style="padding:12px 16px 0">&lsaquo; Back to ${S.page.name}</button>`:''}
function detailBody(d){
  return `<button class="back" data-act="bback">&lsaquo; Back</button><h2>${d.item}</h2><div class="card"><div class="row"><span class="t"><b>Page</b><span>${ROLES[d.role].n}: ${d.page}</span></span></div><div class="row"><span class="t"><b>Details</b><span>${d.sub||'Edit the fields here'}</span></span></div></div>${d.sub==='Asked to join'?'<button class="btn" data-act="jan" data-k="yes">Add as manager</button><button class="btn alt" data-act="jan" data-k="no">Decline</button>':'<button class="btn" data-act="save">Save</button>'}`;
}
function addPage(){
  return `<button class="back" data-act="addback" style="padding:12px 16px 0">&lsaquo; Back</button><div class="head" style="padding-top:8px"><h2>Add a page</h2><p class="cap">Pick what you want to add. You can hold any mix.</p></div><div class="scroll"><div class="card">${ORDER.map(r=>`<button class="row" data-act="addrole" data-r="${r}">${badge(r)}<span class="t"><b>${ROLES[r].n} page</b><span>Start here</span></span><span aria-hidden="true">&rsaquo;</span></button>`).join('')}</div></div>`;
}
function signin(){
  return `<div class="head"><h2>Bachata Calendar</h2><p class="cap">Sign in to manage your pages.</p></div>
  <div class="scroll"><button class="btn" data-act="signin">Continue with email link</button><p class="cap">Prototype: tap to sign in as the person chosen above.</p></div>`;
}
function pageRow(p){
  const st=p.state==='pending'?'Claim pending':p.state==='unfinished'?'Finish profile':'';
  return `<button class="row" data-act="open" data-id="${p.id}">${badge(p.role)}<span class="t"><b>${p.name}</b><span>${ROLES[p.role].n}${p.seat?' - '+p.seat:''}</span></span>${st?`<span class="tag">${st}</span>`:'<span aria-hidden="true">&rsaquo;</span>'}</button>`;
}
function chooser(){
  const P=pages();
  return `${backToPage()}<div class="head"><h2>Your pages</h2><p class="cap">Pick one to manage. Switch any time from the top strip.</p></div><div class="scroll">
  ${ORDER.map(r=>{const g=P.filter(p=>p.role===r);return g.length?`<h3>${ROLES[r].n}${g.length>1?' pages':''}</h3><div class="card">${g.map(pageRow).join('')}</div>`:''}).join('')}
  <button class="btn alt" data-act="add">Add another page</button></div>`;
}
function idbar(p){
  const hasScan=S.place==='strip'&&canScan(p)&&!S.scan;
  const P=pages(),label=ROLES[p.role].n+(p.seat&&!hasScan?' - '+p.seat:'');
  const scan=hasScan?`<button class="sw scan" data-act="scan" aria-label="Scan tickets">Scan</button>`:'';
  return `<div class="idbar r-${p.role}"><button class="idmain" data-act="sheet" aria-label="${label}, ${p.name}. Switch page"><span class="badge r-${p.role}" style="--s:40px">${ROLES[p.role].ic}</span><span class="idtxt"><small>${label}</small><b>${p.name}</b></span></button>${scan}<button class="sw" data-act="sheet" aria-label="Switch page">${P.length>1?'Switch':'Account'} &#9662;</button></div>`;
}
function linkRow(p){
  return `<div class="linkrow"><span>Your link</span><b>${LINKS[p.id]}</b><button class="sm" data-act="copy">Copy</button></div>`;
}
function soonRows(){
  return `<h3>Coming soon</h3><div class="card">${SOON.map(s=>`<div class="row soon"><span class="t"><b>${s[0]}</b><span>${s[1]}</span></span><span class="tag">Coming soon</span></div>`).join('')}</div>`;
}
function home(p){
  const T=(TODOS[p.id]||[]).filter(x=>{
    if(x.pre&&S.day==='event')return false;
    if(x.jan&&S.jan)return false;
    if((EVENTS[p.id]||[]).some((e,i)=>isGone(p,i)&&x.t.includes(e.n)))return false;
    if(x.mus&&x.a.startsWith('event:')&&mus(p,+x.a.slice(6)))return false;
    return true});
  const ev=liveIdx(p).map(i=>EVENTS[p.id][i]);
  let h=`<h2>To do</h2>`;
  const si=scanDefault(p);
  if(S.day==='event'&&S.place==='home'&&si!==undefined&&EVENTS[p.id][si].today){const se=EVENTS[p.id][si];h+=`<h3>Tonight</h3><div class="card"><div class="row"><span class="t"><b>${se.n} is tonight</b><span>Doors 8pm. ${se.tk} tickets sold, ${inCount(p,si)} scanned in.</span></span><button class="act" data-act="scan" data-i="${si}">Open scanner</button></div></div>`}
  h+=`<div class="qa"><button data-act="stub" data-i="New event">New event</button>${ev.length?`<button data-act="stub" data-i="Make a copy of ${ev[0].n}" data-s="Copies the title, venue, price and description. You pick a new date.">Make a copy</button>`:''}</div>`;
  if(!T.length)h+=`<div class="banner">You are all caught up. Nothing needs you right now.</div>`;
  else{
    h+=`<p class="cap">${T.length} thing${T.length>1?'s':''} waiting for you, soonest first.</p>`;
    ['Today','This week','Later'].forEach(g=>{
      const it=T.filter(x=>x.g===g);
      if(it.length)h+=`<h3>${g}</h3><div class="card">${it.map(x=>`<div class="row"><span class="t"><b>${x.t}</b><span>${x.d}</span></span><button class="act" data-act="todo" data-a="${x.a}" data-i="${x.t}" data-s="${x.d}">${x.b}</button></div>`).join('')}</div>`;
    });
  }
  return h+soonRows();
}
function eventsTab(p){
  const E=EVENTS[p.id]||[];
  return `<h2>Events</h2>`+(E.length?`<div class="card">${E.map((e,i)=>{const st=S.cx[key(p,i)]||e.s;if(st==='Deleted')return '';return `<div class="row evrow"><button class="main" data-act="event" data-i="${i}"><span class="t"><b>${e.n}</b><span>${evW(e)}</span></span><span class="tag">${st}</span></button><button class="menub" data-act="menu" data-i="${i}" aria-label="Options for ${e.n}">&#8943;</button></div>`}).join('')}</div>`:`<div class="banner">No events yet. Make your first one and it appears here.</div>`)+`<button class="btn" data-act="stub" data-i="New event">New event</button>`;
}
function eventDetail(p,e,i){
  const st=S.cx[key(p,i)]||e.s,gone=!!S.cx[key(p,i)];
  return `<button class="back" data-act="bback">&lsaquo; ${({home:'To do',tickets:'Tickets',events:'Events'})[S.evFrom]||'Events'}</button><h2>${e.n}</h2><p class="cap">${evW(e)} - ${st}</p>
  ${gone?`<div class="banner">This event is ${st.toLowerCase()}.</div><button class="btn alt" data-act="stub" data-i="Make a copy of ${e.n}" data-s="Copies the title, venue, price and description. You pick a new date.">Make a copy</button>`:''}
  ${gone?'':`<h3>Manage</h3><div class="card">
  <button class="row" data-act="stub" data-i="Edit ${e.n}" data-s="${evW(e)}"><span class="t"><b>Edit details</b><span>Date, venue, description</span></span><span aria-hidden="true">&rsaquo;</span></button>
  <button class="row" data-act="music" data-i="${i}"><span class="t"><b>Music style</b><span>${mus(p,i)||'Not set yet. Dancers use it to find events.'}</span></span>${mus(p,i)?'<span aria-hidden="true">&rsaquo;</span>':'<span class="tag">Add</span>'}</button>
  ${e.cap?`<button class="row" data-act="stub" data-i="Tickets for ${e.n}" data-s="${e.tk} of ${e.cap} sold"><span class="t"><b>Tickets</b><span>${e.tk} of ${e.cap} sold</span></span><span aria-hidden="true">&rsaquo;</span></button>`:''}
  </div>`}
  <h3>Tools</h3><div class="card">
  ${e.tk>0&&!gone?`<button class="row" data-act="scan" data-i="${i}"><span class="t"><b>Scan tickets</b><span>Check guests in at the door.</span></span><span aria-hidden="true">&rsaquo;</span></button><button class="row" data-act="door" data-i="${i}"><span class="t"><b>Door team</b><span>${doorOf(p,i).length} ${doorOf(p,i).length===1?'person':'people'} can scan for this event.</span></span><span aria-hidden="true">&rsaquo;</span></button>`:''}
  <div class="row soon"><span class="t"><b>Guest list</b><span>See who is coming and check them in at the door.</span></span><span class="tag">Coming soon</span></div>
  <div class="row soon"><span class="t"><b>Raffle</b><span>Donate tickets and draw winners at the door.</span></span><span class="tag">Coming soon</span></div></div>`;
}
function suggFor(p,i){const L=doorOf(p,i),q=S.q.toLowerCase();return [['Priya Nair','Dancer, London'],['Leo Martins','Dancer, London']].filter(s=>!L.includes(s[0])&&s[0].toLowerCase().includes(q))}
function suggHtml(g){return g.length?`<div class="card">${g.map(s=>`<button class="row" data-act="dooradd" data-n="${s[0]}"><span class="t"><b>${s[0]}</b><span>${s[1]}</span></span><span class="tag">Add</span></button>`).join('')}</div>`:'<p class="cap">No dancers match. Send an invite link instead.</p>'}
function doorScreen(p,e,i){
  const L=doorOf(p,i);
  return `<button class="back" data-act="bback">&lsaquo; ${e.n}</button><h2>Door team</h2>
  <div class="banner">Door team can scan tickets and see guest names. They cannot see sales or money. Access ends 12 hours after the event. They need a full dancer profile before the scanner opens.</div>
  <h3>On the door for ${e.n}</h3><div class="card">${L.map(n=>`<div class="row"><span class="t"><b>${n}</b><span>Door, ends 12 hours after the event</span></span></div>`).join('')}</div>
  <h3>Add a dancer</h3><input id="dq" class="inp" aria-label="Search dancers" placeholder="Search by name" value="${S.q}"><div id="sugg">${suggHtml(suggFor(p,i))}</div>
  <h3>Someone without a profile yet</h3><button class="btn alt" data-act="doorlink">Copy door invite link</button>`;
}
function scanner(mode,p,i){
  const door=mode==='door',R=S.scanRes;
  if(i===undefined||i===null)return `<h2>Scan tickets</h2><div class="banner">No event with tickets to scan right now.</div>`;
  const pg=door?{id:'o1'}:p,idx=door?0:i,ev=EVENTS[pg.id][idx],n=inCount(pg,idx);
  if(S.day!=='event'||!ev.today)return `${door?`<div class="banner">Door access for ${DOOR.ev} at ${DOOR.org}. It ends 12 hours after the event.</div>`:''}<h2>Scan tickets</h2><div class="banner">The scanner opens on the day of ${ev.n}. (Prototype: switch to Event day.)</div>`;
  const RES={valid:['ok','&#10003; VALID','Ana Lopez - General entry'],used:['bad','&#10005; ALREADY USED','Tom Reed. Scanned at 8:12pm. Do not let them in again.'],wrong:['bad','! WRONG EVENT',door?'Priya Nair. This ticket is for a different event.':'Priya Nair. This ticket is for Sunday Workshop.']};
  return `${door?`<div class="banner">Door access for ${DOOR.ev} at ${DOOR.org}. It ends 12 hours after the event.</div>`:''}
  <h2>Scan tickets</h2><p class="cap">${ev.n} &middot; ${door?n+' checked in':n+' of '+ev.tk+' in'}</p>
  ${R?`<div class="res ${RES[R][0]}" role="status"><b>${RES[R][1]}</b><span>${RES[R][2]}</span></div><button class="btn" data-act="scannext">Next guest</button>`:`<div class="scanbox">Point the camera at the ticket QR code.<br>(Prototype: use the buttons below.)</div>`}
  <h3>Try a result</h3><div class="chips"><button class="chip" aria-pressed="${R==='valid'}" data-act="scanres" data-k="valid">Valid</button><button class="chip" aria-pressed="${R==='used'}" data-act="scanres" data-k="used">Already used</button><button class="chip" aria-pressed="${R==='wrong'}" data-act="scanres" data-k="wrong">Wrong event</button></div>`;
}
function tickets(p){
  const T=TIX[p.id]||{on:false},A=(EVENTS[p.id]||[]).map((e,i)=>[e,i]).filter(x=>x[0].cap),E=A.filter(x=>!isGone(p,x[1])),C=A.filter(x=>isGone(p,x[1]));
  if(!T.on)return `<h2>Tickets</h2><div class="banner">Payouts are not connected yet. Connect once, about 5 minutes, to start selling tickets. Free events do not need it.</div><button class="btn" data-act="stub" data-i="Connect payouts" data-s="Set up once with our payments partner">Connect payouts</button>`;
  const sold=E.reduce((a,x)=>a+x[0].tk,0),rev=E.reduce((a,x)=>a+x[0].rev,0);
  const rn=T.base.n+C.reduce((a,x)=>a+x[0].tk,0),ra=T.base.amt+C.reduce((a,x)=>a+x[0].rev,0),pay=Math.round(rev*0.88);
  return `<h2>Tickets</h2>
  <div class="card stat"><small>Sold across your events</small><span class="big">${sold}</span><small>&pound;${rev} in sales</small></div>
  <div class="card"><div class="row"><span class="t"><b>Next payout</b><span>${pay?'Tue 18 Nov: &pound;'+pay+' after fees':'Nothing due'}</span></span></div><div class="row"><span class="t"><b>Refunds</b><span>${rn} refund${rn===1?'':'s'}, &pound;${ra}</span></span></div></div>
  <h3>By event</h3><div class="card">${E.map(x=>`<button class="row" data-act="event" data-i="${x[1]}"><span class="t"><b>${x[0].n}</b><span>${x[0].tk} of ${x[0].cap} sold, &pound;${x[0].rev}</span></span><span aria-hidden="true">&rsaquo;</span></button>`).join('')}</div>`;
}
function stats(p){
  const D=STATS[p.id],per=S.period;
  const head=`<h2>Stats</h2>${linkRow(p)}`;
  if(!D)return head+`<div class="banner">No opens yet. Share your link on Instagram or WhatsApp and your numbers appear here.</div>`;
  const opens=D.opens[per],going=D.going[per],pct=Math.round(going/opens*100),bars=D.bars[per],mx=Math.max(...bars.map(b=>b[1]));
  const seg=[['7','7 days'],['30','30 days'],['all','All time']];
  return head+`<div class="seg" role="group" aria-label="Period">${seg.map(s=>`<button data-act="period" data-k="${s[0]}" aria-pressed="${per===s[0]}">${s[1]}</button>`).join('')}</div>
  <div class="card stat"><small>People who opened your link</small><span class="big">${opens}</span>${per==='7'?`<small>${D.delta}</small>`:'<small>&nbsp;</small>'}</div>
  <div class="card"><div class="bars" aria-label="Opens over time">${bars.map(b=>`<div class="bar"><span class="bv">${b[1]}</span><i style="height:${Math.max(4,Math.round(b[1]/mx*80))}px"></i><span class="bl">${b[0]}</span></div>`).join('')}</div></div>
  <div class="card stat"><small>Said going or interested</small><span class="big" style="font-size:32px">${going}</span><small>${pct}% of the people who opened your link</small></div>
  <h3>Where they came from (all time)</h3><div class="card src">${D.src.map(s=>`<div><div class="l"><span>${s[0]}</span><b>${s[1]}%</b></div><div class="tr"><i style="width:${s[1]}%"></i></div></div>`).join('')}</div>`;
}
function team(p){
  let M=TEAM[p.id]||[['You',p.seat||'Owner']];
  if(p.id==='o1'&&S.jan)M=M.filter(m=>m[0]!=='Jan'||S.jan==='yes').map(m=>m[0]==='Jan'?['Jan','Manager']:m);
  return `<h2>Team</h2><div class="card">${M.map(m=>`<button class="row" data-act="stub" data-i="${m[0]}" data-s="${m[1]}"><span class="t"><b>${m[0]}</b><span>${m[1]}</span></span><span aria-hidden="true">&rsaquo;</span></button>`).join('')}</div><button class="btn" data-act="stub" data-i="Invite someone">Invite someone</button>`;
}
function doorCard(p){
  if(S.day==='event')return `<div class="card"><div class="row"><span class="t"><b>You are on the door tonight</b><span>${p.door.ev}, ${p.door.org}. Doors 8pm.</span></span><button class="act" data-act="scan">Open scanner</button></div></div>`;
  return `<div class="card"><div class="row"><span class="t"><b>You are on the door for ${p.door.ev}</b><span>${p.door.org}, Fri 14 Nov. The scanner opens on the day and closes 12 hours after the event.</span></span></div></div>`;
}
function body(p,tab){
  if(p.state==='pending')return `<div class="banner">Your claim for ${p.name} is pending. We emailed the page contact; you get access once they confirm. Nothing to manage yet.</div><button class="btn alt" data-act="stub" data-i="View public page">View public page</button>`;
  if(p.state==='unfinished')return `${p.door?`<div class="banner">You are on the door for ${p.door.ev}. Finish your profile to open the scanner.</div>`:''}<div class="banner">Finish your profile to appear on the calendar. It takes about two minutes.</div><button class="btn" data-act="stub" data-i="Finish profile">Finish profile</button>`;
  if(p.role==='org'){
    return tab==='home'?home(p):tab==='events'?eventsTab(p):tab==='tickets'?tickets(p):tab==='scan'?scanner('org',p,S.scanEv):tab==='stats'?stats(p):team(p);
  }
  const items=ITEMS[p.role+'.'+tab]||[];
  const lab=tabsFor(p).find(t=>t[0]===tab)[1];
  const cta=tab==='classes'?'New class':'Add';
  return `${tab==='home'&&p.door&&!S.cx['o1:0']?doorCard(p):''}<h2>${lab}</h2><div class="card">${items.map(i=>`<button class="row" data-act="stub" data-i="${i[0]}" data-s="${i[1]}"><span class="t"><b>${i[0]}</b><span>${i[1]}</span></span><span aria-hidden="true">&rsaquo;</span></button>`).join('')}</div><button class="btn" data-act="stub" data-i="${cta}">${cta}</button>`;
}
function area(){
  const p=S.page,bar=idbar(p),sc=`<div class="scroll r-${p.role}">`;
  if(S.scan)return `${bar}${sc}<button class="back" data-act="bback">&lsaquo; Back</button>${scanner(p.role==='dancer'?'door':'org',p,S.scanEv)}</div>`;
  if(S.detail)return `${bar}${sc}${detailBody(S.detail)}</div>`;
  if(S.door!=null)return `${bar}${sc}${doorScreen(p,EVENTS[p.id][S.door],S.door)}</div>`;
  if(S.event!=null)return `${bar}${sc}${eventDetail(p,EVENTS[p.id][S.event],S.event)}</div>`;
  const tabs=p.state?'':`<nav class="tabs r-${p.role}" aria-label="${ROLES[p.role].n}">${tabsFor(p).map(t=>`<button data-act="tab" data-k="${t[0]}" ${S.tab===t[0]?'aria-current="true"':''}>${t[1]}</button>`).join('')}</nav>`;
  return `${bar}${sc}${body(p,S.tab)}</div>${tabs}`;
}
function sheet(){
  const P=pages(),cur=S.page,ttl=P.length>1?'Switch page':'Account';
  const groups=ORDER.map(r=>[ROLES[r].n+(P.filter(p=>p.role===r).length>1?' pages':''),P.filter(p=>p.role===r)]);
  return `<div class="sheetbg" data-act="close"><div class="sheet" role="dialog" aria-label="${ttl}"><button class="x" data-act="close">Close</button><h2>${ttl}</h2>
  ${groups.filter(g=>g[1].length).map(g=>`<h3>${g[0]}</h3><div class="card">${g[1].map(p=>`<button class="row" data-act="switch" data-id="${p.id}">${badge(p.role)}<span class="t"><b>${p.name}</b><span>${sub(p)}</span></span>${p.id===cur.id?'<span class="tag">Showing</span>':''}</button>`).join('')}</div>`).join('')}
  ${P.length>1?'<button class="btn alt" data-act="chooser">All my pages</button>':''}
  <button class="btn alt" data-act="add">Add another page</button><button class="btn alt" data-act="stub" data-i="Account and help">Account and help</button></div></div>`;
}
function modal(){
  const p=S.page,m=S.modal,e=EVENTS[p.id][m.i],gone=S.cx[key(p,m.i)];
  if(m.k==='music'){
    const STY=['Sensual bachata','Dominican bachata','Urban bachata','Mixed'];
    return `<div class="sheetbg" data-act="mclose"><div class="sheet" role="dialog" aria-label="Music style for ${e.n}"><button class="x" data-act="mclose">Close</button><h2>Music style</h2><p class="cap">${e.n}. Dancers use this to find events.</p>
    <div class="chips">${STY.map(s=>`<button class="chip" aria-pressed="${S.mpick===s}" data-act="mpick" data-k="${s}">${s}</button>`).join('')}</div>
    <button class="btn" data-act="msave" ${S.mpick?'':'disabled'}>Save</button>${S.mpick?'':'<p class="cap">Pick a style first.</p>'}</div></div>`;
  }
  if(m.k==='menu'){
    return `<div class="sheetbg" data-act="mclose"><div class="sheet" role="dialog" aria-label="Options for ${e.n}"><button class="x" data-act="mclose">Close</button><h2>${e.n}</h2><div class="card">
    ${gone?'':`<button class="row" data-act="mstub" data-i="Edit ${e.n}" data-s="${evW(e)}"><span class="t"><b>Edit details</b></span></button>`}
    <button class="row" data-act="mstub" data-i="Make a copy of ${e.n}" data-s="Copies the title, venue, price and description. You pick a new date."><span class="t"><b>Make a copy</b></span></button>
    ${gone||e.s==='Draft'?'':`<button class="row" data-act="mcopy"><span class="t"><b>Copy event link</b></span></button>`}
    ${gone?'':`<button class="row" data-act="mcancel"><span class="t danger">${e.s==='Draft'?'Delete draft':'Cancel event'}</span></button>`}</div></div></div>`;
  }
  const draft=e.s==='Draft';
  const lines=draft?'<p class="cap">This draft has not been published. It will be deleted.</p>':`<p class="cap">${e.go} people who said going will be told. ${e.tk>0?e.tk+' ticket buyers are refunded automatically.':'Nobody has paid, so there is nothing to refund.'}</p>`;
  const ready=draft||S.reason;
  return `<div class="sheetbg" data-act="mclose"><div class="sheet" role="dialog" aria-label="${draft?'Delete':'Cancel'} ${e.n}"><button class="x" data-act="mclose">Close</button><h2>${draft?'Delete':'Cancel'} ${e.n}?</h2>${lines}
  ${draft?'':`<h3>Why are you cancelling?</h3><div class="chips">${REASONS.map(r=>`<button class="chip" aria-pressed="${S.reason===r}" data-act="reason" data-k="${r}">${r}</button>`).join('')}</div>`}
  <button class="btn dng" data-act="confirmcancel" ${ready?'':'disabled'}>${draft?'Delete draft':'Cancel event'}</button>
  ${ready?'':'<p class="cap">Pick a reason first.</p>'}
  <button class="btn alt" data-act="mclose">Keep ${draft?'draft':'event'}</button></div></div>`;
}
function render(){
  $('#pseg').innerHTML=Object.keys(PERSONAS).map(k=>`<button data-act="per" data-k="${k}" aria-pressed="${S.p===k}">${PERSONAS[k].n}</button>`).join('');
  $('#sseg').innerHTML=Object.keys(PLACES).map(k=>`<button data-act="place" data-k="${k}" aria-pressed="${S.place===k}">${PLACES[k]}</button>`).join('');
  $('#dseg').innerHTML=Object.keys(DAYS).map(k=>`<button data-act="day" data-k="${k}" aria-pressed="${S.day===k}">${DAYS[k]}</button>`).join('');
  let h;
  if(S.screen==='signin')h=signin();
  else if(S.screen==='choose')h=chooser();
  else if(S.screen==='add')h=addPage();
  else h=area();
  $('#screen').innerHTML=h+(S.sheet?sheet():'')+(S.modal&&S.page?modal():'');
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  const a=t.dataset.act,id=t.dataset.id,P=pages();
  if(t.classList.contains('sheetbg')&&e.target!==t)return;
  if(a==='per'){S.p=t.dataset.k;restart();return}
  if(a==='place'){S.place=t.dataset.k;S.tab='home';resetNav();render();return}
  if(a==='day'){S.day=t.dataset.k;resetNav();render();return}
  if(a==='restart'){restart();return}
  if(a==='signin'){if(P.length===1){S.page=P[0];S.screen='area'}else S.screen='choose';render();return}
  if(a==='open'||a==='switch'){S.page=P.find(p=>p.id===id);S.tab='home';S.sheet=false;resetNav();S.period='7';S.scanRes=null;S.screen='area'}
  else if(a==='stub'){S.sheet=false;S.scan=false;S.detail={role:S.page.role,page:S.page.name,item:t.dataset.i,sub:t.dataset.s||''}}
  else if(a==='add'){S.sheet=false;S.from=S.screen;S.screen='add'}
  else if(a==='addback'){S.screen=S.from||'choose'}
  else if(a==='addrole'){S.screen=S.from||'choose';render();showToast('Prototype: would start the '+ROLES[t.dataset.r].n+' page setup');return}
  else if(a==='sheet')S.sheet=true;
  else if(a==='close')S.sheet=false;
  else if(a==='chooser'){S.sheet=false;resetNav();S.screen='choose'}
  else if(a==='tab'){S.tab=t.dataset.k;S.scanRes=null;if(S.tab==='scan')S.scanEv=scanDefault(S.page)}
  else if(a==='bback'){if(S.scan)S.scan=false;else if(S.detail)S.detail=null;else if(S.door!=null)S.door=null;else S.event=null}
  else if(a==='event'){S.event=+t.dataset.i;S.evFrom=S.tab;S.detail=null}
  else if(a==='period')S.period=t.dataset.k;
  else if(a==='scan'){S.scanEv=t.dataset.i!==undefined?+t.dataset.i:(S.page.role==='org'?scanDefault(S.page):0);S.scanRes=null;S.sheet=false;if(S.place==='tab'&&S.page.role==='org'){S.tab='scan';S.event=null;S.detail=null;S.door=null}else S.scan=true}
  else if(a==='scanres'){const k=t.dataset.k,door=S.page.role==='dancer',pg=door?{id:'o1'}:S.page,ix=door?0:S.scanEv,ev=EVENTS[pg.id][ix];if(k==='valid'&&S.scanRes!=='valid')S.scanIn[key(pg,ix)]=Math.min(ev.tk,inCount(pg,ix)+1);S.scanRes=k}
  else if(a==='scannext')S.scanRes=null;
  else if(a==='door'){S.door=+t.dataset.i;S.q=''}
  else if(a==='dooradd'){doorOf(S.page,S.door).push(t.dataset.n);render();showToast(t.dataset.n+' added to the door team');return}
  else if(a==='doorlink'){render();showToast('Door invite link copied');return}
  else if(a==='menu')S.modal={k:'menu',i:+t.dataset.i};
  else if(a==='mclose'){S.modal=null;S.reason=null}
  else if(a==='music'){S.modal={k:'music',i:+t.dataset.i};S.mpick=mus(S.page,+t.dataset.i)||null}
  else if(a==='mpick')S.mpick=t.dataset.k;
  else if(a==='msave'){if(!S.mpick)return;S.music[key(S.page,S.modal.i)]=S.mpick;S.modal=null;render();showToast('Music style saved');return}
  else if(a==='save'){S.detail=null;render();showToast('Saved (prototype: nothing is stored)');return}
  else if(a==='jan'){S.jan=t.dataset.k;S.detail=null;render();showToast(t.dataset.k==='yes'?'Jan added as a manager':'Request declined');return}
  else if(a==='mstub'){S.scan=false;S.modal=null;S.detail={role:S.page.role,page:S.page.name,item:t.dataset.i,sub:t.dataset.s||''}}
  else if(a==='mcopy'){const l=EVENTS[S.page.id][S.modal.i].l;S.modal=null;render();copyLink(l);return}
  else if(a==='mcancel'){S.modal={k:'cancel',i:S.modal.i};S.reason=null}
  else if(a==='reason')S.reason=t.dataset.k;
  else if(a==='confirmcancel'){
    const p=S.page,i=S.modal.i,e=EVENTS[p.id][i],draft=e.s==='Draft';
    if(!draft&&!S.reason)return;
    S.cx[key(p,i)]=draft?'Deleted':'Cancelled';S.modal=null;S.reason=null;render();
    showToast(draft?e.n+' deleted':e.n+' cancelled. '+e.go+' people will be told.');return}
  else if(a==='copy'){copyLink();return}
  else if(a==='todo'){
    const k=t.dataset.a;
    if(k==='copy'){copyLink();return}
    else if(k.startsWith('tab:'))S.tab=k.slice(4);
    else if(k.startsWith('event:')){S.event=+k.slice(6);S.evFrom='home'}
    else S.detail={role:S.page.role,page:S.page.name,item:t.dataset.i,sub:t.dataset.s||''};
  }
  render();
});
document.addEventListener('input',e=>{if(e.target.id==='dq'){S.q=e.target.value;const el=$('#sugg');if(el)el.innerHTML=suggHtml(suggFor(S.page,S.door))}});
render();
</script>

</body></html>