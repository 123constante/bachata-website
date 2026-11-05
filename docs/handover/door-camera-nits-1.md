# Handover: door-camera-nits-1

Ticket dt_05cd1b0bd5f9. Brief: docs/briefs/door-camera-nits-1.md (on branch brief/door-camera-nits-1).

## Red first (new cells run on main before the change)
4 of 88 failed in `door.cameraHelp.matrix.test.tsx`:
- camera states: steps and Try again > none (no Try the camera again button)
- camera states: steps and Try again > failed (same)
- the N of M pill is never inside the live camera box
- the CSS gives the steps visible numbers and the feed no pill

## What changed
- `door.css`: `.p3-door-steps` gets `list-style: decimal outside` (the site reset hid the numbers; the `<ol>` was already there). The pill's absolute `.p3-door-camtop` is gone.
- `DoorScreen.tsx`: the Counter pill is its own row above the camera box (and not duplicated inside the hidden box). none/failed show "Try the camera again" (44px+ tap, `door-cam-retry`) in the Scan box; the list-tab dead-camera line has the same button, which switches to Scan and retries once.
- `camera.ts`, the permissions-policy header: untouched. `model.ts`: untouched.

## Not done
No browser walk (the lead walks). Real phone permission sheet not verified.
- Not run: check:bundle-budget (needs npm run build), full lint chain (eslint on door dir + tsc clean).
