# R4EmptyTickets board (390x844 HTML source, from the Round 4 canvas)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tickets empty and error states</title>
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

<header style="height:48px;box-sizing:border-box;padding:0 8px 0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0;border:0;background:none;font-size:15px;font-weight:500" aria-label="Switch page, now showing Ritmo London">Ritmo London
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
</button>
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0 8px;border:0;background:none;font-size:13px;font-weight:500;color:#464646">To do
<span style="min-width:20px;height:20px;box-sizing:border-box;padding:0 6px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:11px;font-weight:500;line-height:1;display:flex;align-items:center;justify-content:center">2</span>
</button>
</header>

<main style="padding:24px 16px 0;display:flex;flex-direction:column;gap:48px">

<section style="display:flex;flex-direction:column;gap:24px">
<h2 style="margin:0 0 -16px;font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">No tickets yet</h2>

<button style="min-height:56px;width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;display:flex;align-items:center;gap:8px;text-align:left" aria-label="Change night, now showing Sunday Sensual Workshop, Sun 6 Dec">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Sunday Sensual Workshop</span>
<span style="font-size:13px;color:#696969">Sun 6 Dec</span>
</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
</button>

<div style="display:flex;flex-direction:column;gap:4px">
<h1 style="margin:0;font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">No tickets yet</h1>
<p style="margin:0;font-size:15px;color:#464646">Add your first ticket and it goes on sale on the event page.</p>
</div>

<div style="min-height:44px;display:flex;align-items:center">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
Add a ticket
</button>
</div>
</section>

<div role="separator" style="height:1px;background:#E9E9E9"></div>

<section style="display:flex;flex-direction:column;gap:8px">
<h2 style="margin:0;font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">If loading fails</h2>

<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:16px;display:flex;flex-direction:column;gap:16px">
<div style="display:flex;flex-direction:column;gap:4px">
<h3 style="margin:0;font-size:18px;line-height:1.25;font-weight:500">We could not load tickets</h3>
<p style="margin:0;font-size:13px;color:#464646">Nothing was changed. Your live nights are still on the calendar for dancers.</p>
</div>
<div style="min-height:44px;display:flex;align-items:center">
<button style="height:34px;width:100%;padding:0 12px;border:0;border-radius:9px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px">
<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/></svg>
Try again
</button>
</div>
</div>
</section>

</main>

<nav aria-label="Main" style="position:absolute;left:0;right:0;bottom:0;height:64px;border-top:1px solid #E9E9E9;background:#FFFFFF;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))">
<a href="R4HomeBefore.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>Home</a>
<a href="R4Events.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>Events</a>
<a href="R4Tickets.dc.html" aria-current="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;color:#C2410C;text-decoration:none">
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
