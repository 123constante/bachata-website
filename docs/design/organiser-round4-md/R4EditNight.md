# R4EditNight board (390x844 HTML source, from the Round 4 canvas)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Edit night</title>
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
<h1 style="margin:0;font-size:15px;font-weight:500">Edit night</h1>
</header>

<main style="padding:24px 16px 0;display:flex;flex-direction:column;gap:24px">

<div style="display:flex;flex-direction:column;gap:8px">
<label for="en-name" style="font-size:13px;font-weight:400;color:#464646">Name</label>
<input id="en-name" type="text" value="Friday Social" style="height:42px;width:100%;box-sizing:border-box;padding:0 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;color:#030303;font:inherit;font-size:16px">
</div>

<div style="display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:12px">
<div style="display:flex;flex-direction:column;gap:8px">
<label for="en-date" style="font-size:13px;font-weight:400;color:#464646">Date</label>
<input id="en-date" type="text" value="Fri 20 Nov 2026" style="height:42px;width:100%;box-sizing:border-box;padding:0 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;color:#030303;font:inherit;font-size:16px">
</div>
<div style="display:flex;flex-direction:column;gap:8px">
<label for="en-starts" style="font-size:13px;font-weight:400;color:#464646">Starts</label>
<input id="en-starts" type="text" value="21:00" style="height:42px;width:100%;box-sizing:border-box;padding:0 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;color:#030303;font:inherit;font-size:16px">
</div>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<label for="en-place" style="font-size:13px;font-weight:400;color:#464646">Place</label>
<input id="en-place" type="text" value="Soho Dance Studio" style="height:42px;width:100%;box-sizing:border-box;padding:0 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;color:#030303;font:inherit;font-size:16px">
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<label for="en-price" style="font-size:13px;font-weight:400;color:#464646">Ticket price</label>
<div style="position:relative">
<input id="en-price" type="text" value="£12" disabled aria-describedby="en-price-why" style="height:42px;width:100%;box-sizing:border-box;padding:0 40px 0 12px;border:1px solid #E9E9E9;border-radius:8px;background:#FAFAFA;color:#696969;font:inherit;font-size:16px;opacity:1">
<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;right:12px;top:12px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
</div>
<p id="en-price-why" style="margin:0;font-size:13px;color:#696969">Tickets have sold at this price, so it cannot change. Pause this one and add a new ticket for a new price.</p>
</div>

<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<button style="min-height:52px;width:100%;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:8px;border:0;background:none;text-align:left">
<span style="flex:1;font-weight:500">Repeats every Friday</span>
<span style="font-size:13px;color:#464646">On</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</button>
</div>

</main>

<div style="position:absolute;left:0;right:0;bottom:64px;box-sizing:border-box;padding:12px 16px;border-top:1px solid #E9E9E9;background:#FFFFFF">
<div style="min-height:44px;display:flex;align-items:center">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px">Save changes</button>
</div>
</div>

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
