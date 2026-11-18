# R4AddTeammate board (390x844 HTML source, from the Round 4 canvas)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Add a teammate</title>
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
<div style="height:42px;border-radius:10px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center">Add a teammate</div>
<div style="display:flex;flex-direction:column;gap:8px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Owner</div>
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;font-weight:500">Sam Rowe</div>
</div>
<div style="display:flex;flex-direction:column;gap:8px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Manager</div>
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;font-weight:500">Maya Cole</div>
</div>
<div style="display:flex;flex-direction:column;gap:8px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Door staff</div>
<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;font-weight:500">Tom Reed</div>
</div>
</div>
</div>

<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>

<section role="dialog" aria-modal="true" aria-labelledby="add-title" style="position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px;background:#FFFFFF;border-radius:16px 16px 0 0;display:flex;flex-direction:column;gap:24px">

<div style="display:flex;flex-direction:column;gap:8px">
<div aria-hidden="true" style="width:100px;height:8px;border-radius:999px;background:#D9D9D9;align-self:center"></div>
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<h1 id="add-title" style="margin:0;font-size:15px;line-height:1.5;font-weight:600">Add a teammate</h1>
<a href="R4Team.dc.html" aria-label="Close" style="width:44px;height:44px;margin-right:-12px;display:flex;align-items:center;justify-content:center;color:#030303;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
</a>
</div>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<label for="teammate-search" style="font-size:13px;font-weight:400;color:#464646">Name or email</label>
<div style="position:relative;display:flex">
<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:12px;top:12px"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
<input id="teammate-search" type="search" autocomplete="off" style="flex:1;min-width:0;height:42px;box-sizing:border-box;padding:0 12px 0 38px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;color:#030303;font-family:inherit;font-size:16px">
</div>
</div>

<div role="group" aria-labelledby="role-label" style="display:flex;flex-direction:column;gap:8px">
<div id="role-label" style="font-size:13px;font-weight:400;color:#464646">Role</div>
<div style="min-height:44px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 8px">
<button aria-pressed="true" style="height:34px;padding:0 12px;border:0;border-radius:9px;background:#FFFFFF;color:#C2410C;box-shadow:inset 0 0 0 1px #C2410C,0 1px 3px rgba(0,0,0,0.04);font-size:13px;font-weight:500">Manager</button>
<button aria-pressed="false" style="height:34px;padding:0 12px;border:0;border-radius:9px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:13px;font-weight:500">Contributor</button>
<button aria-pressed="false" style="height:34px;padding:0 12px;border:0;border-radius:9px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:13px;font-weight:500">Door staff</button>
</div>
<p style="margin:0;font-size:13px;color:#696969">Runs events, tickets and guest lists, and can add people. Sees ticket counts, not money.</p>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500">Add to team</button>
<div style="display:flex;flex-direction:column;align-items:center">
<a href="#" style="min-height:44px;display:flex;align-items:center;font-size:13px;font-weight:500;text-decoration:none">Send an invite link instead</a>
<p style="margin:0;font-size:13px;color:#696969">Works once, lasts 7 days.</p>
</div>
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
