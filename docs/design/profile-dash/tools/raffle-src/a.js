// OPTION A: the raffle is a SWITCH row inside the night sheet ("On the night"), next to Tickets.
const TITLE='Option A: a raffle switch in each night';
const FOOT='<b>Option A, a switch in the night.</b> Tap a night on Events; its sheet has an "On the night" card with a Raffle switch next to Tickets. Flipping the switch never acts at once: it opens a confirmation that says what happens (hard stop). Once anyone enters, the switch stays on and greys out, with the reason and a "Message us to cancel" button. After our draw, the same card shows the winner, the draw time and the entries count. List rows carry one plain line ("Raffle &middot; 23 entered"). Every person and event is a made-up example.';
const FIRST_SHEET='night',NIGHT_SHEET='night';
function nightRow(n){
 const p=phase(n),l=lineOf(n);
 return `<button class="row" data-act="night" data-k="${n.id}" aria-label="${n.t}, ${n.d}. Open"><span class="t"><b>${n.t}</b><span>${n.d} &middot; ${n.time} &middot; ${ST[n.st]}</span>${p==='off'||p==='pastoff'||p==='draft'?'':`<span class="pub ${p==='locked'||p==='closed'?'hot':''}">${l}</span>`}</span><span aria-hidden="true">&rsaquo;</span></button>`;
}
function nightSheet(){
 const n=byId(S.of),p=phase(n),g=gate(n),st=story(n);
 const sw=`<button class="toggle" role="switch" aria-checked="${n.on&&p!=='cancelled'&&p!=='draft'}" aria-labelledby="rl" ${g?'disabled':''} data-act="sheet" data-k="confirm" data-m="${n.on?'close':'open'}"></button>`;
 const win=p==='drawn'?`<div class="facts"><div><span>Winner</span><b>${n.winner}</b></div><div><span>Drawn</span><b>${n.drawn}</b></div><div><span>Entries</span><b>${n.entries}</b></div></div>`:'';
 const fail=sh().note==='failed'?failedBanner(n)+`<button class="btn" data-act="sheet" data-k="confirm" data-m="open">Try again</button>`:'';
 return `<button class="x" data-act="close">Close</button><h2>${n.t}</h2><p class="cap">${n.d} &middot; ${n.time} &middot; ${ST[n.st]}</p>${fail}<h3>On the night</h3><div class="card"><div class="row"><span class="t" id="rl"><b>Raffle</b><span>${st.h}</span></span>${sw}</div>${win}<div class="sub"><p class="why">${st.b}</p>${g&&p!=='locked'?`<p class="why"><b>Switch off:</b> ${g}</p>`:''}${p==='locked'&&canEdit()?msgUs(n):''}${p==='locked'&&!canEdit()?`<p class="why"><b>Switch off:</b> ${g}</p>`:''}</div><button class="row" data-act="toast" data-k="Opens the Tickets tab for this night"><span class="t"><b>Tickets</b><span>Prices and sales live on the Tickets tab</span></span><span aria-hidden="true">&rsaquo;</span></button></div>`;
}
function confirmSheet(){return confirmBody(byId(S.of),S.mode==='open')}
const SHEETS={night:nightSheet,confirm:confirmSheet};
