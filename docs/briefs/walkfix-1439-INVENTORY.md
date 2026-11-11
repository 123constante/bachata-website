# INVENTORY walkfix-1439
- Check again: `<button className="p3-btn p3-door-big">` DoorScreen.tsx:305
- Back to events: `<Link className="p3-btn p3-btn-line p3-door-big">` DoorScreen.tsx:308
- Shared rule: `.p3-door-big` door.css:56 (now inline-flex centred; only door uses this class)
- Coverage: 2/2 refused-card controls; other `<Link className="p3-btn` uses untouched (rule scoped to p3-door-big).
