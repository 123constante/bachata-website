// OPTION A: one page per night. Switch, counts, actions, the list (with Check in on the night) and the
// settings all on one scroll, in that order.
const TITLE='Option A: one page per night';
const FOOT='<b>Option A, one page per night.</b> Open a night on Events, tap Open the guest list, and everything for that night is on one scroll: the on/off switch, the counts, Add / Share link / Scan, the names (each with Check in on the night), then the settings for this night. Nothing is hidden behind a second level of tabs. The <b>team-only</b> shape (or <code>&amp;v=team</code>) is the privacy alternative, clearly marked; the owner chose public names. Every name is a made-up example.';
function counts(){const n=live().length,s=sh();return `<div class="stats"><div><b>${n}</b><span>names</span></div><div><b>${s.door||s.past?inCount():places()-n<0?0:places()-n}</b><span>${s.door||s.past?'in':'places left'}</span></div><div><b>${s.door||s.past?n-inCount():NIGHT.close}</b><span>${s.door||s.past?'not yet':'closes'}</span></div></div>`}
function actions(){
 const s=sh(),w=lockWhy();
 if(w)return '';
 return `<div class="qa"><button data-act="sheet" data-k="add">Add a name</button>${s.door?'<button data-act="sheet" data-k="qr">Scan QR</button>':s.full||s.closed?'<button data-act="sheet" data-k="settings">Settings</button>':'<button data-act="sheet" data-k="link">Share link</button>'}</div>`;
}
function glBody(s){
 let h=backBar()+viewOnly()+teamVariantBadge()+`<div class="card">${switchRow()}</div>`;
 if(!s.on)return h+emptyCard();
 h+=stateBanner()+(statusLine()?`<p class="cap">${statusLine()}</p>`:'')+(s.cx?'':counts())+actions();
 if(!live().length)h+=emptyCard();
 else{
  const m=matches(),cut=50*(S.more+1),dw=doorWhy();
  h+=search()+`${s.door||s.past?`<h3>Names &middot; tap Check in as people arrive</h3>`:'<h3>Names</h3>'}${(s.door||s.past)&&dw&&canEdit()?`<p class="why">${dw}</p>`:''}<div class="card">${m.slice(0,cut).map(([x,i])=>nameRow(x,i,{check:s.door||s.past})).join('')}${moreRow(m.length,Math.min(cut,m.length))}</div>`;
  if(!m.length)h+=noMatch();
  h+=`<button class="btn alt" data-act="toast" data-k="Downloads names.csv: name, how added, checked in">Download names</button>`;
 }
 h+=`<h3>Settings for this night</h3>${settingsRows()}<p class="why pubnote">${PUBLIC_LINE()}</p>`;
 return h;
}
