// OPTION B: three parts per event behind a switch: Sell (tickets), Orders (orders + guest list), Money (owner).
const TITLE='Option B: Sell / Orders / Money';
const FOOT='<b>Option B, three parts.</b> Pick the event, then switch between Sell (the tickets and their sold bars), Orders (orders, refunds and the guest list) and Money (takings and payouts). Money is the owner&rsquo;s part: for anyone else it is switched off and the line under the switch says why. Price changes and refunds always end in an owner approval sheet. Every person, order and event is a made-up example.';
function segs(){
 const m=showMoney();
 const b=(k,l,dis)=>`<button aria-pressed="${S.seg===k}" data-act="seg" data-k="${k}"${dis?' disabled':''}>${l}</button>`;
 return `<div class="seg2" role="group" aria-label="Part">${b('sell','Sell')}${b('orders','Orders')}${b('money','Money',!m)}</div>${m?'':`<p class="why">Money is off: ${seat()==='owner'?'the server did not confirm money access.':'amounts are for owners.'}</p>`}`;
}
function tixBody(s){
 if(!s.types.length&&!s.stripe)return `${eventPick(s)}${emptyTypes()}`;
 if(!s.types.length)return `${eventPick(s)}${stripeBanner()}${emptyTypes()}`;
 const seg=S.seg==='money'&&!showMoney()?'sell':S.seg;
 let part='';
 if(seg==='sell')part=`${summary(s)}<div class="card">${s.types.map(typeRow).join('')}</div>${addType()}`;
 if(seg==='orders')part=`<button class="btn alt" data-act="sheet" data-k="guests" data-of="1">Guest list and check-ins</button><div class="card">${s.orders.map(orderRow).join('')}</div>${ordersFoot()}`;
 if(seg==='money')part=`<div class="stats"><div class="stat"><b>${gbp(net(s))}</b><span>taken after refunds</span></div><div class="stat"><b>${gbp(s.orders.reduce((a,o)=>a+(o.st==='refunded'?o.p:o.ref||0),0))}</b><span>refunded</span></div></div><button class="row card" data-act="sheet" data-k="payout"><span class="t"><b>Payouts</b><span>Stripe pays your bank. See what is on the way.</span></span><span aria-hidden="true">&rsaquo;</span></button><p class="why">Refunds start from an order in Orders, and always end in an approval step.</p>`;
 return `${eventPick(s)}${askBanner()}${stripeBanner()}${moneyNote()}${segs()}${part}`;
}
