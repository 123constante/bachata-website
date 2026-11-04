# Brief (DO NOT DISPATCH YET: the program lead orders it, after the camera-header PR ships): help a door volunteer who declines the camera

Lane: normal (Website UI, no database change, no migration). Sonnet or Opus builder, independent critique by `impeccable-finish-reviewer`. One slice = one branch = one push. Depends on the camera-header fix (PR `claude/door-camera-policy`, `vercel.json` `camera=(self)`): without it the camera never works on any deploy, so this brief cannot be walked until that is live.

## Owner decision (2026-11-04, click answers)
For someone who taps "Don't allow" on the camera question, the door screen gets: (1) a warm-up before the question ("Tap Start camera, then tap Allow") and (2) after a decline, plain steps plus a "Try the camera again" button, with the code box and Tonight's list still right below. To be built after the header fix ships.

## Why (real, seen on the owner's phone 2026-11-04)
The door screen (`src/modules/organiser/p3/door/DoorScreen.tsx`, flag `organiserTicketing`; short-code parts behind `VITE_ENABLE_TICKET_DOOR_CODE`) starts the camera as soon as the Scan tab shows. A blocked camera shows `CAMERA_WORDS.denied` (`door/model.ts` ~line 221): "Camera blocked. Allow the camera for this site in your browser settings, or type the code or use tonight's list." The words do not say HOW, there is no retry control, and Chrome remembers a "Don't allow", so a volunteer cannot get the camera back without knowing browser site settings. The first failure today was also seen inside an in-app browser tab, which never shows a camera question at all.

## Inventory first (write `docs/design/door-camera-help/INVENTORY.md` BEFORE any code; cite file:line; list GAPs; end with a coverage count)
- Every camera state: `CameraState = 'starting' | 'on' | 'denied' | 'none' | 'failed' | 'off'` (`door/model.ts:216`), `CAMERA_WORDS`, `cameraDead()`, `cameraErrorState()` and `useScanner`/`runScanner` (`door/camera.ts`), the tab-visibility restart, and every place `DoorScreen.tsx` renders camera words, the code box, the list.
- The current Website screens only (the door is organiser-side; there is no public page), the existing tests under `door/__tests__/` (`door.screen.test.tsx`, `door.shortCode.matrix.test.tsx`), and the design tokens the door already uses.
- Browsers: Android Chrome (BarcodeDetector), the jsQR fallback path, iOS Safari, an in-app browser (no camera question ever shown), and a desktop browser with no camera (`none`).

## Build
1. Read the permission BEFORE asking: `navigator.permissions.query({ name: 'camera' })` where it exists (Chrome, Edge, Firefox); where it does not (iOS Safari) treat the state as unknown.
   - `granted`: start the camera as today.
   - `prompt` or unknown: do NOT call `getUserMedia` on load. Show a calm card: "To scan tickets, this page needs your camera. Tap Start camera, then tap Allow." with one primary "Start camera" button (>= 44 px). The question appears only after that tap. The code box and Tonight's list stay available underneath.
   - `denied` (or `getUserMedia` rejected with NotAllowedError): show the steps for the detected browser in plain words, a "Try the camera again" button, and keep the code box and list. Chrome Android: tap the padlock (or the settings icon) next to the address, Permissions, Camera, Allow, then come back and tap Try again. iOS Safari: tap aA, Website Settings, Camera, Allow. Add one line for in-app browsers: "If you opened this link inside another app, open it in Chrome or Safari."
   - "Try the camera again" re-reads the permission state (a change made in settings is picked up without a reload where the Permissions API fires `change`; otherwise it calls `getUserMedia` once and, if still blocked, keeps the steps and says "Still blocked").
2. Words are plain, warm, beginner-friendly; no jargon (no "permission policy", "getUserMedia"); every disabled control says why; the empty/blocked state always says what the person CAN do (type the code, use the list). Run the `copy-checker` agent over the new strings.
3. No change to the scan result screen, the check-in calls, the door RPCs, or flag-OFF behaviour (OFF = exactly as before).

## Checks (self-running, per the Design Gate)
Table-driven matrix: (permission state: granted, prompt, unknown, denied) x (browser: Chrome-like, iOS-like, in-app) x (camera: available, none, failed) x (door flags: short-code ON/OFF): each cell asserts which of {warm-up card, camera view, steps, retry button, code box, list} is shown and that no text points at a missing control. Red first: write the denied/prompt cells against the current code and show them fail. Contrast >= 4.5, taps >= 44 px, no sideways scroll at 390x844, every state actionable. Mutants (rolled back): load-time `getUserMedia` restored, retry button removed, steps hidden when denied, code box hidden when the camera is dead: each must turn a test red.
Walk by the orchestrator at 390x844 on the preview with the door flags on (`node ~/.claude/bin/preview-deploy.mjs <branch> --flag VITE_ENABLE_ORGANISER_P3=true --flag VITE_ENABLE_ORGANISER_TICKETING=true --flag VITE_ENABLE_TICKET_DOOR_CODE=true`), including a real "Don't allow" and a recovery through settings on the owner's phone; then the review pack.

## Boundaries
No change to `vercel.json`, no database or RPC change, no new dependency, no Vercel deploy by the worker. Design record `docs/design/<pr>.md`. Do not touch the organiser team, claim or onboarding screens.

## Output
Inventory (with coverage count), tests (matrix + mutants), design record, per-job CI table, Verified / Not verified (say plainly which browsers were not tried).
