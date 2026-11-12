# Dancer dashboard slice 1, Option B: coverage of INVENTORY.md

Flag: `VITE_ENABLE_DANCER_DASH_B=true` (default off; off = the current Option A Home, untouched).
Counts below are over the 77 rows of `docs/design/dancer-dash-protos/INVENTORY.md`.

- **Built on Home (D): 39 rows** as the inventory drew them, EXCEPT where listed under "deliberately left".
- **Reached in one tap (R): 35 rows**: nothing changed, the existing screens still own them.
- **Uncovered, same reasons as the inventory: 3** (#27 always null, #35 views tile removed by contract, #55 superseded page).

Deliberately left (reason):
- #24 paused banner, #25 linked-from-admin note: still rendered by the existing HomeBodyView above the B view (kept, not rebuilt).
- #28/#76 unclaimed "Claim / Not me": reused the existing ClaimCard (G-2: claim is automatic, no "not me" contract). Action: Claim, Check again, Message us.
- #36 stats strip: only "nights attended" built. Positive-only; the zero state is "Your first night out" with no number.
- #63-#70 profile switch / Account button: owned by the shell header, not redrawn.
- Row "Finish your profile" from the brief is the FOCUS card itself (profile step first), so it is not repeated as a row; rows are Share, more plans (above 0), nights attended (above 0), as in option-b.html.
- Share disabled with a reason until 4 required steps (G-9) and for a paused profile (existing HIDDEN_SHARE_REASON).
