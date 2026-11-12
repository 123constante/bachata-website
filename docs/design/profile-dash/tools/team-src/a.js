// OPTION A: one people list with role chips, an "Add a teammate" card on top.
const TITLE='Option A: one list, add card on top';
const FOOT='<b>Option A, one list.</b> An "Add a teammate" card sits at the top with the three ways in (Find, Link, Email). Below it is ONE list of everyone, each with a role chip and a line saying whether they show on your public page; invites waiting to be used sit at the end of the same list. Tap a person for role, public switch and Remove. Every person, email and link is a made-up example.';
function addCard(s){
 if(!canEdit())return viewOnly();
 return `<section class="card inv" aria-label="Add a teammate"><h2>Add a teammate</h2>${s.people.length===1?soloCard():''}<div class="qa"><button data-act="sheet" data-k="invite" data-m="find">Find</button><button data-act="sheet" data-k="invite" data-m="link">Link</button><button data-act="sheet" data-k="invite" data-m="email">Email</button></div><p class="why">Find someone already on Bachata Calendar, or send a link or an email to anyone else.</p></section>`;
}
function teamBody(s){
 const n=s.people.length,search=n>8?`<div class="field"><label for="ft">Find in your team</label><input id="ft" placeholder="Name" autocomplete="off"></div>`:'';
 const list=s.people.map((p,i)=>personRow(p,i,true)).join('')+s.inv.map(invRow).join('');
 const head=`<div class="ghead"><h3>Your team</h3><span>${n===1?'Only you':n+' people'}${s.inv.length?' &middot; '+s.inv.length+' waiting':''}</span></div>`;
 const solo=n===1?`<p class="why">Nobody else yet. Add someone above and they show here.</p>`:'';
 return `${noteBanner()}${addCard(s)}${head}${search}<div class="card">${list}</div>${solo}<h3>What each role can do</h3>${roleKey()}${publicNote()}`;
}
