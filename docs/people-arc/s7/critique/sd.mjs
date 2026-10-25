const [a,b,s]=process.argv.slice(2);
const norm = (t) => t.replace(/\/assets\/[A-Za-z0-9_.-]+/g, '/assets/X').replace(/nonce="[^"]*"/g, '').replace(/nonce-[A-Za-z0-9+\/=]+/g,'nonce-X').replace(/127\.0\.0\.1:\d+|localhost:\d+/g,'HOST').replace(/\d{13}/g,'TS');
const [x,y]=await Promise.all([a,b].map(u=>fetch(`${u}/dancers/${s}`).then(r=>r.text()).then(norm)));
if(x===y){console.log(s,'IDENTICAL');process.exit(0)}
let i=0; while(i<x.length&&x[i]===y[i]) i++; let j=0; while(j<x.length-i&&j<y.length-i&&x[x.length-1-j]===y[y.length-1-j]) j++;
console.log(s,'DIFF\n<', x.slice(Math.max(0,i-150), x.length-j+30).slice(0,600), '\n>', y.slice(Math.max(0,i-150), y.length-j+30).slice(0,600));
