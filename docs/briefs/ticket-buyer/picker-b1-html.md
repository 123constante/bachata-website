<title>Ticket Picker B1</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>
:root{
  /* Layout: one 390px phone, interactive. Page is dark by choice; the phone is a white checkout screen. */
  --bg:#1b1f1d;--fg:#efe9db;--muted-page:#9fb0a6;--gold:#d9a84e;
  --w:#ffffff;--ink:#17211c;--sub:#5f6e66;--line:#e3e9e6;--soft:#f4f6f5;--brand:#14604a;--brand-ink:#fff;--tint:#e8f3ee;--bad:#b3261e;--good:#14604a;
  --font-body:'Inter',system-ui,sans-serif;--font-head:'Space Grotesk','Inter',system-ui,sans-serif;
  color-scheme:dark;
}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 var(--font-body);padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font:600 22px var(--font-head);margin:0 0 4px}
.lead{color:var(--muted-page);margin:0 0 16px;max-width:62ch}
.wrap{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}
.side{flex:1 1 260px;max-width:420px;min-width:0;color:var(--muted-page)}
.side h3{font:600 14px var(--font-head);color:var(--gold);letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px}
.side ul{margin:0 0 14px;padding-left:18px}
.side code{color:var(--fg);background:#2a312e;padding:1px 5px;border-radius:4px}
.phone{position:relative;flex:0 1 390px;width:100%;max-width:390px;height:780px;border-radius:28px;overflow:hidden;display:flex;flex-direction:column;border:1px solid #000;font-size:13px;background:var(--w);color:var(--ink)}
.nav{flex:none;display:flex;justify-content:space-between;padding:14px 18px 6px;color:var(--sub)}
.scroll{flex:1;overflow-y:auto;padding:6px 18px 12px}
.ev{padding:4px 0 14px}
.ev h4{margin:0;font:600 17px var(--font-head)}
.ev div{color:var(--sub);margin-top:2px}
.tk{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 0;border-top:1px solid var(--line)}
.tk.last{border-bottom:1px solid var(--line)}
.tk .t{min-width:0}
.tk .n{font:600 14px var(--font-head)}
.tk .i{color:var(--sub);font-size:12px;margin-top:2px}
.tk .per{color:var(--brand);font-size:12px;margin-top:4px}
.tk .r{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.tk .p{font:600 16px var(--font-head);font-variant-numeric:tabular-nums;line-height:1.2}
.tk .p s{color:var(--sub);font:400 12px var(--font-body);margin-right:6px}
.step{display:flex;align-items:center;gap:2px}
.step button{width:36px;height:36px;border:1px solid var(--line);border-radius:50%;background:var(--w);color:var(--ink);font:500 18px var(--font-body);cursor:pointer;line-height:1}
.step button.add{border-color:var(--brand);color:var(--brand)}
.step button:disabled{color:#c3cdc8;cursor:default}
.step output{width:26px;text-align:center;font:600 14px var(--font-head);font-variant-numeric:tabular-nums}
/* promo */
.promo{margin-top:16px}
.promo label{display:block;font:600 12px var(--font-head);color:var(--ink);margin-bottom:6px}
.pr{display:flex;gap:8px}
.pr input{flex:1;min-width:0;height:44px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font:500 14px var(--font-body);color:var(--ink);background:var(--w);text-transform:uppercase;letter-spacing:.04em}
.pr input::placeholder{text-transform:none;letter-spacing:0;color:#93a199}
.pr button{height:44px;padding:0 16px;border:1px solid var(--brand);border-radius:10px;background:var(--w);color:var(--brand);font:600 13px var(--font-head);cursor:pointer}
.pr.bad input{border-color:var(--bad)}
.msg{margin-top:6px;font-size:12px;min-height:16px}
.msg.bad{color:var(--bad)}
.pr button[disabled]{opacity:.7;cursor:default}
.pr button .dots::after{content:"";animation:dots 1s steps(4,end) infinite}
@keyframes dots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
/* applied code: a ticket stub, notched edges, dashed tear line */
.stub{position:relative;display:flex;align-items:stretch;margin-top:2px;background:var(--tint);border-radius:12px;color:var(--good);transform-origin:top;animation:unfold .38s cubic-bezier(.2,.8,.2,1)}
.stub::before,.stub::after{content:"";position:absolute;left:calc(100% - 92px - 7px);width:14px;height:14px;border-radius:50%;background:var(--w)}
.stub::before{top:-7px}.stub::after{bottom:-7px}
.stub .l{flex:1;min-width:0;padding:12px 14px}
.stub .l b{display:block;font:700 15px var(--font-head);letter-spacing:.08em}
.stub .l span{display:block;font-size:12px;margin-top:2px;color:var(--sub)}
.stub .r{flex:none;width:92px;border-left:2px dashed #b7d6c9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px}
.stub .r b{font:700 18px var(--font-head);font-variant-numeric:tabular-nums}
.stub .r button{border:0;background:none;color:var(--sub);font:500 12px var(--font-body);text-decoration:underline;cursor:pointer;min-height:32px;padding:0 6px}
@keyframes unfold{from{opacity:0;transform:scaleY(.4)}to{opacity:1;transform:scaleY(1)}}
.save{display:flex;justify-content:space-between;margin-bottom:6px;color:var(--good);font-weight:600}
.bar .line b s{color:var(--sub);font:400 13px var(--font-body);margin-right:8px}
.bar .line b.roll{animation:roll .45s cubic-bezier(.2,.8,.2,1)}
@keyframes roll{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.stub,.bar .line b.roll,.pr button .dots::after{animation:none}}
@keyframes buzz{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.buzz{animation:buzz .28s}
@media (prefers-reduced-motion:reduce){.buzz{animation:none}}
.boxes{display:flex;gap:8px;justify-content:space-between}
.boxes .d{width:44px;height:54px;padding:0;text-align:center;font:600 22px var(--font-head);border-radius:10px}
.boxes .d.bad,.card input.d.bad{border-color:var(--bad)}
.lnks{display:flex;justify-content:space-between;align-items:center;margin-top:6px;color:var(--sub);font-size:12px}
.card .x.lk{display:inline;margin:0;color:var(--brand);text-decoration:underline;min-height:40px;padding:0 4px}
.hint{margin:10px 0 0!important;font-size:11.5px;color:#93a199!important}
.scr{position:absolute;inset:0;background:var(--w);overflow-y:auto;padding:18px}
.scr[hidden]{display:none!important}
.mid{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px}
.big{font:600 18px var(--font-head)}
.sm{display:flex;gap:6px;align-items:center;color:var(--sub);font-size:12px}
.spin{width:30px;height:30px;border:3px solid var(--line);border-top-color:var(--brand);border-radius:50%;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation-duration:3s}}
.note{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:var(--soft);color:var(--ink)}
.fin{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px;border-radius:12px;background:var(--tint);margin-bottom:14px}
.fin b{display:block;font:600 14px var(--font-head)}
.fin span{display:block;color:var(--sub);font-size:12px;margin-top:2px}
.btn.sm{width:auto;flex:none;padding:0 14px;min-height:40px}
.qr{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.qr span{display:block;color:var(--sub);font-size:12px}
.qrbox{width:64px;height:64px;flex:none;background:repeating-conic-gradient(var(--ink) 0 25%,var(--w) 0 50%) 0 0/16px 16px;border-radius:6px}
/* bar */
.bar{flex:none;padding:12px 18px 14px;background:var(--w);border-top:1px solid var(--line)}
.bar .line{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;color:var(--sub)}
.bar .line b{font:600 16px var(--font-head);color:var(--ink);font-variant-numeric:tabular-nums}
.btn{width:100%;background:var(--brand);color:var(--brand-ink);border:0;border-radius:10px;min-height:46px;font:600 14px var(--font-head);cursor:pointer}
.btn[disabled]{background:var(--soft);color:#9aa8a1;cursor:default}
.trust{display:flex;gap:8px;align-items:center;justify-content:center;color:var(--sub);font-size:12px;margin-top:10px}
.trust b{color:var(--ink);font-weight:600}
/* layover */
.dim{position:absolute;inset:0;background:rgba(10,18,14,.55);display:flex;align-items:center;justify-content:center;padding:18px}
.dim[hidden]{display:none!important}
.card{width:100%;background:var(--w);border-radius:16px;padding:20px 18px 16px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
.card h5{margin:0 0 4px;font:600 17px var(--font-head)}
.card p{margin:0 0 14px;color:var(--sub)}
.card input{width:100%;box-sizing:border-box;height:46px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font:500 15px var(--font-body);color:var(--ink);background:var(--w)}
.card input.bad{border-color:var(--bad)}
.card .btn{margin-top:12px}
.card .x{display:block;margin:8px auto 0;border:0;background:none;color:var(--sub);font:500 13px var(--font-body);min-height:40px;cursor:pointer}
.sum{display:flex;justify-content:space-between;margin:0 0 12px;padding:10px 12px;background:var(--soft);border-radius:10px}
.done{text-align:center;padding:30px 10px}
:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
</style>
<h1>Ticket picker: B1</h1>
<p class="lead">Option A with your changes: price top-right of each row, an always-open promo box, the shorter trust line, and an email card that opens after Continue. Everything on the phone works. Sample data only.</p>
<div class="wrap">
<div class="phone" id="ph">
  <div class="nav"><span>&lsaquo; Back</span><span>Step 1 of 2</span></div>
  <div class="scroll" id="sc"></div>
  <div class="bar" id="bar"></div>
  <div class="dim" id="dim" hidden></div><div class="scr" id="scr" hidden></div>
</div>
<div class="side">
  <h3>Try this</h3>
  <ul>
    <li>Add tickets with + and &minus;.</li>
    <li>Type <code>SPRING10</code> and Apply for a valid code (10% off). The keyboard closes, the button shows Checking, the code turns into a ticket stub, the total rolls to the new price with the old one crossed out,. Phone buzzes once.</li>
    <li>Type anything else for the invalid state (double buzz, red text).</li>
    <li>Tap Continue, type any email, Continue again. Then type the code: <code>418027</code> is right, <code>000000</code> is expired, anything else is wrong (boxes shake). It checks itself on the sixth digit.</li><li>Then the white opening screen, a Stripe stand-in (Pay now or Back to tickets), and My tickets with the Finish your profile card above the tickets.</li>
  </ul>
  <h3>Notes</h3>
  <ul>
    <li>Buzz uses the phone vibration where the browser allows it, and a small shake on the box as a stand-in on screens that cannot vibrate.</li>
    <li>The 5 Weeks Class discount applies to the whole basket here. Whether a code can apply to some tickets only is not decided.</li>
  </ul>
</div>
</div>
<script>
var LOCK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
var T=[
 {id:'a',n:'1 Class + Latin Party',p:10,i:'1 class and the party',per:'£10 for the night'},
 {id:'b',n:'Full Experience',p:15,i:'2 classes and the party',per:'£7.50 a class, party free'},
 {id:'c',n:'5 Weeks Class',p:65,i:'10 classes over 5 weeks',per:'£6.50 a class'}
];
var checking=false,roll=false,q={a:0,b:0,c:0},code='',applied=null,msg='',bad=false,stage='pick',email='',emailBad=false;
var cancelled=false,scr=document.getElementById('scr'),sc=document.getElementById('sc'),bar=document.getElementById('bar'),dim=document.getElementById('dim'),ph=document.getElementById('ph');
function money(n){return '£'+(Math.round(n*100)/100).toFixed(n%1?2:0)}
function buzz(p){try{if(navigator.vibrate)navigator.vibrate(p)}catch(e){}var b=document.getElementById('prbox');if(b){b.classList.remove('buzz');void b.offsetWidth;b.classList.add('buzz')}}
function totals(){var n=0,s=0;T.forEach(function(t){n+=q[t.id];s+=q[t.id]*t.p});var d=applied?Math.round(s*applied.pct)/100:0;return {n:n,s:s,d:d,t:s-d}}
function step(t){return '<div class="step"><button data-t="'+t.id+'" data-d="-1" aria-label="Remove one '+t.n+'"'+(q[t.id]?'':' disabled')+'>&minus;</button><output>'+q[t.id]+'</output><button class="add" data-t="'+t.id+'" data-d="1" aria-label="Add one '+t.n+'">+</button></div>'}
function draw(){
  var h='<div class="ev"><h4>Coco Loco</h4><div>Wed 18 Nov</div><div>Ritmo Latino Studio</div></div>';
  T.forEach(function(t,ix){h+='<div class="tk'+(ix===2?' last':'')+'"><div class="t"><div class="n">'+t.n+'</div><div class="i">'+t.i+'</div><div class="per">'+t.per+'</div></div><div class="r"><div class="p">'+money(t.p)+'</div>'+step(t)+'</div></div>'});
  var T2=totals();
  if(cancelled)h+='<div class="note">Payment cancelled. You were not charged. Your tickets are still here.</div>';
  if(applied){
    h+='<div class="promo" id="promo"><div class="stub" id="stubel"><div class="l"><b>'+applied.c+'</b><span>'+applied.pct+'% off your tickets</span></div><div class="r"><b>&minus;'+money(T2.d)+'</b><button type="button" id="rm" aria-label="Remove code '+applied.c+'">Remove</button></div></div></div>';
  }else{
    h+='<div class="promo" id="promo"><label for="code">Promo code</label><div class="pr'+(bad?' bad':'')+'" id="prbox"><input id="code" type="text" autocomplete="off" autocapitalize="characters" placeholder="Enter code" value="'+code+'"'+(checking?' disabled':'')+'><button type="button" id="apply"'+(checking?' disabled':'')+'>'+(checking?'Checking<span class="dots"></span>':'Apply')+'</button></div><div class="msg'+(bad?' bad':'')+'" role="status">'+msg+'</div></div>';
  }
  var y=sc.scrollTop;sc.innerHTML=h;sc.scrollTop=y;
  bar.innerHTML='<div class="line"><span>'+(T2.n?T2.n+' ticket'+(T2.n>1?'s':''):'No tickets yet')+'</span><b'+(roll?' class="roll"':'')+'>'+(applied&&T2.n?'<s>'+money(T2.s)+'</s>':'')+money(T2.t)+'</b></div><button class="btn" id="go"'+(T2.n?'':' disabled')+'>Continue</button><div class="trust">'+LOCK+'<span><b>Secure payment by Stripe.</b> We never see your card.</span></div>';
}
function esc(x){return x.replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]})}
var codeErr='',secs=0,tmr=null,toast='';
function tick(){if(tmr)clearInterval(tmr);secs=30;tmr=setInterval(function(){secs--;var r=document.getElementById('rs');if(r)r.innerHTML=secs>0?'Send a new code in '+secs+'s':'<button class="x lk" id="resend">Send a new code</button>';if(secs<=0)clearInterval(tmr)},1000)}
function drawCard(){
  scr.hidden=true;
  if(stage==='pick'){dim.hidden=true;return}
  var T2=totals();
  if(stage==='email'){dim.hidden=false;
    dim.innerHTML='<div class="card" role="dialog" aria-modal="true" aria-labelledby="ct"><h5 id="ct">Where should we send your tickets?</h5><p>We email you a code to confirm it is you.</p><div class="sum"><span>'+T2.n+' ticket'+(T2.n>1?'s':'')+(applied?' &middot; '+applied.c:'')+'</span><b>'+money(T2.t)+'</b></div><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="'+esc(email)+'" class="'+(emailBad?'bad':'')+'" aria-label="Email address">'+(emailBad?'<div class="msg bad">Enter a valid email, like you@example.com.</div>':'')+'<button class="btn" id="sendcode">Continue</button><div class="trust">'+LOCK+'<span><b>Secure payment by Stripe.</b> We never see your card.</span></div><button class="x" id="cx">Back to tickets</button></div>';
    var e=document.getElementById('em');if(e&&emailBad)e.focus();
  }else if(stage==='code'){dim.hidden=false;
    var bx='';for(var i=0;i<6;i++)bx+='<input class="d'+(codeErr?' bad':'')+'" inputmode="numeric" autocomplete="'+(i?'off':'one-time-code')+'" maxlength="1" data-i="'+i+'" aria-label="Digit '+(i+1)+'">';
    dim.innerHTML='<div class="card" role="dialog" aria-modal="true" aria-labelledby="ct"><h5 id="ct">Enter the 6-digit code</h5><p>We sent it to '+esc(email)+'.</p><div class="boxes" id="boxes">'+bx+'</div><div class="msg bad" role="alert" style="min-height:34px">'+codeErr+'</div><div class="lnks"><span id="rs">'+(secs>0?'Send a new code in '+secs+'s':'<button class="x lk" id="resend">Send a new code</button>')+'</span><button class="x lk" id="chg">Change email</button></div><p class="hint">Demo: <b>418027</b> works. <b>000000</b> is expired. Anything else is wrong.</p></div>';
    var f=dim.querySelector('.d');if(f)f.focus();
  }else if(stage==='open'){dim.hidden=true;scr.hidden=false;
    scr.innerHTML='<div class="mid"><div class="spin" aria-hidden="true"></div><div class="big">Opening secure payment</div><div class="sm">'+LOCK+'<span>Secure payment by Stripe</span></div></div>';
  }else if(stage==='stripe'){dim.hidden=true;scr.hidden=false;
    scr.innerHTML='<div class="mid"><div class="sm" style="margin-bottom:6px">Stand-in for Stripe\'s own page</div><div class="big">Pay '+money(T2.t)+'</div><button class="btn" id="paid" style="max-width:260px;margin-top:14px">Pay now</button><button class="x" id="cancelpay" style="margin-top:6px">Back to tickets</button></div>';
  }else if(stage==='mine'){dim.hidden=true;scr.hidden=false;
    var ts='';T.forEach(function(t){for(var k=0;k<q[t.id];k++)ts+='<div class="qr"><div class="qrbox" aria-hidden="true"></div><div><b>'+t.n+'</b><span>Coco Loco, Wed 18 Nov</span><span>Show this code at the door</span></div></div>'});
    scr.innerHTML='<div class="mt"><div class="nav" style="padding:0 0 10px"><span>My tickets</span><span></span></div><div class="fin"><div><b>Finish your profile</b><span>Takes a minute. Your tickets work already.</span></div><button class="btn sm" id="fin">What are you?</button></div>'+ts+'<button class="x" id="again" style="margin-top:14px">Start again</button></div>';
  }
}
function checkCode(v){
  if(v==='418027'){codeErr='';clearInterval(tmr);stage='open';drawCard();setTimeout(function(){stage='stripe';drawCard()},1400)}
  else{codeErr=v==='000000'?'This code has expired. Send a new code.':'That code is wrong. Check your email and try again.';
    var bx=document.getElementById('boxes');if(bx){bx.classList.remove('buzz');void bx.offsetWidth;bx.classList.add('buzz')}buzz([40,60,40]);
    dim.querySelectorAll('.d').forEach(function(i){i.value='';i.classList.add('bad')});dim.querySelector('.msg').textContent=codeErr;var f=dim.querySelector('.d');if(f)f.focus()}
}
sc.addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.dataset.t){q[b.dataset.t]=Math.max(0,Math.min(10,q[b.dataset.t]+ +b.dataset.d));draw()}
  else if(b.id==='apply'){var v=document.getElementById('code').value.trim().toUpperCase();code=v;
    document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
    if(!v){bad=true;msg='Enter a code first.';draw();buzz([40,60,40]);return}
    checking=true;bad=false;msg='';draw();
    setTimeout(function(){
      checking=false;
      if(v==='SPRING10'){applied={c:v,pct:10};bad=false;msg='';roll=true;draw();roll=false;buzz(40);
        var s=document.getElementById('stubel');if(s)s.scrollIntoView({block:'center',behavior:'smooth'})}
      else{applied=null;bad=true;msg='Code not valid. Check the spelling and try again.';draw();buzz([40,60,40])}
    },600)}
  else if(b.id==='rm'){applied=null;code='';bad=false;msg='';roll=true;draw();roll=false}
});
sc.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='code'){e.preventDefault();document.getElementById('apply').click()}});
bar.addEventListener('click',function(e){if(e.target.id==='go'){stage='email';emailBad=false;drawCard();var i=document.getElementById('em');if(i)i.focus()}});
dim.addEventListener('click',function(e){
  var id=e.target.id;
  if(id==='cx'){stage='pick';drawCard()}
  else if(id==='sendcode'){var v=document.getElementById('em').value.trim();email=v;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){emailBad=true;drawCard()}else{emailBad=false;codeErr='';stage='code';tick();drawCard()}}
  else if(id==='chg'){stage='email';clearInterval(tmr);secs=0;drawCard()}
  else if(id==='resend'){codeErr='';tick();drawCard()}
});
dim.addEventListener('input',function(e){var t=e.target;if(!t.classList.contains('d'))return;
  t.value=t.value.replace(/\D/g,'').slice(-1);var ds=[].slice.call(dim.querySelectorAll('.d')),i=ds.indexOf(t);
  if(t.value&&i<5)ds[i+1].focus();
  if(ds.every(function(x){return x.value})){document.activeElement.blur();checkCode(ds.map(function(x){return x.value}).join(''))}});
dim.addEventListener('paste',function(e){var t=e.target;if(!t.classList.contains('d'))return;var v=(e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,6);if(v.length<6)return;e.preventDefault();var ds=dim.querySelectorAll('.d');v.split('').forEach(function(c,i){ds[i].value=c});document.activeElement.blur();checkCode(v)});
dim.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target.id==='em'){e.preventDefault();document.getElementById('sendcode').click()}
  if(e.key==='Backspace'&&e.target.classList.contains('d')&&!e.target.value){var p=e.target.previousElementSibling;if(p)p.focus()}
  if(e.key==='Escape'){stage='pick';drawCard()}});
scr.addEventListener('click',function(e){var id=e.target.id;
  if(id==='paid'){stage='mine';drawCard()}
  else if(id==='cancelpay'){stage='pick';cancelled=true;msg='';draw();drawCard()}
  else if(id==='again'){q={a:0,b:0,c:0};applied=null;code='';msg='';bad=false;email='';cancelled=false;stage='pick';draw();drawCard()}
  else if(id==='fin'){e.target.textContent='Opens What are you?'}});
q.b=2;draw();
</script>
