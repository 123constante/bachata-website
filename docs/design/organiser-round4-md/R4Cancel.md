# R4Cancel board (390x844 HTML source, from the Round 4 canvas)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cancel a night</title>
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
<div style="height:56px;box-sizing:border-box;padding:0 16px 0 4px;display:flex;align-items:center;gap:4px;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<span style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>
</span>
<span style="font-size:15px;font-weight:500">Friday Social</span>
</div>
<div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:24px">
<div style="display:flex;flex-direction:column;gap:4px">
<div style="font-weight:500">Fri 20 Nov, 21:00, Soho Dance Studio</div>
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<span style="font-size:13px;color:#464646">Every Friday, night 3 of 13</span>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Live</span>
</div>
</div>
<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;flex-direction:column;gap:4px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Going</div>
<div style="font-size:24px;line-height:1.2;font-weight:600">62</div>
</div>
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;flex-direction:column;gap:4px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Tickets sold</div>
<div style="font-size:24px;line-height:1.2;font-weight:600">41 <span style="font-size:13px;font-weight:400;color:#464646">of 80</span></div>
</div>
</div>
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<div style="min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;font-weight:500">Guest list</div>
<div style="min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;font-weight:500;border-top:1px solid #E9E9E9">Raffle</div>
<div style="min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;font-weight:500;border-top:1px solid #E9E9E9">Tickets</div>
</div>
</div>
</div>

<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>

<section role="dialog" aria-modal="true" aria-labelledby="cancel-title" style="position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px;background:#FFFFFF;border-radius:16px 16px 0 0;display:flex;flex-direction:column;gap:24px">

<div style="display:flex;flex-direction:column;gap:8px">
<span aria-hidden="true" style="align-self:center;width:100px;height:8px;border-radius:999px;background:#D9D9D9"></span>
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
<h1 id="cancel-title" style="margin:0;font-size:15px;line-height:1.5;font-weight:600">Cancel Friday Social?</h1>
<a href="R4Night.dc.html" aria-label="Close" style="flex:none;width:44px;height:44px;margin-right:-12px;display:flex;align-items:center;justify-content:center;color:#030303;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
</a>
</div>
<p style="margin:0;color:#464646">62 people who said going will be told. 41 ticket buyers are refunded automatically.</p>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<div id="why-label" style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Why?</div>
<div role="group" aria-labelledby="why-label" style="display:flex;flex-wrap:wrap;gap:10px 8px;padding:5px 0">
<button aria-pressed="false" style="height:34px;padding:0 12px;border:1px solid #D9D9D9;border-radius:9px;background:transparent;color:#030303;font-size:13px;font-weight:500">Venue problem</button>
<button aria-pressed="false" style="height:34px;padding:0 12px;border:1px solid #D9D9D9;border-radius:9px;background:transparent;color:#030303;font-size:13px;font-weight:500">Not enough people</button>
<button aria-pressed="false" style="height:34px;padding:0 12px;border:1px solid #D9D9D9;border-radius:9px;background:transparent;color:#030303;font-size:13px;font-weight:500">Illness</button>
<button aria-pressed="false" style="height:34px;padding:0 12px;border:1px solid #D9D9D9;border-radius:9px;background:transparent;color:#030303;font-size:13px;font-weight:500">Weather</button>
<button aria-pressed="false" style="height:34px;padding:0 12px;border:1px solid #D9D9D9;border-radius:9px;background:transparent;color:#030303;font-size:13px;font-weight:500">Other</button>
</div>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<button disabled aria-describedby="cancel-help" style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#AB413E;color:#FFF9F8;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;opacity:0.5;cursor:default">Cancel this night</button>
<p id="cancel-help" style="margin:0;font-size:13px;color:#696969;text-align:center">Pick a reason first.</p>
<a href="R4Night.dc.html" style="height:42px;box-sizing:border-box;margin-top:8px;padding:0 16px;border-radius:10px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;text-decoration:none;display:flex;align-items:center;justify-content:center">Keep the night</a>
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
