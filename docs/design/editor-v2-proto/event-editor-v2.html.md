<title>Event Editor v2 Prototype</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap" rel="stylesheet">
<style>
/* Layout: one 390x844 phone frame centred on a quiet page (full screen on a phone). Inside the frame the app's light organiser look, copied from options A1/B1. */
:root{
  --pg:#F3F2EF; --pg-fg:#1B1A18; --pg-mut:#5B5853; --pg-line:#DCD9D3;
  --head:"Space Grotesk",Inter,system-ui,sans-serif;
  --bg:#FDFDFD; --card:#FFFFFF; --line:#E9E9E9; --text:#030303; --muted:#464646; --soft:#696969;
  --accent:#C2410C; --on-accent:#FFFAF7; --warn-bg:#FFF1E8; --warn-line:#F3C6A8; --warn:#9A3412;
  --ok:#16B674; --ok-bg:rgba(22,182,116,.10); --ok-text:#097C4F; --danger:#B42318; --danger-bg:#FEF3F2; --info:#F6F6F6; --field-line:#D9D9D9;
  --scrim:rgba(0,0,0,.38); --toast:#1B1A18; --on-toast:#FFFFFF; --night:#FFFBF8; --stripe1:#ECECEC; --stripe2:#F6F6F6;
  --font:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--pg:#161513;--pg-fg:#EDEBE7;--pg-mut:#A9A59E;--pg-line:#34322E;color-scheme:dark}}
:root[data-theme="dark"]{--pg:#161513;--pg-fg:#EDEBE7;--pg-mut:#A9A59E;--pg-line:#34322E;color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%}
body{background:var(--pg);color:var(--pg-fg);font-family:var(--font);font-size:15px;line-height:1.5}
.stage{min-height:100%;display:flex;flex-direction:column;align-items:center;gap:12px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 32px}
.cap{font-family:var(--head);font-size:16px;font-weight:600;text-align:center;margin:0}
.cap small{display:block;font-family:var(--font);font-size:13px;font-weight:400;color:var(--pg-mut)}
button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left}
[data-act]{cursor:pointer}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.phone{width:390px;max-width:100%;height:844px;flex:none;background:var(--bg);color:var(--text);border:1px solid var(--pg-line);border-radius:28px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 28px rgba(0,0,0,.10);font-size:16px;line-height:1.45;position:relative;color-scheme:light}
@media (max-width:430px){
  .stage{padding:0;gap:0}
  .cap{display:none}
  .phone{width:100%;height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border:0;border-radius:0;box-shadow:none}
}
.top{height:56px;flex:none;padding:0 12px 0 4px;display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--line);background:var(--card)}
.bk{width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--text)}
.bk::before{content:"";width:10px;height:10px;border-left:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin-left:4px}
.tt{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
.tt1{font-size:12px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tt2{font-size:17px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.main{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:14px;-webkit-overflow-scrolling:touch}
.tabs{height:60px;flex:none;border-top:1px solid var(--line);background:var(--card);display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px;color:var(--muted);text-align:center}
.tab i{width:20px;height:20px;border:1.8px solid currentColor;border-radius:5px;display:block}
.tab.on{color:var(--accent);font-weight:500}
.lbl{margin:0;font-size:12px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;color:var(--soft)}
.p{margin:0;font-size:14px;color:var(--muted)}
.stack{display:flex;flex-direction:column;gap:8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;position:relative}
.row{min-height:52px;padding:8px 16px;display:flex;align-items:center;gap:12px;position:relative;width:100%}
.row+.row,.sess+.row,.price+.row{border-top:1px solid var(--line)}
.k{width:88px;flex:none;font-size:14px;color:var(--soft)}
.v{flex:1;min-width:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.v.add{color:var(--soft)}
.rb{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.rt{font-size:15px;line-height:1.35}
.rl{font-size:13px;line-height:1.4;color:var(--soft)}
.go::after{content:"";flex:none;width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(-45deg);margin-right:4px}
.red .rt{color:var(--danger)}
.chg{flex:none;font-size:14px;color:var(--accent);text-decoration:underline;min-height:44px;display:inline-flex;align-items:center;padding:0 2px}
.btn{min-height:46px;width:100%;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 12px}
.btn.sec{background:var(--card);color:var(--text);box-shadow:inset 0 0 0 1px rgba(0,0,0,.14)}
.btn.dng{background:var(--danger);color:#fff}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.btns{display:flex;gap:8px}.btns>*{flex:1}
.pill{flex:none;padding:3px 7px;border-radius:999px;font-size:11px;font-weight:500;line-height:1;letter-spacing:.07em;text-transform:uppercase;border:1px solid var(--ok);background:var(--ok-bg);color:var(--ok-text)}
.pill.off{border-color:var(--warn-line);background:var(--warn-bg);color:var(--warn)}
.pill.x{border-color:var(--danger);background:var(--danger-bg);color:var(--danger)}
.ovr{display:inline-block;margin-top:3px;font-size:12px;color:var(--warn);background:var(--warn-bg);padding:2px 6px;border-radius:4px;align-self:flex-start}
.ovr.x{color:var(--danger);background:var(--danger-bg)}
.back2{font-size:13px;color:var(--accent);text-decoration:underline;align-self:flex-start;min-height:32px;display:inline-flex;align-items:center}
.price{display:flex;justify-content:space-between;gap:12px;font-size:15px;padding:8px 16px}
.price+.price{padding-top:0}
.price b{font-weight:500;font-variant-numeric:tabular-nums}
.sess{display:flex;gap:12px;padding:10px 16px;align-items:flex-start;position:relative;width:100%}
.sess+.sess{border-top:1px solid var(--line)}
.sess.cx .rt,.sess.cx .time{text-decoration:line-through;color:var(--soft)}
.time{width:56px;flex:none;font-size:15px;font-weight:500;font-variant-numeric:tabular-nums;line-height:1.35}
.time small{display:block;font-size:12px;font-weight:400;color:var(--soft)}
.opt{min-height:52px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);display:flex;align-items:center;gap:10px;position:relative;width:100%}
.opt.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.radio{width:18px;height:18px;flex:none;border-radius:50%;border:2px solid var(--field-line)}
.opt.on .radio{border:5px solid var(--accent)}
.info{padding:10px 12px;border-radius:8px;background:var(--info);color:var(--muted);font-size:14px;line-height:1.4}
.cxbox{padding:12px;border-radius:8px;background:var(--danger-bg);border:1px solid var(--danger);color:var(--danger);font-size:14px;display:flex;flex-direction:column;gap:8px}
.cxbox b{font-weight:600}
.dim{opacity:.45;pointer-events:none}
.flyer{height:110px;border-radius:8px;background:repeating-linear-gradient(135deg,var(--stripe1) 0 10px,var(--stripe2) 10px 20px);display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--soft)}
.tcard{width:100%;padding:12px 16px;display:flex;flex-direction:column;gap:4px;position:relative}
.tcard .th{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.tcard .th b{font-weight:500;font-variant-numeric:tabular-nums;flex:none}
.sold{font-size:13px;color:var(--ok-text);font-variant-numeric:tabular-nums}
.stg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) auto;gap:8px;align-items:end}
.big{min-height:52px;width:100%;border-radius:8px;background:var(--accent);color:var(--on-accent);font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;text-align:center}
.pitch{margin:0;font-size:13px;line-height:1.45;color:var(--muted)}
.sent{margin:0;font-size:14px;color:var(--soft);line-height:1.6}
.sent button{color:var(--accent);text-decoration:underline;font-size:14px}
.sent b{color:var(--text);font-weight:500;word-break:break-all}
.row[data-key="about"] .rt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:normal}
.btn.sm{min-height:40px;font-size:14px}
[hidden]{display:none!important}
.row.off,.tcard.off{opacity:.5;pointer-events:none}
.warnl{font-size:13px;color:var(--danger);margin:0}
.warnl.soft{color:var(--warn)}
.warnl:empty{display:none}
.topcx{flex:none;min-height:44px;min-width:44px;padding:0 6px;font-size:14px;color:var(--danger);text-decoration:underline;display:inline-flex;align-items:center}
.sess .chg{margin-left:auto}
.dtag{flex:none;font-size:12px;color:var(--warn);background:var(--warn-bg);padding:2px 6px;border-radius:4px}
.dtag.x{color:var(--danger);background:var(--danger-bg)}

.bar{flex:none;padding:10px 12px;border-top:1px solid var(--line);background:var(--card);display:flex;flex-direction:column;gap:8px}
.sbline{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.sbline span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.undo{color:var(--accent);text-decoration:underline;font-size:14px;flex:none;min-height:36px;padding:0 4px}

.scrim{position:absolute;inset:0;background:var(--scrim);z-index:20;display:flex;align-items:flex-end}
.sheet{width:100%;max-height:88%;overflow-y:auto;background:var(--card);border-radius:14px 14px 0 0;padding:8px 16px calc(16px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px}
.grab{width:40px;height:4px;border-radius:2px;background:var(--line);align-self:center;flex:none}
.sh{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sh h3{margin:0;font-family:var(--font);font-size:17px;font-weight:600}
.x{width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--muted);text-align:center}
.f{display:flex;flex-direction:column;gap:6px}
.f label,.flab{font-size:13px;color:var(--soft)}
.in{width:100%;min-height:46px;border:1px solid var(--field-line);border-radius:8px;padding:10px 12px;font:inherit;font-size:16px;background:var(--card);color:var(--text)}
textarea.in{min-height:96px;resize:vertical}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;align-items:center;gap:4px;min-height:36px;padding:0 6px 0 12px;border-radius:999px;border:1px solid var(--field-line);font-size:14px;background:var(--card)}
.chip button{width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:16px;text-align:center}
.tog{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--field-line);font-size:14px;background:var(--card)}
.tog.on{border-color:var(--accent);background:var(--warn-bg);color:var(--warn);font-weight:500}
.addp{display:flex;gap:8px}.addp select{flex:1;min-width:0}.addp .btn{width:auto;flex:none}
.hintx{font-size:13px;color:var(--soft);margin:0}
.toast{position:absolute;left:12px;right:12px;bottom:72px;z-index:30;background:var(--toast);color:var(--on-toast);border-radius:8px;padding:10px 12px;font-size:14px;text-align:center}
.row.stk{flex-wrap:wrap;row-gap:2px}.row.stk .k{width:100%}
.price b{text-align:right}
.price.wrap{flex-direction:column;gap:2px}.price.wrap b{text-align:left}
.price .rb{min-width:0}
.dl{display:flex;flex-direction:column;gap:2px;margin-top:4px;font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;width:100%}
.dl .d{display:flex;justify-content:space-between;gap:12px}
.swrow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px}
.sw{width:46px;height:28px;border-radius:999px;background:var(--field-line);position:relative;flex:none}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.2)}
.sw.on{background:var(--accent)}.sw.on::after{left:21px}
.proto{align-self:center;font-size:13px;color:var(--soft);border:1px dashed var(--field-line);border-radius:8px;padding:8px 12px;min-height:40px;text-align:center}
@media (prefers-reduced-motion:no-preference){.sheet{animation:up .18s ease-out}@keyframes up{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}}
</style>

<div class="stage">
  <p class="cap">Event editor v2, tappable prototype<small>Tap rows to change them. Sample event, names and prices.</small></p>
  <div class="phone" id="phone">
    <div class="top" id="top"></div>
    <div class="main" id="main"></div>
    <div class="bar" id="bar" hidden>
      <div class="sbline"><span id="sum"></span><button class="undo" data-act="undo">Undo</button></div>
      <button class="btn" data-act="save">Save</button>
    </div>
    <div class="tabs">
      <button class="tab" data-act="tab" data-t="Home"><i></i>Home</button>
      <button class="tab on" data-act="tab" data-t="Events"><i></i>Events</button>
      <button class="tab" data-act="tab" data-t="Tickets"><i></i>Tickets</button>
      <button class="tab" data-act="tab" data-t="Team"><i></i>Team</button>
    </div>
    <div id="sheetHost"></div>
    <div class="toast" id="toast" hidden></div>
  </div>
</div>

<script>
(function(){
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const TYPES=['Class','Masterclass','Party','Performance'];
const LEVELS=['Beginner','Improver','Intermediate','Advanced'];
const POOL={teachers:['Carlos & Ana','Sofia Reyes','Jon Marsh','Lena Kovac'],djs:['DJ Tito','DJ Marisol','DJ Kev'],dancers:['Rosa & Mike','Elena Petrova','Tom Baker'],orgs:['Maria Lopez','Dan Reid','Priya Shah']};
const MUSIC=['Bachata','Sensual','Dominican','Salsa','Kizomba'];
const START=new Date(2026,10,19);
const CX_REASONS=['Venue not available','No reason'];

const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keyOf=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fromKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d);};
const dLabel=k=>{const d=fromKey(k);return DAYS[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()];};
const money=p=>'£'+(Number(p)%1?Number(p).toFixed(2):Number(p));

const seed={
  event:{
    name:'Thursday Bachata Social', about:'Two classes then social dancing until midnight. All levels welcome, no partner needed.',
    music:['Bachata','Sensual'], venue:'The Loft, Northern Quarter, Manchester',
    repeat:{day:'Thursday',end:''}, date:'2026-11-19', organisers:['Maria Lopez','Dan Reid'],
    flyer:'Flyer (sample)', gallery:4, videos:[],
    sessions:[
      {id:'s1',type:'Class',title:'Beginners class',start:'19:30',end:'20:15',levels:['Beginner'],teachers:['Carlos & Ana'],djs:[]},
      {id:'s2',type:'Class',title:'Improvers class',start:'20:15',end:'21:00',levels:['Improver'],teachers:['Sofia Reyes'],djs:[]},
      {id:'s3',type:'Party',title:'Social dancing',start:'21:00',end:'00:00',levels:[],teachers:[],djs:['DJ Tito']}
    ],
    tickets:[{id:'t1',name:'Class and party',price:12,qty:50,stages:[{price:10,until:'2026-12-01'}],sold:31,money:372},{id:'t2',name:'Party only',price:8,qty:80,stages:[],sold:18,money:144}],
    pay:'here', payLink:'', status:'Live'
  },
  nights:{
    '2026-11-26':{venue:'Studio 5, Ancoats, Manchester',about:'The main room is being repainted, so we are in Studio 5 this week. Same classes, same DJ, same price.'},
    '2026-12-03':{sess:{s3:{djs:['DJ Marisol']}},nightTicket:{id:'n1',name:'Guest DJ special',price:10,qty:40,stages:[],sold:6,money:60}},
    '2026-12-17':{cancelled:'Venue not available'}
  }
};

seed.event.sessions.forEach(s=>{s.dancers=s.dancers||[];});
let saved=clone(seed), draft=clone(seed), hist=[];
let screen='event', cur=null, sheet=null, stripe=false, skipped=false, oneOff=false, stripePending=false;
const $=id=>document.getElementById(id);

function commit(fn){hist.push(clone(draft));fn(draft);tidy(draft);render();}
/* takes effect at once: not one of the changes behind Save */
function now(fn){[draft,saved].concat(hist).forEach(d=>{fn(d);tidy(d);});render();}
function tidy(d){Object.keys(d.nights).forEach(k=>{const n=d.nights[k];if(n.sess){Object.keys(n.sess).forEach(s=>{if(!Object.keys(n.sess[s]).length)delete n.sess[s];});if(!Object.keys(n.sess).length)delete n.sess;}if(n.added&&!n.added.length)delete n.added;if(!Object.keys(n).length)delete d.nights[k];});}
function night(d,k){return d.nights[k]||{};}
function ensure(d,k){return d.nights[k]||(d.nights[k]={});}
function dates(d){if(oneOff)return [d.event.date];const out=[];const x=new Date(START);const wd=DAYS.indexOf(d.event.repeat.day);while(x.getDay()!==wd)x.setDate(x.getDate()+1);for(let i=0;i<6;i++){if(d.event.repeat.end&&keyOf(x)>d.event.repeat.end)break;out.push(keyOf(x));x.setDate(x.getDate()+7);}return out;}
function span(list){const live=list.filter(s=>!s.cancelled);if(!live.length)return '';const st=live.map(s=>s.start).sort()[0];const late=e=>(e<'06:00'?'2':'1')+e;const en=live.map(s=>s.end).sort((a,b)=>late(a)<late(b)?1:-1)[0];return st+' to '+en;}
function people(s){const a=[];if(s.teachers&&s.teachers.length)a.push(s.teachers.join(', '));if(s.djs&&s.djs.length)a.push(s.djs.join(', '));if(s.dancers&&s.dancers.length)a.push(s.dancers.join(', '));if(s.levels&&s.levels.length)a.push(s.levels.join(', '));return a.join(' · ');}
function nightSessions(d,k){const n=night(d,k);const ov=n.sess||{};const base=d.event.sessions.map(s=>{const o=ov[s.id]||{};const m=Object.assign(clone(s),o);m.changed=Object.keys(o).some(x=>x!=='cancelled');m.cancelled=!!o.cancelled;return m;});const add=(n.added||[]).map(a=>Object.assign(clone(a),{added:true}));return base.concat(add).sort((a,b)=>late(a.start)<late(b.start)?-1:1);}
const late=x=>(x<'06:00'?'2':'1')+x;
function soldFor(t,k){const ds=dates(draft);const i=ds.indexOf(k);if(i<0)return 0;const n=t.sold||0;if(ds.length===1)return n;const f=[.45,.25,.15,.1,.05,0];const a=ds.map((x,j)=>Math.floor(n*(f[j]||0)));a[0]+=n-a.reduce((p,q)=>p+q,0);return a[i];}
function nightSold(k){if(!(stripe&&draft.event.pay==='here'))return 0;const n=night(draft,k);return draft.event.tickets.reduce((a,t)=>a+soldFor(t,k),0)+(n.nightTicket?n.nightTicket.sold||0:0);}
function refund(s){return s?'<p class="p"><b>'+s+' ticket'+(s===1?'':'s')+' sold.</b> We will email buyers. Refunds are sorted separately.</p>':'';}
function reasonOpts(w){return '<div class="stack">'+CX_REASONS.map(r=>'<button class="opt'+(w.r===r?' on':'')+'" data-sa="r" data-v="'+r+'"><span class="radio"></span><span class="rb"><span class="rt">'+r+'</span></span></button>').join('')+'</div>';}
function nightLine(s,q){return 'Sold for this night: '+s+' of '+q;}
function allSold(t){return (t.sold||0)+' sold across all dates, '+money(t.money||0);}
function priceOn(t,k){if(t.free)return 'Free';if(t.price===''||t.price==null)return 'Add a price';const st=(t.stages||[]).slice().sort((a,b)=>a.until<b.until?-1:1);const before=st.filter(s=>s.until<k);const on=st.find(s=>s.until>=k);const last=on?on.price:t.price;return before.length?before.map(s=>money(s.price)+' until '+dLabel(s.until)).join(', then ')+', then '+money(last):(on?money(on.price)+' (early bird)':money(t.price));}
function isLev(w){return w.type==='Class'||w.type==='Masterclass';}
function dropped(w){const lev=isLev(w);let g=[];if(!lev){g=g.concat(w.teachers||[]);if(w.levels&&w.levels.length)g.push(w.levels.join(' and ')+' level');}if(w.type!=='Party')g=g.concat(w.djs||[]);if(lev)g=g.concat(w.dancers||[]);return g;}
function strip(w){const lev=isLev(w);if(!lev){w.levels=[];w.teachers=[];}if(w.type!=='Party')w.djs=[];if(lev)w.dancers=[];return w;}
function badTime(w){return !!(w.start&&w.end&&late(w.end)<=late(w.start));}
function ebWarn(w){const st=w.stages.filter(s=>s.until).slice().sort((a,b)=>a.until<b.until?-1:1);const fin=Number(w.price)||0;const bad=st.some((s,i)=>Number(s.price)>=fin||(i>0&&Number(s.price)<Number(st[i-1].price)));return bad?'<p class="warnl soft">Check the prices: early bird prices usually go up over time and stay below '+money(fin)+'.</p>':'';}
function repeatText(r){return 'Every '+r.day+', '+(r.end?'ends '+dLabel(r.end):'no end date');}

/* ---------- change summary ---------- */
const EV_LABEL={name:'Name',about:'About text',music:'Music',venue:'Venue',repeat:'Repeat',organisers:'Who runs it',flyer:'Flyer',gallery:'Gallery',videos:'Videos',date:'Date',sessions:'Programme',tickets:'Tickets',pay:'How to pay',payLink:'How to pay',status:'Event status'};
const N_LABEL={time:'Time',venue:'Venue',title:'Name',about:'About this night',note:'Note',picture:'Picture',ticketLink:'Ticket link',nightTicket:'Night ticket',sess:'Sessions',added:'Sessions',cancelled:'Cancelled'};
function changes(S,D){S=S||saved;D=D||draft;const out=[];const seen=new Set();Object.keys(EV_LABEL).forEach(k=>{if(!same(S.event[k],D.event[k])){const l=EV_LABEL[k];if(!seen.has(l)){seen.add(l);out.push(l+' changed');}}});
  const ks=new Set(Object.keys(S.nights).concat(Object.keys(D.nights)));[...ks].sort().forEach(k=>{const a=S.nights[k]||{},b=D.nights[k]||{};const f=new Set(Object.keys(a).concat(Object.keys(b)));const ls=[];f.forEach(x=>{if(!same(a[x],b[x])){let l=N_LABEL[x];if(x==='cancelled')l=b.cancelled?(a.cancelled?'Cancel reason':'Cancelled'):'Brought back';if(!ls.includes(l))ls.push(l);}});ls.forEach(l=>out.push((l==='Cancelled'||l==='Brought back'?l+' ':l+' changed for ')+dLabel(k)));});
  return out;}

/* ---------- render ---------- */
function render(){const m=$('main');const keep=m.scrollTop;
  if(screen==='event')renderEvent();else if(screen==='tickets')renderTickets();else renderNight();
  m.scrollTop=keep;
  const ch=changes();const bar=$('bar');bar.hidden=!ch.length;
  $('sum').textContent=ch.length===1?ch[0]:ch.length+' changes: '+ch.map(c=>c.replace(' changed','')).join(', ');
  if(sheet)drawSheet();placeToast();}
function go(s,k){screen=s;cur=k||null;closeSheet();render();$('main').scrollTop=0;}

function row(act,k,v,extra){return '<button class="row go" data-act="'+act+'"'+(extra||'')+'><span class="k">'+k+'</span><span class="v'+(v?'':' add')+'">'+esc(v||'Add')+'</span></button>';}

function renderEvent(){const e=draft.event;const st=e.status;
  $('top').innerHTML='<button class="bk" data-act="back" aria-label="Back to events"></button><span class="tt"><span class="tt1">Events</span><span class="tt2">'+esc(e.name)+'</span></span><span class="pill'+(st==='Live'?'':st==='Cancelled'?' x':' off')+'">'+st+'</span>';
  let h='';
  h+='<div class="stack"><p class="lbl">The event</p><div class="card">'+row('f-name','Name',e.name)+row('f-about','About',e.about)+row('f-music','Music',e.music.join(', '))+row('f-venue','Venue',e.venue)+
     (oneOff?'<div class="row"><span class="k">Date</span><span class="rb"><span class="rt">'+dLabel(e.date)+'</span><span class="rl">'+esc(span(e.sessions))+'</span></span><button class="chg" data-act="f-date">Change date</button></div>':'<div class="row"><span class="k">Repeat</span><span class="rb"><span class="rt">'+esc(repeatText(e.repeat))+'</span></span><button class="chg" data-act="f-repeat">Change repeat</button></div>')+
     row('f-orgs','Who runs it',e.organisers.join(', '))+'</div></div>';
  h+='<div class="stack"><p class="lbl">Programme</p><div class="card">'+e.sessions.slice().sort((a,b)=>late(a.start)<late(b.start)?-1:1).map(s=>'<button class="sess" data-act="sess" data-id="'+s.id+'"><span class="time">'+s.start+'<small>to '+s.end+'</small></span><span class="rb"><span class="rt">'+esc(s.title)+'</span><span class="rl">'+esc(s.type+(people(s)?' · '+people(s):''))+'</span></span></button>').join('')+
     '<div class="row"><button class="chg" data-act="sess-add">Add a session</button></div></div><p class="p" style="font-size:13px">Teachers and DJs are set inside each session.</p></div>';
  {const sold=e.tickets.reduce((a,t)=>a+(t.sold||0),0),mon=e.tickets.reduce((a,t)=>a+(t.money||0),0);const here=e.pay==='here';
  h+='<div class="stack"><p class="lbl">Tickets</p>';
  if(stripe&&here)h+='<button class="big" data-act="tickets">Manage tickets</button><p class="pitch">'+e.tickets.length+' ticket'+(e.tickets.length===1?'':'s')+' \u00b7 '+sold+' sold across all dates, '+money(mon)+'</p>';
  else h+='<button class="big" data-act="sellhere">Sell tickets here</button>'+(stripe?'':'<p class="pitch">Connect Stripe and get paid in seconds. No commission from Bachata Calendar.</p>'+(skipped&&here?'<p class="warnl">Dancers can\'t buy yet. Connect Stripe or choose pay at the door.</p>':''));
  if(here)h+='<p class="sent">Not selling here? <button data-act="paypick" data-v="door">Pay at the door</button> or <button data-act="paypick" data-v="link">add a link</button> instead.</p>';
  else if(e.pay==='door')h+='<p class="sent">Dancers pay at the door. <button data-act="paychange">Change</button></p>';
  else h+='<p class="sent">Dancers buy at <b>'+esc(e.payLink||'your link')+'</b>. <button data-act="paychange">Change</button></p>';
  h+='</div>';}
  h+='<div class="stack"><p class="lbl">Pictures and videos</p><div class="card">'+row('f-flyer','Flyer',e.flyer?e.flyer:'')+row('f-gallery','Gallery',e.gallery+' photo'+(e.gallery===1?'':'s'))+row('f-videos','Videos',e.videos.length+' video'+(e.videos.length===1?'':'s'))+'</div></div>';
  const ds=dates(draft);
  if(!oneOff)h+='<div class="stack"><p class="lbl">Upcoming dates</p><p class="p">Tap a date to change just that night.</p><div class="card">'+ds.map(k=>{const n=night(draft,k);const tag=n.cancelled||st==='Cancelled'?'<span class="dtag x">Cancelled</span>':st==='Ended'?'<span class="dtag">Ended</span>':Object.keys(n).length?'<span class="dtag">Changed</span>':'';return '<button class="row go" data-act="night" data-k="'+k+'"><span class="rt" style="flex:1">'+dLabel(k)+'</span>'+tag+'</button>';}).join('')+'</div></div>';
  h+='<div class="card"><button class="row go" data-act="f-guest"><span class="rb"><span class="rt">Guest list link</span></span></button><button class="row go" data-act="f-pause"><span class="rb"><span class="rt">Pause or end event</span>'+(st==='Paused'||st==='Ended'?'<span class="rl">'+st+'</span>':'')+'</span></button><button class="row go red" data-act="f-cancel-ev"><span class="rb"><span class="rt">'+(st==='Cancelled'?'Event cancelled: bring it back':'Cancel the event')+'</span>'+(st==='Cancelled'&&e.cancelReason&&e.cancelReason!=='No reason'?'<span class="rl">Reason: '+esc(e.cancelReason)+'</span>':'')+'</span></button></div>';
  h+='<button class="proto" data-act="proto-kind">Prototype: '+(oneOff?'show the weekly event':'show as a one-off event')+'</button>';
  $('main').innerHTML=h;}

function priceText(t){if(t.free)return 'Free';if(t.price===''||t.price==null)return 'Add a price';const st=(t.stages||[]).slice().sort((a,b)=>a.until<b.until?-1:1);return st.length?st.map(s=>money(s.price)+' until '+dLabel(s.until)).join(', then ')+', then '+money(t.price):money(t.price);}
function coverText(t,list){const ids=list.map(s=>s.id);const c=(t.sessions||[]).filter(id=>ids.includes(id));if(c.length===ids.length)return 'All sessions';return c.map(id=>list.find(s=>s.id===id).title||'Session').join(', ')||'No sessions';}
function tcard(t,list,act,extra,k,o){o=o||{};return '<button class="tcard" data-act="'+act+'" data-id="'+t.id+'"><span class="th"><span class="rt">'+esc(t.name)+'</span>'+(o.noPrice?'':'<b>'+esc(priceText(t))+'</b>')+'</span><span class="sold">'+(k?nightLine(t.sold||0,t.qty):allSold(t))+'</span>'+(o.perDate?'<span class="dl">'+dates(draft).map(d=>'<span class="d"><span>'+dLabel(d)+'</span><span>'+soldFor(t,d)+' of '+t.qty+'</span></span>').join('')+'</span>':'')+(extra||'')+'</button>';}
function renderTickets(){const e=draft.event;
  $('top').innerHTML='<button class="bk" data-act="back" aria-label="Back to the event"></button><span class="tt"><span class="tt1">'+esc(e.name)+'</span><span class="tt2">Tickets</span></span>';
  let h=(stripePending?'<div class="info">Connected. Stripe is still checking it.</div>':'')+(e.tickets.length?'<p class="p">Tap a ticket to change it.</p>':'<p class="p">No tickets yet. Add your first ticket.</p>');
  h+=e.tickets.map(t=>'<div class="card">'+tcard(t,e.sessions,'tk','','',{perDate:true})+'</div>').join('');
  h+='<button class="btn sec" data-act="tk-add">Add a ticket</button>';
  $('main').innerHTML=h;}
function ticketSheet(t,mode){const list=()=>mode==='night'?nightSessions(draft,cur).filter(s=>!s.cancelled):draft.event.sessions;
  const w=clone(t);w.stages=w.stages||[];delete w.sessions;
  openSheet({title:mode==='event-new'?'Add a ticket':mode==='night'?'Ticket for '+dLabel(cur)+' only':'Ticket',w,
    body(){const w=this.w;let h='';
      if(mode==='night')h+='<p class="hintx">One extra ticket, sold for '+dLabel(cur)+' only.</p>';
      h+='<div class="f"><label for="sf-tn">Ticket name</label><input class="in" id="sf-tn" data-f="name" value="'+esc(w.name)+'" placeholder="For example Class and party"></div>';
      h+='<div class="swrow"><span class="rt">Free ticket</span><button class="sw'+(w.free?' on':'')+'" id="sf-free" role="switch" aria-checked="'+(w.free?'true':'false')+'" aria-label="Free ticket" data-sa="free"></button></div>';
      h+='<div class="two">'+(w.free?'':'<div class="f"><label for="sf-tp">'+(w.stages.length?'Price after early bird (\u00a3)':'Price (\u00a3)')+'</label><input class="in" id="sf-tp" inputmode="decimal" data-f="price" value="'+esc(w.price)+'" placeholder="Add a price"></div>')+'<div class="f"><label for="sf-tq">'+(mode==='night'?'How many available':'How many available each night')+'</label><input class="in" id="sf-tq" inputmode="numeric" data-f="qty" value="'+esc(w.qty)+'">'+(w.sold?'<p class="hintx">'+w.sold+' already sold</p>':'')+'</div></div>'+(w.err?'<p class="warnl">'+esc(w.err)+'</p>':'');
      if(w.free)h+='<p class="hintx">Sales stay open until the night ends.</p>';else h+='<div class="f"><span class="flab">Early bird prices</span>'+(w.stages.length?w.stages.map((s,i)=>'<div class="stg"><div class="f"><label for="st-p'+i+'">Price (\u00a3)</label><input class="in" id="st-p'+i+'" inputmode="decimal" data-st="'+i+'" data-sf="price" value="'+esc(s.price)+'"></div><div class="f"><label for="st-u'+i+'">Until</label><input class="in" type="date" id="st-u'+i+'" data-st="'+i+'" data-sf="until" value="'+esc(s.until)+'"></div><button class="x" data-sa="rms" data-i="'+i+'" aria-label="Remove this early bird price">\u00d7</button></div>').join('')+'<p class="hintx">Then '+money(Number(w.price)||0)+'. Sales stay open until the night ends.</p><div id="sf-ebw">'+ebWarn(w)+'</div>':'<p class="hintx">One fixed price. Sales stay open until the night ends.</p>')+'<button class="btn sec" data-sa="adds">Add an early bird price</button>'+(mode==='night'?'':'<p class="hintx">Early bird prices end on the same date for every night.</p>')+'</div>';
      if(w.sold)h+='<p class="sold">'+(mode==='night'?nightLine(w.sold,w.qty):allSold(w))+'</p>';
      h+='<button class="btn" data-sa="done">Done</button>';
      if(mode==='event'||(mode==='night'&&night(draft,cur).nightTicket)){const locked=(w.sold||0)>0;h+='<button class="btn sec" data-sa="del"'+(locked?' disabled':'')+'>Remove this ticket</button>'+(locked?'<p class="hintx">Tickets are already sold, so this ticket cannot be removed.</p>':'');}
      return h;},
    adds(){const st=this.w.stages;const last=st[st.length-1];let u='2026-12-01';if(last&&last.until){const d=fromKey(last.until);d.setDate(d.getDate()+7);u=keyOf(d);}st.push({price:last?(Number(last.price)||0)+2:Math.max(0,(Number(this.w.price)||0)-2),until:u});},
    live(){const x=$('sf-ebw');if(x)x.innerHTML=ebWarn(this.w);},
    rms(el){this.w.stages.splice(+el.dataset.i,1);},
    free(){this.w.free=!this.w.free;},
    done(){const w=this.w;const q=parseInt(w.qty,10)||0;if(w.sold&&q<w.sold){w.err='How many available cannot be lower than '+w.sold+', the number already sold.';drawSheet();return;}delete w.err;const v={id:w.id,name:String(w.name).trim()||'Ticket',price:w.free?0:(String(w.price==null?'':w.price).trim()===''?'':Number(w.price)||0),qty:Math.max(0,parseInt(w.qty,10)||0),stages:(w.free?[]:w.stages).filter(s=>s.until).map(s=>({price:Number(s.price)||0,until:s.until})).sort((a,b)=>a.until<b.until?-1:1),sold:w.sold||0,money:w.money||0};if(w.free)v.free=true;
      closeSheet();
      if(mode==='night'){if(!same(v,night(draft,cur).nightTicket))commit(d=>{ensure(d,cur).nightTicket=v;});}
      else if(mode==='event-new')commit(d=>{d.event.tickets.push(v);});
      else{const i=draft.event.tickets.findIndex(x=>x.id===v.id);if(!same(v,draft.event.tickets[i]))commit(d=>{d.event.tickets[i]=v;});}},
    del(){closeSheet();if(mode==='night')commit(d=>{delete ensure(d,cur).nightTicket;});else commit(d=>{d.event.tickets=d.event.tickets.filter(x=>x.id!==t.id);});return false;}
  });}
function nrow(k,label,key,usual,display){const n=night(draft,cur);const has=key in n;
  return '<div class="row go'+(label.length>12?' stk':'')+'" data-act="n-f" data-key="'+key+'" role="button" tabindex="0"><span class="k">'+label+'</span><span class="rb"><span class="rt">'+esc(has?(display?display(n[key]):n[key]):(usual||'Add'))+'</span>'+
  (has?'<span class="ovr">Changed for this night</span><button class="back2" data-act="n-usual" data-key="'+key+'">Back to usual</button>':(usual?'<span class="rl">Usual</span>':''))+'</span></div>';}

function renderNight(){const e=draft.event;const n=night(draft,cur);const L=dLabel(cur);const list=nightSessions(draft,cur);
  $('top').innerHTML='<button class="bk" data-act="back" aria-label="Back to the event"></button><span class="tt"><span class="tt1">'+esc(e.name)+'</span><span class="tt2">'+L+' only</span></span>'+(n.cancelled?'':'<button class="topcx" data-act="n-cancel">Cancel this night</button>');
  let h='';
  if(n.cancelled){h+='<div class="cxbox"><span><b>This night is cancelled.</b> Dancers see Cancelled'+(n.cancelled==='No reason'?'.':' and your reason: '+esc(n.cancelled))+'</span><button class="btn sec" data-act="n-uncancel">Bring this night back</button></div>';}
  else h+='<div class="info">Changes here are for '+L+' only.</div>';
  h+='<div class="stack"><p class="lbl">Share this night</p><div class="btns"><button class="btn sec sm" data-act="n-sharecopy">Copy link</button><button class="btn sec sm" data-act="n-share">Share</button></div></div>';
  h+='<div class="'+(n.cancelled?'dim':'')+'" style="display:flex;flex-direction:column;gap:14px">';
  h+='<button class="btn sec" data-act="n-copy">Copy changes from another date</button>';
  h+='<div class="stack"><p class="lbl">Name and about</p><div class="card">'+nrow(cur,'Name for this night','title',e.name)+nrow(cur,'About this night','about',e.about)+'</div></div>';
  h+='<div class="stack"><p class="lbl">Venue</p><div class="card">'+nrow(cur,'Venue','venue',e.venue)+'</div></div>';
  h+='<div class="stack"><p class="lbl">Picture</p><div class="card">'+nrow(cur,'Picture','picture',e.flyer?'Usual flyer':'')+'</div></div>';
  const usualLink=e.pay==='link'&&e.payLink?e.payLink:'Usual';
  const canSell=stripe&&e.pay==='here',canLink=e.pay==='link';const needSell='<span class="rl">Connect Stripe and tap Sell tickets here on the event page first.</span>';
  h+='<div class="stack"><p class="lbl">Tickets</p><div class="card">'+(e.pay==='here'?e.tickets.map(t=>'<div class="price'+(priceOn(t,cur).length>14?' wrap':'')+'"><span class="rb"><span>'+esc(t.name)+'</span>'+(canSell?'<span class="sold">'+nightLine(soldFor(t,cur),t.qty)+'</span>':'')+'</span><b>'+esc(priceOn(t,cur))+'</b></div>').join(''):'')+(canLink?nrow(cur,'Ticket link','ticketLink',usualLink):'<div class="row off"><span class="k">Ticket link</span><span class="rb"><span class="rt">Not in use</span><span class="rl">Choose add a link on the event page first.</span></span></div>');
  if(n.nightTicket)h+=tcard(n.nightTicket,list.filter(s=>!s.cancelled),'n-ticket',canSell?'<span class="ovr">Ticket for this night only</span>':needSell,cur,{noPrice:e.pay!=='here'}).replace('class="tcard"','class="tcard'+(canSell?'':' off')+'" style="border-top:1px solid var(--line)"');
  else h+=canSell?'<div class="row"><button class="chg" data-act="n-ticket">Add a ticket for this night only</button></div>':'<div class="row off"><span class="rb"><span class="rt">Add a ticket for this night only</span>'+needSell+'</span></div>';
  h+='</div></div>';
  h+='<div class="card"><button class="row go" data-act="n-guest"><span class="rb"><span class="rt">Guest list for this night</span><span class="rl">Link for '+L+' only</span></span></button></div>';
  h+='<div class="stack"><p class="lbl">Sessions that night</p><div class="card">'+list.map(s=>{let tag='';
      if(s.cancelled)tag='<span class="ovr x">Cancelled for this night</span><button class="back2" data-act="ns-usual" data-id="'+s.id+'">Back to usual</button>';
      else if(s.added)tag='<span class="ovr">This night only</span>';
      else if(s.changed)tag='<span class="ovr">Changed for this night</span><button class="back2" data-act="ns-usual" data-id="'+s.id+'">Back to usual</button>';
      return '<div class="sess'+(s.cancelled?' cx':'')+'" data-act="nsess" data-id="'+s.id+'" role="button" tabindex="0"><span class="time">'+s.start+'<small>to '+s.end+'</small></span><span class="rb"><span class="rt">'+esc(s.title)+'</span><span class="rl">'+esc(s.type+(people(s)?' · '+people(s):''))+'</span>'+tag+'</span>'+(!s.cancelled&&!s.added?'<button class="chg" data-act="ns-cx" data-id="'+s.id+'" aria-label="Cancel '+esc(s.title)+' for this night">Cancel</button>':'')+'</div>';}).join('')+
     '<div class="row"><button class="chg" data-act="nsess-add">Add a session for this night only</button></div></div><p class="p" style="font-size:13px">Tap a session to change its title, time or level, add or remove a teacher or DJ, or cancel it.</p></div>';
  h+='</div>';
  $('main').innerHTML=h;}

/* ---------- sheets ---------- */
function openSheet(s){sheet=s;drawSheet();}
function closeSheet(){sheet=null;$('sheetHost').innerHTML='';}
function drawSheet(){const s=sheet;const body=s.body();
  $('sheetHost').innerHTML='<div class="scrim" data-sa="scrim"><div class="sheet" role="dialog" aria-label="'+esc(s.title)+'"><span class="grab"></span><div class="sh"><h3>'+esc(s.title)+'</h3><button class="x" data-sa="close" aria-label="Close">×</button></div>'+body+'</div></div>';
  $('sheetHost').querySelectorAll('[data-f]').forEach(el=>{el.addEventListener('input',()=>{s.w[el.dataset.f]=el.value;const c=$('sf-cnt');if(c&&el.id==='sf-v')c.textContent=(+c.dataset.max-el.value.length)+' left';if(el.dataset.redraw)drawSheet();if(s.live)s.live();});});
  $('sheetHost').querySelectorAll('[data-st]').forEach(el=>{el.addEventListener('input',()=>{s.w.stages[+el.dataset.st][el.dataset.sf]=el.value;if(s.live)s.live();});});}
function textSheet(title,value,opts,done){openSheet({title,w:{v:value||''},body(){const ml=opts&&opts.multi;const t=opts&&opts.type||'text';
  const mx=opts&&opts.max;
  return '<div class="f">'+(ml?'<textarea class="in" id="sf-v" data-f="v"'+(mx?' maxlength="'+mx+'"':'')+' placeholder="'+esc(opts.ph||'')+'">'+esc(this.w.v)+'</textarea>'+(mx?'<p class="hintx" id="sf-cnt" data-max="'+mx+'" aria-live="polite">'+(mx-this.w.v.length)+' left</p>':''):'<input class="in" id="sf-v" type="'+t+'" data-f="v" value="'+esc(this.w.v)+'" placeholder="'+esc(opts&&opts.ph||'')+'">')+(opts&&opts.hint?'<p class="hintx">'+esc(opts.hint)+'</p>':'')+(this.w.err?'<p class="warnl">'+esc(this.w.err)+'</p>':'')+'</div><button class="btn" data-sa="done">Done</button>';},
  done(){const v=this.w.v.trim();if(!v&&opts&&opts.req){this.w.err=opts.req;drawSheet();return;}closeSheet();if(v!==(value||''))commit(d=>done(d,v));}});}

function personBlock(w,key,label,pool){const avail=pool.filter(p=>!w[key].includes(p));
  return '<div class="f"><span class="flab">'+label+'</span><div class="chips">'+(w[key].length?w[key].map((p,i)=>'<span class="chip">'+esc(p)+'<button data-sa="rm" data-key="'+key+'" data-i="'+i+'" aria-label="Remove '+esc(p)+'">×</button></span>').join(''):'<span class="hintx">None yet</span>')+'</div>'+
  (avail.length?'<div class="addp"><select class="in" id="sf-add-'+key+'" aria-label="Add '+label+'">'+avail.map(p=>'<option>'+esc(p)+'</option>').join('')+'</select><button class="btn sec" data-sa="addp" data-key="'+key+'">Add</button></div>':'')+'</div>';}

function sessionSheet(mode,s){/* mode: event | event-new | night | night-new | night-added */
  const w=clone(s);['teachers','djs','dancers'].forEach(k=>{w[k]=w[k]||[];});
  openSheet({title:mode==='event-new'?'Add a session':mode==='night-new'?'Add a session for this night only':mode.startsWith('night')?'Session on '+dLabel(cur):'Session',w,
    body(){const w=this.w;const lev=w.type==='Class'||w.type==='Masterclass';let h='';
      if(mode.startsWith('night')&&mode!=='night-new'&&mode!=='night-added')h+='<div class="info">Changes here are for '+dLabel(cur)+' only.</div>';
      h+='<div class="f"><label for="sf-title">Title</label><input class="in" id="sf-title" data-f="title" value="'+esc(w.title)+'"></div>';
      h+='<div class="f"><span class="flab">Type</span><div class="chips">'+TYPES.map(t=>'<button class="tog'+(w.type===t?' on':'')+'" data-sa="type" data-v="'+t+'">'+t+'</button>').join('')+'</div></div>';
      h+='<div class="two"><div class="f"><label for="sf-start">Starts</label><input class="in" type="time" id="sf-start" data-f="start" value="'+esc(w.start)+'"></div><div class="f"><label for="sf-end">Ends</label><input class="in" type="time" id="sf-end" data-f="end" value="'+esc(w.end)+'"></div></div>';
      if(lev)h+='<div class="f"><span class="flab">Level</span><div class="chips">'+LEVELS.map(l=>'<button class="tog'+(w.levels.includes(l)?' on':'')+'" data-sa="lvl" data-v="'+l+'">'+l+'</button>').join('')+'</div></div>';
      if(lev)h+=personBlock(w,'teachers','Teachers',POOL.teachers);
      else if(w.type==='Party')h+=personBlock(w,'djs','DJs',POOL.djs)+personBlock(w,'dancers','Dancers',POOL.dancers);
      else h+=personBlock(w,'dancers','Dancers',POOL.dancers);
      {const gone=dropped(w);if(gone.length)h+='<p class="warnl soft">'+esc(gone.join(', '))+' will be removed.</p>';}
      {const bt=badTime(w);h+='<p class="warnl" id="sf-endw">'+(bt?'Ends before it starts. Check the end time.':'')+'</p><button class="btn" data-sa="done"'+(bt?' disabled':'')+'>Done</button>';}
      if(mode==='event'){const one=draft.event.sessions.length<=1;h+='<button class="btn sec" data-sa="del"'+(one?' disabled':'')+'>Remove this session</button>'+(one?'<p class="hintx">An event needs at least one session.</p>':'');}
      if(mode==='night')h+='<button class="btn sec" data-sa="cx">'+(w.cancelled?'Bring this session back':'Cancel this session for this night')+'</button>';
      if(mode==='night-added')h+='<button class="btn sec" data-sa="del">Remove this session</button>';
      return h;},
    type(el){this.w.type=el.dataset.v;},
    live(){const b=badTime(this.w);const m=$('sf-endw');if(m)m.textContent=b?'Ends before it starts. Check the end time.':'';const d=$('sheetHost').querySelector('[data-sa=done]');if(d)d.disabled=b;},
    lvl(el){const l=el.dataset.v;const a=this.w.levels;const i=a.indexOf(l);if(i>=0)a.splice(i,1);else a.push(l);},
    done(){if(badTime(this.w))return;const w=strip(this.w);closeSheet();
      if(mode==='event'){const i=draft.event.sessions.findIndex(x=>x.id===s.id);if(!same(draft.event.sessions[i],w))commit(d=>{d.event.sessions[i]=w;});}
      else if(mode==='event-new'){commit(d=>{d.event.sessions.push(w);});}
      else if(mode==='night-new'){commit(d=>{const n=ensure(d,cur);(n.added=n.added||[]).push(w);});}
      else if(mode==='night-added'){commit(d=>{const n=ensure(d,cur);const i=n.added.findIndex(x=>x.id===s.id);n.added[i]=(delete w.added,w);});}
      else{const base=draft.event.sessions.find(x=>x.id===s.id);const o={};['title','type','start','end','levels','teachers','djs','dancers'].forEach(f=>{if(!same(base[f],w[f]))o[f]=w[f];});if(w.cancelled)o.cancelled=true;
        const prev=(night(draft,cur).sess||{})[s.id]||{};if(!same(prev,o))commit(d=>{const n=ensure(d,cur);n.sess=n.sess||{};n.sess[s.id]=o;});}},
    del(){closeSheet();if(mode==='event')commit(d=>{d.event.sessions=d.event.sessions.filter(x=>x.id!==s.id);Object.values(d.nights).forEach(n=>{if(n.sess)delete n.sess[s.id];});});else commit(d=>{const n=ensure(d,cur);n.added=n.added.filter(x=>x.id!==s.id);});},
    cx(){this.w.cancelled=!this.w.cancelled;this.done();return false;}
  });}

let uid=10;
function newSession(){return {id:'s'+(++uid),type:'Class',title:'',start:'19:00',end:'20:00',levels:[],teachers:[],djs:[],dancers:[]};}

function listSheet(title,key,pool,label){openSheet({title,w:{list:clone(draft.event[key])},body(){const w=this.w;return personBlock(w,'list',label,pool)+'<button class="btn" data-sa="done">Done</button>';},
  done(){const v=this.w.list;closeSheet();if(!same(v,draft.event[key]))commit(d=>{d.event[key]=v;});}});}

/* ---------- actions ---------- */
function leaveEditor(leave){if(!changes().length){leave();return;}A._unused(leave);}
const A={
  back(){if(screen==='night'||screen==='tickets'){go('event');return;}leaveEditor(()=>toast('The events list is not part of this prototype.'));},
  tab(el){const tb=el.dataset.t;leaveEditor(()=>toast((tb==='Events'?'The events list':tb)+' is not part of this prototype.'));},
  _unused(leave){openSheet({title:'You have unsaved changes',w:{},body(){return '<p class="p">'+esc($('sum').textContent)+'</p><button class="btn" data-sa="sv">Save</button><button class="btn sec" data-sa="tw">Throw away changes</button><button class="btn sec" data-sa="close">Keep editing</button>';},
      sv(){closeSheet();saved=clone(draft);hist=[];render();leave();toast('Saved');return false;},
      tw(){closeSheet();draft=clone(saved);hist=[];render();leave();return false;}});},

  undo(){if(hist.length){const prev=draft;draft=hist.pop();const l=changes(draft,prev);render();toast(l.length?'Undone: '+(l.length>2?l[0]+' and '+(l.length-1)+' more':l.join(', ')):'Undone');}},
  save(){saved=clone(draft);hist=[];render();toast('Saved');},
  night(el){go('night',el.dataset.k);},
  'f-name'(){textSheet('Name',draft.event.name,{req:'Add a name'},(d,v)=>{d.event.name=v;});},
  'f-about'(){textSheet('About',draft.event.about,{multi:true,ph:'What happens, who it is for'},(d,v)=>{d.event.about=v;});},
  'f-venue'(){textSheet('Venue',draft.event.venue,{hint:'Search for a venue (sample: type a name).',req:'Add a venue'},(d,v)=>{d.event.venue=v;});},
  'f-music'(){openSheet({title:'Music',w:{m:clone(draft.event.music)},body(){return '<div class="chips">'+MUSIC.map(m=>'<button class="tog'+(this.w.m.includes(m)?' on':'')+'" data-sa="t" data-v="'+m+'">'+m+'</button>').join('')+'</div><button class="btn" data-sa="done">Done</button>';},
    t(el){const a=this.w.m,i=a.indexOf(el.dataset.v);if(i>=0)a.splice(i,1);else a.push(el.dataset.v);},
    done(){const v=this.w.m;closeSheet();if(!same(v,draft.event.music))commit(d=>{d.event.music=v;});}});},
  'f-repeat'(){openSheet({title:'Change repeat',w:clone(draft.event.repeat),body(){const w=this.w;return '<div class="f"><label for="sf-day">Every</label><select class="in" id="sf-day" data-f="day">'+DAYS.map(x=>'<option'+(x===w.day?' selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="f"><label for="sf-end">Last date (leave empty for no end date)</label><input class="in" type="date" id="sf-end" data-f="end" value="'+esc(w.end)+'"></div><button class="btn" data-sa="done">Done</button>';},
    done(){const v=clone(this.w);closeSheet();if(same(v,draft.event.repeat))return;const tmp=clone(draft);tmp.event.repeat=v;const keep=dates(tmp);const lost=Object.keys(draft.nights).filter(k=>!keep.includes(k)).sort();
      const apply=()=>commit(d=>{d.event.repeat=v;lost.forEach(k=>{delete d.nights[k];});});
      if(!lost.length){apply();return;}
      openSheet({title:'Change repeat?',w:{},body(){return '<p class="p">These dates have their own changes. They will be removed:</p><div class="card">'+lost.map(k=>'<div class="row"><span class="rt" style="flex:1">'+dLabel(k)+'</span><span class="dtag'+(draft.nights[k].cancelled?' x">Cancelled':'">Changed')+'</span></div>').join('')+'</div><button class="btn dng" data-sa="ok">Change repeat</button><button class="btn sec" data-sa="close">Keep the current repeat</button>';},
        ok(){closeSheet();apply();return false;}});}});},
  'f-date'(){openSheet({title:'Change date',w:{v:draft.event.date},body(){return '<div class="f"><label for="sf-date">Date</label><input class="in" type="date" id="sf-date" data-f="v" value="'+esc(this.w.v)+'"></div><p class="hintx">Start and end times come from the programme.</p><button class="btn" data-sa="done">Done</button>';},
    done(){const v=this.w.v;closeSheet();if(v&&v!==draft.event.date)commit(d=>{d.event.date=v;});}});},
  'proto-kind'(){oneOff=!oneOff;render();},
  'f-orgs'(){listSheet('Who runs it','organisers',POOL.orgs,'Organisers');},
  sess(el){sessionSheet('event',draft.event.sessions.find(s=>s.id===el.dataset.id));},
  'sess-add'(){sessionSheet('event-new',newSession());},
  tickets(){go('tickets');},
  tk(el){ticketSheet(draft.event.tickets.find(x=>x.id===el.dataset.id),'event');},
  'tk-add'(){ticketSheet({id:'t'+(++uid),name:'',price:10,qty:50,stages:[],sold:0,money:0},'event-new');},
  sellhere(){const toHere=()=>{if(draft.event.pay!=='here')commit(d=>{d.event.pay='here';});};
    if(stripe){toHere();go('tickets');return;}
    openSheet({title:'Stripe sign-up',w:{},body(){return '<p class="p">In the real app this opens Stripe to make or link your account. In this prototype, tap Connect.</p><button class="btn" data-sa="ok">Connect Stripe</button><button class="btn sec" data-sa="nn">Not now</button>';},
      nn(){closeSheet();skipped=true;render();return false;},
      ok(){closeSheet();toHere();const had=changes().length;saved=clone(draft);hist=[];render();toast(had?'Saving your changes, then taking you to Stripe':'Taking you to Stripe');setTimeout(()=>{stripe=true;stripePending=true;go('tickets');},1400);return false;}});},
  paypick(el){const v=el.dataset.v;const e=draft.event;const sold=e.tickets.reduce((a,t)=>a+(t.sold||0),0);
    const run=()=>{if(v==='door'){if(e.pay!=='door')commit(d=>{d.event.pay='door';});}
      else textSheet('Link to buy tickets',e.payLink,{type:'url',ph:'https://'},(d,x)=>{d.event.payLink=x;d.event.pay='link';});};
    if(e.pay==='here'&&stripe&&sold>0){openSheet({title:'Switch how dancers pay?',w:{},body(){return '<p class="p">'+sold+' tickets already sold here. Buyers keep their tickets. New buyers will not be able to buy here.</p><button class="btn" data-sa="sw">Switch</button><button class="btn sec" data-sa="close">Keep selling</button>';},
      sw(){closeSheet();run();return false;}});}
    else run();},
  paychange(){const e=draft.event;openSheet({title:'How dancers pay',w:{},body(){return '<p class="p">Or tap Sell tickets here to sell on Bachata Calendar again.</p>'+(e.pay!=='door'?'<button class="btn sec" data-sa="door">Pay at the door</button>':'')+'<button class="btn sec" data-sa="link">'+(e.pay==='link'?'Change the link':'Add a link')+'</button>';},
    door(){closeSheet();A.paypick({dataset:{v:'door'}});return false;},link(){closeSheet();A.paypick({dataset:{v:'link'}});return false;}});},
  'f-flyer'(){openSheet({title:'Flyer',w:{},body(){return '<div class="flyer">'+esc(draft.event.flyer||'No flyer')+'</div><button class="btn" data-sa="rep">Choose a new flyer</button>'+(draft.event.flyer?'<button class="btn sec" data-sa="rem">Remove the flyer</button>':'');},
    rep(){closeSheet();commit(d=>{d.event.flyer='New flyer (sample)';});return false;},rem(){closeSheet();commit(d=>{d.event.flyer='';});return false;}});},
  'f-gallery'(){openSheet({title:'Gallery',w:{},body(){return '<p class="p">'+draft.event.gallery+' photos</p><div class="btns"><button class="btn sec" data-sa="minus"'+(draft.event.gallery?'':' disabled')+'>Remove a photo</button><button class="btn" data-sa="plus">Add a photo</button></div>';},
    plus(){commit(d=>{d.event.gallery++;});},minus(){if(draft.event.gallery)commit(d=>{d.event.gallery--;});}});},
  'f-videos'(){openSheet({title:'Videos',w:{v:''},body(){return (draft.event.videos.length?'<div class="chips">'+draft.event.videos.map((u,i)=>'<span class="chip">'+esc(u)+'<button data-sa="rmv" data-i="'+i+'" aria-label="Remove video">×</button></span>').join('')+'</div>':'<p class="hintx">No videos yet.</p>')+'<div class="f"><label for="sf-vid">Video link</label><input class="in" id="sf-vid" type="url" data-f="v" placeholder="https://" value="'+esc(this.w.v)+'"></div><button class="btn" data-sa="addv">Add video</button>';},
    addv(){const v=this.w.v.trim();if(!v)return;this.w.v='';commit(d=>{d.event.videos.push(v);});},rmv(el){commit(d=>{d.event.videos.splice(+el.dataset.i,1);});}});},
  'f-guest'(){openSheet({title:'Guest list link',w:{},body(){return '<p class="p">Share this link so dancers can put their name down.</p><div class="info" id="glink" style="user-select:all">bachatacalendar.co.uk/guest/thursday-bachata-social</div><button class="btn sec" data-sa="copy">Copy link</button>';},
    copy(){const t=$('glink').textContent;try{navigator.clipboard.writeText(t).then(()=>toast('Link copied'),()=>toast('Select the link to copy it'));}catch(e){toast('Select the link to copy it');}return false;}});},
  'f-pause'(){openSheet({title:'Pause or end event',w:{},body(){const st=draft.event.status;return (st!=='Live'?'<button class="btn" data-sa="s" data-v="Live">Make it live again</button>':'')+(st!=='Paused'?'<button class="btn sec" data-sa="s" data-v="Paused">Pause the event</button><p class="hintx">Dates stop showing until you make it live again.</p>':'')+(st!=='Ended'?'<button class="btn sec" data-sa="s" data-v="Ended">End the event</button><p class="hintx">No new dates after today.</p>':'');},
    s(el){const v=el.dataset.v;if(v==='Live'){closeSheet();commit(d=>{d.event.status=v;});return false;}const was=draft.event.status;
      openSheet({title:'Are you sure?',w:{},body(){return '<p class="p">'+(v==='Paused'?'Dates stop showing until you make it live again.':'No new dates after today. Upcoming dates show Ended.')+'</p><button class="btn" data-sa="ok">'+(v==='Paused'?'Pause the event':'End the event')+'</button><button class="btn sec" data-sa="close">Keep it '+was.toLowerCase()+'</button>';},
        ok(){closeSheet();commit(d=>{d.event.status=v;});return false;}});return false;}});},
  'f-cancel-ev'(){if(draft.event.status==='Cancelled'){openSheet({title:'Make this event live again?',w:{},body(){return '<p class="p">Every upcoming date shows to dancers again.</p><button class="btn" data-sa="ok">Make it live</button><button class="btn sec" data-sa="close">Keep it cancelled</button>';},ok(){closeSheet();now(d=>{d.event.status='Live';delete d.event.cancelReason;});return false;}});return;}
    const sold=dates(draft).filter(k=>!night(draft,k).cancelled).reduce((a,k)=>a+nightSold(k),0);
    openSheet({title:'Cancel the event',w:{r:CX_REASONS[0]},body(){return '<p class="p">Every upcoming date shows Cancelled and your reason to dancers.</p>'+refund(sold)+reasonOpts(this.w)+'<p class="hintx">This takes effect straight away.</p><button class="btn dng" data-sa="ok">Cancel the event</button><button class="btn sec" data-sa="close">Keep the event</button>';},
    r(el){this.w.r=el.dataset.v;},ok(){const r=this.w.r;closeSheet();now(d=>{d.event.status='Cancelled';d.event.cancelReason=r;});return false;}});},

  /* one night */
  'n-f'(el){const key=el.dataset.key;const n=night(draft,cur);const e=draft.event;
    const cfg={time:['Time for this night',n.time||span(nightSessions(draft,cur)),{hint:'For example 20:00 to 00:00.'}],venue:['Venue for this night',n.venue||e.venue,{}],title:['Name for this night',n.title||e.name,{hint:'Leave as the event name unless this night has its own name.'}],about:['About this night',n.about||e.about,{multi:true,max:2000,ph:'What is different about this night'}],picture:['Picture for this night','',{}],ticketLink:['Ticket link for this night',n.ticketLink||'',{type:'url',ph:'https://'}]}[key];
    if(key==='picture'){openSheet({title:'Picture for this night',w:{},body(){return '<div class="flyer">'+esc(n.picture||'Usual flyer')+'</div><button class="btn" data-sa="rep">Choose a picture for this night</button>';},rep(){closeSheet();commit(d=>{ensure(d,cur).picture='Night picture (sample)';});return false;}});return;}
    const usual={title:e.name,about:e.about,venue:e.venue}[key];
    textSheet(cfg[0],cfg[1],cfg[2],(d,v)=>{const nn=ensure(d,cur);if(v&&v!==usual)nn[key]=v;else delete nn[key];});},
  'n-sharecopy'(){const u='bachatacalendar.co.uk/e/thursday-bachata-social/'+cur;try{navigator.clipboard.writeText(u).catch(()=>{});}catch(e){}toast('Link copied');},
  'n-share'(){toast('Phone share menu opens here');},
  'n-guest'(){const u='bachatacalendar.co.uk/guest/thursday-bachata-social/'+cur;openSheet({title:'Guest list for '+dLabel(cur),w:{},body(){return '<p class="p">Share this link so dancers can put their name down for this night.</p><div class="info" id="glink" style="user-select:all;word-break:break-all">'+u+'</div><button class="btn sec" data-sa="copy">Copy link</button>';},
    copy(){try{navigator.clipboard.writeText(u).then(()=>toast('Link copied'),()=>toast('Select the link to copy it'));}catch(e){toast('Select the link to copy it');}return false;}});},
  'n-usual'(el){const key=el.dataset.key;commit(d=>{delete ensure(d,cur)[key];});},
  'n-ticket'(){const t=night(draft,cur).nightTicket||{id:'n'+(++uid),name:'',price:10,qty:50,stages:[],sold:0,money:0};ticketSheet(t,'night');},
  nsess(el){const id=el.dataset.id;const s=nightSessions(draft,cur).find(x=>x.id===id);const w=clone(s);delete w.changed;if(s.added){delete w.added;sessionSheet('night-added',w);}else sessionSheet('night',w);},
  'nsess-add'(){sessionSheet('night-new',newSession());},
  'ns-usual'(el){const id=el.dataset.id;commit(d=>{const n=ensure(d,cur);if(n.sess)delete n.sess[id];});},
  'n-copy'(){const SKIP=['cancelled','nightTicket','ticketLink'];const own=n=>Object.keys(n).filter(x=>!SKIP.includes(x));const others=Object.keys(draft.nights).filter(k=>k!==cur&&own(draft.nights[k]).length);const what=k=>[...new Set(own(draft.nights[k]).map(x=>N_LABEL[x]))].join(', ');
    openSheet({title:'Copy changes from another date',w:{},body(){if(!others.length)return '<p class="p">No other date has its own changes yet.</p>';return '<p class="hintx">Copies that date&#39;s changes to '+dLabel(cur)+'. Tickets and cancelling are not copied.</p><div class="card">'+others.map(k=>'<button class="row go" data-sa="pick" data-k="'+k+'"><span class="rb"><span class="rt">'+dLabel(k)+'</span><span class="rl">'+esc(what(k))+'</span></span></button>').join('')+'</div>';},
    pick(el){const k=el.dataset.k;openSheet({title:'Copy from '+dLabel(k)+'?',w:{},body(){return '<p class="p">'+esc(what(k))+' will be copied to '+dLabel(cur)+'. Changes already made to '+dLabel(cur)+' are replaced. Tickets and cancelling are not copied.</p><button class="btn" data-sa="ok">Copy changes</button><button class="btn sec" data-sa="close">Do not copy</button>';},
      ok(){const src=clone(draft.nights[k]);SKIP.forEach(x=>{delete src[x];});closeSheet();commit(d=>{const old=night(d,cur);SKIP.forEach(x=>{if(x in old)src[x]=old[x];});d.nights[cur]=src;});toast('Changes copied from '+dLabel(k));return false;}});return false;}});},
  'n-cancel'(){openSheet({title:'Cancel '+dLabel(cur),w:{r:CX_REASONS[0]},body(){const w=this.w;const sold=nightSold(cur);return '<p class="p">Dancers see Cancelled and your reason.</p>'+refund(sold)+reasonOpts(w)+'<p class="hintx">This takes effect straight away.</p><button class="btn dng" data-sa="ok">Cancel this night</button><button class="btn sec" data-sa="close">Keep this night</button>';},
    r(el){this.w.r=el.dataset.v;},ok(){const r=this.w.r;closeSheet();now(d=>{ensure(d,cur).cancelled=r;});return false;}});},
  'ns-cx'(el){const id=el.dataset.id;const s=nightSessions(draft,cur).find(x=>x.id===id);commit(d=>{const n=ensure(d,cur);n.sess=n.sess||{};n.sess[id]=Object.assign({},n.sess[id]||{},{cancelled:true});});toast((s.title||'Session')+' cancelled for this night');},
  'n-uncancel'(){now(d=>{delete ensure(d,cur).cancelled;});}
};

function placeToast(){const t=$('toast'),b=$('bar');if(t&&b)t.style.bottom=(b.hidden?72:60+b.offsetHeight+12)+'px';}
let tt;function toast(m){const t=$('toast');placeToast();t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>{t.hidden=true;},1800);}

$('phone').addEventListener('click',ev=>{
  const sa=ev.target.closest('[data-sa]');
  if(sa&&sheet){const a=sa.dataset.sa;if(a==='scrim'&&ev.target!==sa)return;if(a==='close'||a==='scrim'){closeSheet();return;}
    if(a==='rm'){sheet.w[sa.dataset.key].splice(+sa.dataset.i,1);drawSheet();return;}
    if(a==='addp'){const sel=$('sf-add-'+sa.dataset.key);if(sel){sheet.w[sa.dataset.key].push(sel.value);drawSheet();}return;}
    if(sa.disabled)return;const r=sheet[a]&&sheet[a](sa);if(r!==false&&sheet&&a!=='done')drawSheet();return;}
  const el=ev.target.closest('[data-act]');if(!el)return;const fn=A[el.dataset.act];if(fn){ev.stopPropagation();fn(el);}
});
$('phone').addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[role=button][data-act]')){ev.preventDefault();ev.target.click();}});
render();
})();
</script>

