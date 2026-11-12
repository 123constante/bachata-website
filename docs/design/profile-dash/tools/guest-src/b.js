// OPTION B: three views inside the night: Names (before), Door (on the night), Settings.
// The night opens on Door on the night itself and on Names before it.
const TITLE='Option B: Names / Door / Settings';
const FOOT='<b>Option B, three views inside the night.</b> Under the night&rsquo;s title a small switch picks <b>Names</b> (add and remove, before the night), <b>Door</b> (big Check in rows, not-arrived first, Scan QR, live count) or <b>Settings</b>. On the night itself it opens on Door. The main tab bar is unchanged. The <b>team-only</b> shape (or <code>&amp;v=team</code>) is the privacy alternative, clearly marked; the owner chose public names. Every name is a made-up example.';
function sub(){const n=live().length;return `<div class="seg sub" role="tablist">${[['names',`Names ${n}`],['door',`Door ${inCount()}/${n}`],['settings','Settings']].map(v=>`<button role="tab" data-act="view" data-k="${v[0]}" aria-selected="${S.view===v[0]}" aria-pressed="${S.view===v[0]}">${v[1]}</button>`).join('')}</div>`}
function listCard(rows,o){const cut=50*(S.more+1);return `<div class="card">${rows.slice(0,cut).map(([x,i])=>nameRow(x,i,o)).join('')}${moreRow(rows.length,Math.min(cut,rows.length))}</div>`}
function namesView(s){
 const w=lockWhy();
 let h=stateBanner()+(statusLine()?`<p class="cap">${statusLine()}</p>`:'');
 if(!w)h+=`<div class="addline"><input aria-label="Add a name" placeholder="Add a name" maxlength="80"><button class="act" data-act="sheet" data-k="add">Add</button></div>`;
 else if(canEdit())h+=`<p class="why">${w}</p>`;
 if(!live().length)return h+emptyCard();
 const m=matches();
 h+=search()+(m.length?listCard(m,{}):noMatch());
 return h+`<button class="btn alt" data-act="toast" data-k="Downloads names.csv: name, how added, checked in">Download names</button><p class="why pubnote">${PUBLIC_LINE()}</p>`;
}
function doorView(s){
 const n=live().length,k=inCount(),w=doorWhy();
 let h=`<div class="door"><div><b>${k}</b> of ${n} in</div><div class="bar"><i style="width:${n?Math.round(100*k/n):0}%"></i></div><span>${s.door?'Updates as your team checks people in':s.past?'Final count':'Opens on the night'}</span></div>`;
 if(w){if(canEdit())h+=`<p class="why">${w}</p>`}else h+=`<button class="btn" data-act="sheet" data-k="qr">Scan a QR code</button>`;
 if(!n)return h+emptyCard();
 const m=matches().sort((a,b)=>a[0].inn-b[0].inn);
 return h+`<input id="q" class="search" type="search" aria-label="Find a name" placeholder="Find a name" value="${S.q}" data-act="q"><h3>Not in yet first</h3>`+(m.length?listCard(m,{check:1}):noMatch());
}
function settingsView(s){return `<div class="card">${switchRow()}</div>${s.on?settingsRows():''}<p class="why pubnote">${PUBLIC_LINE()}</p>`}
function glBody(s){
 let h=backBar()+viewOnly()+teamVariantBadge();
 if(!s.on)return h+`<div class="card">${switchRow()}</div>`+emptyCard();
 h+=sub();
 return h+(S.view==='door'?doorView(s):S.view==='settings'?settingsView(s):namesView(s));
}
