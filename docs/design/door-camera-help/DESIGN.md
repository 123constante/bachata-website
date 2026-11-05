# Door camera help: design record + handover

Built to `docs/briefs/door-camera-help.md` (branch brief/door-camera-help). Website only; no vercel.json, DB, RPC or dependency change.

- `camera.ts`: `ScannerDeps.permission` / `watchPermission` (Permissions API; iOS rejects the name = unknown). Without a granted answer the camera does NOT call getUserMedia until Start camera is tapped. `useScanner` now returns `{ state, start, denials }`. A settings change to granted restarts the camera.
- `model.ts`: `CameraState` gains `ask`; `detectBrowser`, `cameraSteps`, button/line constants; denied words now point to the Scan tab.
- `DoorScreen.tsx`: `CameraHelp` card (Start camera / steps + Try the camera again + Still blocked + open tonight's list); code box stays below. Denied no longer auto-opens the list (that hid the steps); none/failed still do. Deps without `permission` (all old tests) behave as before. Flag OFF untouched.
- Tests: `door.cameraHelp.matrix.test.tsx` (72 matrix cells + flow tests). Mutants (load-time getUserMedia, retry id removed, denied steps hidden) each turn it red; rolled back. The existing denied case in door.screen.test.tsx was moved to the matrix (behaviour change above).

## Not verified
No browser walk at 390x844, no real "Don't allow" on a phone, iOS/in-app not tried, no copy-checker or impeccable review run, no contrast/tap measurement (CSS sets 48px/44px min-heights), no full lint chain / pre-ship, red-first run against the old code not recorded (mutant M1 stands in). Orchestrator walk and review still to do.
