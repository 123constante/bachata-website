// Shared Team-tab core: one copy of every fact both options show (roles, public rule, invites, removal).
// Every person, email and link here is an obviously fake example (example.com, "Sample", "Placeholder").
const ROLE={
 owner:{n:'Owner',can:'Everything, plus removing people, changing roles and handing the page over.'},
 manager:{n:'Manager',can:'Runs events, tickets and the page, and can add people.'},
 contributor:{n:'Contributor',can:'Can look at events, tickets and the team, but cannot change anything.'}
};
const ORDER=['owner','manager','contributor'];
const P=(n,role,o={})=>Object.assign({n,role},o);
const ME=P('You (Sam Sample)','owner',{me:1});
const BEN=P('Ben Sample','manager');
const CARA=P('Cara Placeholder','contributor');
const INV={
 link:{kind:'link',role:'manager',to:'Anyone with the link',when:'Works once. Expires in 5 days.'},
 email:{kind:'email',role:'contributor',to:'dee@example.com',when:'Sent 2 days ago. Expires in 5 days.'},
 expired:{kind:'link',role:'contributor',to:'Anyone with the link',when:'Expired 3 days ago. Nobody used it.',bad:1}
};
const HUGE=[ME,P('Olu Example','owner'),BEN,P('Mia Fictional','manager'),P('Raf Testcase','manager'),CARA,
 P('Dee Dummy','contributor'),P('Eli Unclaimed','contributor',{stub:1}),P('Fay Specimen','contributor',{hidden:1}),
 P('Gus Mockup','contributor'),P('Hal Demo','contributor'),P('Ivy Template-Longname-Doublebarrel','contributor')];
const SHAPES={
 solo:{lab:'Only you',people:[ME],inv:[]},
 two:{lab:'You + 2',people:[ME,BEN,CARA],inv:[]},
 huge:{lab:'12 people',people:HUGE,inv:[INV.email]},
 pending:{lab:'Pending',people:[ME,BEN],inv:[INV.link,INV.email,INV.expired]},
 stub:{lab:'Unclaimed',people:[ME,BEN,CARA,P('Eli Unclaimed','contributor',{stub:1})],inv:[]},
 lastowner:{lab:'Last owner',people:[ME,BEN,CARA],inv:[],sheet:'person',of:0},
 remove:{lab:'Remove',people:[ME,BEN,CARA],inv:[],sheet:'remove',of:2},
 contributor:{lab:'Contributor',people:[P('Sam Sample','owner'),BEN,P('You (Cara Placeholder)','contributor',{me:1})],inv:[INV.email],seat:'contributor'},
 sent:{lab:'Invite sent',people:[ME,BEN],inv:[Object.assign({},INV.email,{when:'Sent just now. Expires in 7 days.'})],note:'sent'},
 failed:{lab:'Invite failed',people:[ME,BEN],inv:[],note:'failed'},
 loading:{lab:'Loading'},
 error:{lab:'Error'}
};
const S={shape:'two',sheet:null,of:null,mode:'find',role:'contributor',picked:[],tab:'team'};
const $=q=>document.querySelector(q);
const sh=()=>SHAPES[S.shape];
const canEdit=()=>sh().seat!=='contributor';
const owners=s=>s.people.filter(p=>p.role==='owner'&&!p.stub).length;
const ini=n=>n.replace(/^You \(|\)$/g,'').split(/[ -]/).map(w=>w[0]).slice(0,2).join('');
// Contributors see "the public page"; only editors are told it is "your" page.
const pg=()=>canEdit()?'your public page':'the public page';
const chip=r=>`<span class="chip ${r}">${ROLE[r].n}</span>`;
// The public rule (owner 2026-11-07): owners and managers always show; others have a hide switch; unclaimed stubs stay hidden until claimed.
function pubLine(p){
 if(p.stub)return `<span class="pub">Not claimed yet &middot; hidden from ${pg()} until they claim it</span>`;
 if(p.role!=='contributor')return `<span class="pub">Shown on ${pg()}</span>`;
 return p.hidden?`<span class="pub off">Hidden from ${pg()}</span>`:`<span class="pub">Shown on ${pg()}</span>`;
}
function avatar(p){return `<span class="av ${p.stub?'stub':''}" aria-hidden="true">${ini(p.n)}</span>`}
function personRow(p,i,showChip){
 const lbl=`${p.n}, ${ROLE[p.role].n}${p.stub?', not claimed yet':''}`;
 const inner=`${avatar(p)}<span class="t"><b>${p.n}</b><span class="meta">${showChip?chip(p.role):''}${pubLine(p)}</span></span>`;
 return canEdit()?`<button class="row" data-act="person" data-k="${i}" aria-label="${lbl}. Open">${inner}<span aria-hidden="true">&rsaquo;</span></button>`:`<div class="row">${inner}</div>`;
}
// Contributors never see a full invitee email: d***@example.com.
const mask=e=>e.replace(/^(.)[^@]*/,'$1***');
function invRow(v,i){
 const what=v.kind==='email'?(canEdit()?v.to:mask(v.to)):'Invite link';
 const act=!canEdit()?'':v.bad?`<button class="act alt" data-act="sheet" data-k="invite" data-m="link">New link</button>`:`<button class="act alt" data-act="invmenu" data-k="${i}" aria-label="Options for invite to ${what}">Options</button>`;
 return `<div class="row"><span class="av stub" aria-hidden="true">${v.kind==='email'?'@':'&#128279;'}</span><span class="t"><b>${what}</b><span class="meta">${chip(v.role)}<span class="chip ${v.bad?'bad':'wait'}">${v.bad?'Expired':'Waiting'}</span></span><span>${v.when}</span></span>${act}</div>`;
}
function noteBanner(){
 const s=sh();
 if(s.note==='sent')return `<div class="banner ok" role="status"><b>Invite sent to dee@example.com.</b><br>They join as a contributor when they open the email and sign in. It shows under Waiting until then.</div>`;
 if(s.note==='failed')return `<div class="banner err" role="alert"><b>We could not send the invite to dee@example.com.</b><br>Nothing was sent and nobody was added. Check the address, then try again, or send a link yourself instead.</div><div class="qa"><button data-act="sheet" data-k="invite" data-m="email">Try again</button><button data-act="sheet" data-k="invite" data-m="link">Send a link instead</button></div>`;
 return '';
}
function viewOnly(){
 return `<div class="banner" role="note"><b>You can see the team, but not change it.</b><br>You are a contributor. To add or remove someone, ask an owner (Sam Sample).</div>`;
}
function soloCard(){
 return `<p class="why">Add a teammate to share the work. They see the same organiser pages you do, with the role you pick.</p>`;
}
function roleKey(){
 return `<div class="card">${ORDER.map(r=>`<div class="roleline">${chip(r)}<span>${ROLE[r].can}</span></div>`).join('')}</div>`;
}
function publicNote(){
 if(!canEdit())return `<p class="why">The public page lists owners and managers. Contributors show unless an owner hides them. Someone who has not claimed their profile stays hidden until they do.</p>`;
 return `<p class="why">Your public page lists owners and managers. Contributors show too unless you hide them. Someone who has not claimed their profile stays hidden until they do.</p>`;
}
function loadingBody(){
 return `<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px" aria-busy="true"><span class="lbl">Loading your team&hellip;</span><div class="skel" style="width:60%;height:18px"></div><div class="skel" style="width:85%"></div><div class="skel" style="width:45%"></div></div><button class="btn" disabled>Add a teammate</button><p class="why">Adding wakes up as soon as your team loads. This usually takes a second.</p>`;
}
function errorBody(){
 return `<div class="banner err" role="alert"><b>We could not load your team.</b><br>Nothing was changed. Check your signal, then try again.</div><button class="btn" data-act="retry">Try again</button>`;
}
// ---- sheets (shared) ----
function personSheet(){
 const s=sh(),p=s.people[S.of],last=p.role==='owner'&&owners(s)===1;
 const other=p.role==='owner'&&!p.me&&!last;
 const roles=ORDER.map(r=>`<button role="radio" aria-checked="${p.role===r}" data-act="role" data-k="${r}" ${last&&r!=='owner'||other?'disabled':''}><span class="dot" aria-hidden="true"></span><span class="t"><b>${ROLE[r].n}</b><span>${ROLE[r].can}</span></span></button>`).join('');
 const pub=p.stub?`<div class="row"><span class="t"><b>Public page</b><span>Hidden until ${p.n.split(' ')[0]} claims their profile. Nothing to switch yet.</span></span></div>`
  :p.role==='contributor'?`<div class="row"><span class="t" id="pl"><b>Show on our public page</b><span>${p.hidden?'Hidden now. Only the team sees them here.':'Shown now, under Team.'}</span></span><button class="toggle" role="switch" aria-checked="${!p.hidden}" aria-labelledby="pl" data-act="hide"></button></div>`
  :`<div class="row"><span class="t"><b>Public page</b><span>Always shown. Owners and managers are always on your public page.</span></span></div>`;
 const rm=other?`<button class="btn alt" disabled>Remove</button><p class="why"><b>Owners cannot remove another owner.</b> ${p.n.split(' ')[0]} can leave from their own Team tab.</p>`:last?`<button class="btn alt" disabled>${p.me?'Leave the team':'Remove'}</button><p class="why"><b>${p.me?'You are':p.n+' is'} the only owner.</b> A page always needs one owner. Make someone else an owner first, then ${p.me?'you can leave':'this can be removed'}.</p>`
  :`<button class="btn alt" data-act="sheet" data-k="remove" data-of="${S.of}" style="color:var(--danger)">${p.me?'Leave the team':'Remove from team'}</button>`;
 const claim=p.stub?`<div class="banner"><b>${p.n} has not claimed their profile yet.</b><br>We made it for them when they were added. They can still be on your team; the public page waits until they claim it.</div><button class="btn" data-act="toast" data-k="Claim invite sent (prototype)">Send them a claim link</button>`:'';
 return `<button class="x" data-act="close">Close</button><div class="row" style="padding:0">${avatar(p)}<span class="t"><h2>${p.n}</h2></span></div>${claim}<h3>Role</h3><div class="card radio" role="radiogroup" aria-label="Role">${roles}</div>${other?'<p class="why">Only the owner themselves can change an owner role.</p>':''}${last?'<p class="why">Role stays Owner while there is only one owner.</p>':''}<h3>Public page</h3><div class="card">${pub}</div>${rm}`;
}
function loses(p){
 if(p.role==='owner')return ['Everything on this organiser page: events, tickets, the page and the team','This Team tab and the numbers on Home'];
 if(p.role==='manager')return ['Editing events, tickets and the page','Inviting people','Seeing the numbers on Home'];
 return ['Seeing this organiser page and its team'];
}
function removeSheet(){
 const p=sh().people[S.of],f=p.n.split(' ')[0];
 return `<button class="x" data-act="close">Cancel</button><h2>Remove ${p.n}?</h2><p class="cap"><b>${f} will lose:</b></p><ul class="lose">${loses(p).map(x=>`<li>${x}</li>`).join('')}${p.role!=='contributor'||!p.hidden?'<li>Their place under Team on your public page</li>':''}</ul><p class="cap">Their own dancer profile and anything they posted stay. We do not message them. You can invite them again any time.</p><button class="btn danger" data-act="toast" data-k="${p.n} removed (prototype)">Remove ${f}</button><button class="btn alt" data-act="close">Keep ${f}</button>`;
}
function invMenu(){
 const v=sh().inv[S.of];
 return `<button class="x" data-act="close">Close</button><h2>${v.kind==='email'?'Invite to '+v.to:'Invite link'}</h2><p class="cap">Joins as ${ROLE[v.role].n.toLowerCase()}. ${v.when}</p><div class="card">${v.kind==='email'?'<button class="row" data-act="toast" data-k="Invite sent again (prototype)"><span class="t"><b>Send again</b><span>Same address, new 7-day expiry.</span></span></button>':'<button class="row" data-act="toast" data-k="Link copied"><span class="t"><b>Copy link</b><span>bc.link/join/x7k2-example</span></span></button>'}<button class="row" data-act="toast" data-k="Invite cancelled (prototype)"><span class="t"><b style="color:var(--danger)">Cancel invite</b><span>The ${v.kind==='email'?'email link':'link'} stops working. Nobody is told.</span></span></button></div>`;
}
// The team picker is the existing one (search a person, add as chip). Only its frame changes.
function picker(){
 const res=[['Dee Dummy','Dancer &middot; London'],['Dee Example-Two','Teacher &middot; Bristol']];
 const chips=S.picked.map((n,i)=>`<span class="pchip">${n}<button data-act="unpick" data-k="${i}" aria-label="Remove ${n}">&times;</button></span>`).join('');
 return `<div class="field"><label for="q">Search people on Bachata Calendar</label><input id="q" value="Dee" autocomplete="off"></div><div class="card">${res.map(r=>{const on=S.picked.includes(r[0]);return `<button class="row${on?' picked':''}" data-act="${on?'unpick':'pick'}" data-k="${on?S.picked.indexOf(r[0]):r[0]}" aria-pressed="${on}" aria-label="${r[0]}${on?', picked. Tap to unpick':'. Pick'}"><span class="av" aria-hidden="true">${ini(r[0])}</span><span class="t"><b>${r[0]}</b><span>${on?'Picked':r[1]}</span></span><span class="tick" aria-hidden="true">${on?'&#10003;':'+'}</span></button>`}).join('')}</div>${chips?`<div class="chips" aria-label="Picked">${chips}</div>`:''}<p class="why">Not on Bachata Calendar yet? Use Link or Email instead.</p>`;
}
function roleRadios(){
 return `<h3>Their role</h3><div class="card radio" role="radiogroup" aria-label="Role">${['manager','contributor'].map(r=>`<button role="radio" aria-checked="${S.role===r}" data-act="irole" data-k="${r}"><span class="dot" aria-hidden="true"></span><span class="t"><b>${ROLE[r].n}</b><span>${ROLE[r].can}</span></span></button>`).join('')}</div><p class="why">To add another owner, add them as a manager, then change their role.</p>`;
}
function inviteBody(){
 let b,go;
 if(S.mode==='find'){b=picker();go=S.picked.length?`<button class="btn" data-act="toast" data-k="Added (prototype)">Add ${S.picked.length===1?S.picked[0]:S.picked.length+' people'}</button>`:`<button class="btn" disabled>Add</button><p class="why">Pick someone above first.</p>`}
 else if(S.mode==='link'){b=`<p class="cap">Anyone who opens the link and signs in joins with the role you pick. It works once and expires after 7 days.</p>`;go=`<button class="btn" data-act="toast" data-k="Link created and copied (prototype)">Create and copy link</button><button class="btn alt" data-act="toast" data-k="Opens WhatsApp (prototype)">Send on WhatsApp</button>`}
 else {b=`<div class="field"><label for="em">Their email</label><input id="em" type="email" value="dee@example.com"></div><p class="cap">We send one email with a join link. It expires after 7 days.</p>`;go=`<button class="btn" data-act="shape" data-k="sent">Send invite</button>`}
 return `<div class="seg2" role="group" aria-label="How to add">${[['find','Find'],['link','Link'],['email','Email']].map(m=>`<button aria-pressed="${S.mode===m[0]}" data-act="mode" data-k="${m[0]}">${m[1]}</button>`).join('')}</div>${b}${roleRadios()}${go}`;
}
function inviteSheet(){return `<button class="x" data-act="close">Close</button><h2>Add a teammate</h2>${inviteBody()}`}
// ---- frame ----
function idbar(){
 const seat=canEdit()?'Owner':'Contributor';
 return `<div class="idbar r-org"><button class="idmain" data-act="toast" data-k="Switch: drawn on Home" aria-label="Organiser, ${seat}, Sample Socials London. Switch page"><span class="badge r-org" style="--s:40px">ORG</span><span class="idtxt"><small>Organiser &middot; ${seat}</small><b>Sample Socials London</b></span></button><button class="sw" data-act="toast" data-k="Switch: drawn on Home" aria-label="Switch page">Switch &#9662;</button></div>`;
}
function tabs(){return `<nav class="tabs" aria-label="Organiser area">${[['home','Home'],['events','Events'],['tickets','Tickets'],['team','Team']].map(t=>`<button data-act="tab" data-k="${t[0]}" aria-current="${S.tab===t[0]}">${t[1]}</button>`).join('')}</nav>`}
var tt;
function toast(m){clearTimeout(tt);let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');$('#frame').appendChild(el)}el.textContent=m;tt=setTimeout(()=>el.remove(),1800)}
const SHEETS={person:personSheet,remove:removeSheet,invite:inviteSheet,invmenu:invMenu};
function render(){
 $('#shseg').innerHTML=Object.keys(SHAPES).map(k=>`<button data-act="shape" data-k="${k}" aria-pressed="${S.shape===k}">${SHAPES[k].lab}</button>`).join('');
 const s=sh();
 const body=S.shape==='loading'?loadingBody():S.shape==='error'?errorBody():teamBody(s);
 let h=idbar()+`<main class="scroll" id="scroll">${body}</main>`+tabs();
 if(S.sheet)h+=`<div class="sheetbg" data-act="bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${S.sheet}">${SHEETS[S.sheet]()}</div></div>`;
 $('#frame').innerHTML=h;
}
function setShape(k){S.shape=k;const s=SHAPES[k];S.sheet=s.sheet||null;S.of=s.of??null;S.picked=[];S.mode='find'}
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
 const a=t.dataset.act,k=t.dataset.k;
 if(a==='bg'){if(e.target===t){S.sheet=null;render()}return}
 if(a==='shape')setShape(k);
 else if(a==='person'){S.sheet='person';S.of=+k}
 else if(a==='invmenu'){S.sheet='invmenu';S.of=+k}
 else if(a==='sheet'){S.sheet=k;if(t.dataset.of)S.of=+t.dataset.of;if(t.dataset.m)S.mode=t.dataset.m;if(t.dataset.r)S.role=t.dataset.r}
 else if(a==='close')S.sheet=null;
 else if(a==='mode')S.mode=k;
 else if(a==='irole')S.role=k;
 else if(a==='pick'){if(!S.picked.includes(k))S.picked.push(k)}
 else if(a==='unpick')S.picked.splice(+k,1);
 else if(a==='role'){toast('Role change: careful lane, not built (prototype)');return}
 else if(a==='hide'){const p=sh().people[S.of];p.hidden=!p.hidden}
 else if(a==='retry')setShape('two');
 else if(a==='tab'){if(k!=='team'){toast('Prototype: only Team is drawn');return}}
 else if(a==='toast'){toast(k);return}
 render();
});
(function init(){
 const h=new URLSearchParams(location.hash.slice(1));
 for(const k of h.keys())if(SHAPES[k])setShape(k);
 if(h.get('sheet')){S.sheet=h.get('sheet');if(h.get('of'))S.of=+h.get('of');if(h.get('m'))S.mode=h.get('m');if(h.get('r'))S.role=h.get('r')}
 if(h.get('pick'))S.picked=[h.get('pick')];
 if(h.has('shot'))document.body.classList.add('shot');
 render();
})();
