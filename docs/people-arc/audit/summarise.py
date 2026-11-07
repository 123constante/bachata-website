# Compact per-page summary of measurements.json for writing the report.  python3 docs/people-arc/audit/summarise.py
import json, collections
r = json.load(open('docs/people-arc/audit/measurements.json'))
for x in r:
    h = (x.get('h1') or {})
    print(f"{x['build']:4} {x['screen']:16} {x['shape']:24} {x['width']} st={x['status']} -> {x['landed'][:40]:40} h1={h.get('text','')[:24]!r} {h.get('font','')} {h.get('px','')} sw={x.get('scrollWidth')} taps<44={x.get('smallTapCount')} lowC={x.get('lowContrastCount')} clip={len(x.get('clipped',[]))}")
