// OPTION A: one scroll per event. Summary, tickets, latest orders and money all on one page, top to bottom.
const TITLE='Option A: one page per event';
const FOOT='<b>Option A, one page per event.</b> Pick the event at the top; then everything for it is on one scroll: the three numbers, each ticket with its sold bar, the latest orders with Refund, the guest list, then Payouts. Owners see amounts; managers and contributors see counts and a one-line reason. Price changes and refunds always end in an owner approval sheet. Every person, order and event is a made-up example.';
function tixBody(s){
 if(!s.types.length&&!s.stripe)return `${eventPick(s)}${emptyTypes()}`;
 const orders=s.orders.length?`<h3>Latest orders</h3><div class="card">${s.orders.slice(0,5).map(orderRow).join('')}${s.orders.length>5?`<button class="row" data-act="toast" data-k="All ${s.orders.length} orders" style="justify-content:center;font-weight:600">See all ${s.orders.length} orders</button>`:''}</div>${ordersFoot()}`:'';
 const guests=s.orders.length?`<button class="btn alt" data-act="sheet" data-k="guests" data-of="1">Guest list and check-ins</button>`:'';
 const money=s.orders.length?`<h3>Money</h3>${showMoney()?`<button class="row card" data-act="sheet" data-k="payout"><span class="t"><b>Payouts</b><span>Stripe pays your bank. See what is on the way.</span></span><span aria-hidden="true">&rsaquo;</span></button>`:`<div class="card"><div class="row"><span class="t"><b>Payouts</b><span>${seat()==='owner'?'Hidden while amounts are off.':'Owners only. Stripe pays the owner’s bank.'}</span></span></div></div>`}`:'';
 const list=s.types.length?`<h3>Tickets</h3><div class="card">${s.types.map(typeRow).join('')}</div>${addType()}`:emptyTypes();
 return `${eventPick(s)}${askBanner()}${stripeBanner()}${moneyNote()}${s.types.length?summary(s):''}${list}${orders}${guests}${money}`;
}
