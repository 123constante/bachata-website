<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>
<title>Post-pay Dashboard Polish</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap">
<style>
/* Layout: control strip on top, one 390px phone frame below. Colours copied from the live dancer app (dancer.css / dancer-color.css). Single dark look by choice. */
:root{
  --bg:#202226; --card:#2A2D32; --card2:#33373D; --line:#3D4148; --mut:#A3A9B3; --fg:#F1F2F4;
  --accent:#F5865A; --on-accent:#1D0A03; --plum:#C9ADFF; --teal:#4FE0CF; --gold:#FFCF66; --rose:#FF9CC0;
  --sun:linear-gradient(120deg,#f0703a 0%,#e8487f 52%,#8a4dff 100%);
  --page:#15161A;
  --font:'Outfit',system-ui,-apple-system,'Segoe UI',sans-serif;
  color-scheme:dark;
}
*{box-sizing:border-box}
body{background:var(--page);color:var(--fg);font-family:var(--font);margin:0;
  padding-block:16px 32px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.wrap{max-width:430px;margin:0 auto;display:grid;gap:12px}
.note{font-size:13px;color:var(--mut);line-height:1.45;margin:0}
.seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}
.seg button{font:600 13px var(--font);min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer;padding:6px 8px;line-height:1.2}
.seg button[aria-pressed="true"]{color:var(--on-accent);background:var(--accent);border-color:var(--accent)}
.seg button:focus-visible,.tab:focus-visible,.lockable:focus-visible{outline:2px solid var(--plum);outline-offset:2px}

/* phone */
.phone{position:relative;width:100%;max-width:390px;margin:0 auto;height:780px;background:var(--bg);border:1px solid var(--line);border-radius:28px;overflow:hidden;display:flex;flex-direction:column;isolation:isolate}
.phone::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(520px 260px at 0% 0%,rgba(138,77,255,.14),transparent 70%),radial-gradient(520px 260px at 100% 0%,rgba(240,112,58,.12),transparent 70%)}
.hdr{position:relative;z-index:2;min-height:52px;padding:0 12px;display:flex;align-items:center;gap:8px;background:var(--bg);border-bottom:1px solid var(--line)}
.chip{width:28px;height:28px;border-radius:9px;background:var(--sun);display:grid;place-items:center}
.logo{font-weight:800;font-size:16px;letter-spacing:-.01em}
.role{font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--card2);color:var(--plum)}
.sw{margin-left:auto;min-height:44px;display:flex;align-items:center;gap:8px;padding:0 12px 0 6px;border-radius:99px;border:1px solid var(--line);background:var(--card);font-size:14px;font-weight:600}
.av{width:32px;height:32px;border-radius:50%;background:var(--card2);display:grid;place-items:center;font-size:13px;font-weight:700;color:var(--plum)}
.body{position:relative;z-index:1;flex:1;overflow-y:auto;padding:12px 12px 16px;display:grid;gap:12px;align-content:start}
h1{font-size:26px;font-weight:800;line-height:1.15;margin:0;letter-spacing:-.02em}
.title{font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-.025em;margin:0}
.sub{font-size:15px;color:var(--mut);margin:4px 0 0}
.kick{font-size:14px;font-weight:700;color:var(--mut)}
.sec{font-size:15px;font-weight:700}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden}
.pad{padding:16px}
.btn{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:12px;background:var(--accent);color:var(--on-accent);font:800 15px var(--font);border:0;width:100%;cursor:pointer}
.ghost{background:var(--card2);color:var(--fg);font-weight:700}
h2{font-size:21px;font-weight:800;margin:0 0 4px}
.mut{color:var(--mut);font-size:14px}
.bar{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:10px 0}
.bar i{height:6px;border-radius:3px;background:var(--line)}
.bar i.on{background:var(--accent)}
.row{display:flex;align-items:center;gap:12px;min-height:64px;padding:14px 16px;border-top:1px solid var(--line);width:100%;background:none;border-left:0;border-right:0;border-bottom:0;color:inherit;font-family:inherit;text-align:left}
.row:first-child{border-top:0}
.row b{display:block;font-size:16px;font-weight:700}
.row span.s{display:block;font-size:14px;color:var(--mut)}
.row .t{flex:1;min-width:0}
.chev{color:var(--mut)}
.tkt{display:flex;align-items:center;gap:12px;padding:12px 14px;width:100%;background:none;border:0;color:inherit;font-family:inherit;text-align:left;cursor:pointer}
.tkt .ic{width:44px;height:44px;border-radius:12px;background:rgba(245,134,90,.14);color:var(--accent);display:grid;place-items:center}
.tkt b{font-size:16px;font-weight:700;display:block}
.tkt span.s{font-size:13px;color:var(--mut)}
.pill{font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:rgba(79,224,207,.14);color:var(--teal)}
/* big ticket */
.big{padding:12px;display:grid;justify-items:center;gap:6px;text-align:center}
.big .top{display:flex;justify-content:space-between;width:100%;align-items:center;font-size:14px;font-weight:600}
.qr{width:220px;max-width:100%;padding:8px;background:#fff;border-radius:10px;line-height:0}
.qr svg{width:100%;height:auto;display:block}
.code{font-size:12px;color:var(--mut)} .code b{display:block;font-size:16px;color:#fff;letter-spacing:.08em}
/* night rows */
.night{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
.night:first-child{border-top:0}
.date{width:48px;height:48px;border-radius:12px;background:rgba(201,173,255,.14);color:var(--plum);display:grid;place-items:center;text-align:center;line-height:1.05;flex:none}
.date small{font-size:11px;display:block}.date strong{font-size:20px;font-weight:800;display:block}
.night b{font-size:15px;font-weight:700;display:block}.night span.s{font-size:13px;color:var(--mut)}
/* tab bar */
.tabs{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);min-height:60px;background:var(--card);border-top:1px solid var(--line)}
.tab{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:600 12px var(--font);color:var(--mut);background:none;border:0;border-radius:10px;min-height:44px;cursor:pointer}
.tab[aria-current="page"]{color:#fff}
.tab[aria-current="page"] svg{color:var(--accent);filter:drop-shadow(0 0 6px rgba(240,112,58,.7))}
.tab[aria-current="page"]::before{content:"";position:absolute;top:0;left:28%;right:28%;height:3px;border-radius:0 0 3px 3px;background:var(--sun)}
.tab .lk{position:absolute;right:calc(50% - 22px);top:8px;color:var(--gold)}
svg{flex:none}

/* ===== locked looks ===== */
.lockable{position:relative;cursor:pointer;display:block;width:100%;background:none;border:0;padding:0;color:inherit;font-family:inherit;text-align:left}
.lockico{color:var(--gold);flex:none}
/* A: normal + small lock (lock replaces chevron) */
.vA .lockable .chev{display:none}
.vA .lockable .lockico{display:block}
.lockable .lockico{display:none}
/* B: faded + lock */
.vB .lockable>*{opacity:.42}
.vB .lockable .lockico{display:block;opacity:1}
.vB .lockable .chev{display:none}
.vB .lockable{position:relative}
.vB .lockable .badge{opacity:1}
/* C: blurred + centred lock chip */
.vC .lockable>.in{filter:blur(4.5px);opacity:.8;pointer-events:none}
.vC .lockable .chev{display:none}
.badge{display:none}
.vB .lockable .badge,.vC .lockable .badge{display:flex}
.vC .lockable .badge{position:absolute;inset:0;align-items:center;justify-content:center}
.vB .lockable .badge{position:absolute;right:14px;top:50%;transform:translateY(-50%)}
.badge span{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:99px;font-size:13px;font-weight:700;color:var(--gold);background:rgba(32,34,38,.88);border:1px solid rgba(255,207,102,.55)}
.vB .badge span{padding:6px;background:rgba(32,34,38,.9)}
.vB .badge span em{display:none}
.vA .badge{display:none}
/* sheet */
.scrim{position:absolute;inset:0;z-index:10;background:rgba(0,0,0,.55);display:flex;align-items:flex-end}
.scrim[hidden]{display:none}
.sheet{width:100%;background:var(--card);border-top:1px solid var(--line);border-radius:28px 28px 0 0;padding:10px 16px 20px;display:grid;gap:10px;box-shadow:0 -12px 40px rgba(0,0,0,.55)}
.grab{width:40px;height:4px;border-radius:2px;background:#7b828d;margin:0 auto 4px}
.sheet h3{font-size:17px;font-weight:700;margin:0;text-align:center}
.sheet p{margin:0;text-align:center;color:var(--mut);font-size:14px}
@media (prefers-reduced-motion:no-preference){.sheet{animation:up .25s ease-out}@keyframes up{from{transform:translateY(40px);opacity:0}}}

/* ===== polish ===== */
.sec,.kick{text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:700;color:var(--mut);padding:4px 4px 0}
.tk{position:relative}
.big .top b{font-size:16px}
.vC .badge span{box-shadow:0 2px 10px rgba(0,0,0,.35)}
.tab{font-size:12px;letter-spacing:.02em}
/* CALM: quieter, more air, clearer hierarchy */
.p-calm .body{gap:16px;padding:16px 14px 20px}
.p-calm h1{font-size:28px;font-weight:700;letter-spacing:-.025em}
.p-calm .title{font-size:26px;font-weight:700}
.p-calm .card{border-radius:18px;border-color:#383C43}
.p-calm .fin{padding:20px}
.p-calm .fin span[style*="40px"]{font-size:44px;font-weight:700;letter-spacing:-.03em}
.p-calm .bar i{height:4px}
.p-calm .tk .tkt{padding:16px}
.p-calm .tk .ic{border-radius:50%;width:46px;height:46px}
.p-calm .tk::before,.p-calm .tk::after{content:"";position:absolute;top:50%;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:var(--bg);border:1px solid #383C43}
.p-calm .tk::before{left:-8px;border-left-color:transparent;border-bottom-color:transparent;transform:rotate(45deg)}
.p-calm .tk::after{right:-8px;border-right-color:transparent;border-top-color:transparent;transform:rotate(45deg)}
.p-calm .bigt{padding:22px 16px;gap:10px}
.p-calm .qr{width:232px;padding:12px;border-radius:14px}
.p-calm .code b{font-size:20px;letter-spacing:.14em;margin-top:2px}
.p-calm .row{min-height:68px}
.p-calm .row b{font-weight:600}
.p-calm .btn{border-radius:14px;min-height:50px}
/* BOLDER: one loud place per screen, the ticket and the finish card */
.p-bold .body{gap:14px}
.p-bold h1{font-size:34px;font-weight:800;letter-spacing:-.035em}
.p-bold .title{font-size:34px;font-weight:800;letter-spacing:-.035em}
.p-bold .fin{border:0;background:linear-gradient(160deg,#3a2c3f 0%,#2A2D32 55%);box-shadow:inset 0 0 0 1px rgba(245,134,90,.45),0 8px 28px rgba(240,112,58,.16);padding:20px}
.p-bold .fin span[style*="40px"]{font-size:56px;letter-spacing:-.04em;background:var(--sun);-webkit-background-clip:text;background-clip:text;color:transparent}
.p-bold .bar i{height:8px}
.p-bold .bar i.on{background:var(--sun)}
.p-bold .btn{background:var(--sun);color:#fff;border-radius:99px;min-height:52px;font-size:16px;box-shadow:0 6px 20px rgba(232,72,127,.3)}
.p-bold .ghost{background:var(--card2);box-shadow:none}
.p-bold .tk{border:0;background:var(--sun);padding:2px;border-radius:20px}
.p-bold .tk .tkt{background:var(--card);border-radius:18px;padding:14px 16px}
.p-bold .tk .ic{background:var(--sun);color:#fff}
.p-bold .bigt{border:0;background:var(--sun);padding:2px}
.bin{display:grid;justify-items:center;gap:8px;width:100%}.p-bold .bin{background:var(--card);border-radius:18px;padding:16px 12px}
.p-bold .bigt{box-shadow:0 10px 32px rgba(138,77,255,.25)}
.p-bold .qr{width:244px;padding:12px;border-radius:16px;box-shadow:0 0 0 6px var(--card)}
.p-bold .code b{font-size:24px;color:var(--gold);letter-spacing:.16em}
.p-bold .tab[aria-current="page"]::before{height:4px}
.p-bold .tabs{background:#25282D}
.p-bold .sheet{background:#2E3138;border-radius:32px 32px 0 0}
.p-bold .sheet h3{font-size:20px;font-weight:800}
</style>

<div class="wrap">
  <p class="note"><b style="color:var(--fg)">Screen shown right after paying.</b> Live dancer-app colours and lock look C are fixed. Only the polish changes. Compare Calm and Bolder on each screen, and tap a locked item to see the sheet.</p>
  <div class="seg" id="pseg" aria-label="Polish"><button data-p="calm" aria-pressed="true">Calm polish</button><button data-p="bold" aria-pressed="false">Bolder polish</button></div>
  <div class="seg" id="sseg" aria-label="Screen">
    <button data-s="home" aria-pressed="true">Home</button>
    <button data-s="nights" aria-pressed="false">Nights</button>
    <button data-s="me" aria-pressed="false">Me</button>
    <button data-s="options" aria-pressed="false">Options</button>
  </div>

  <div class="phone vA" id="phone">
    <div class="hdr">
      <div class="chip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></div>
      <span class="logo">Bachata Calendar</span><span class="role">Dancer</span>
      <div class="sw"><span class="av">S</span>Account</div>
    </div>
    <div class="body" id="body"></div>
    <nav class="tabs" id="tabs" aria-label="Dancer app"></nav>
    <div class="scrim" id="scrim" hidden>
      <div class="sheet" role="dialog" aria-label="Finish your profile">
        <div class="grab"></div>
        <h3>Finish your profile to use this</h3>
        <p>It takes about a minute. Your ticket stays safe either way.</p>
        <button class="btn" id="cont">Continue</button>
        <button class="btn ghost" id="close">Not now</button>
      </div>
    </div>
  </div>
  <p class="note">Sample data: name, night, QR and code are placeholders. Layout, colours and tab bar follow the live dancer app.</p>
</div>

<script>
const I={
 lock:'<svg class="lockico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
 chev:'<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
 tix:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M13 5v14" stroke-dasharray="2 3"/></svg>',
 circle:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>',
 check:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4FE0CF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>'
};
const TABS=[['home','Home','<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],['nights','Nights','<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'],['me','Me','<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'],['options','Options','<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>']];
const LOCKED_TABS={me:1,options:0};
function qr(){let s=7,r=()=>(s=(s*16807)%2147483647)/2147483647,n=25,o='';
 const f=(x,y)=>(x<8&&y<8)||(x>=n-8&&y<8)||(x<8&&y>=n-8);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){if(f(x,y))continue;if(r()>.52)o+=`<rect x="${x}" y="${y}" width="1" height="1"/>`}
 const fin=(x,y)=>`<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#fff"/><rect x="${x+2}" y="${y+2}" width="3" height="3"/>`;
 return `<svg viewBox="-1 -1 ${n+2} ${n+2}" fill="#111" shape-rendering="crispEdges" role="img" aria-label="Sample ticket QR code">${o}${fin(0,0)}${fin(n-7,0)}${fin(0,n-7)}</svg>`}
const L=(inner,cls='')=>`<button class="lockable ${cls}" data-lock><div class="in">${inner}</div><div class="badge"><span>${I.lock.replace('lockico','')}<em>Locked</em></span></div></button>`;
const lockedRow=(t,s)=>L(`<div class="row"><div class="t"><b>${t}</b><span class="s">${s}</span></div>${I.chev}${I.lock}</div>`);
const ticketCard=`<div class="card tk"><button class="tkt" data-go="nights"><div class="ic">${I.tix}</div><div style="flex:1;min-width:0"><b>Your ticket</b><span class="s">Saturday 21 November · Full pass</span></div><span class="pill">Valid</span></button></div>`;
const VIEWS={
 home:()=>`<div><h1>Hi Sam</h1></div>
  <div class="card pad fin"><div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:40px;font-weight:800;line-height:1">1 of 4</span><span class="mut" style="font-weight:600">to finish your profile</span></div>
   <div class="bar"><i class="on"></i><i></i><i></i><i></i></div>
   <p class="mut" style="margin:0 0 14px">Your ticket is bought. Next step: tell us what you are.</p>
   <button class="btn" data-lock>What are you?</button></div>
  ${ticketCard}
  <div class="kick">Also</div>
  <div class="card">${lockedRow('Share my page','Send your page to friends')}${lockedRow('Plans','Say you are going to a night')}${lockedRow('Nights attended','Your numbers start after your first night')}</div>`,
 nights:()=>`<h2 class="title" style="margin:0">Nights</h2>
  <div class="card big bigt"><div class="bin"><div class="top"><span>Full pass</span><span class="pill">Valid</span></div>
   <div class="qr">${qr()}</div>
   <div class="code">Door code<b>4K7 · 92M</b></div>
   <div class="mut" style="font-size:13px">Saturday 21 November 2026 · Show this at the door</div></div></div>
  <div class="sec">Upcoming nights</div>
  <div class="card pad" style="padding:6px 16px"><div class="night"><div class="date"><small>Sat</small><strong>21</strong><small>Nov</small></div><div style="flex:1;min-width:0"><b>Sensual Saturdays</b><span class="s">Studio 9 · 9pm</span></div><span class="pill">Ticket</span></div></div>
  <div class="sec">Past nights</div>
  <div class="card" style="padding:6px 16px">${L(`<div class="night" style="border:0"><div class="date" style="background:rgba(255,207,102,.14);color:var(--gold)"><small>Wed</small><strong>12</strong><small>Nov</small></div><div style="flex:1"><b>Bachata Social</b><span class="s">Rate this night</span></div>${I.lock}</div>`)}</div>`,
 me:()=>`<h2 class="title" style="margin:0">Me</h2>
  <div class="card pad" style="display:grid;gap:10px"><div style="display:flex;gap:12px;align-items:center"><div class="av" style="width:64px;height:64px;font-size:22px;background:var(--card2);box-shadow:0 0 0 3px #e8487f"> S</div><div><div style="font-size:20px;font-weight:800">Sam</div><div class="mut">Not set yet</div></div></div>
   <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:600"><span>Profile strength</span><span>10%</span></div><div style="height:8px;border-radius:4px;background:var(--card2)"><div style="width:10%;height:100%;border-radius:4px;background:var(--sun)"></div></div>
   <button class="btn" data-lock>Continue</button></div>
  <div class="sec">My profile</div>
  <div class="card">${lockedRow('Edit my profile','')}${lockedRow('My page','How it looks and who visited')}${lockedRow('See my public page','')}</div>`,
 options:()=>`<h2 class="title" style="margin:0">Options</h2>
  <div class="card">${lockedRow('Share my page','')}${lockedRow('My page','')}${lockedRow('Send feedback','What is missing?')}${lockedRow('Add to my phone home screen','')}
   <button class="row" data-open="help"><div class="t"><b>Help and message us</b></div>${I.chev}</button>
   <button class="row"><div class="t"><b>Sign out</b></div>${I.chev}</button></div>`
};
let v='C',p='calm',s='home';
const $=id=>document.getElementById(id);
function render(){
 $('phone').className='phone vC p-'+p;
 $('body').innerHTML=VIEWS[s]();$('body').scrollTop=0;
 $('tabs').innerHTML=TABS.map(([k,n,p])=>`<button class="tab" data-tab="${k}" ${k===s?'aria-current="page"':''}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>${n}${LOCKED_TABS[k]===1?I.lock.replace('class="lockico"','class="lk"').replace('width="16" height="16"','width="11" height="11"'):''}</button>`).join('');
 document.querySelectorAll('#pseg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.p===p));
 document.querySelectorAll('#sseg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===s));
}
document.addEventListener('click',e=>{
 const t=e.target.closest('button');if(!t)return;
 if(t.dataset.p){p=t.dataset.p;render();return}
 if(t.dataset.s){s=t.dataset.s;render();return}
 if(t.dataset.tab){if(t.dataset.tab==='me'){s='me'}else{s=t.dataset.tab}render();return}
 if(t.dataset.go){s=t.dataset.go;render();return}
 if(t.hasAttribute('data-lock')){$('scrim').hidden=false;return}
 if(t.id==='close'||t.id==='cont'){$('scrim').hidden=true}
});
$('scrim').addEventListener('click',e=>{if(e.target.id==='scrim')$('scrim').hidden=true});
render();
</script>

</body></html>