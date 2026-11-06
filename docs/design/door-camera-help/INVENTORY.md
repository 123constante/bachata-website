# Door camera help: inventory (before code)

Screen: `src/modules/organiser/p3/door/DoorScreen.tsx` (flag `organiserTicketing`; short code behind `VITE_ENABLE_TICKET_DOOR_CODE`). No public page.

## Camera states (what exists today)
| # | Item | Where |
|---|------|-------|
| 1 | `CameraState = starting/on/denied/none/failed/off` | `door/model.ts:216` |
| 2 | `CAMERA_WORDS` (denied says "allow in browser settings", no how) | `door/model.ts:219-225` |
| 3 | `cameraDead()` = denied/none/failed | `door/model.ts:228` |
| 4 | `cameraErrorState()` NotAllowed/Security -> denied; NotFound/Overconstrained -> none; else failed | `door/camera.ts:48` |
| 5 | `browserDeps.getStream` calls `getUserMedia` as soon as the Scan tab shows (GAP: asks on load, no warm-up) | `door/camera.ts:66`, `runScanner` `:84` |
| 6 | `useScanner`: restarts when the tab becomes visible; GAP: no retry control, no permission read | `door/camera.ts:123` |
| 7 | `DoorScreen` camOn = Scan tab, allowed, tickets sold, no blocking answer | `DoorScreen.tsx:104` |
| 8 | Dead camera auto-opens Tonight's list once (hides the how-to for denied) | `DoorScreen.tsx:119-121` |
| 9 | Camera box renders `CAMERA_WORDS[cam]` only (GAP: no button) | `DoorScreen.tsx:~207` |
| 10 | List tab note `door-cam-dead` repeats the words | `DoorScreen.tsx:~341` |
| 11 | Code box under the camera box on the Scan tab when no answer is shown | `DoorScreen.tsx` ScanTab / `CodeBox` |

## Tests today
`__tests__/door.screen.test.tsx` (camera mock, dead cameras line 185), `door.model.test.ts:132`, `door.listShape.test.tsx`.

## Browsers
Android Chrome (BarcodeDetector, Permissions API), jsQR fallback (same camera path), iOS Safari (no `permissions.query` for camera: unknown), in-app browser (no question ever: unknown/denied; steps say open in Chrome or Safari), desktop with no camera (`none`).

## GAPs this slice closes
G1 asks on load (#5). G2 no "how" in words (#2). G3 no retry (#9). G4 denied hides the steps by switching tab (#8). G5 no browser-specific steps.

Coverage: 11 items listed, 5 GAPs, 5 closed by this slice.
