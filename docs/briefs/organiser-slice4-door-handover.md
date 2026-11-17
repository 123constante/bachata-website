# Handover: organiser slice 4, Door Search
Done: tab renamed Search (no count in label; ticket count in the search label), header "<night name> · Door" (name via useEventWorkspace in DoorScreen wrapper; falls back to "Door" if unreadable by door-only staff), no-match next step, orange #C2410C active tab with 2px underline (token --door-active in p3.css). Route already behind flags.organiserTicketing. Check-in gating by ticketDoorCode unchanged.
Left: 390x844 walk (owner window). Open question: does a door-only role pass admin_event_workspace_p5? If not, header shows plain "Door".
tsc run on HEAD: 0 errors in branch files. vitest src/modules/organiser/p3: 160 files pass.
