// W2-D hub mockups: writes a.html, b.html, c.html and tap.html next to this file.
//   node docs/mockups/w2d-hub/build.mjs
// Each HTML is self-contained (no external files). Pick a data shape with the hash: #s1 .. #s4.
// Colours: only src/modules/person-page/wall/tokens.ts (WALL, CHIP, TILE) and the site footer
// (bg-primary, hsl(39 100% 50%) = #FFA600, src/index.css --primary). No new colours.
// ASCII only (CLAUDE.md: HTML entities, never raw Unicode punctuation).
import { writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url).pathname;

const T = {
  page: '#1E1410', card: '#2B1D16', text: '#FBEBDD', muted: '#CDB09C', line: '#6A4A38',
  footer: '#FFA600', footerInk: '#000000',
  chip: {
    dj: { bg: '#F2B632', text: '#2B1A00', border: '#FFD479' },
    dancer: { bg: '#2DD4BF', text: '#04302C', border: '#8DF0E2' },
    teacher: { bg: '#B79CFB', text: '#1E0A4D', border: '#D8C8FD' },
  },
  tile: {
    dj: { bg: '#6B4A0E', ink: '#FFE3A0', edge: '#C9921E' },
    dancer: { bg: '#0F4F4A', ink: '#A7F3E8', edge: '#2DD4BF' },
    teacher: { bg: '#4A2D8A', ink: '#E4D7FB', edge: '#A78BFA' },
  },
};

// Prod-SHAPED data (counts from a read-only prod survey 2026-10-22; names are samples except
// Elias, the owner's own example). No photos of real people: the "photo" is a drawn placeholder.
const SHAPES = {
  s1: { label: 'dancer + DJ with upcoming gigs (10 people have dancer + DJ)', name: 'Elias', photo: true, city: 'London',
    roles: ['dj', 'dancer'], open: { dj: true, dancer: true }, lead: 'dj',
    gig: { next: 'Fri 30 Oct', count: 3 }, years: 6, langs: 'English, Spanish' },
  s2: { label: 'dancer + DJ, no photo', name: 'Sam', photo: false, city: 'London',
    roles: ['dancer', 'dj'], open: { dj: true, dancer: true }, lead: 'dancer',
    gig: null, years: 3, langs: 'English' },
  s3: { label: 'dancer + teacher, teacher pages closed (36 people)', name: 'Rosa', photo: true, city: 'London',
    roles: ['dancer', 'teacher'], open: { dancer: true, teacher: false }, lead: 'dancer',
    gig: null, years: 8, langs: 'English, Portuguese' },
  s4: { label: 'dancer + DJ + teacher (25 people), teacher closed', name: 'Marco', photo: true, city: 'London',
    roles: ['dj', 'dancer', 'teacher'], open: { dj: true, dancer: true, teacher: false }, lead: 'dj',
    gig: { next: 'Sat 7 Nov', count: 1 }, years: 10, langs: 'English, Italian' },
};

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${T.page};color:${T.text};font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.site-header{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:${T.page}}
.logo{font-weight:800;font-size:16px;letter-spacing:.2px}
.menu{width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.hub{min-height:calc(100svh - 56px);display:flex;flex-direction:column;padding:4px 12px 0}
.hub-body{flex:1}
/* Soft fade from the warm base into the footer gold: no hard seam (owner rule). */
.fade{height:96px;margin:0 -12px;background:linear-gradient(to bottom, ${T.page} 0px, ${T.footer} 96px)}
.site-footer{background:${T.footer};color:${T.footerInk};padding:28px 16px 32px;margin:0 -12px}
.site-footer nav{display:flex;flex-wrap:wrap;gap:4px 8px}
.site-footer a{min-height:44px;min-width:44px;display:inline-flex;align-items:center;padding:0 6px;font-size:15px;font-weight:700}
.site-footer p{font-size:13px;margin-top:8px}
.back{min-height:44px;min-width:44px;display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:700;padding:0 4px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:13px;line-height:18px;font-weight:800;padding:3px 10px;border-radius:999px;border:1px solid}
.facts{font-size:14px;color:${T.muted};line-height:20px}
.label{font-size:13px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:${T.muted}}
.hint{font-size:13px;color:${T.muted};line-height:18px}
.face{display:flex;align-items:center;justify-content:center;font-weight:800;overflow:hidden}
.cta{min-height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;padding:0 16px}
:focus-visible{outline:2px solid ${T.text};outline-offset:2px}
`;

// Shared helpers (inlined into every page as a script string).
const HELPERS = `
var T = ${JSON.stringify(T)};
var SHAPES = ${JSON.stringify(SHAPES)};
var NAME = { dj: 'DJ', dancer: 'Dancer', teacher: 'Teacher' };
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function shape(){var k=(location.hash||'#s1').slice(1);return SHAPES[k]||SHAPES.s1}
function chip(role){var c=T.chip[role];return '<span class="chip" style="background:'+c.bg+';color:'+c.text+';border-color:'+c.border+'">'+NAME[role]+'</span>'}
function face(s,size,radius){var t=T.tile[s.lead];
  if(!s.photo) return '<div class="face" aria-label="'+esc(s.name)+' (no photo)" style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+'px;background:'+t.bg+';color:'+t.ink+';border:2px solid '+t.edge+';font-size:'+Math.round(size*0.36)+'px">'+esc(s.name.slice(0,1))+'</div>';
  return '<div class="face" role="img" aria-label="Photo of '+esc(s.name)+' (placeholder)" style="width:'+size+'px;height:'+size+'px;border-radius:'+radius+'px;background:linear-gradient(160deg,'+t.edge+','+t.bg+' 70%);border:2px solid '+t.edge+'">'+
    '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'" aria-hidden="true"><circle cx="50" cy="40" r="18" fill="'+t.ink+'" opacity=".55"/><path d="M14 100c4-24 18-34 36-34s32 10 36 34z" fill="'+t.ink+'" opacity=".55"/></svg></div>'}
function summary(s,role){
  if(role==='dj') return s.gig ? 'Next gig '+s.gig.next+' &middot; '+s.gig.count+' coming up' : 'No gigs listed right now';
  if(role==='dancer') return s.years+' years dancing &middot; '+esc(s.langs);
  return 'Teacher pages open soon';
}
function what(role){
  if(role==='dj') return 'Opens their DJ page: gigs and DJ details';
  if(role==='dancer') return 'Opens their dancer page: style, level and how to say hi';
  return 'No teacher page yet: teacher pages are not open';
}
function facts(s){return [s.city, s.years+' years dancing', s.langs].map(esc).join(' &middot; ')}
function chips(s){return '<div class="chips">'+s.roles.map(chip).join('')+'</div>'}
function lead(s){return T.chip[s.lead]}
function header(){return '<header class="site-header"><span class="logo">Bachata Calendar</span><button class="menu" aria-label="Open the site menu">Menu</button></header>'}
function footer(){return '<div class="fade" aria-hidden="true" data-seam="fade"></div><footer class="site-footer" data-testid="footer"><nav aria-label="Footer"><a href="#">Events</a><a href="#">Venues</a><a href="#">People</a><a href="#">About</a></nav><p>Site footer (unchanged, site-wide)</p></footer>'}
function back(){return '<a class="back" href="#" aria-label="Back to the previous page">&larr; Back</a>'}
`;

const OPTIONS = {
  a: {
    title: 'Option A: stacked role cards, big photo',
    css: `
.a-hero{position:relative;height:264px;overflow:hidden;border-radius:24px}
.a-hero .face{width:100%!important;height:100%!important;border-radius:0!important;border:0!important}
.a-hero .face svg{width:62%;height:auto}
.a-scrim{position:absolute;left:0;right:0;bottom:0;height:120px;background:linear-gradient(to bottom, rgba(30,20,16,0), ${T.page})}
.a-back{position:absolute;top:8px;left:8px;background:${T.page};border-radius:12px;padding:0 10px}
.a-name{font-size:28px;line-height:32px;font-weight:900;margin-top:-34px;position:relative}
.a-accent{height:4px;width:56px;border-radius:2px;margin:8px 0 10px}
.a-cards{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.a-card{display:flex;align-items:center;gap:12px;min-height:88px;border-radius:18px;background:${T.card};border:1px solid;border-left-width:8px;padding:12px}
.a-card h3{font-size:18px;line-height:22px;font-weight:900}
.a-card p{font-size:14px;line-height:19px;color:${T.muted};margin-top:2px}
.a-card .go{margin-left:auto;font-size:15px;font-weight:800;white-space:nowrap}
.a-card.closed{border-style:dashed;border-left-style:solid}
`,
    render: `function render(s){var L=lead(s);
var cards=s.roles.slice().sort(function(x,y){return (x===s.lead?-1:0)-(y===s.lead?-1:0)}).map(function(r){var t=T.tile[r];var open=s.open[r];
  var inner='<div><h3>'+NAME[r]+'</h3><p>'+summary(s,r)+'</p><p class="what">'+what(r)+'</p></div>';
  return open ? '<a class="a-card" data-tap href="#" style="border-color:'+t.edge+'">'+inner+'<span class="go" style="color:'+T.chip[r].bg+'">Open &rarr;</span></a>'
    : '<div class="a-card closed" aria-disabled="true" style="border-color:'+T.line+'">'+inner+'</div>'}).join('');
return header()+'<main class="hub" data-testid="hub"><div class="hub-body">'+
  '<div class="a-hero">'+face(s,390,0)+'<div class="a-scrim"></div><div class="a-back">'+back()+'</div></div>'+
  '<h1 class="a-name">'+esc(s.name)+'</h1><div class="a-accent" style="background:'+L.bg+'"></div>'+chips(s)+
  '<p class="facts" style="margin-top:8px">'+facts(s)+'</p>'+
  '<p class="label" style="margin-top:16px">Their pages</p><div class="a-cards">'+cards+'</div>'+
  '<p class="hint" style="margin:12px 0 20px">Each card opens that page. The first card is what '+esc(s.name)+' is best known for.</p>'+
  '</div>'+footer()+'</main>'}`,
  },
  b: {
    title: 'Option B: role switcher, one summary at a time',
    css: `
.b-top{display:flex;gap:14px;align-items:center;margin-top:4px}
.b-name{font-size:26px;line-height:30px;font-weight:900}
.b-tabs{display:flex;gap:4px;margin-top:16px;padding:4px;border-radius:16px;background:${T.card};border:1px solid ${T.line}}
.b-tab{flex:1;min-height:48px;border-radius:12px;font-size:15px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:17px}
.b-tab small{font-size:12px;font-weight:700}
.b-tab[aria-disabled=true]{color:${T.muted};cursor:not-allowed}
.b-panel{margin-top:12px;border-radius:18px;background:${T.card};border:1px solid;padding:16px;display:flex;flex-direction:column;gap:12px;min-height:300px}
.b-panel h2{font-size:20px;line-height:24px;font-weight:900}
.b-row{display:flex;justify-content:space-between;gap:8px;border-top:1px solid ${T.line};padding-top:10px;font-size:15px;line-height:20px}
.b-row span:first-child{color:${T.muted}}
.b-row span:last-child{font-weight:700;text-align:right}
`,
    render: `function render(s){var key='hubTab';var active=window[key]||s.lead;var L=lead(s);
var tabs=s.roles.map(function(r){var on=r===active;var c=T.chip[r];
  if(!s.open[r]) return '<button class="b-tab" role="tab" aria-selected="false" aria-disabled="true" data-tap title="Teacher pages are not open yet">'+NAME[r]+'<small>opens soon</small></button>';
  return '<button class="b-tab" role="tab" data-tap aria-selected="'+on+'" data-role="'+r+'" style="'+(on?'background:'+c.bg+';color:'+c.text:'color:'+T.text)+'">'+NAME[r]+(r===s.lead?'<small>main</small>':'')+'</button>'}).join('');
var c=T.chip[active];var rows=[];
if(active==='dj'){rows=[['Next gig',s.gig?s.gig.next:'None listed'],['Gigs coming up',s.gig?String(s.gig.count):'0'],['Based in',s.city]]}
else {rows=[['Dancing for',s.years+' years'],['Speaks',s.langs],['Based in',s.city]]}
var panel='<section class="b-panel" role="tabpanel" style="border-color:'+T.tile[active].edge+'"><h2>'+esc(s.name)+' as a '+NAME[active].replace('DJ','DJ')+'</h2>'+
  rows.map(function(r){return '<div class="b-row"><span>'+r[0]+'</span><span>'+esc(r[1])+'</span></div>'}).join('')+
  '<a class="cta" data-tap href="#" style="background:'+c.bg+';color:'+c.text+';margin-top:auto">Open '+NAME[active].replace('DJ','DJ')+' page &rarr;</a>'+
  '<p class="hint">'+what(active)+'.</p></section>';
return header()+'<main class="hub" data-testid="hub"><div class="hub-body">'+back()+
  '<div class="b-top">'+face(s,88,18)+'<div><h1 class="b-name">'+esc(s.name)+'</h1><p class="facts">'+esc(s.city)+'</p><div style="margin-top:6px">'+chips(s)+'</div></div></div>'+
  '<div class="b-tabs" role="tablist" aria-label="Choose a role to preview">'+tabs+'</div>'+
  '<p class="hint" style="margin-top:6px">Tap a role to see a summary. The button opens that page.</p>'+panel+
  '<div style="height:20px"></div></div>'+footer()+'</main>'}
document.addEventListener('click',function(e){var b=e.target.closest('.b-tab[data-role]');if(b){window.hubTab=b.getAttribute('data-role');draw()}});`,
  },
  c: {
    title: 'Option C: one hero role card + an Also row',
    css: `
.c-hero{margin-top:4px;border-radius:24px;background:${T.card};border:2px solid;padding:16px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}
.c-name{font-size:28px;line-height:32px;font-weight:900}
.c-line{font-size:16px;line-height:22px;font-weight:700}
.c-hero .cta{align-self:stretch;margin-top:4px}
.c-also{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.c-tile{min-height:72px;border-radius:16px;background:${T.card};border:1px solid;padding:10px 12px;display:flex;flex-direction:column;justify-content:center;gap:2px}
.c-tile b{font-size:16px;line-height:20px;font-weight:900}
.c-tile span{font-size:13px;line-height:17px;color:${T.muted}}
.c-tile.closed{border-style:dashed}
.c-about{margin-top:12px;border-top:1px solid ${T.line};padding-top:10px}
`,
    render: `function render(s){var L=lead(s);var t=T.tile[s.lead];
var others=s.roles.filter(function(r){return r!==s.lead});
var also=others.map(function(r){var open=s.open[r];
  var inner='<b>'+NAME[r]+'</b><span>'+summary(s,r)+'</span>';
  return open?'<a class="c-tile" data-tap href="#" style="border-color:'+T.tile[r].edge+'">'+inner+'<span style="color:'+T.chip[r].bg+';font-weight:800">Open &rarr;</span></a>'
    :'<div class="c-tile closed" aria-disabled="true" style="border-color:'+T.line+'">'+inner+'</div>'}).join('');
return header()+'<main class="hub" data-testid="hub"><div class="hub-body">'+back()+
  '<section class="c-hero" style="border-color:'+t.edge+'">'+face(s,128,22)+
  '<h1 class="c-name">'+esc(s.name)+'</h1>'+chips(s)+
  '<p class="c-line">'+summary(s,s.lead)+'</p>'+
  '<a class="cta" data-tap href="#" style="background:'+L.bg+';color:'+L.text+'">Open '+NAME[s.lead]+' page &rarr;</a>'+
  '<p class="hint">'+what(s.lead)+'.</p></section>'+
  '<p class="label" style="margin-top:14px">Also</p><div class="c-also"'+(others.length===1?' style="grid-template-columns:1fr"':'')+'>'+also+'</div>'+
  '<div class="c-about"><p class="label">About</p><p class="facts" style="margin-top:4px">'+facts(s)+'</p></div>'+
  '<div style="height:20px"></div></div>'+footer()+'</main>'}`,
  },
};

const page = (title, css, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>${BASE_CSS}${css}</style></head>
<body><div id="app"></div>
<script>${HELPERS}
${body}
function draw(){document.getElementById('app').innerHTML=render(shape())}
window.addEventListener('hashchange',function(){window.hubTab=null;draw()});draw();
</script></body></html>
`;

for (const [k, o] of Object.entries(OPTIONS)) writeFileSync(`${dir}${k}.html`, page(`W2-D hub ${o.title}`, o.css, o.render));

// The small frame: what a wall tile tap does for a one-role vs a multi-role person.
const tapCss = `
.t-wrap{padding:12px}
.t-h{font-size:20px;line-height:24px;font-weight:900;margin:8px 0 4px}
.t-row{display:grid;grid-template-columns:96px 28px 1fr;align-items:center;gap:6px;margin-top:14px;background:${T.card};border:1px solid ${T.line};border-radius:18px;padding:12px}
.t-tile{width:96px;min-height:120px;padding:8px 4px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px solid}
.t-tile b{font-size:13px}
.t-arrow{font-size:22px;text-align:center;font-weight:900}
.t-dest b{display:block;font-size:16px;line-height:20px}
.t-dest span{font-size:14px;line-height:19px;color:${T.muted}}
`;
const tapBody = `function render(){
function tile(n,role,roles){var t=T.tile[role];return '<div class="t-tile" style="background:'+t.bg+';border-color:'+t.edge+';color:'+t.ink+'"><span style="font-size:30px;font-weight:900">'+n.slice(0,1)+'</span><b>'+n+'</b><div class="chips" style="justify-content:center">'+roles.map(chip).join('')+'</div></div>'}
function row(n,role,roles,dest,why){return '<div class="t-row">'+tile(n,role,roles)+'<div class="t-arrow" aria-hidden="true">&rarr;</div><div class="t-dest"><b>'+dest+'</b><span>'+why+'</span></div></div>'}
return header()+'<main class="hub" data-testid="hub"><div class="hub-body t-wrap">'+
'<h1 class="t-h">What a wall tile tap does</h1><p class="hint">Rule: count the person\\'s roles that have a page today (visible roles).</p>'+
row('Ana','dancer',['dancer'],'Straight to the dancer page','One role with a page: no hub. Address /people/:id also forwards there, so old links still work.')+
row('Leo','dj',['dj'],'Straight to the DJ page','One role with a page: no hub.')+
row('Rosa','dancer',['dancer','teacher'],'Straight to the dancer page','Teacher chip shows, but teacher pages are closed, so only one role has a page (36 people today). Owner call.')+
row('Elias','dj',['dj','dancer'],'The hub (this mockup)','Two or more roles with a page: the hub, led by the main role.')+
'<p class="hint" style="margin:14px 0 20px">Back from a role page returns to the wall, never to a hub the person did not see.</p>'+
'</div>'+footer()+'</main>'}`;
writeFileSync(`${dir}tap.html`, page('W2-D wall tile tap', tapCss, tapBody));
console.log('wrote a.html b.html c.html tap.html');
