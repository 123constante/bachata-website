# R4Refund board (390x844 HTML source, from the Round 4 canvas)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Refund an order</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">
<div style="height:44px;box-sizing:border-box;padding:0 8px;display:flex;align-items:center;background:#FFFFFF">
<a href="https://bachatacalendar.co.uk" style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk</a>
</div>

<div aria-hidden="true">
<div style="height:56px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<span style="font-size:15px;font-weight:500">Ritmo London</span>
<span style="font-size:13px;font-weight:500;color:#464646">To do</span>
</div>
<div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:24px">
<div style="height:42px;box-sizing:border-box;padding:0 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;display:flex;align-items:center;font-weight:500">Friday Social, Fri 20 Nov</div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;flex-direction:column;gap:4px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Tickets sold</div>
<div style="font-size:24px;line-height:1.2;font-weight:600">41 <span style="font-size:13px;font-weight:400;color:#464646">of 80</span></div>
</div>
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;flex-direction:column;gap:4px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Money</div>
<div style="font-size:24px;line-height:1.2;font-weight:600">£410</div>
</div>
</div>
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<div style="padding:16px;display:flex;flex-direction:column;justify-content:center">
<span style="font-weight:500">Early bird £12</span>
<span style="font-size:13px;color:#696969">38 of 40 sold</span>
</div>
<div style="padding:16px;display:flex;flex-direction:column;justify-content:center;border-top:1px solid #E9E9E9">
<span style="font-weight:500">Standard £14</span>
<span style="font-size:13px;color:#696969">3 of 40 sold</span>
</div>
</div>
</div>
</div>

<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>

<section role="dialog" aria-modal="true" aria-labelledby="refund-title" style="position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px;background:#FFFFFF;border-radius:16px 16px 0 0;display:flex;flex-direction:column;gap:24px">

<div style="display:flex;flex-direction:column;gap:8px">
<div aria-hidden="true" style="width:100px;height:8px;border-radius:999px;background:#D9D9D9;align-self:center"></div>
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<h1 id="refund-title" style="margin:0;font-size:15px;line-height:1.5;font-weight:600">Order K7Q2</h1>
<a href="R4Tickets.dc.html" aria-label="Close" style="width:44px;height:44px;margin-right:-10px;display:flex;align-items:center;justify-content:center;color:#030303;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
</a>
</div>
</div>

<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;align-items:center;gap:12px">
<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
<div style="font-weight:500">Maya Cole</div>
<div style="font-size:13px;color:#696969">2 tickets, Early bird</div>
<div style="font-size:24px;line-height:1.2;font-weight:600">£24</div>
</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Paid</span>
</div>

<p style="margin:0;font-size:15px;color:#030303">£24 goes back to Maya Cole in 5 to 10 days and their 2 tickets stop working at the door. We email them. It comes out of your next payout and cannot be undone.</p>

<div style="display:flex;flex-direction:column;gap:8px">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#AB413E;color:#FFF9F8;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500">Refund £24</button>
<a href="R4Tickets.dc.html" style="height:42px;width:100%;box-sizing:border-box;padding:0 16px;border-radius:10px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;text-decoration:none;display:flex;align-items:center;justify-content:center">Keep the order</a>
<p style="margin:0;font-size:13px;color:#696969;text-align:center">Only the owner handles money.</p>
</div>

</section>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
```
