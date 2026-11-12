// OPTION B: the night sheet has a Raffle ROW; it opens a Raffle sheet with a 4-step track, the facts, and ONE button.
const TITLE='Option B: a raffle page per night, one button';
const FOOT='<b>Option B, a raffle page per night.</b> List rows show a raffle chip (Raffle open / locked / Winner drawn). The night sheet has a Raffle row; it opens a Raffle sheet with a 4-step track (Open, Entries, Closed, Winner), the facts (closes at, entered, winner, drawn) and ONE button for the only thing you can do now: Open a raffle, Close the raffle, or Message us to cancel. Both buttons go through the same confirmation (hard stop). Every person and event is a made-up example.';
const FIRST_SHEET='raffle',NIGHT_SHEET='night';
const STEPS=['Open','Entries','Closed','Winner'];
const STEP_AT={off:-1,open:0,locked:1,closed:2,nodraw:2,drawn:3,pastoff:-1,cancelled:-1,draft:-1};
function nightRow(n){
 const p=phase(n),c=PH[p].chip;
 return `<button class="row" data-act="night" data-k="${n.id}" aria-label="${n.t}, ${n.d}. Open"><span class="t"><b>${n.t}</b><span>${n.d} &middot; ${n.time} &middot; ${ST[n.st]}</span></span>${c?`<span class="chip ${p}">${c}${p==='locked'||p==='closed'?' &middot; '+n.entries:''}</span>`:''}<span aria-hidden="true">&rsaquo;</span></button>`;
}
function nightSheet(){
 const n=byId(S.of),p=phase(n),c=PH[p].chip||'Off';
 return `<button class="x" data-act="close">Close</button><h2>${n.t}</h2><p class="cap">${n.d} &middot; ${n.time} &middot; ${ST[n.st]}</p><h3>On the night</h3><div class="card"><button class="row" data-act="sheet" data-k="raffle"><span class="t"><b>Raffle</b><span>${lineOf(n)}</span></span><span class="chip ${p}">${c}</span><span aria-hidden="true">&rsaquo;</span></button><button class="row" data-act="toast" data-k="Opens the Tickets tab for this night"><span class="t"><b>Tickets</b><span>Prices and sales live on the Tickets tab</span></span><span aria-hidden="true">&rsaquo;</span></button></div>`;
}
function raffleSheet(){
 const n=byId(S.of),p=phase(n),g=gate(n),st=story(n),at=STEP_AT[p];
 const track=at<0?'':`<ol class="track" aria-label="Raffle steps">${STEPS.map((s,i)=>`<li class="${i<at?'done':i===at?'now':''}" ${i===at?'aria-current="step"':''}>${s}</li>`).join('')}</ol>`;
 const facts=[['Entries close',p==='off'||p==='open'||p==='locked'||p==='closed'?n.close:''],['Entered',p==='off'||p==='cancelled'||p==='draft'||p==='pastoff'?'':String(n.entries)],['Winner',n.winner||''],['Drawn',n.drawn||'']].filter(x=>x[1]);
 let act='';
 if(p==='off'||p==='open'){act=g?`<button class="btn" disabled>${p==='off'?'Open a raffle':'Close the raffle'}</button><p class="why"><b>Not available:</b> ${g}</p>`:p==='off'?`<button class="btn" data-act="sheet" data-k="confirm" data-m="open">${sh().note==='failed'?'Try again: open a raffle':'Open a raffle'}</button>`:`<button class="btn alt red" data-act="sheet" data-k="confirm" data-m="close">Close the raffle</button>`}
 else if(p==='locked')act=canEdit()?msgUs(n):`<p class="why"><b>Not available:</b> ${g}</p>`;
 else if(p==='draft')act=`<button class="btn" disabled>Open a raffle</button><p class="why"><b>Not available:</b> ${g}</p>`;
 const fail=sh().note==='failed'?failedBanner(n):'';
 return `<button class="x" data-act="close">Close</button><h2>Raffle</h2><p class="cap">${n.t}, ${n.d} &middot; ${n.time}</p>${fail}${track}<div class="capbox"><b>${st.h}</b><p class="why" style="margin-top:4px">${st.b}</p></div>${facts.length?`<div class="facts card">${facts.map(f=>`<div><span>${f[0]}</span><b>${f[1]}</b></div>`).join('')}</div>`:''}${act}`;
}
function confirmSheet(){return confirmBody(byId(S.of),S.mode==='open')}
const SHEETS={night:nightSheet,raffle:raffleSheet,confirm:confirmSheet};
