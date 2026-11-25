# Dancer onboarding v8 mockup (source HTML, approved prototype)

Copy of docs/design/dancer-onboarding/mockup-v8-after-code.html. The HTML below is the spec.

~~~~html
<title>Onboarding After Code</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Bricolage+Grotesque:wght@500;800&family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;600&display=swap">
<style>
/* Layout: control bar on top, one full-size phone centred (scaled to fit), decisions below. Three directions styled per data-d. */
:root{--bg:#f4f0e8;--card:#fffaf0;--fg:#1c1813;--mut:#6d6355;--line:#d9d0bf;--btn:#1c1813;--btnfg:#f6f1e7;--ok:#2f7a4c}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f0d0b;--card:#1a1713;--fg:#f6f1e7;--mut:#a39a8b;--line:#2e2922;--btn:#f6f1e7;--btnfg:#15120e;--ok:#8fe0b0;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f0d0b;--card:#1a1713;--fg:#f6f1e7;--mut:#a39a8b;--line:#2e2922;--btn:#f6f1e7;--btnfg:#15120e;--ok:#8fe0b0;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.45 Inter,system-ui,sans-serif;margin:0;padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px));padding-block:16px 56px}
.wrap{max-width:900px;margin:0 auto}
h1{font:800 22px/1.2 "Bricolage Grotesque",Inter,sans-serif;margin:0 0 4px}
p.t{color:var(--mut);margin:0 0 12px;max-width:62ch}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.bar button,.opts button{font:inherit;color:var(--fg);background:transparent;border:1px solid var(--line);border-radius:99px;padding:9px 16px;cursor:pointer;min-height:40px}
.bar button[aria-pressed=true],.opts button[aria-pressed=true]{background:var(--btn);color:var(--btnfg);border-color:var(--btn)}
button:focus-visible{outline:2px solid #ffa600;outline-offset:2px}
.sep{width:1px;height:24px;background:var(--line);margin:0 4px}
.stage{display:flex;justify-content:center;margin:10px 0}
.hold{position:relative}
.ph{position:absolute;left:0;top:0;width:390px;height:844px;transform-origin:0 0;border-radius:40px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);font-size:16px;color:#fff}
.ph *{box-sizing:border-box}
.photo{position:absolute;inset:0}.photo svg{width:100%;height:100%;display:block}
.tag{position:absolute;right:12px;top:54px;font:600 10px Inter;letter-spacing:.08em;text-transform:uppercase;background:rgba(0,0,0,.45);color:#fff;border-radius:99px;padding:3px 8px;z-index:3}
.seg{position:absolute;left:20px;right:20px;top:20px;display:flex;gap:4px;z-index:3}.seg i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.35)}.seg i.on{background:#fff}
.back{position:absolute;left:14px;top:34px;z-index:3;font:600 15px Inter;background:rgba(0,0,0,.35);border:0;color:#fff;border-radius:99px;padding:6px 12px;cursor:pointer}
.body{position:absolute;z-index:2;display:flex;flex-direction:column}
h2.q{margin:0 0 8px;text-wrap:balance}
.sub{margin:0 0 18px;opacity:.85}
.opt{display:flex;align-items:center;gap:12px;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;margin-bottom:10px}
.opt small{display:block;opacity:.75;font-size:13px}
.opt .ic{font-size:26px}
.opt .ck{margin-left:auto;width:24px;height:24px;border-radius:50%;border:2px solid currentColor;opacity:.6;flex:none;display:grid;place-items:center;font-size:14px}
.opt.on .ck{opacity:1}
.cta{margin-top:auto;border:0;font:inherit;font-weight:800;cursor:pointer;padding:17px;width:100%;font-size:17px}
.cta[disabled]{opacity:.4;cursor:default}
.ph .cta.alt{background:transparent!important;color:inherit!important;border:2px solid currentColor;box-shadow:none!important;text-shadow:none}
.fld{width:100%;font:inherit;padding:16px;margin-bottom:12px;border:0;outline:0}
.small{font-size:13px;opacity:.8;margin:4px 0 10px}
.code{display:flex;gap:6px;margin:4px 0 14px}.code span{flex:1;height:54px;display:grid;place-items:center;font-weight:800;font-size:22px}
.lnk{background:none;border:0;color:inherit;opacity:.8;text-decoration:underline;font:inherit;font-size:14px;cursor:pointer;padding:8px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.grid2 .opt{flex-direction:column;align-items:flex-start;margin:0;gap:2px;padding:14px}
.sec{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.75;margin:12px 0 8px}
.pills{display:flex;flex-wrap:wrap;gap:8px}.pills span{padding:9px 14px;font-weight:600;font-size:14px}

.fakehome{position:absolute;left:0;right:0;top:-280px;filter:blur(7px);opacity:.7;pointer-events:none}
.fh1{font:400 34px/1 Anton,Impact,sans-serif;text-transform:uppercase;margin:0 0 12px}
.fhc{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:14px;margin-bottom:10px}.fhc small{display:block;opacity:.7}
.peek{position:relative;display:flex;flex-direction:column;height:100%}
.photoadd{margin:6px auto 14px;width:200px;height:200px;border-radius:50%;border:2px dashed rgba(255,255,255,.5);background:rgba(255,255,255,.08);color:#fff;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer}.photoadd.on{border:3px solid #ff2d95;box-shadow:0 0 28px rgba(255,45,149,.6)}
.chip{font:600 15px Inter;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);border-radius:99px;padding:10px 16px;cursor:pointer}.chip.on{background:rgba(255,45,149,.35);border-color:#ff2d95}
textarea.fld{resize:none}
.sheet{position:absolute;left:-22px;right:-22px;bottom:-30px;top:-120px;background:#1a0d33;border-radius:28px 28px 0 0;padding:16px 22px;border-top:1px solid #ff2d95;box-shadow:0 -10px 40px rgba(0,0,0,.6);z-index:5;overflow:auto}
.sheet h3{margin:6px 0 4px;font:400 28px Anton,Impact,sans-serif;text-transform:uppercase}.grab{width:44px;height:4px;border-radius:2px;background:rgba(255,255,255,.4);margin:0 auto}
.card{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:18px;padding:14px;margin-bottom:14px}.card .row{display:flex;justify-content:space-between}
.bar2{height:8px;background:rgba(255,255,255,.2);border-radius:4px;margin:8px 0}.bar2 i{display:block;height:100%;background:linear-gradient(90deg,#ff2d95,#ffa600);border-radius:4px}
.lk{display:flex;align-items:center;gap:12px;width:100%;text-align:left;font:inherit;color:inherit;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:12px 14px;margin-bottom:9px;cursor:pointer;position:relative}.lk .ic{font-size:24px}.lk small{display:block;opacity:.7;font-size:13px}.lk .lock{margin-left:auto;opacity:.8}
.shake{animation:shk .45s}@keyframes shk{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
.toast{position:absolute;left:20px;right:20px;bottom:150px;z-index:9;background:#fff;color:#1b1330;border-radius:14px;padding:12px 14px;font-weight:600;display:flex;align-items:center;gap:10px;justify-content:space-between;transition:opacity .25s;box-shadow:0 8px 30px rgba(0,0,0,.5)}.toast button{background:#ff2d95;color:#fff;border:0;border-radius:99px;padding:8px 14px;font:700 14px Inter;cursor:pointer}
.peekbar{position:absolute;left:-22px;right:-22px;bottom:-30px;padding:16px 22px 28px;background:linear-gradient(180deg,rgba(11,6,20,0),rgba(11,6,20,.97) 30%)}.peekbar b{font:400 28px Anton,Impact,sans-serif;text-transform:uppercase;display:block}.peekbar small{display:block;opacity:.8;margin-bottom:10px}.peekbar .cta{margin-top:0}
.ringrow{display:flex;align-items:center;gap:14px}#ring{transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)}
.card.win{background:linear-gradient(135deg,rgba(255,45,149,.35),rgba(255,166,0,.35));border-color:#ffa600;animation:pop .6s}@keyframes pop{0%{transform:scale(.8)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
.cf{position:absolute;width:9px;height:14px;border-radius:2px;z-index:20;pointer-events:none;animation:cf 1.2s ease-out forwards}@keyframes cf{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}
.bigmsg{position:absolute;left:0;right:0;top:300px;text-align:center;z-index:21;font:400 44px Anton,Impact,sans-serif;color:#fff;text-shadow:0 0 30px #ff2d95;animation:pop .6s}
/* D1 Neon Night */
[data-d="1"]{background:#0b0614;font-family:Inter}
[data-d="1"] .photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,6,20,.1) 0%,rgba(11,6,20,.55) 40%,rgba(11,6,20,.95) 78%)}
[data-d="1"] .body{left:22px;right:22px;bottom:30px;top:300px}
[data-d="1"] h2.q{font:400 54px/1 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em}
[data-d="1"] .opt{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:14px;backdrop-filter:blur(8px)}
[data-d="1"] .opt.on{background:rgba(255,45,149,.25);border-color:#ff2d95;box-shadow:0 0 22px rgba(255,45,149,.55)}
[data-d="1"] .cta{background:linear-gradient(90deg,#ff2d95,#ffa600);color:#fff;border-radius:16px;box-shadow:0 0 28px rgba(255,45,149,.6);text-transform:uppercase;letter-spacing:.06em}
[data-d="1"] .fld{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:14px}
[data-d="1"] .code span{background:rgba(255,255,255,.1);border:1px solid #ff2d95;border-radius:10px}
[data-d="1"] .pills span{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:99px}
/* D2 Sunset Social */
[data-d="2"]{background:#fff4e6;color:#2a1408;font-family:"Bricolage Grotesque",Inter}
[data-d="2"] .photo{height:300px;bottom:auto;border-radius:0 0 40px 40px;overflow:hidden}
[data-d="2"] .body{left:0;right:0;bottom:0;top:268px;background:#fff4e6;border-radius:34px 34px 0 0;padding:26px 22px 28px;color:#2a1408}
[data-d="2"] h2.q{font:800 34px/1.05 "Bricolage Grotesque";letter-spacing:-.01em}
[data-d="2"] .opt{background:#fff;border:2px solid #f2d4b4;border-radius:20px;padding:13px 14px;box-shadow:0 4px 0 #f2d4b4;font-weight:600}
[data-d="2"] .opt.on{border-color:#ff5a3c;background:#ffe9e3;box-shadow:0 4px 0 #ff5a3c}
[data-d="2"] .cta{background:#ff5a3c;color:#fff;border-radius:20px;box-shadow:0 5px 0 #b83a22}
[data-d="2"] .fld{background:#fff;border:2px solid #f2d4b4;color:#2a1408;border-radius:18px}
[data-d="2"] .code span{background:#fff;border:2px solid #f2d4b4;border-radius:14px}
[data-d="2"] .pills span{background:#fff;border:2px solid #f2d4b4;border-radius:99px}
[data-d="2"] .back{background:rgba(255,255,255,.85);color:#2a1408}
[data-d="2"] .tag{top:54px}
/* D3 Midnight Club */
[data-d="3"]{background:#0a0f24;font-family:Inter}
[data-d="3"] .photo svg{filter:saturate(1.2)}
[data-d="3"] .photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,9,26,0) 45%,rgba(6,9,26,.5))}
[data-d="3"] .cta{margin-top:14px}
[data-d="3"] .body{left:16px;right:16px;bottom:24px;top:auto;background:rgba(14,20,50,.62);border:1px solid rgba(255,214,140,.35);backdrop-filter:blur(18px);border-radius:30px;padding:28px 22px 22px}
[data-d="3"] h2.q{font:600 36px/1.08 Fraunces,Georgia,serif;color:#ffe3a8}
[data-d="3"] .opt{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:14px}
[data-d="3"] .opt.on{border-color:#ffd68c;background:rgba(255,214,140,.16)}
[data-d="3"] .cta{background:#ffd68c;color:#1b1330;border-radius:99px}
[data-d="3"] .fld{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:14px}
[data-d="3"] .code span{background:rgba(255,255,255,.08);border:1px solid rgba(255,214,140,.5);border-radius:12px}
[data-d="3"] .pills span{background:rgba(255,255,255,.08);border:1px solid rgba(255,214,140,.4);border-radius:99px}

.q2{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:12px 0}
.q2 h4{margin:0 0 8px;font-size:15px}.opts{display:flex;gap:8px;flex-wrap:wrap}
#st{color:var(--ok);font-size:13px;min-height:20px}
</style>
<div class="wrap">
<h1>After the code: onboarding</h1>
<p class="t">Tap through like the real app. Photo areas are stand-ins; real dance photos replace them. Menu, signup form, check-email and Home stay exactly as production today, so they are not drawn here. These are the new screens after the email code. After the last one the person lands on today's Home.</p>

<div class="bar" id="steps"></div>
<div class="stage"><div class="hold" id="hold"><div class="ph" id="ph"></div></div></div>
<div class="bar"><button id="prev" type="button">‹ Back</button><button id="next" type="button">Next ›</button></div>

<h1 style="margin-top:28px">Your clicks</h1>
<div id="qs"></div><div id="st" role="status"></div>
</div>
<script>
const D={1:{n:'1 Neon Night',a:['#ff2d95','#7a1fff','#ffa600','#12072a']},2:{n:'2 Sunset Social',a:['#ff7a3c','#ffb347','#ff5a3c','#ffd9a8']},3:{n:'3 Midnight Club',a:['#2a3a8f','#6a3fb5','#ffd68c','#0a0f24']}};
const STEPS=['Roles','Styles','Years','Partner','Photo','Bio+links'];const ORDER=[1,11,10,13,9,12];const pos=()=>ORDER.indexOf(S.i);
const CITIES=[['London','United Kingdom'],['Manchester','United Kingdom'],['Birmingham','United Kingdom'],['Bristol','United Kingdom'],['Leeds','United Kingdom'],['Madrid','Spain'],['Barcelona','Spain'],['Valencia','Spain'],['Paris','France'],['Berlin','Germany'],['Hamburg','Germany'],['Rome','Italy'],['Milan','Italy'],['Amsterdam','Netherlands'],['Warsaw','Poland'],['Vienna','Austria'],['Budapest','Hungary'],['Kyiv','Ukraine'],['New York','United States'],['Los Angeles','United States'],['Chicago','United States'],['Houston','United States'],['Toronto','Canada'],['Montreal','Canada'],['Mexico City','Mexico'],['Havana','Cuba'],['Bogotá','Colombia'],['Medellín','Colombia'],['Cali','Colombia'],['Quito','Ecuador'],['Guayaquil','Ecuador'],['Lima','Peru'],['Santiago','Chile'],['Buenos Aires','Argentina'],['São Paulo','Brazil'],['Rio de Janeiro','Brazil'],['Salvador','Brazil']];
const pmiss=()=>[!S.pk.size&&'a kind',!S.prole&&'their role',!S.plvl&&'years dancing'].filter(Boolean);const S={photo:false,yrs:'',styles:new Set(),bio:'',ig:'',partner:'',sheet:false,pk:new Set(),prole:'',plvl:'',pnote:'',d:1,i:1,roles:new Set(['Dancer']),name:'',city:'London',lf:'Leader',email:''};
function photo(d,id){const c=D[d].a;return `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="g${id}" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${c[2]}" stop-opacity=".9"/><stop offset=".45" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[3]}"/></radialGradient><filter id="b${id}"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="390" height="844" fill="url(#g${id})"/><g filter="url(#b${id})" opacity=".75"><circle cx="60" cy="90" r="34" fill="${c[2]}"/><circle cx="330" cy="60" r="22" fill="${c[0]}"/><circle cx="300" cy="200" r="40" fill="${c[0]}"/><circle cx="90" cy="230" r="18" fill="#fff"/><circle cx="200" cy="40" r="14" fill="#fff"/></g><g fill="#0c0612" opacity=".92"><circle cx="165" cy="150" r="19"/><path d="M148 172h34l20 70-14 100h-18l-4-70-6 70h-16l-4-100z"/><circle cx="232" cy="140" r="17"/><path d="M216 160h32l24 60-30 12-4 110h-16l-6-80-8 80h-14l2-110-20-30z"/><path d="M180 205l40-12" stroke="#0c0612" stroke-width="9" stroke-linecap="round"/></g></svg>`}
const opt=(key,ic,t,sub,on,act)=>`<button class="opt ${on?'on':''}" data-act="${act}" data-v="${key}"><span class="ic">${ic}</span><span>${t}${sub?`<small>${sub}</small>`:''}</span><span class="ck">${on?'✓':''}</span></button>`;
function body(){const d=S.d,i=S.i;const nm=S.name.trim()||'dancer';
 const cta=(t,dis)=>`<button class="cta" data-act="next" ${dis?'disabled':''}>${t}</button>`;
 if(i==0)return `<h2 class="q">Find your next dance</h2><p class="sub">Free to join. Takes a minute.</p>
  <button class="cta" data-act="next" style="margin:0 0 4px">Create free account</button>
  <button class="cta alt" data-act="next" style="margin-top:12px">Sign in</button>`;
 if(i==1)return `<h2 class="q">Who's hitting the floor?</h2><p class="sub">Pick all that fit. Change anytime.</p>
  ${[['💃','Dancer','Find nights and partners'],['🎟️','Organiser','Run events and classes'],['🎓','Teacher','Share your classes'],['🎧','DJ','Play at nights']].map(([a,b,c])=>opt(b,a,b,c,S.roles.has(b),'role')).join('')}${cta('Continue',!S.roles.size)}`;
 if(i==2)return `<h2 class="q">What do we call you?</h2><p class="sub">Your first name is enough.</p><input class="fld" id="nm" placeholder="First name" value="${S.name}" autocomplete="off">${cta('Continue',false)}`;
 if(i==3)return `<h2 class="q">Where do you dance?</h2><p class="sub">Every city is open. Type to search.</p><input class="fld" id="cs" placeholder="Search your city" autocomplete="off" style="margin-bottom:8px"><div id="cl" style="overflow:auto;max-height:${S.d==1?150:S.d==2?150:190}px"></div>${cta('Continue',!S.city)}`;
 if(i==4)return `<h2 class="q">Lead, follow, or both?</h2><p class="sub">Helps partners find you.</p>${[['Leader','🕺'],['Follower','💃'],['Both','🔄']].map(([b,a])=>opt(b,a,b,'',S.lf==b,'lf')).join('')}${cta('Continue',false)}`;
 if(i==5)return `<h2 class="q">Where do we send your code?</h2><p class="sub">No password. We email you 8 digits.</p><input class="fld" id="em" type="email" placeholder="you@email.com" value="${S.email}" autocomplete="off"><p class="small">By continuing you accept our <u>Terms</u> and <u>Privacy</u>.</p>${cta('Send my code',false)}`;
 if(i==8)return `<div class="fh1" style="font-size:30px;margin-top:6px">Hi ${nm} 👋</div>${[['🎉','Bachata Sensual Social','Tonight 21:00 · Soho'],['💃','Salsa y Bachata Club','Tonight 22:00 · Camden'],['🎓','Beginner class + party','Sat 19:30 · Shoreditch'],['🤝','Dancers looking for a partner','12 near you'],['🎟️','My tickets','Nothing yet']].map(([a,b,c])=>`<button class="lk" data-act="locked"><span class="ic">${a}</span><span><b>${b}</b><small>${c}</small></span><span class="lock">🔒</span></button>`).join('')}<div class="peekbar"><b>Almost there, ${nm}</b><small>Add a photo, years dancing and styles to unlock everything.</small>${cta('Finish my profile',false)}</div>`;
 if(i==9)return `<h2 class="q">Show us your face</h2><p class="sub">A photo is required. Partners and organisers need to know who you are.</p><button class="photoadd ${S.photo?'on':''}" data-act="photo">${S.photo?'<span style="font-size:60px">🧑</span><small>Photo added. Tap to change</small>':'<span style="font-size:44px">📸</span><small>Tap to add a photo</small>'}</button>${cta('Continue',!S.photo)}`;
 if(i==10)return `<h2 class="q">How long have you danced?</h2><p class="sub">Required. We store the year you started.</p>${[['Under 1 year','2026'],['1 to 2 years','2024'],['3 to 5 years','2021'],['6 to 10 years','2016'],['Over 10 years','2010']].map(([a,b])=>opt(a,'📅',a,'',S.yrs==a,'yrs')).join('')}${cta('Continue',!S.yrs)}`;
 if(i==11)return `<h2 class="q">Which styles do you dance?</h2><p class="sub">Pick at least one.</p><div class="pills" style="margin-bottom:14px">${['Sensual','Dominican','Moderna','Urban','Fusion','Traditional'].map(x=>`<button class="chip ${S.styles.has(x)?'on':''}" data-act="style" data-v="${x}">${x}</button>`).join('')}</div>${cta('Continue',!S.styles.size)}`;
 if(i==12)return `<h2 class="q">Tell us about you</h2><p class="sub">Optional. Skip any time.</p><textarea class="fld" id="bio" rows="3" placeholder="A short bio (optional)">${S.bio}</textarea><input class="fld" id="ig" placeholder="Instagram or other link (optional)" value="${S.ig}" autocomplete="off">${cta('Finish',false)}<button class="lnk" data-act="next">Skip for now</button><p class="small" style="text-align:center">Next: your real Home, exactly as today.</p>`;
 if(i==13)return `<h2 class="q">Looking for a dance partner?</h2><p class="sub">Say yes and we show you to dancers who want a partner.</p>${opt('yes','🤝','Yes, I am','','yes'==S.partner,'partner')}${opt('no','🙂','No, just social dancing','','no'==S.partner,'partner')}${cta('Continue',!S.partner)}${S.sheet?`<div class="sheet"><div class="grab"></div><h3>Your ideal partner</h3><div class="sec">What kind</div><div class="pills">${['Social dancing','Classes','Performance','Competition'].map(x=>`<button class="chip ${S.pk.has(x)?'on':''}" data-act="pk" data-v="${x}">${x}</button>`).join('')}</div><div class="sec">Their role</div><div class="pills">${['Leader','Follower','Either'].map(x=>`<button class="chip ${S.prole==x?'on':''}" data-act="prole" data-v="${x}">${x}</button>`).join('')}</div><div class="sec">Years dancing</div><div class="pills">${['0-2','2-5','5+','Any'].map(x=>`<button class="chip ${S.plvl==x?'on':''}" data-act="plvl" data-v="${x}">${x}</button>`).join('')}</div><input class="fld" id="pn" placeholder="A line to potential partners" value="${S.pnote}" style="margin-top:12px;margin-bottom:8px">${pmiss().length?`<p class="small" style="margin:6px 0 4px">Pick ${pmiss().join(', ').replace(/, ([^,]*)$/,' and $1')} to save.</p>`:''}<button class="cta" data-act="sheetdone" ${pmiss().length?'disabled':''} style="margin-top:4px;padding:14px">Save</button></div>`:''}`;
 if(i==14){const done=3+(S.partner?1:0)+(S.bio?1:0)+(S.ig?1:0),tot=7;const pct=Math.round(done/tot*100);const miss=[!S.bio&&['addbio','Add a bio'],!S.ig&&['addig','Add a link']].filter(Boolean);S.pct=pct;return `<div class="fh1" style="font-size:30px">Hi ${nm} 👋</div>${pct==100?`<div class="card win"><div style="font-size:44px;text-align:center">🏆</div><b style="display:block;text-align:center;font-size:20px">Profile complete</b><small style="display:block;text-align:center">You are fully visible to dancers and organisers.</small></div>`:`<div class="card"><div class="ringrow"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="9"/><circle id="ring" cx="42" cy="42" r="34" fill="none" stroke="url(#rg)" stroke-width="9" stroke-linecap="round" stroke-dasharray="213.6" stroke-dashoffset="213.6" transform="rotate(-90 42 42)" data-pct="${pct}"/><defs><linearGradient id="rg"><stop offset="0" stop-color="#ff2d95"/><stop offset="1" stop-color="#ffa600"/></linearGradient></defs></svg><div><b style="font-size:22px"><span id="pctn" data-pct="${pct}">0</span>%</b><small style="display:block">Your profile</small><small style="display:block;color:#ffa600">${miss.length?'Next: '+miss[0][1].toLowerCase()+' (+1 step closer)':''}</small></div></div><div class="pills" style="margin-top:10px">${miss.map(m=>`<button class="chip" data-act="${m[0]}">＋ ${m[1]}</button>`).join('')}</div></div>`}<div class="fh1" style="font-size:26px;margin-top:6px">Tonight in London</div>${['Bachata Sensual Social|Tonight 21:00','Salsa y Bachata Club|Tonight 22:00'].map(x=>`<div class="fhc"><b>${x.split('|')[0]}</b><small>${x.split('|')[1]}</small></div>`).join('')}<small style="opacity:.6">Home design comes in its own round.</small>`;}
 if(i==6)return `<h2 class="q">Check your email</h2><p class="sub">Open it on this phone and type the 8 digit code we sent.</p><div class="code">${'48271936'.split('').map(c=>`<span>${c}</span>`).join('')}</div>${cta('Sign me in',false)}<button class="lnk" data-act="none" style="margin-top:8px">Resend code (30s) · Use a different email</button>`;
 return `<div class="fh1" style="font-size:30px;margin-top:6px">You're in, ${nm}! 🎉</div><p class="sub" style="margin:0 0 10px">Welcome to the London bachata scene.</p>${[['🎉','Bachata Sensual Social','Tonight 21:00 · Soho'],['💃','Salsa y Bachata Club','Tonight 22:00 · Camden'],['🎓','Beginner class + party','Sat 19:30 · Shoreditch'],['🤝','Dancers looking for a partner','12 near you']].map(([a,b,c])=>`<div class="lk"><span class="ic">${a}</span><span><b>${b}</b><small>${c}</small></span></div>`).join('')}<div class="peekbar"><b>Make your profile shine</b><small>Add a bio and a link so dancers know you.</small><button class="cta" data-act="none">Add bio and links</button><button class="lnk" data-act="none" style="margin-top:6px">Go to Home</button></div>`;}
function render(){const d=S.d,i=S.i;const ph=document.getElementById('ph');ph.dataset.d=d;
 const P=pos();const seg=P<6?`<div class="seg">${[0,1,2,3,4,5].map(k=>`<i class="${k<=P?'on':''}"></i>`).join('')}</div>`:'';
 ph.innerHTML=`<div class="photo">${photo(d,d)}</div><div class="tag">Photo here</div>${seg}${pos()>0?'<button class="back" data-act="back">‹ Back</button>':''}<div class="body" ${i==0&&d==2?'style="top:200px"':''}${i==8?' style="top:52px"':''}${i==10?' style="top:215px"':''}${i==7?' style="top:52px"':''}>${body()}</div>`;
 if(i==0&&d==2)ph.querySelector('.photo').style.height='230px';
 document.getElementById('dirs').innerHTML=Object.keys(D).map(k=>`<button type="button" data-dir="${k}" aria-pressed="${S.d==k}">${D[k].n}</button>`).join('');
 document.getElementById('steps').innerHTML=STEPS.map((s,k)=>`<button type="button" data-step="${k}" aria-pressed="${S.i==ORDER[k]}">${s}</button>`).join('');
 const cs=document.getElementById('cs');if(cs){const fill=()=>{const q=cs.value.trim().toLowerCase();const r=CITIES.filter(c=>!q||c[0].toLowerCase().includes(q)||c[1].toLowerCase().includes(q)).slice(0,30);document.getElementById('cl').innerHTML=r.map(c=>`<button class="opt ${S.city==c[0]?'on':''}" data-act="city" data-v="${c[0]}" style="padding:10px 14px;margin-bottom:6px"><span class="ic" style="font-size:18px">📍</span><span>${c[0]}<small>${c[1]}</small></span><span class="ck">${S.city==c[0]?'✓':''}</span></button>`).join('')+`<button class="lnk" data-act="none" style="text-align:left">${r.length?'Not listed?':'No match.'} Message us and we add your city</button>`};cs.oninput=fill;fill()}
 const nm=document.getElementById('nm');if(nm)nm.oninput=e=>S.name=e.target.value;const bi=document.getElementById('bio');if(bi)bi.oninput=e=>S.bio=e.target.value;const ig=document.getElementById('ig');if(ig)ig.oninput=e=>S.ig=e.target.value;const pn=document.getElementById('pn');if(pn)pn.oninput=e=>S.pnote=e.target.value;const em=document.getElementById('em');if(em)em.oninput=e=>S.email=e.target.value;
 fit();after();}
function boom(big){const ph=document.getElementById('ph');const n=big?90:28;const cols=['#ff2d95','#ffa600','#7a1fff','#fff','#2ee6a6'];for(let k=0;k<n;k++){const e=document.createElement('i');e.className='cf';const x=big?Math.random()*390:195+(Math.random()-.5)*60;e.style.cssText=`left:${x}px;top:${big?-20:520}px;background:${cols[k%5]};--dx:${(Math.random()-.5)*(big?200:300)}px;--dy:${big?(500+Math.random()*350):-(150+Math.random()*250)}px;--r:${Math.random()*720}deg;animation-duration:${big?1.8+Math.random():1.1}s`;ph.appendChild(e);setTimeout(()=>e.remove(),3200)}if(big){const b=document.createElement('div');b.className='bigmsg';b.textContent='PROFILE COMPLETE!';ph.appendChild(b);setTimeout(()=>b.remove(),2600)}}
function after(){const r=document.getElementById('ring');if(r){const p=+r.dataset.pct;requestAnimationFrame(()=>requestAnimationFrame(()=>{r.style.strokeDashoffset=213.6*(1-p/100)}));const n=document.getElementById('pctn');let c=0;const tgt=p;const iv=setInterval(()=>{c=Math.min(tgt,c+3);n.textContent=c;if(c>=tgt)clearInterval(iv)},18)}
 if(S.i==14&&S.pct==100&&!S.won){S.won=true;setTimeout(()=>boom(true),250)}}
function fit(){const s=Math.min(1,(innerHeight-120)/844,(document.body.clientWidth-32)/390);const h=document.getElementById('hold');h.style.width=390*s+'px';h.style.height=844*s+'px';document.getElementById('ph').style.transform=`scale(${s})`}
addEventListener('resize',fit);
const go=n=>{const was=S.i;const dir=n>=pos()?1:-1;let p=Math.max(0,Math.min(ORDER.length-1,n));if(ORDER[p]==13&&!S.roles.has('Dancer'))p+=dir;p=Math.max(0,Math.min(ORDER.length-1,p));const cel=dir>0&&(was==9||was==10||was==11||was==13||(was==12&&(S.bio||S.ig)));S.i=ORDER[p];render();if(cel)setTimeout(()=>boom(false),120)};
document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
 if(t.dataset.dir){S.d=+t.dataset.dir;render();return}
 if(t.dataset.step){go(+t.dataset.step);return}
 if(t.id=='prev'){go(pos()-1);return}if(t.id=='next'){go(pos()+1);return}
 const a=t.dataset.act;if(!a)return;
 if(a=='next'){if(S.i==13&&S.partner=='yes'&&pmiss().length){S.sheet=true;render()}else go(pos()+1)}else if(a=='back')go(pos()-1);
 else if(a=='role'){S.roles.has(t.dataset.v)?S.roles.delete(t.dataset.v):S.roles.add(t.dataset.v);render()}
 else if(a=='city'){S.city=t.dataset.v;const q=(document.getElementById('cs')||{}).value;render();const c=document.getElementById('cs');if(c&&q){c.value=q;c.oninput()}}else if(a=='lf'){S.lf=t.dataset.v;render()}
 else if(a=='locked'){const t2=t;t2.classList.remove('shake');void t2.offsetWidth;t2.classList.add('shake');let to=document.getElementById('toast');if(!to){to=document.createElement('div');to.id='toast';to.className='toast';to.innerHTML='🔒 Finish your profile to unlock this <button data-act="next">Finish</button>';document.getElementById('ph').appendChild(to)}to.style.opacity=1;clearTimeout(window._tt);window._tt=setTimeout(()=>{to.style.opacity=0},2200)}else if(a=='addbio'){S.bio='Dancing since 2019';render()}else if(a=='addig'){S.ig='@mybachata';render()}else if(a=='photo'){S.photo=true;render()}else if(a=='yrs'){S.yrs=t.dataset.v;render()}else if(a=='style'){const v=t.dataset.v;S.styles.has(v)?S.styles.delete(v):S.styles.add(v);render()}else if(a=='partner'){S.partner=t.dataset.v;S.sheet=S.partner=='yes';render()}else if(a=='pk'){const v=t.dataset.v;S.pk.has(v)?S.pk.delete(v):S.pk.add(v);render()}else if(a=='prole'){S.prole=t.dataset.v;render()}else if(a=='plvl'){S.plvl=t.dataset.v;render()}else if(a=='sheetdone'){S.sheet=false;go(pos()+1)}});
render();
/* decisions */
const Q=[['order','Order after the code: roles, styles, years, partner (dancers only), photo, optional bio, You are in: right?',['Yes','Needs changes']],['roles','Roles screen as drawn (pick all that fit, Dancer ticked first): right?',['Yes','Needs changes']],['skip','Organisers, teachers and DJs who are not dancers skip the partner question: right?',['Yes','No, ask everyone']],['pov','Partner yes opens a bottom sheet (kind, role, years, note): right?',['Yes','Make it a full screen instead','Needs changes']],['req','Photo, years and styles are required, one screen each: right?',['Yes','Merge some screens','Needs changes']],['cel','Small confetti after each step: right?',['Yes','Too much','Remove']],['peek','Sneak peek of Home before the required steps (decided earlier) is not drawn here. Keep it?',['Keep it, draw it next','Drop it']],['note','What is the one thing to change first?',['Colours','Photo style','Words','Layout']]];
const ans={};let dbh=null;const st=document.getElementById('st');
function rq(){document.getElementById('qs').innerHTML=Q.map(([k,t,o])=>`<div class="q2"><h4>${t}</h4><div class="opts" data-k="${k}">${o.map(x=>`<button type="button" aria-pressed="${ans[k]===x}">${x}</button>`).join('')}</div></div>`).join('');
 document.querySelectorAll('.opts').forEach(g=>g.onclick=async e=>{const b=e.target.closest('button');if(!b)return;ans[g.dataset.k]=b.textContent;rq();
  try{if(dbh){await dbh.doc('answers/onboarding-after-code-round8').set({...ans,at:Date.now()});st.textContent='Saved.'}else st.textContent='Not saved here. Tell Claude your picks.'}catch(err){st.textContent='Save failed. Tell Claude your picks.'}})}
rq();
(async()=>{try{dbh=await claude.use('db')}catch(e){}})();
</script>

~~~~
