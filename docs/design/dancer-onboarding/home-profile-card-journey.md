# Home profile card journey mockup (source HTML, approved)

~~~~html
<title>Home Profile Card</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: BEFORE (real prod dancer Home, 390px) then 3 AFTER options side by side, only the new card differs. */
:root{
  --page:#14101c; --ink:#f3eefb; --mute:#a99fbd; --line:#2c2540;
  --app:#1b1626; --card:#262033; --card2:#2d2740; --orange:#f58a5c; --orange-ink:#2a1208;
  --mark:#37e0b4; --chip:#3a3150;
  --display:'Space Grotesk',system-ui,sans-serif; --body:'Inter',system-ui,sans-serif;
}
*{box-sizing:border-box}
body{background:var(--page);color:var(--ink);font-family:var(--body);margin:0;
  padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-family:var(--display);font-size:24px;margin:0 0 6px;text-wrap:balance}
.lead{color:var(--mute);max-width:70ch;margin:0 0 20px;font-size:14px;line-height:1.5}
.row{display:flex;gap:24px;overflow-x:auto;padding-bottom:16px;align-items:flex-start}
.col{flex:0 0 330px;min-width:0}
.col h2{font-family:var(--display);font-size:15px;margin:0 0 4px}
.col p{font-size:12.5px;color:var(--mute);margin:0 0 10px;line-height:1.45;min-height:54px}
.phone{width:330px;height:760px;border:1px solid var(--line);border-radius:26px;overflow:hidden;position:relative;background:var(--app)}
.scroll{height:100%;overflow-y:auto;padding-bottom:70px}
.top{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line)}
.logo{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#ff4d8d,#8a5cff)}
.top b{font-family:var(--display);font-size:14px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip{background:var(--chip);border-radius:12px;font-size:11px;padding:3px 8px;color:#c9b8ff}
.bell{width:20px;text-align:center;font-size:14px}
.sw{display:flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:20px;padding:3px 10px 3px 3px;font-size:12px;font-weight:600}
.av{width:24px;height:24px;border-radius:50%;background:#7a8aa8}
.hi{font-family:var(--display);font-size:24px;font-weight:700;margin:10px 12px 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:0 10px 10px;padding:14px}
.card h3{margin:0 0 6px;font-size:14px}
.card p{margin:0 0 10px;font-size:12.5px;line-height:1.5;color:#d6cdea;min-height:0}
.btn{display:inline-block;background:var(--orange);color:var(--orange-ink);font-weight:700;font-size:13px;border-radius:10px;padding:9px 14px;border:0}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line);margin-left:6px}
.btn.wide{display:block;text-align:center}
.lab{font-size:11px;letter-spacing:.12em;color:var(--mute);margin:14px 14px 6px;font-weight:600}
.h2{font-family:var(--display);font-size:16px;font-weight:700;margin:0 14px 8px}
.qr{width:120px;height:120px;margin:8px auto;background:#fff;border-radius:8px;
  background-image:repeating-conic-gradient(#000 0 25%,#fff 0 50%);background-size:12px 12px}
.pager{display:flex;align-items:center;justify-content:center;gap:12px;font-size:11px;color:var(--mute)}
.pager i{width:28px;height:28px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;font-style:normal;color:var(--ink)}
.tile{display:flex;gap:12px;align-items:center}
.tile .ic{width:28px;text-align:center;color:var(--mute)}
.tile b{display:block;font-size:14px}.tile span{font-size:12px;color:var(--mute)}
.list .it{display:flex;align-items:center;gap:12px;padding:10px 4px}
.list .it+.it{border-top:1px solid var(--line)}
.list .it .t{flex:1}.list .it b{display:block;font-size:14px}.list .it span{font-size:12px;color:var(--mute)}
.chev{color:var(--mute)}
.tabs{position:absolute;left:0;right:0;bottom:0;height:60px;background:#232033;border-top:1px solid var(--line);display:flex}
.tabs div{flex:1;display:grid;place-items:center;font-size:11px;color:var(--mute);align-content:center;gap:2px}
.tabs div.on{color:var(--orange);font-weight:700}
/* the new card + marking */
.new{position:relative;outline:2px dashed var(--mark);outline-offset:3px}
.new::before{content:"NEW";position:absolute;left:-2px;top:-14px;background:var(--mark);color:#06281f;font-size:9px;font-weight:800;padding:1px 6px;border-radius:6px;letter-spacing:.08em}
.x{position:absolute;right:8px;top:8px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:var(--mute);font-size:16px}
.shine{padding-right:40px}
.shine .line{font-size:13.5px;line-height:1.45;margin:0 0 10px;color:var(--ink)}
.linkbtn{color:var(--orange);font-weight:700;font-size:13px}
.shine.row2{display:flex;align-items:center;gap:10px;padding-right:40px}
.shine.row2 .line{margin:0;flex:1}
.note{font-size:12px;color:var(--mute);margin-top:18px;max-width:70ch;line-height:1.5}

.phone{cursor:default}
[data-go]{cursor:pointer}
.tabs div{cursor:pointer}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.bar button{font:inherit;font-size:13px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:99px;padding:8px 14px;cursor:pointer}
.sub{padding:14px}.sub h2{font-family:var(--display);font-size:22px;margin:6px 0 4px}.sub p{font-size:13px;color:var(--mute);margin:0 0 14px;line-height:1.5}
.fld{width:100%;background:var(--card2);border:1px solid var(--line);color:var(--ink);border-radius:12px;padding:12px;font:inherit;font-size:14px;margin-bottom:10px}
.back{display:inline-block;color:var(--orange);font-weight:700;font-size:13px;margin:12px 12px 0;cursor:pointer}
.mrow{display:flex;align-items:center;gap:12px;padding:12px 4px;border-top:1px solid var(--line)}.mrow:first-child{border-top:0}
.mrow .t{flex:1}.mrow b{display:block;font-size:14px}.mrow span{font-size:12px;color:var(--mute)}
.hint{position:absolute;left:12px;right:12px;bottom:70px;background:#fff;color:#1b1330;border-radius:12px;padding:10px 12px;font-size:12.5px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.5)}
</style>
<h1>Home: profile card journey (Option A)</h1>
<p class="lead">Tap through this one phone. Real today: "Check my profile" opens the Me tab; "Got it" removes the linked-profile card. New: the green dashed card sits between "1 night attended" and BE FOUND. "Nothing planned yet" is removed; everything else on Home is unchanged. Photo, QR and names are stand-ins.</p>
<div class="bar"><button id="reset" type="button">Start again</button><button data-jump="home" type="button">Home</button></div>
<div class="col" style="flex:none"><div id="stage"></div><p id="cap" style="margin-top:10px"></p></div>
<script>
function card(variant){
  const X='<div class="x" aria-label="Dismiss">✕</div>';
  if(variant==='A') return '<div class="card new shine">'+X+'<p class="line">Add a bio and a link so dancers know you.</p><span class="btn">Add</span></div>';
  if(variant==='B') return '<div class="card new shine row2">'+X+'<p class="line">Add a bio and a link so dancers know you.</p><span class="linkbtn">Add ›</span></div>';
  return '';
}
function home(variant){
  const cA = variant==='A'?card('A'):'';
  const cB = variant==='B'?card('B'):'';
  const cC = variant==='C'
    ? '<div class="it new" style="position:relative;margin:4px 0;border-radius:10px"><div class="x" style="top:6px">✕</div><div class="t" style="padding-right:36px"><b>Add a bio and a link</b><span>So dancers know you.</span></div><span class="linkbtn" style="margin-right:30px">Add</span></div>'
    : '';
  return `<div class="phone"><div class="scroll">
  <div class="top"><div class="logo"></div><b>Bachata Calendar</b><span class="chip">Dancer</span><span class="bell">🔔</span><span class="sw"><span class="av"></span>Switch</span></div>
  <div class="hi">Hi Ricky</div>
  <div class="card"><h3>We’ve linked your profile</h3><p>A profile made for you by the Bachata Calendar team is now yours. Have a look and make it right.</p><span class="btn">Check my profile</span><span class="btn ghost">Got it</span></div>
  <div class="lab">GO OUT</div><div class="h2">Your ticket</div>
  <div class="card"><h3 style="margin:0">ZZ TEST create look</h3><p style="margin:2px 0 0">Sunday 20 December 2026</p><div class="qr"></div><p style="text-align:center;margin:0 0 8px">Door code <b style="letter-spacing:.1em">CSE 358</b></p><div class="pager"><i>‹</i>Ticket 1 of 2<i>›</i></div></div>
  <div class="card"><h3 style="font-size:17px">Nothing planned yet</h3><p>Tap Going on a night and it shows up here.</p><span class="btn wide">Find events this week</span></div>
  <div class="card tile"><div class="ic">▦</div><div><b>1 night attended</b><span>Nights you went to.</span></div></div>
  ${cA}
  <div class="lab">BE FOUND</div>
  <div class="card list">${cC}<div class="it"><div class="ic">⤴</div><div class="t"><b>Share my page</b><span>Send your page to a dance partner.</span></div><span class="chev">›</span></div><div class="it"><div class="ic">◉</div><div class="t"><b>Preview my page</b><span>How it looks and who visited.</span></div><span class="chev">›</span></div></div>
  ${cB}
  </div><div class="tabs"><div class="on">⌂<br>Home</div><div>☾<br>Nights</div><div>☺<br>Me</div></div></div>`;
}

const T=document.createElement('div');
let st={screen:'home',gotit:false,dismissed:false,bio:'',link:'',saved:false};
const topbar='<div class="top"><div class="logo"></div><b>Bachata Calendar</b><span class="chip">Dancer</span><span class="bell">🔔</span><span class="sw"><span class="av"></span>Switch</span></div>';
function tabs(on){return '<div class="tabs"><div data-go="tab-home" class="'+(on==='home'?'on':'')+'">⌂<br>Home</div><div data-go="tab-nights" class="'+(on==='nights'?'on':'')+'">☾<br>Nights</div><div data-go="tab-me" class="'+(on==='me'?'on':'')+'">☺<br>Me</div></div>'}
function homeHtml(){
  let h=home('A');
  h=h.replace(/<div class="card"><h3 style="font-size:17px">Nothing planned yet<\/h3>.*?<\/div>\n?/s,'');
  h=h.replace('<span class="btn">Check my profile</span><span class="btn ghost">Got it</span>','<span class="btn" data-go="check">Check my profile</span><span class="btn ghost" data-go="gotit">Got it</span>');
  h=h.replace('<div class="x" aria-label="Dismiss">✕</div>','<div class="x" data-go="dismiss" aria-label="Dismiss">✕</div>');
  h=h.replace('<span class="btn">Add</span>','<span class="btn" data-go="add">Add</span>');
  if(st.gotit||st.screenSeenMe) h=h.replace(/<div class="card"><h3>We’ve linked your profile<\/h3>.*?Got it<\/span><\/div>/s,'');
  if(st.dismissed||st.saved) h=h.replace(/<div class="card new shine">.*?<span class="btn" data-go="add">Add<\/span><\/div>/s,'');
  h=h.replace(/<div class="tabs">.*<\/div><\/div>$/s,'');
  return h.replace('<div class="phone">','<div class="phone">')+tabs('home')+'</div>';
}
function phone(inner,on){return '<div class="phone"><div class="scroll">'+topbar+inner+'</div>'+tabs(on)+'</div>'}
function render(){
  let html='',cap='';
  if(st.screen==='home'){
    html=homeHtml();
    cap=st.saved?'Saved. Back on Home: the profile card is gone.':st.dismissed?'Cross tapped: the card is gone (real app brings it back after 30 days if bio or links are still missing).':st.gotit?'Got it tapped: the linked-profile card is gone.':'Tap Add (new card), Check my profile, Got it, the cross or a tab.';
  }else if(st.screen==='add'){
    html=phone('<div class="back" data-go="back">‹ Back</div><div class="sub"><h2>Tell us about you</h2><p>Add a bio and a link so dancers know you. You can change this any time on Me.</p><textarea class="fld" id="bio" rows="4" placeholder="A short bio">'+st.bio+'</textarea><input class="fld" id="lnk" placeholder="Instagram or other link" value="'+st.link+'"><span class="btn wide" data-go="save" style="margin-top:6px">Save</span><div style="text-align:center;margin-top:10px"><span class="linkbtn" data-go="back">Not now</span></div></div>','home');
    cap='New screen after Add: same look as the bio step in onboarding. Save goes to Home with the card gone; Not now goes back with the card still there.';
  }else if(st.screen==='me'){
    html=phone('<div class="hi">Me</div><div class="card list"><div class="mrow"><div class="ic">☺</div><div class="t"><b>My profile</b><span>The page dancers see. Check it and make it right.</span></div><span class="chev">›</span></div><div class="mrow"><div class="ic">✎</div><div class="t"><b>Bio</b><span>'+(st.bio||'Not added yet')+'</span></div><span class="linkbtn" data-go="add">'+(st.bio?'Edit':'Add')+'</span></div><div class="mrow"><div class="ic">⤴</div><div class="t"><b>Link</b><span>'+(st.link||'Not added yet')+'</span></div><span class="linkbtn" data-go="add">'+(st.link?'Edit':'Add')+'</span></div><div class="mrow"><div class="ic">⚙</div><div class="t"><b>Settings</b><span>Account and options.</span></div><span class="chev">›</span></div></div>','me');
    cap='Check my profile opens the Me tab (as in the real app). The linked-profile card is gone from Home after this visit.';
  }else{
    html=phone('<div class="hi">Nights</div><div class="card"><p style="margin:0">Nights tab: unchanged, not drawn.</p></div>','nights');
    cap='Nights tab is unchanged and not drawn here.';
  }
  document.getElementById('stage').innerHTML=html;document.getElementById('cap').textContent=cap;
}
document.addEventListener('click',e=>{
  if(e.target.id==='reset'){st={screen:'home',gotit:false,dismissed:false,bio:'',link:'',saved:false};render();return}
  const j=e.target.closest('[data-jump]');if(j){st.screen='home';render();return}
  const g=e.target.closest('[data-go]');if(!g)return;const a=g.dataset.go;
  const b=document.getElementById('bio'),l=document.getElementById('lnk');if(b)st.bio=b.value;if(l)st.link=l.value;
  if(a==='check'){st.screen='me';st.screenSeenMe=true}
  else if(a==='gotit')st.gotit=true;
  else if(a==='dismiss')st.dismissed=true;
  else if(a==='add')st.screen='add';
  else if(a==='back')st.screen='home';
  else if(a==='save'){if(st.bio.trim()||st.link.trim()){st.saved=true;st.screen='home'}else{st.screen='home'}}
  else if(a==='tab-home')st.screen='home';
  else if(a==='tab-me')st.screen='me';
  else if(a==='tab-nights')st.screen='nights';
  render();
});
render();
</script>

~~~~
