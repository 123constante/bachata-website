// OPTION B: grouped by role, each group says what that role can do; one "Add a teammate" button opens a sheet.
const TITLE='Option B: grouped by role + add sheet';
const FOOT='<b>Option B, grouped by role.</b> People sit under Owners, Managers and Contributors, and each group heading says in one line what that role can do, so no separate key is needed. Invites waiting to be used get their own group at the top, because they may need a nudge. One "Add a teammate" button stays above the tabs and opens a sheet with Find, Link and Email. Big groups fold after 4. Every person, email and link is a made-up example.';
const FAB=1;
let OPEN={};
function fab(s){return canEdit()&&s.people?`<button class="btn fab" data-act="sheet" data-k="invite" data-m="find">Add a teammate</button>`:''}
function group(s,r){
 const all=s.people.map((p,i)=>[p,i]).filter(x=>x[0].role===r);
 const plural={owner:'Owners',manager:'Managers',contributor:'Contributors'}[r];
 const head=`<div class="ghead"><h3>${plural}</h3><span>${all.length}</span></div><p class="gline">${ROLE[r].can}</p>`;
 if(!all.length){
  const empty=canEdit()?(r==='manager'?'No managers yet. A manager can run events and tickets with you.':'No contributors yet. Add someone who helps but should not change anything.'):'Nobody in this role.';
  return `${head}<div class="card"><div class="row"><span class="t"><span>${empty}</span></span>${canEdit()?`<button class="act alt" data-act="sheet" data-k="invite" data-m="find" aria-label="Add a ${ROLE[r].n.toLowerCase()}">Add</button>`:''}</div></div>`;
 }
 const cut=all.length>5&&!OPEN[r]?4:all.length;
 const more=cut<all.length?`<button class="row" data-act="more" data-k="${r}" style="justify-content:center;font-weight:600">Show all ${all.length} ${plural.toLowerCase()}</button>`:'';
 return `${head}<div class="card">${all.slice(0,cut).map(x=>personRow(x[0],x[1],false)).join('')}${more}</div>`;
}
function teamBody(s){
 const solo=s.people.length===1&&canEdit()?`<section class="card inv"><h2>Only you so far</h2>${soloCard()}<p class="why">Tap Add a teammate below. You can find someone on Bachata Calendar, or send a link or an email.</p></section>`:'';
 const wait=s.inv.length?`<div class="ghead"><h3>Waiting to join</h3><span>${s.inv.length}</span></div><p class="gline">Invites nobody has used yet.</p><div class="card">${s.inv.map(invRow).join('')}</div>`:'';
 return `${canEdit()?'':viewOnly()}${noteBanner()}${solo}${wait}${ORDER.map(r=>s.people.length===1&&r!=='owner'?'':group(s,r)).join('')}${publicNote()}`;
}
document.addEventListener('click',e=>{const t=e.target.closest('[data-act=more]');if(t){OPEN[t.dataset.k]=1;render()}});
