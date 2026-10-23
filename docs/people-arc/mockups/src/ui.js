// Shared render helpers for the three directions (shell, avatar, router). Not a design choice:
// every direction gets the same site header, the same avatar fallback and the same views.

/** One avatar for every screen: photo stand-in when a photo exists, else initials on the role tile. */
function avatar(p, role, size, radius, fontPx) {
  const t = TILE[role];
  const fill = size === 'fill';
  const fs = fontPx || Math.round(size * 0.38);
  const base = `width:${fill ? '100%' : size + 'px'};height:${fill ? '100%' : size + 'px'};border-radius:${radius}px;flex:none;display:flex;align-items:center;justify-content:center;`;
  if (p.photo) {
    return `<div class="photo" data-photo style="${base}background:repeating-linear-gradient(135deg,${t.bg} 0 10px,${mix(t.bg, '#000000', 0.25)} 10px 20px);color:${t.ink};font:700 ${Math.max(10, Math.round(fs / 2.6))}px/1 Inter,system-ui,sans-serif;">photo</div>`;
  }
  return `<div aria-hidden="true" style="${base}background:${t.bg};color:${t.ink};font:800 ${fs}px/1 Inter,system-ui,sans-serif;letter-spacing:0.5px;">${initialsOf(p)}</div>`;
}

function siteHeader() {
  return `<header style="height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#0A080B;border-bottom:1px solid #2A1F1A;">
    <span style="font:800 15px/1 Inter,system-ui,sans-serif;color:${WALL.text};">Bachata Calendar</span>
    <a href="#" style="min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;font:600 14px/1 Inter,system-ui,sans-serif;color:${WALL.text};text-decoration:none;">Menu</a>
  </header>`;
}

const qs = new URLSearchParams(location.search);
const view = qs.get('view') || 'index';
const shapeKey = qs.get('shape');
const tabKey = qs.get('tab');

function renderView() {
  const root = document.getElementById('root');
  if (view === 'page') {
    const s = SHAPES.find((x) => x.key === shapeKey);
    const p = PEOPLE[s.person];
    const role = tabKey || s.tabs[0];
    document.body.style.background = groundOf(role);
    document.title = `${DIR.name} -- ${p.name} -- ${ROLE_LABEL[role]}`;
    root.innerHTML = siteHeader() + DIR.page(p, role);
    return;
  }
  if (view === 'tile') {
    document.body.style.background = WALL.page;
    const row = [['magda', 'dancer'], ['pierre', 'teacher'], ['papacito', 'dj'], ['ramiro', 'dj'], ['sabrina', 'dancer'], ['ramiro', 'teacher'], ['pierre', 'teacher'], ['magda', 'dancer']];
    root.innerHTML = `<div style="padding:12px;"><div style="font:700 13px/1.3 Inter,system-ui,sans-serif;color:${WALL.muted};margin-bottom:8px;">Wall tiles (4 columns at 390)</div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 8px;">${row.map(([k, r]) => DIR.tile(PEOPLE[k], r)).join('')}</div></div>`;
    return;
  }
  if (view === 'og') {
    document.body.style.background = '#0B141A';
    const links = [['magda', 'dancer'], ['pierre', 'teacher'], ['papacito', 'dj'], ['ramiro', 'teacher'], ['ramiro', 'dj'], ['ramiro', 'dancer'], ['sabrina', 'dancer']];
    root.innerHTML = `<div style="padding:12px;display:grid;gap:12px;">${links.map(([k, r]) => ogBubble(PEOPLE[k], r)).join('')}</div>`;
    return;
  }
  // index: every shape x tab as a live frame at both widths
  document.body.style.background = '#111';
  const frames = [];
  SHAPES.forEach((s) => s.tabs.forEach((t) => [390, 360].forEach((w) => {
    const h = w === 390 ? 844 : 800;
    frames.push(`<figure style="margin:0;"><figcaption style="color:#ddd;font:12px/1.4 system-ui;margin-bottom:4px;">${s.label} &middot; ${ROLE_LABEL[t]} tab &middot; ${w}x${h}<br><code>${urlOf(PEOPLE[s.person], t)}</code></figcaption>
      <iframe src="?view=page&shape=${s.key}&tab=${t}" width="${w}" height="${h}" style="border:1px solid #444;background:#000;"></iframe></figure>`);
  })));
  root.innerHTML = `<h1 style="color:#fff;font:700 20px system-ui;padding:12px;">Direction ${DIR.letter}: ${DIR.name}</h1>
    <p style="color:#ccc;font:14px/1.5 system-ui;padding:0 12px;max-width:760px;">${DIR.pitch}</p>
    <p style="padding:0 12px;"><a style="color:#9cf" href="?view=tile">Wall tiles</a> &middot; <a style="color:#9cf" href="?view=og">Link previews</a></p>
    <div style="display:flex;flex-wrap:wrap;gap:16px;padding:12px;">${frames.join('')}</div>`;
}

/** A WhatsApp-style chat bubble holding the link preview: the 1.91:1 og image, title, text, domain. */
function ogBubble(p, role) {
  return `<div style="max-width:320px;margin-left:auto;background:#005C4B;border-radius:10px;padding:4px;">
    <div style="background:#025144;border-radius:8px;overflow:hidden;">
      <div style="aspect-ratio:1.91/1;width:100%;">${DIR.og(p, role)}</div>
      <div style="padding:8px 10px;">
        <div style="font:700 14px/1.3 system-ui,sans-serif;color:#E9EDEF;">${ogTitle(p, role)}</div>
        <div style="font:400 13px/1.35 system-ui,sans-serif;color:#C9D6D2;margin-top:2px;">${ogDescription(p, role)}</div>
        <div style="font:400 12px/1.3 system-ui,sans-serif;color:#B7C8C3;margin-top:4px;">bachatacalendar.co.uk</div>
      </div>
    </div>
    <div style="font:400 14px/1.35 system-ui,sans-serif;color:#E9EDEF;padding:6px 8px 4px;">https://bachatacalendar.co.uk${urlOf(p, role)}</div>
  </div>`;
}
