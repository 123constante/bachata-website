# R4Raffle board (390x844 HTML source, from the Round 4 canvas)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Raffle</title>
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

<header style="height:48px;box-sizing:border-box;padding:0 16px 0 4px;display:flex;align-items:center;gap:4px;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<a href="R4Night.dc.html" aria-label="Back" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:#030303;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>
</a>
<h1 style="margin:0;font-size:15px;font-weight:500">Raffle</h1>
</header>

<main style="padding:24px 16px 0;display:flex;flex-direction:column;gap:24px">

<p style="margin:0;font-size:13px;color:#464646">Friday Social, Fri 20 Nov</p>

<ol aria-label="Raffle steps" style="margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
<li style="display:flex;flex-direction:column;gap:8px">
<span style="height:4px;border-radius:2px;background:#030303"></span>
<span style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:500;color:#030303">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>Open</span>
</li>
<li aria-current="step" style="display:flex;flex-direction:column;gap:8px">
<span style="height:4px;border-radius:2px;background:#C2410C"></span>
<span style="font-size:13px;font-weight:500;color:#C2410C">Entries</span>
</li>
<li style="display:flex;flex-direction:column;gap:8px">
<span style="height:4px;border-radius:2px;background:#E9E9E9"></span>
<span style="font-size:13px;font-weight:400;color:#696969">Closed</span>
</li>
<li style="display:flex;flex-direction:column;gap:8px">
<span style="height:4px;border-radius:2px;background:#E9E9E9"></span>
<span style="font-size:13px;font-weight:400;color:#696969">Winner</span>
</li>
</ol>

<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;flex-direction:column;gap:4px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Entered</div>
<div style="font-size:24px;line-height:1.2;font-weight:600">23</div>
</div>
</div>

<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;gap:8px">
<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#464646" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:2px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
<div style="font-weight:500">Locked: 23 people have entered</div>
<p style="margin:0;font-size:13px;color:#696969">Once the first person enters, the raffle cannot be closed or changed. This keeps it fair for everyone who entered.</p>
</div>
</div>

<p style="margin:0;font-size:13px;color:#464646">You see how many entered, never who.</p>

<div style="display:flex;flex-direction:column;gap:8px;margin-top:24px">
<div style="min-height:44px;display:flex;align-items:center">
<button disabled aria-describedby="pick-help" style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;opacity:0.5;cursor:default">Pick the winner</button>
</div>
<p id="pick-help" style="margin:0;font-size:13px;color:#696969;text-align:center">Available when doors close.</p>
</div>

</main>

<nav aria-label="Main" style="position:absolute;left:0;right:0;bottom:0;height:64px;border-top:1px solid #E9E9E9;background:#FFFFFF;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))">
<a href="R4HomeBefore.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>Home</a>
<a href="R4Events.dc.html" aria-current="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;color:#C2410C;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>Events</a>
<a href="R4Tickets.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z"/><path d="M14 5v14" stroke-dasharray="2 3"/></svg>Tickets</a>
<a href="R4Team.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/></svg>Team</a>
</nav>

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
