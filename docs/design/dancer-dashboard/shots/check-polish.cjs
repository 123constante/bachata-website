const { chromium } = require('playwright');
const path=require('path');
const file='file://'+path.resolve('docs/design/dancer-dashboard/option-b-polished.html');
const shapes=['new','partial','saveOff','complete','completeEmpty','unclaimed','switch','addProfile'];
(async()=>{
 const b=await chromium.launch(); const out={};
 for(const s of shapes){
  const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  await p.goto(file+'#'+s);
  const r=await p.evaluate(()=>{
   const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return [.2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]),m[3]===undefined?1:m[3]]};
   const parse=c=>{const m=c.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m[3]===undefined?1:m[3]}};
   const over=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),b:fg.b*fg.a+bg.b*(1-fg.a),a:1});
   const L=o=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(o.r)+.7152*f(o.g)+.0722*f(o.b)};
   const bgOf=el=>{const chain=[];for(let e=el;e;e=e.parentElement){chain.push(parse(getComputedStyle(e).backgroundColor))}let acc={r:17,g:17,b:17,a:1};for(let i=chain.length-1;i>=0;i--){acc=over(chain[i],acc)}return acc};
   // scrim: elements under the scrim are covered; skip text not top-most
   const res={scrollW:document.documentElement.scrollWidth,small:[],lowC:[],clip:[],overTabs:[],reasonless:[],minC:99,taps:0};
   const ph=document.querySelector('.shape.on .phone');
   const taps=ph.querySelectorAll('a,button');
   for(const t of taps){const q=t.getBoundingClientRect();if(!q.width)continue;res.taps++;if(q.width<44||q.height<44)res.small.push(t.textContent.trim().slice(0,30)+' '+Math.round(q.width)+'x'+Math.round(q.height))}
   const walker=document.createTreeWalker(ph,NodeFilter.SHOW_TEXT);let n;
   while(n=walker.nextNode()){if(!n.textContent.trim())continue;const el=n.parentElement;const q=el.getBoundingClientRect();if(!q.width)continue;
     const top=document.elementFromPoint(Math.min(389,q.left+2),Math.min(843,q.top+q.height/2));if(top&&!el.contains(top)&&!top.contains(el)&&top.closest('.scrim')&&!el.closest('.scrim'))continue;
     const fg=parse(getComputedStyle(el).color);const bg=bgOf(el);const c=over(fg,bg);const a=L(c),bb=L(bg);const ratio=(Math.max(a,bb)+.05)/(Math.min(a,bb)+.05);
     res.minC=Math.min(res.minC,+ratio.toFixed(2));if(ratio<4.5)res.lowC.push(n.textContent.trim().slice(0,30)+' '+ratio.toFixed(2));
     if(el.scrollWidth>el.clientWidth+1&&getComputedStyle(el).textOverflow!=='ellipsis')res.clip.push(n.textContent.trim().slice(0,30));
     if(q.right>390.5)res.clip.push('offright:'+n.textContent.trim().slice(0,30));}
   const tabs=ph.querySelector('.tabs').getBoundingClientRect().top;
   for(const c of ph.querySelectorAll('.sc > *')){if(c.getBoundingClientRect().bottom>tabs)res.overTabs.push(c.className)}
   for(const d of ph.querySelectorAll('[disabled]')){const id=d.getAttribute('aria-describedby');const e=id&&document.getElementById(id);if(!e||!e.textContent.trim())res.reasonless.push(d.textContent)}
   return res});
  out[s]=r;
  await p.screenshot({path:`docs/design/dancer-dashboard/shots/b-polished-${s}.png`});
  await p.close();
 }
 await b.close(); console.log(JSON.stringify(out,null,1));
})();
