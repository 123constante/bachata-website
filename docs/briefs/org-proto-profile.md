# Existing organiser prototype: profile (HTML in fence; tile numbers are placeholders)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organiser Profile Mockups</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--black:#0c0a0d;--cream:#f6f1ea;--muted:rgba(246,241,234,.66);--faint:rgba(246,241,234,.09);--gold:#e3b96a;--gold2:#f3d9a4;--ember:#d8602f;--plum:#7a2f6e;--wa:#25D366;--serif:'Cormorant Garamond',Georgia,serif;--sans:'Manrope',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050405;color:var(--cream);font-family:var(--sans);padding:24px 16px 64px}
::selection{background:var(--gold);color:var(--black)}
a{color:inherit;text-decoration:none}
.intro{max-width:900px;margin:0 auto 28px}
.intro h1{font-family:var(--serif);font-size:32px;font-weight:600}
.intro p{color:var(--muted);font-size:14px;margin-top:6px;max-width:70ch;line-height:1.55}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(390px,1fr));gap:40px;max-width:900px;margin:0 auto}
.col h2{font-family:var(--serif);font-size:26px;color:var(--gold2)}
.col .tag{font-size:13px;color:var(--muted);margin:4px 0 14px;line-height:1.5}
.phone{width:390px;max-width:100%;margin:0 auto;border-radius:30px;overflow:hidden;border:1px solid rgba(246,241,234,.12);box-shadow:0 30px 80px -20px rgba(0,0,0,.8);position:relative;
  /* the hero glow flows down the whole page */
  background:
    radial-gradient(140% 38% at 10% 0%,rgba(216,96,47,.55),transparent 70%),
    radial-gradient(90% 30% at 100% 12%,rgba(170,120,60,.35),transparent 70%),
    radial-gradient(120% 30% at 0% 48%,rgba(122,47,110,.30),transparent 70%),
    radial-gradient(120% 30% at 100% 78%,rgba(216,96,47,.22),transparent 70%),
    linear-gradient(#24150f 0%,#120c0d 30%,#0c0a0d 100%)}
.ico{width:18px;height:18px;flex-shrink:0}
/* hero stand-in (real hero unchanged) */
.hero{padding:44px 20px 0;text-align:center}
.logo{width:112px;height:112px;border-radius:50%;margin:0 auto 14px;border:3px solid #e9b877;box-shadow:0 10px 30px rgba(0,0,0,.6);overflow:hidden;background:#000}
.logo img,.art img{width:100%;height:100%;object-fit:cover}
.meta{font-size:11px;letter-spacing:.18em;font-weight:800;color:var(--gold);text-transform:uppercase}
.name{font-family:var(--serif);font-weight:700;font-size:46px;line-height:1;margin-top:6px;color:var(--gold2)}
.eq{display:flex;align-items:flex-end;gap:3px;height:40px;margin-top:22px;opacity:.9}
.eq i{flex:1;background:rgba(246,241,234,.12);border-radius:2px 2px 0 0}
.stats{display:flex;justify-content:space-around;padding:22px 16px 6px}
.stats b{display:block;font-family:var(--serif);font-size:32px;font-weight:600;text-align:center}
.stats span{font-size:10px;letter-spacing:.16em;color:var(--gold);font-weight:700;text-transform:uppercase}
section{padding:22px 18px}
h4{font-family:var(--serif);font-size:28px;font-weight:600;margin-bottom:14px;display:flex;justify-content:space-between;align-items:baseline}
h4 small{font-family:var(--sans);font-size:12px;color:var(--muted);font-weight:600}
/* Dice-style artwork: logo on glow, square */
.art{position:relative;aspect-ratio:1;border-radius:22px;overflow:hidden;display:grid;place-items:center;
  background:radial-gradient(70% 70% at 25% 20%,rgba(216,96,47,.95),transparent 65%),radial-gradient(70% 70% at 85% 80%,rgba(122,47,110,.9),transparent 65%),#1a0f10;box-shadow:0 24px 50px -18px rgba(216,96,47,.45)}
.art .disc{width:46%;aspect-ratio:1;border-radius:50%;overflow:hidden;box-shadow:0 0 0 3px rgba(243,217,164,.8),0 20px 40px rgba(0,0,0,.55)}
.art .badge{position:absolute;top:14px;left:14px;font-size:11px;font-weight:800;letter-spacing:.12em;padding:7px 11px;border-radius:999px;background:rgba(12,10,13,.6);backdrop-filter:blur(8px)}
.art .count{position:absolute;bottom:14px;right:14px;font-family:var(--serif);font-style:italic;font-size:22px;font-weight:600;color:var(--gold2)}
.lead h3{font-family:var(--serif);font-size:40px;line-height:1;font-weight:600;margin:18px 0 10px}
.facts{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.facts div{display:flex;gap:10px;align-items:center;font-size:14px;font-weight:600}
.facts svg{color:var(--gold)}
.facts span{color:var(--muted);font-weight:500}
.cta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 10px 10px 18px;border-radius:999px;background:rgba(246,241,234,.07);border:1px solid var(--faint)}
.cta p{font-size:13px;color:var(--muted);line-height:1.3}
.cta a{height:46px;display:inline-flex;align-items:center;gap:8px;padding:0 18px;border-radius:999px;background:var(--cream);color:var(--black);font-weight:800;font-size:14px;white-space:nowrap}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.chip{padding:9px 12px;border-radius:12px;background:rgba(246,241,234,.06);font-size:13px;font-weight:600;line-height:1.1;text-align:center}
.chip b{display:block;font-family:var(--serif);font-size:22px;color:var(--gold2)}
.chip.last{background:rgba(227,185,106,.18);box-shadow:inset 0 0 0 1px rgba(227,185,106,.5)}
.contact{display:flex;flex-direction:column;gap:10px}
.row{display:flex;gap:14px;align-items:center;padding:12px;border-radius:16px;background:rgba(12,10,13,.35);border:1px solid var(--faint)}
.tile{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(37,211,102,.14);color:var(--wa)}
.row small{display:block;font-size:12px;color:var(--muted);font-weight:600}
.pills{display:flex;gap:8px}
.pill{flex:1;height:46px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:14px;background:rgba(12,10,13,.35);border:1px solid var(--faint);font-size:13px;font-weight:600}
.person{display:flex;gap:14px;align-items:center;padding:12px;border-radius:18px;background:rgba(12,10,13,.35);border:1px solid var(--faint)}
.person img{width:64px;height:64px;border-radius:14px;object-fit:cover}
.person b{font-family:var(--serif);font-size:24px;font-weight:600;display:block;line-height:1}
.person span{font-size:11px;letter-spacing:.16em;color:var(--gold);font-weight:800}
/* variant 2: horizontal Dice list cards */
.hcard{display:flex;gap:14px;align-items:center;padding:10px;border-radius:18px;background:rgba(12,10,13,.35);border:1px solid var(--faint)}
.hcard .art{width:92px;flex-shrink:0;border-radius:14px;box-shadow:none}
.hcard .art .disc{width:60%}
.hcard .when{font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--ember);text-transform:uppercase}
.hcard b{font-family:var(--serif);font-size:24px;font-weight:600;display:block;line-height:1.05;margin:4px 0}
.hcard small{font-size:12px;color:var(--muted)}
.big{padding:0}
.big .art{border-radius:0;aspect-ratio:4/4.3;box-shadow:none}
.big .over{position:absolute;inset:auto 0 0 0;padding:22px 18px 18px;background:linear-gradient(transparent,rgba(12,10,13,.92))}
.big .over h3{font-family:var(--serif);font-size:44px;line-height:.95;font-weight:600}
.big .over .when{font-size:12px;font-weight:800;letter-spacing:.1em;color:var(--gold2);margin-bottom:6px}
</style>
</head>
<body>
<div class="intro">
  <h1>Organiser profile &mdash; round 2 (Dice.fm-inspired)</h1>
  <p>Hero glow now flows down the whole page. Serif kept. The logo becomes square &ldquo;artwork&rdquo; like Dice&rsquo;s event art. The 9 Bachata Picnics are one series card, not 8 identical rows. Real Bachata Community data; no venue or time invented.</p>
</div>
<div class="grid">

<!-- ========== D ========== -->
<div class="col">
  <h2>D &middot; Poster</h2>
  <p class="tag">One big square artwork card leads, Dice-style, then the series as date chips.</p>
  <div class="phone">
    <div class="hero"><div class="logo"><img src="https://pub-07f606224cac4f2596903c44df723644.r2.dev/images/organisers/logos/2026/06/9d64d5af-b372-412e-bb9d-78acc604e887.webp" alt="Bachata Community"></div><div class="meta">Community group &middot; London</div><div class="name">Bachata Community</div><div class="eq"></div></div>
    <div class="stats"><div><b>0</b><span>Upcoming</span></div><div><b>9</b><span>Past nights</span></div><div><b>1</b><span>Team</span></div></div>
    <section class="lead">
      <div class="art"><span class="badge">LATEST NIGHT</span><div class="disc"><img src="https://pub-07f606224cac4f2596903c44df723644.r2.dev/images/organisers/logos/2026/06/9d64d5af-b372-412e-bb9d-78acc604e887.webp" alt=""></div><span class="count">9 nights</span></div>
      <h3>Bachata Picnic</h3>
      <div class="facts">
        <div><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Saturday 5 September <span>&middot; last one</span></div>
        <div><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0"/><path d="M12 8v4l3 2"/></svg>9 Saturdays in 2026</div>
      </div>
      <div class="cta"><p>No new dates yet</p><a href="#"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z"/></svg>Get the next date</a></div>
      <div class="chips" id="chipsD"></div>
    </section>
    <section class="contact">
      <div class="row"><div class="tile"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z"/></svg></div><div style="flex:1"><small>WhatsApp</small>+447577576006</div><svg class="ico" style="color:var(--gold)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></div>
      <div class="pills"><a class="pill" href="#"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>Instagram</a><a class="pill" href="#"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/></svg>Website</a></div>
    </section>
    <section><h4>Team <small>1</small></h4><div class="person"><img src="https://pub-07f606224cac4f2596903c44df723644.r2.dev/images/persons/2026/04/1777539458735-6lnbv0s9um8.webp" alt="Ricky Quinonez"><div><b>Ricky Quinonez</b><span>LEADER</span></div></div></section>
  </div>
</div>

<!-- ========== E ========== -->
<div class="col">
  <h2>E &middot; Full-bleed</h2>
  <p class="tag">Artwork runs edge to edge with the title laid over it, then Dice-style list cards.</p>
  <div class="phone">
    <div class="hero"><div class="logo"><img src="https://pub-07f606224cac4f2596903c44df723644.r2.dev/images/organisers/logos/2026/06/9d64d5af-b372-412e-bb9d-78acc604e887.webp" alt=""></div><div class="meta">Community group &middot; London</div><div class="name">Bachata Community</div><div class="eq"></div></div>
    <div class="stats"><div><b>0</b><span>Upcoming</span></div><div><b>9</b><span>Past nights</span></div><div><b>1</b><span>Team</span></div></div>
    <section class="big">
      <div class="art"><span class="badge">LATEST NIGHT &middot; NO NEW DATES YET</span><div class="disc" style="margin-bottom:22%"><img src="https://pub-07f606224cac4f2596903c44df723644.r2.dev/images/organisers/logos/2026/06/9d64d5af-b372-412e-bb9d-78acc604e887.webp" alt=""></div>
        <div class="over"><div class="when">SATURDAY 5 SEPTEMBER</div><h3>Bachata Picnic</h3></div></div>
    </section>
    <section style="padding-top:16px"><div class="cta"><p>Be first to hear<br>the next date</p><a href="#"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z"/></svg>Join WhatsApp</a></div></section>
    <section><h4>Series <small>2026</small></h4>
      <div class="hcard"><div class="art"><div class="disc"><img src="https://pub-07f606224cac4f2596903c44df723644.r2.dev/images/organisers/logos/2026/06/9d64d5af-b372-412e-bb9d-78acc604e887.webp" alt=""></div></div><div><div class="when">9 Saturdays &middot; 2026</div><b>Bachata Picnic</b><small>Last: Saturday 5 September</small></div></div>
    </section>
    <section class="contact" style="padding-top:4px">
      <div class="row"><div class="tile"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z"/></svg></div><div style="flex:1"><small>WhatsApp</small>+447577576006</div><svg class="ico" style="color:var(--gold)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></div>
      <div class="pills"><a class="pill" href="#"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg>Instagram</a><a class="pill" href="#"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/></svg>Website</a></div>
    </section>
    <section><h4>Team <small>1</small></h4><div class="person"><img src="https://pub-07f606224cac4f2596903c44df723644.r2.dev/images/persons/2026/04/1777539458735-6lnbv0s9um8.webp" alt="Ricky Quinonez"><div><b>Ricky Quinonez</b><span>LEADER</span></div></div></section>
  </div>
</div>
</div>
<script>
document.querySelectorAll('.eq').forEach(eq=>{for(let i=0;i<24;i++){const b=document.createElement('i');b.style.height=(30+Math.abs(Math.sin(i*1.7))*70)+'%';eq.appendChild(b);}});
const n=[["5","Sep"],["15","Aug"],["1","Aug"],["25","Jul"],["18","Jul"],["11","Jul"],["4","Jul"],["20","Jun"],["?","Jun"]];
document.getElementById('chipsD').innerHTML=n.slice(0,8).map(([d,m],i)=>`<span class="chip${i===0?' last':''}"><b>${d}</b>${m}</span>`).join('')+'<span class="chip" style="align-self:center">+1 more</span>';
</script>
</body>
</html>
```
