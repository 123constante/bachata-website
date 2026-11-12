// Shared Tickets-tab core: ONE copy of every fact both options show (money rule, refunds, approvals, copy).
// Every person, order code and event here is an obviously fake example. Money rule = PR #1541 (59e0809):
// amounts show only when seat is owner AND the server's money_visible is not false (fail closed).
const COPY={
 countsOnly:'Ticket counts only. The owner sees sales and refunds.', // ticketModel.ts:76 COUNTS_ONLY_NOTE
 notOwnerRefund:'Ask the owner to refund this order.', // ticketModel.ts:74 NOT_OWNER_REFUND
 notManager:'Only an owner or manager of this page can change tickets.', // ticketModel.ts:56
 priceLocked:'Tickets have been sold at this price, so it cannot change. To use a different price, pause this ticket and add a new one.', // ticketModel.ts:567
 paused:'Not on sale. People who already bought keep their tickets.' // ticketModel.ts:571
};
const T=(n,p,sold,cap,o={})=>Object.assign({n,p,sold,cap},o);
const O=(code,who,q,p,st,o={})=>Object.assign({code,who,q,p,st},o);
const EV='Friday Sample Social';
const TYPES=[T('Early bird',800,40,40,{out:1}),T('Standard',1200,22,80),T('Door',1500,0,30,{paused:1})];
const ORDERS=[O('K7Q2','Ana Sample',2,2400,'paid',{when:'Today 14:02'}),O('M3XD','Bo Example',1,1200,'part',{ref:600,when:'Yesterday'}),
 O('P9LA','Cy Placeholder',1,800,'refunded',{when:'3 Nov'}),O('R2VN','Di Demo',1,800,'disputed',{when:'2 Nov'}),O('T5HE','Ed Fictional',3,2400,'paid',{when:'1 Nov'})];
const HUGE_T=['Early bird','Standard','Door','Couples pair','Student','Workshop only','Party only','Full pass','VIP table','Volunteer','Late night','Follower pass'].map((n,i)=>T(n,[800,1200,1500,2000,900,1800,1000,4500,6000,0,700,1100][i],[40,61,0,12,8,30,44,19,2,6,0,3][i],[40,80,30,20,40,30,60,25,4,10,20,20][i],{out:i===0,paused:i===2||i===10}));
const HUGE_O=Array.from({length:9},(_,i)=>O('Z'+(10+i)+'Q','Guest '+'ABCDEFGHI'[i]+' Sample',1+i%3,1200*(1+i%3),i===4?'refunded':'paid',{when:(i+1)+' Nov'}));
const SHAPES={
 empty:{lab:'No tickets',types:[],orders:[],mv:true},
 nostripe:{lab:'No Stripe',types:[],orders:[],mv:true,stripe:'none'},
 stripewait:{lab:'Stripe checking',types:[T('Standard',1200,0,80,{held:1})],orders:[],mv:true,stripe:'wait'},
 normal:{lab:'Owner',types:TYPES,orders:ORDERS,mv:true},
 manager:{lab:'Manager',types:TYPES,orders:ORDERS,mv:false,seat:'manager'},
 ownerhidden:{lab:'Owner, money off',types:TYPES,orders:ORDERS,mv:false},
 contributor:{lab:'Contributor',types:TYPES,orders:ORDERS,mv:false,seat:'contributor'},
 huge:{lab:'12 tickets',types:HUGE_T,orders:HUGE_O,mv:true,events:3},
 guests:{lab:'Guest list',types:TYPES,orders:ORDERS,mv:true,sheet:'guests',of:1},
 guestsmgr:{lab:'Guests (mgr)',types:TYPES,orders:ORDERS,mv:false,seat:'manager',sheet:'guests',of:1},
 refund:{lab:'Refund',types:TYPES,orders:ORDERS,mv:true,sheet:'refund',of:0},
 refundok:{lab:'Approve refund',types:TYPES,orders:ORDERS,mv:true,sheet:'refundok',of:0},
 refunddenied:{lab:'Refund refused',types:TYPES,orders:ORDERS,mv:true,sheet:'refundno',of:0},
 price:{lab:'Approve price',types:TYPES,orders:ORDERS,mv:true,sheet:'price',of:2},
 pricelocked:{lab:'Price locked',types:TYPES,orders:ORDERS,mv:true,sheet:'type',of:1},
 pricereq:{lab:'Ask owner',types:TYPES,orders:ORDERS,mv:false,seat:'manager',sheet:'pricereq',of:1},
 approve:{lab:'Owner to approve',types:TYPES,orders:ORDERS,mv:true,ask:1},
 payout:{lab:'Payouts',types:TYPES,orders:ORDERS,mv:true,sheet:'payout'},
 loading:{lab:'Loading'},
 error:{lab:'Error'}
};
const S={shape:'normal',sheet:null,of:null,amt:'full',seg:'sell',tab:'tickets'};
const $=q=>document.querySelector(q);
const sh=()=>SHAPES[S.shape];
const seat=()=>sh().seat||'owner';
// THE money rule (PR #1541): owner AND server money_visible !== false. Everything money-shaped reads this.
const showMoney=()=>seat()==='owner'&&sh().mv!==false;
const canEdit=()=>seat()!=='contributor';
const gbp=p=>p===0?'Free':'&pound;'+(p/100).toFixed(p%100?2:0);
const SEATN={owner:'Owner',manager:'Manager',contributor:'Contributor'};
// Why amounts are not shown, per shape. One wording per cause.
function moneyWhy(){
 if(seat()==='contributor')return 'You can look, but not change tickets. Amounts and refunds are for owners. Ask an owner (Sam Sample) to change something.';
 if(seat()==='manager')return COPY.countsOnly+' You can add and pause tickets; a price change goes to the owner to approve.';
 return 'Amounts are hidden because the server did not confirm money access for your seat. Counts below are right. Reload; if it stays, contact support. Refunds are off until then.';
}
function moneyNote(){return showMoney()?'':`<div class="banner" role="note"><b>${seat()==='owner'?'Counts only right now':'Counts only'}</b><br>${moneyWhy()}</div>`}
function stripeBanner(){
 const st=sh().stripe;
 if(st==='none')return `<div class="banner"><b>Free tickets work now.</b> To sell paid tickets, connect Stripe so money reaches your bank.${seat()==='owner'?'':' Only the owner can connect it.'}</div>${seat()==='owner'?'<button class="btn" data-act="toast" data-k="Opens Stripe (GetPaid.tsx)">Connect Stripe to get paid</button>':''}`;
 if(st==='wait')return `<div class="banner"><b>Stripe is checking your details.</b> Paid tickets go on sale by themselves when Stripe says yes, usually within a day. Nothing for you to do now.</div><button class="btn alt" data-act="toast" data-k="Opens Stripe (GetPaid.tsx)">Check with Stripe</button>`;
 return '';
}
function askBanner(){
 if(!sh().ask)return '';
 return `<div class="banner warn" role="status"><b>Ben Sample asks to change a price.</b><br>Standard: &pound;12 to &pound;14, for tickets bought from 1 Dec. Nothing changes until you approve.</div><div class="qa"><button data-act="sheet" data-k="price" data-of="1">Look and approve</button><button data-act="toast" data-k="Declined: Ben is told; price stays &pound;12 (prototype)">Decline</button></div>`;
}
function soldBar(t){const pc=t.cap?Math.round(100*t.sold/t.cap):0;return `<span class="bar" aria-hidden="true"><i style="width:${pc}%"></i></span>`}
function typeState(t){return t.held?'<span class="tag">Waiting for Stripe</span>':t.out?'<span class="tag">Sold out</span>':t.paused?'<span class="tag">Paused</span>':'<span class="tag ok">On sale</span>'}
function typeRow(t,i){
 const price=showMoney()||seat()==='manager'||seat()==='contributor'?gbp(t.p):''; // a price is public; takings are not
 const take=showMoney()&&t.sold?` &middot; ${gbp(t.p*t.sold)} taken`:'';
 const inner=`<span class="t"><b>${t.n} &middot; ${price}</b><span>${t.sold} of ${t.cap} sold${take}</span>${soldBar(t)}${t.paused?`<span>${COPY.paused}</span>`:''}</span>${typeState(t)}`;
 return canEdit()?`<button class="row" data-act="sheet" data-k="type" data-of="${i}" aria-label="${t.n}, ${t.sold} of ${t.cap} sold. Open">${inner}</button>`:`<div class="row">${inner}</div>`;
}
const STAT={paid:['Paid','ok'],part:['Part refunded',''],refunded:['Refunded',''],disputed:['Disputed','bad']};
function orderRow(o,i){
 const title=showMoney()?`${o.who.split(' ')[0]} &middot; ${o.code}`:`Order ${o.code}`; // orderTitleFor (59e0809 ticketModel.ts:619)
 const line=showMoney()?`${o.q} ticket${o.q>1?'s':''} &middot; ${gbp(o.p)}${o.ref?` &middot; ${gbp(o.ref)} back`:''} &middot; ${o.when}`:`${o.q} ticket${o.q>1?'s':''} &middot; ${o.when}`;
 const tag=`<span class="tag ${STAT[o.st][1]}">${STAT[o.st][0]}</span>`;
 const can=showMoney()&&(o.st==='paid'||o.st==='part');
 const act=can?`<button class="act alt" data-act="sheet" data-k="refund" data-of="${i}" aria-label="Refund order ${o.code}">Refund</button>`:'';
 return `<div class="row"><span class="t"><b>${title}</b><span>${line}</span></span>${tag}${act}</div>`;
}
function ordersFoot(){
 if(showMoney())return `<p class="why">Disputed: the buyer asked their bank for the money back. Stripe emails you what to send; no refund button while it is open.</p>`;
 return `<p class="why">${seat()==='owner'?'Refunds are off until amounts show again.':COPY.notOwnerRefund+' Refunds are for owners only.'}</p>`;
}
// Takings after refunds: one sum, read by the summary and the payout sheet.
const net=s=>s.types.reduce((a,t)=>a+t.p*t.sold,0)-s.orders.reduce((a,o)=>a+(o.st==='refunded'?o.p:o.ref||0),0);
function summary(s){
 const sold=s.types.reduce((a,t)=>a+t.sold,0),cap=s.types.reduce((a,t)=>a+t.cap,0);
 const money=showMoney()?`<div class="stat"><b>${gbp(net(s))}</b><span>taken after refunds</span></div>`:`<div class="stat"><b>${s.orders.length}</b><span>orders</span></div>`;
 return `<div class="stats"><div class="stat"><b>${sold}</b><span>of ${cap} sold</span></div>${money}<div class="stat"><b>3</b><span>checked in</span></div></div>`;
}
function eventPick(s){
 const n=s.events||1;
 return `<button class="row card evpick" data-act="toast" data-k="Pick another event (${n} with tickets)" aria-label="Event: ${EV}, Fri 14 Nov. Change event"><span class="t"><b>${EV}</b><span>Fri 14 Nov${n>1?` &middot; 1 of ${n} events with tickets`:''}</span></span><span aria-hidden="true">Change &rsaquo;</span></button>`;
}
function emptyTypes(){
 if(!canEdit())return `<div class="card"><div class="row"><span class="t"><span>No tickets for this event yet. ${moneyWhy()}</span></span></div></div>`;
 return `<div class="card pad"><h2>No tickets yet</h2><p class="why">Add a ticket to sell or give out free places. Or keep using your own ticket link: we show it on the event page as a Tickets button.</p></div><button class="btn" data-act="sheet" data-k="type" data-of="-1">Add a ticket</button><button class="btn alt" data-act="toast" data-k="Edit the outside ticket link (event page)">Use my own ticket link instead</button>`;
}
function addType(){return canEdit()?`<button class="btn alt" data-act="sheet" data-k="type" data-of="-1">Add a ticket</button>`:''}
// ---- sheets ----
const X=`<button class="x" data-act="close">Close</button>`;
function typeSheet(){
 const s=sh(),t=s.types[S.of]||T('',0,0,0);
 const locked=t.sold>0;
 const priceField=locked?`<div class="field dis"><span>Price</span><b>${gbp(t.p)}</b></div><p class="why">${COPY.priceLocked}</p><button class="btn alt" data-act="sheet" data-k="${seat()==='owner'?'price':'pricereq'}" data-of="${S.of}">${seat()==='owner'?'Set a new price from a date':'Ask the owner for a new price'}</button>`:`<div class="field"><span>Price</span><b>${t.n?gbp(t.p):'&pound;'}</b></div>${seat()==='owner'?'':'<p class="why">A price you set here waits for the owner to approve before buyers see it.</p>'}`;
 return `${X}<h2>${t.n||'New ticket'}</h2><div class="field"><span>Name</span><b>${t.n||'e.g. Standard'}</b></div>${priceField}<div class="field"><span>How many</span><b>${t.cap||''}</b></div><div class="field"><span>Sales open / close</span><b>Now &ndash; Fri 14 Nov, 21:00</b></div>${t.n?`<button class="btn alt" data-act="toast" data-k="${t.paused?'Back on sale':'Paused: '+COPY.paused}">${t.paused?'Put back on sale':'Pause sales'}</button>`:''}<button class="btn" data-act="close">Save</button>`;
}
function priceSheet(){
 const t=sh().types[S.of],nw=t.p+200,ask=!!sh().ask;
 const who=ask?'Ben Sample (manager) asked for this.':t.sold?'':'No one has bought this ticket yet.';
 return `${X}<p class="step">Owner approval</p><h2>Change ${t.n} to ${gbp(nw)}?</h2><div class="capbox"><b>Now:</b> ${gbp(t.p)}<br><b>New:</b> ${gbp(nw)}${t.sold?' for tickets bought from 1 Dec':' from now'}<br>${t.sold?`<b>${t.sold} people already paid ${gbp(t.p)}.</b> They keep their tickets and pay nothing more.`:who}</div>${ask?`<p class="why">${who}</p>`:''}<p class="why">Buyers see the new price on the event page as soon as you approve. You can change it back before anyone buys.</p><button class="btn" data-act="toast" data-k="Approved (prototype; careful lane: ticket_price_step_set_v1 + approval)">Approve ${gbp(nw)}</button><button class="btn alt" data-act="close">Keep ${gbp(t.p)}</button>`;
}
function priceReq(){
 const t=sh().types[S.of];
 return `${X}<p class="step">Needs the owner</p><h2>Ask for a new ${t.n} price</h2><div class="field"><span>New price</span><b>&pound;14</b></div><div class="field"><span>From</span><b>Mon 1 Dec</b></div><p class="why">The owner approves price changes. Sam Sample gets a request on their Tickets tab; until then buyers keep paying the current price. ${t.sold} people already bought and are not affected.</p><button class="btn" data-act="toast" data-k="Sent to Sam Sample for approval (prototype)">Send to the owner</button>`;
}
function refundSheet(){
 const o=sh().orders[S.of],left=o.p-(o.ref||0);
 const opt=(k,l)=>`<button class="radio" role="radio" aria-checked="${S.amt===k}" data-act="amt" data-k="${k}">${l}</button>`;
 return `${X}<p class="step">Step 1 of 2</p><h2>Refund ${o.who.split(' ')[0]} &middot; ${o.code}</h2><p class="why">${o.q} ticket${o.q>1?'s':''}, paid ${gbp(o.p)} ${o.when.toLowerCase()}.</p><div class="card" role="radiogroup" aria-label="How much">${opt('full','All of it: '+gbp(left))}${opt('part','Part of it: choose an amount')}</div>${S.amt==='part'?'<div class="field"><span>Amount</span><b>&pound;12</b></div>':''}<p class="why">Full refund cancels the tickets so they no longer get in. Part refund keeps the tickets.</p><button class="btn" data-act="sheet" data-k="refundok" data-of="${S.of}">Next: check and approve</button>`;
}
function refundOk(){
 const o=sh().orders[S.of],amt=S.amt==='part'?1200:o.p-(o.ref||0);
 return `${X}<p class="step">Step 2 of 2 &middot; Owner approval</p><h2>Send ${gbp(amt)} back?</h2><div class="capbox"><b>To:</b> ${o.who} (order ${o.code})<br><b>Amount:</b> ${gbp(amt)} of ${gbp(o.p)}<br><b>Tickets:</b> ${S.amt==='part'?'kept':'cancelled, cannot be used at the door'}<br><b>Money:</b> back on their card in 5 to 10 days. It comes out of your next payout.</div><p class="why">This cannot be undone. We email the buyer.</p><button class="btn danger" data-act="sheet" data-k="refundno" data-of="${S.of}">Approve refund of ${gbp(amt)}</button><button class="btn alt" data-act="close">Do not refund</button>`;
}
function refundNo(){
 return `${X}<h2>The refund did not go through</h2><div class="banner err" role="alert"><b>Nothing was refunded.</b><br>The server said only the owner can refund (not_allowed). ${COPY.notOwnerRefund} If you are the owner, reload the page: your seat may have changed.</div><div class="qa"><button data-act="retry">Reload</button><button data-act="close">Close</button></div>`;
}
function guestsSheet(){
 const t=sh().types[S.of];
 const rows=[['Ana Sample','K7Q2',1],['Ana Sample','K7Q2',0],['Ed Fictional','T5HE',1],['Ed Fictional','T5HE',1],['Bo Example','M3XD',0]];
 const r=rows.map(([n,c,ci])=>`<div class="row"><span class="t"><b>${showMoney()?n:'Order '+c}</b><span>${showMoney()?'Order '+c:'Ticket holder'}</span></span><span class="tag ${ci?'ok':''}">${ci?'In':'Not yet'}</span></div>`).join('');
 return `${X}<h2>Guest list: ${t.n}</h2><p class="why">${t.sold} sold &middot; 3 checked in. Door staff scan tickets on the Door screen.</p>${showMoney()?'':`<p class="why">Names are for owners. You see order codes and who is in.</p>`}<div class="card">${r}</div><p class="why">Showing 5 of ${t.sold}.</p><button class="btn alt" data-act="toast" data-k="Download list (CSV, sales report)">${showMoney()?'Download guest list':'Download counts'}</button>`;
}
function payoutSheet(){
 return `${X}<h2>Payouts</h2><div class="capbox"><b>Stripe pays you.</b> Money from ticket sales goes to your bank on Stripe's schedule, usually 2 to 7 days after each sale. Refunds come out of the next payout.</div><div class="card"><div class="row"><span class="t"><b>${gbp(net(sh()))}</b><span>taken after refunds, this event</span></span></div><div class="row"><span class="t"><b>Bank and schedule</b><span>Set in Stripe. Only the owner can change them.</span></span></div></div><button class="btn" data-act="toast" data-k="Opens Stripe dashboard (owner only)">Open Stripe to see payouts</button><p class="why">Changing your bank or schedule happens in Stripe and needs your Stripe login: that is the owner approval step.</p>`;
}
const SHEETS={type:typeSheet,price:priceSheet,pricereq:priceReq,refund:refundSheet,refundok:refundOk,refundno:refundNo,guests:guestsSheet,payout:payoutSheet};
function loadingBody(){return `<div class="card pad" aria-busy="true"><div class="skel" style="width:60%"></div><div class="skel" style="width:40%;margin-top:10px"></div></div><div class="card pad"><div class="skel"></div><div class="skel" style="margin-top:10px"></div><div class="skel" style="margin-top:10px;width:70%"></div></div><button class="btn" disabled>Add a ticket</button><p class="why">Add a ticket works once your tickets have loaded.</p>`}
function errorBody(){return `<div class="banner err" role="alert"><b>We could not load your tickets.</b><br>Nothing was changed, and tickets already on sale keep selling. Check your connection and try again.</div><button class="btn" data-act="retry">Try again</button>`}
// ---- frame ----
function idbar(){const st=SEATN[seat()];return `<div class="idbar r-org"><button class="idmain" data-act="toast" data-k="Switch: drawn on Home" aria-label="Organiser, ${st}, Sample Socials London. Switch page"><span class="badge r-org" style="--s:40px">ORG</span><span class="idtxt"><small>Organiser &middot; ${st}</small><b>Sample Socials London</b></span></button><button class="sw" data-act="toast" data-k="Switch: drawn on Home" aria-label="Switch page">Switch &#9662;</button></div>`}
function tabs(){return `<nav class="tabs" aria-label="Organiser area">${[['home','Home'],['events','Events'],['tickets','Tickets'],['team','Team']].map(t=>`<button data-act="tab" data-k="${t[0]}" aria-current="${S.tab===t[0]}">${t[1]}</button>`).join('')}</nav>`}
var tt;
function toast(m){clearTimeout(tt);let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');$('#frame').appendChild(el)}el.innerHTML=m;tt=setTimeout(()=>el.remove(),1800)}
function render(){
 $('#shseg').innerHTML=Object.keys(SHAPES).map(k=>`<button data-act="shape" data-k="${k}" aria-pressed="${S.shape===k}">${SHAPES[k].lab}</button>`).join('');
 const body=S.shape==='loading'?loadingBody():S.shape==='error'?errorBody():tixBody(sh());
 let h=idbar()+`<main class="scroll" id="scroll">${body}</main>`+tabs();
 if(S.sheet)h+=`<div class="sheetbg" data-act="bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${S.sheet}">${SHEETS[S.sheet]()}</div></div>`;
 $('#frame').innerHTML=h;
}
function setShape(k){S.shape=k;const s=SHAPES[k];S.sheet=s.sheet||null;S.of=s.of??null;S.amt='full';S.seg=s.seg||'sell'}
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
 const a=t.dataset.act,k=t.dataset.k;
 if(a==='bg'){if(e.target===t){S.sheet=null;render()}return}
 if(a==='shape')setShape(k);
 else if(a==='sheet'){S.sheet=k;if(t.dataset.of)S.of=+t.dataset.of}
 else if(a==='close')S.sheet=null;
 else if(a==='amt')S.amt=k;
 else if(a==='seg')S.seg=k;
 else if(a==='retry')setShape('normal');
 else if(a==='tab'){if(k!=='tickets'){toast('Prototype: only Tickets is drawn');return}}
 else if(a==='toast'){toast(k);return}
 render();
});
(function init(){
 const h=new URLSearchParams(location.hash.slice(1));
 for(const k of h.keys())if(SHAPES[k])setShape(k);
 if(h.get('sheet')){S.sheet=h.get('sheet');if(h.get('of'))S.of=+h.get('of')}
 if(h.get('amt'))S.amt=h.get('amt');
 if(h.get('seg'))S.seg=h.get('seg');
 if(h.has('shot'))document.body.classList.add('shot');
 render();
})();
