// Shared Raffle core: ONE copy of every raffle fact both options show (phases, confirm copy, lock rule, winner line).
// Raffle v2 (admin #1405 / #1414) is NOT redesigned: per-night on/off, locked once anyone entered,
// we draw the winner in admin, the night then shows winner first name + draw time + entries count.
// Every person and event here is an obviously made-up example.
const ORG='Sample Socials London',OWNER='Sam Sample';
const N=(id,t,d,time,o={})=>Object.assign({id,t,d,time,st:'live',on:false,entries:0,close:'7pm'},o);
// The ONE phase mapping (shared by list rows, night sheet and raffle sheet; never two copies).
function phase(n){
 if(n.st==='draft')return 'draft';
 if(n.st==='cancelled')return 'cancelled';
 if(n.winner)return 'drawn';
 if(n.st==='past')return n.on?(n.entries?'closed':'nodraw'):'pastoff';
 if(!n.on)return 'off';
 if(n.cut)return 'closed';
 return n.entries?'locked':'open';
}
// Short label for chips and list lines.
const PH={
 off:{chip:'',line:'No raffle'},
 open:{chip:'Raffle open',line:'Raffle open &middot; nobody yet'},
 locked:{chip:'Raffle locked',line:n=>`Raffle &middot; ${n.entries} entered`},
 closed:{chip:'Raffle closed',line:n=>`Raffle &middot; ${n.entries} entered &middot; we draw soon`},
 drawn:{chip:'Winner drawn',line:n=>`Raffle winner: ${n.winner}`},
 nodraw:{chip:'No draw',line:'Raffle &middot; nobody entered'},
 pastoff:{chip:'',line:'No raffle'},
 cancelled:{chip:'',line:'Cancelled night, no raffle'},
 draft:{chip:'',line:'No raffle (draft)'}
};
const lineOf=n=>{const l=PH[phase(n)].line;return typeof l==='function'?l(n):l};
// Plain-English status per phase (headline + body). Used in BOTH options.
function story(n){
 const f=n.d;
 switch(phase(n)){
  case 'off':return {h:'No raffle on this night',b:`Switch it on and dancers can enter on this night&rsquo;s event page until ${n.close} (2 hours before it starts). We draw one winner, who gets in free.`};
  case 'open':return {h:'Raffle open, nobody has entered yet',b:`Dancers can enter on the event page until ${n.close}. You can still close it, until the first person enters.`};
  case 'locked':return {h:`Locked: ${n.entries} ${n.entries===1?'person has':'people have'} entered`,b:`It cannot be closed here once anyone has entered. To cancel it, message us and we tell everyone who entered. Entries close at ${n.close}.`};
  case 'closed':return {h:`Entries closed at ${n.close}: ${n.entries} entered`,b:'We draw the winner from our side. Their first name and the draw time show here as soon as we do.'};
  case 'drawn':return {h:`Winner: ${n.winner}`,b:`Drawn ${n.drawn}. ${n.entries} entries. ${n.winner.split(' ')[0]} gets in free: they show their winner code at the door.`};
  case 'nodraw':return {h:'Nobody entered, so there was no draw',b:'The night has passed. Nothing else to do.'};
  case 'pastoff':return {h:'No raffle on this night',b:'The night has passed, so a raffle cannot be switched on now.'};
  case 'cancelled':return {h:'No raffle: this night is cancelled',b:'A cancelled night cannot have a raffle. Duplicate the night to run it again.'};
  case 'draft':return {h:'No raffle yet',b:'A draft is not on the calendar, so dancers cannot enter. Put the night live first, then switch the raffle on.'};
 }
}
// Why a control cannot be used right now (null = it can). The ONE gate both options read.
function gate(n){
 const p=phase(n);
 if(S.shape==='loading')return 'The switch wakes up once the night loads.';
 if(!canEdit())return `You are a contributor, so you can see the raffle but not change it. Ask an owner (${OWNER}).`;
 if(p==='locked')return `Locked because ${n.entries} ${n.entries===1?'person has':'people have'} entered. To cancel, message us.`;
 if(p==='closed'||p==='drawn'||p==='nodraw'||p==='pastoff')return 'This night has passed its entry close, so the raffle cannot change.';
 if(p==='cancelled')return 'A cancelled night cannot have a raffle.';
 if(p==='draft')return 'Put the night live first.';
 return null;
}
// Confirmation (hard stop) copy: opening and closing are never one tap.
function confirmBody(n,open){
 const h=open?`Open a raffle on ${n.t}, ${n.d}?`:`Close the raffle on ${n.t}, ${n.d}?`;
 const what=open?[`It shows on this night&rsquo;s event page straight away.`,`Dancers can enter until ${n.close}, 2 hours before the start.`,`<b>Once anyone enters, you cannot close it here.</b> To cancel after that, you message us.`,`We draw one winner and tell them. You let them in free on the door.`]
  :[`It comes off this night&rsquo;s event page now.`,`Nobody has entered, so nobody is told.`,`You can open it again until ${n.close}.`];
 return `<button class="x" data-act="close">Cancel</button><h2>${h}</h2><div class="capbox"><b>What happens</b><ul class="lose">${what.map(x=>`<li>${x}</li>`).join('')}</ul></div><button class="btn ${open?'':'danger'}" data-act="doset" data-k="${n.id}">${open?'Open the raffle':'Close the raffle'}</button><button class="btn alt" data-act="close">${open?'Not now':'Keep it open'}</button>`;
}
function msgUs(n){return `<button class="btn alt" data-act="toast" data-k="Opens a message to the Bachata Calendar team (prototype)">Message us to cancel</button>`}
// ---- shapes ----
const BASE=()=>[
 N('n1','Friday Social','Fri 13 Nov','9pm',{on:true,entries:23,wk:'This week'}),
 N('n2','Sunday Sundowner','Sun 15 Nov','6pm',{close:'4pm',wk:'This week'}),
 N('n3','Friday Social','Fri 20 Nov','9pm',{on:true,wk:'Next week'}),
 N('n4','Beginners Bootcamp','Sat 21 Nov','2pm',{st:'draft',close:'12pm',wk:'Next week'}),
 N('n5','Friday Social','Fri 6 Nov','9pm',{st:'past',on:true,entries:41,winner:'Ana Example',drawn:'Fri 6 Nov at 7:05pm',wk:'Past'})
];
const one=(o)=>[N('n1','Friday Social','Fri 13 Nov','9pm',Object.assign({wk:'This week'},o))];
function hugeNights(){
 const out=[N('h0','Friday Social with a Very Long Name for the Late Room','Fri 13 Nov','9pm',{on:true,entries:135,wk:'This week'})];
 const days=['Fri 20 Nov','Fri 27 Nov','Fri 4 Dec','Fri 11 Dec','Fri 18 Dec','Fri 25 Dec','Fri 1 Jan','Fri 8 Jan'];
 days.forEach((d,i)=>out.push(N('h'+(i+1),'Friday Social','+'+d,'9pm',{on:i<5,entries:i<2?(i?4:67):0,wk:i<1?'Next week':'Later'})));
 out.forEach(x=>x.d=x.d.replace('+',''));
 out.push(N('hp','Friday Social','Fri 6 Nov','9pm',{st:'past',on:true,entries:118,winner:'Bea Placeholder-Longname',drawn:'Fri 6 Nov at 7:02pm',wk:'Past'}));
 out.push(N('hq','Friday Social','Fri 30 Oct','9pm',{st:'past',on:true,entries:0,wk:'Past'}));
 out.push(N('hc','Friday Social','Fri 23 Oct','9pm',{st:'cancelled',wk:'Past'}));
 return out;
}
const SHAPES={
 empty:{lab:'Empty',nights:[]},
 normal:{lab:'Normal',nights:BASE()},
 huge:{lab:'Huge',nights:hugeNights(),more:'+ 44 more Friday dates, 3 more series'},
 off:{lab:'Off',nights:one({}),open:'n1'},
 confirmOpen:{lab:'Confirm open',nights:one({}),open:'n1',confirm:'open'},
 open:{lab:'Open, 0 in',nights:one({on:true}),open:'n1'},
 confirmClose:{lab:'Confirm close',nights:one({on:true}),open:'n1',confirm:'close'},
 locked:{lab:'Locked',nights:one({on:true,entries:23}),open:'n1'},
 closed:{lab:'Awaiting draw',nights:one({on:true,entries:41,cut:1}),open:'n1'},
 drawn:{lab:'Drawn',nights:[N('n5','Friday Social','Fri 6 Nov','9pm',{st:'past',on:true,entries:41,winner:'Ana Example',drawn:'Fri 6 Nov at 7:05pm',wk:'Past'})],open:'n5'},
 nodraw:{lab:'No entries',nights:[N('n6','Friday Social','Fri 30 Oct','9pm',{st:'past',on:true,wk:'Past'})],open:'n6'},
 cancelled:{lab:'Cancelled night',nights:[N('n7','Friday Social','Fri 20 Nov','9pm',{st:'cancelled',wk:'Next week'})],open:'n7'},
 draft:{lab:'Draft night',nights:[N('n4','Beginners Bootcamp','Sat 21 Nov','2pm',{st:'draft',close:'12pm',wk:'Next week'})],open:'n4'},
 contributor:{lab:'Contributor',nights:BASE(),seat:'contributor',open:'n1'},
 failed:{lab:'Save failed',nights:one({}),open:'n1',note:'failed'},
 loading:{lab:'Loading'},
 error:{lab:'Error'}
};
const S={shape:'normal',sheet:null,of:null,tab:'events'};
const $=q=>document.querySelector(q);
const sh=()=>SHAPES[S.shape];
const canEdit=()=>sh().seat!=='contributor';
const byId=id=>sh().nights.find(n=>n.id===id);
const ST={live:'Live',past:'Past',cancelled:'Cancelled',draft:'Draft'};
function viewOnly(){return `<div class="banner" role="note"><b>You can see raffles, but not change them.</b><br>You are a contributor. To switch a raffle on or off, ask an owner (${OWNER}).</div>`}
function failedBanner(n){return `<div class="banner err" role="alert"><b>We could not open the raffle on ${n.d}.</b><br>Nothing changed: the night still has no raffle and dancers see nothing new. Check your signal, then try again.</div>`}
function emptyBody(){return `<section class="card inv"><h2>No nights yet</h2><p class="why">A raffle lives inside a night. Create an event, then switch the raffle on for the nights you want.</p><button class="btn" data-act="toast" data-k="Opens the event editor (existing screen)">New event</button></section>`}
function loadingBody(){return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px" aria-busy="true"><span class="lbl">Loading your nights&hellip;</span><div class="skel" style="width:60%;height:18px"></div><div class="skel" style="width:85%"></div><div class="skel" style="width:45%"></div></div><p class="why">Raffle switches wake up as soon as your nights load. This usually takes a second.</p>`}
function errorBody(){return `<div class="banner err" role="alert"><b>We could not load your nights.</b><br>Nothing was changed, and every raffle stays as it was. Check your signal, then try again.</div><button class="btn" data-act="retry">Try again</button>`}
function aboutLine(){return `<p class="why">Raffles are per night. We draw every winner; you let them in free on the door. Questions? <button class="inl" data-act="toast" data-k="Opens a message to the Bachata Calendar team (prototype)">Message us</button></p>`}
// ---- frame ----
function idbar(){
 const seat=canEdit()?'Owner':'Contributor';
 return `<div class="idbar r-org"><button class="idmain" data-act="toast" data-k="Switch: drawn on Home" aria-label="Organiser, ${seat}, ${ORG}. Switch page"><span class="badge r-org" style="--s:40px">ORG</span><span class="idtxt"><small>Organiser &middot; ${seat}</small><b>${ORG}</b></span></button><button class="sw" data-act="toast" data-k="Switch: drawn on Home" aria-label="Switch page">Switch &#9662;</button></div>`;
}
function tabs(){return `<nav class="tabs" aria-label="Organiser area">${[['home','Home'],['events','Events'],['tickets','Tickets'],['team','Team']].map(t=>`<button data-act="tab" data-k="${t[0]}" aria-current="${S.tab===t[0]}">${t[1]}</button>`).join('')}</nav>`}
var tt;
function toast(m){clearTimeout(tt);let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');$('#frame').appendChild(el)}el.textContent=m;tt=setTimeout(()=>el.remove(),1800)}
function listBody(){
 const s=sh();if(!s.nights.length)return emptyBody();
 let wk='',h='';
 for(const n of s.nights){if(n.wk!==wk){if(wk)h+='</div>';wk=n.wk;h+=`<h3>${wk}</h3><div class="card">`}h+=nightRow(n)}
 h+='</div>';
 if(s.more)h+=`<p class="why">${s.more}</p>`;
 return h;
}
function render(){
 $('#shseg').innerHTML=Object.keys(SHAPES).map(k=>`<button data-act="shape" data-k="${k}" aria-pressed="${S.shape===k}">${SHAPES[k].lab}</button>`).join('');
 const s=sh();
 const body=S.shape==='loading'?loadingBody():S.shape==='error'?errorBody():`${canEdit()?'':viewOnly()}${s.note==='failed'&&!S.sheet?failedBanner(s.nights[0]):''}${listBody()}${s.nights.length?aboutLine():''}`;
 let h=idbar()+`<main class="scroll" id="scroll">${body}</main>`+tabs();
 if(S.sheet)h+=`<div class="sheetbg" data-act="bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${S.sheet}">${SHEETS[S.sheet]()}</div></div>`;
 $('#frame').innerHTML=h;
}
function setShape(k){S.shape=k;const s=SHAPES[k];S.of=s.open||null;S.sheet=s.confirm?'confirm':s.open?FIRST_SHEET:null;S.mode=s.confirm||null}
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
 const a=t.dataset.act,k=t.dataset.k;
 if(a==='bg'){if(e.target===t){S.sheet=null;render()}return}
 if(a==='shape')setShape(k);
 else if(a==='night'){S.sheet=NIGHT_SHEET;S.of=k}
 else if(a==='sheet'){S.sheet=k;if(t.dataset.m)S.mode=t.dataset.m}
 else if(a==='close')S.sheet=S.sheet==='confirm'?FIRST_SHEET:null;
 else if(a==='doset'){const n=byId(k);n.on=!n.on;S.sheet=FIRST_SHEET;toast(n.on?'Raffle open (prototype)':'Raffle closed (prototype)');render();return}
 else if(a==='retry')setShape('normal');
 else if(a==='tab'){if(k!=='events'){toast('Prototype: only the raffle inside Events is drawn');return}}
 else if(a==='toast'){toast(k);return}
 render();
});
(function init(){
 const h=new URLSearchParams(location.hash.slice(1));
 for(const k of h.keys())if(SHAPES[k])setShape(k);
 if(h.has('list'))S.sheet=null;
 if(h.has('night'))S.sheet='night';
 if(h.has('shot'))document.body.classList.add('shot');
 render();
})();
