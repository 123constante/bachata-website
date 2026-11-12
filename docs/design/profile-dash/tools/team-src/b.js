// OPTION B (PICKED by the owner): grouped by role, each group says what that role can do; one "Add a teammate" button after the list opens a sheet.
const TITLE='Option B: grouped by role + add sheet';
const FOOT='<b>Option B, grouped by role (picked).</b> People sit under Owners, Managers and Contributors, and each group heading says in one line what that role can do, so no separate key is needed. Invites waiting to be used come after Contributors: the first 2 show, the rest and any expired ones fold under "Show all". One "Add a teammate" button sits after the list (it no longer floats over rows) and opens a sheet with Find, Link and Email. Big groups fold after 4. Every person, email and link is a made-up example.';
let OPEN={};
function addBtn(){return canEdit()?`<button class="btn" data-act="sheet" data-k="invite" data-m="find">Add a teammate</button>`:''}
function group(s,r){
 const all=s.people.map((p,i)=>[p,i]).filter(x=>x[0].role===r);
 const plural={owner:'Owners',manager:'Managers',contributor:'Contributors'}[r];
 const head=`<div class="ghead"><h3>${plural}</h3><span>${all.length}</span></div><p class="gline">${ROLE[r].can}</p>`;
 if(!all.length){
  // Different action from the main button: this one opens the sheet with this role already picked.
  const empty=canEdit()?(r==='manager'?'No managers yet. A manager can run events and tickets with you.':'No contributors yet. A contributor can look but not change anything.'):'Nobody in this role.';
  return `${head}<div class="card"><div class="row"><span class="t"><span>${empty}</span></span>${canEdit()?`<button class="act alt" data-act="sheet" data-k="invite" data-m="find" data-r="${r}">Add a ${ROLE[r].n.toLowerCase()}</button>`:''}</div></div>`;
 }
 const cut=all.length>5&&!OPEN[r]?4:all.length;
 const more=cut<all.length?`<button class="row" data-act="more" data-k="${r}" style="justify-content:center;font-weight:600">Show all ${all.length} ${plural.toLowerCase()}</button>`:'';
 return `${head}<div class="card">${all.slice(0,cut).map(x=>personRow(x[0],x[1],false)).join('')}${more}</div>`;
}
// Waiting to join: after Contributors, first 2 live invites, expired ones folded until "Show all".
function waitGroup(s){
 if(!s.inv.length||!canEdit())return ''; // contributors cannot act on invites, so they do not see the group
 const rows=s.inv.map((v,i)=>[v,i]),live=rows.filter(x=>!x[0].bad),dead=rows.filter(x=>x[0].bad);
 const shown=OPEN.wait?live.concat(dead):live.slice(0,2);
 const rest=s.inv.length-shown.length;
 const more=rest?`<button class="row" data-act="more" data-k="wait" style="justify-content:center;font-weight:600">Show all ${s.inv.length}${dead.length?` (${dead.length} expired)`:''}</button>`:'';
 return `<div class="ghead"><h3>Waiting to join</h3><span>${s.inv.length}</span></div><p class="gline">Invites nobody has used yet.</p><div class="card">${shown.map(x=>invRow(x[0],x[1])).join('')}${more}</div>`;
}
function teamBody(s){
 const solo=s.people.length===1&&canEdit();
 const soloBox=solo?`<section class="card inv"><h2>Only you so far</h2>${soloCard()}</section>${addBtn()}`:'';
 const groups=ORDER.map(r=>s.people.length===1&&r!=='owner'?'':group(s,r)).join('');
 return `${canEdit()?'':viewOnly()}${noteBanner()}${soloBox}${groups}${waitGroup(s)}${solo?'':addBtn()}${publicNote()}`;
}
document.addEventListener('click',e=>{const t=e.target.closest('[data-act=more]');if(t){OPEN[t.dataset.k]=1;render()}});
{const m=new URLSearchParams(location.hash.slice(1)).get('more');if(m)OPEN[m]=1}
