Q: Course is a format in rule 14 but the server's owner create accepts one_off and recurring only. Offer it? | Default used: listed on "What are you listing?" as an OFF row with the reason "Not available yet"; Festival is not listed (C10 owns its entry) | Cost if wrong: small | Where: src/modules/organiser/flows/new/model.ts NEW_FORMATS

Q: series_go_live_check_v1's result shape is not documented in ER-INTERFACE and shared/goLiveCheck.ts is not on this branch. | Default used: flows/new/goLiveCheck.ts reads `blockers` (list of codes or {code}) or `missing`; "not ready" with no code still blocks as `not_ready`. Move to shared/ when the orchestrator merges #897's file | Cost if wrong: small | Where: src/modules/organiser/flows/new/goLiveCheck.ts:1

Q: The route table (shell/paths.ts, OrganiserRoutes) is outside this slice and has six New event routes. | Default used: `/time` now hosts "first session" and `/cover` hosts the last step (flyer, How to pay, details, preview, Publish). URLs are legacy names, no new route | Cost if wrong: small | Where: src/modules/organiser/flows/new/NewFlow.tsx (route target)

Q: First-session default when no start-time step exists. | Default used: one Party at 21:00 (valid with no level; a Class would need a level first); edited in the C4 sheet | Cost if wrong: small | Where: flows/new/model.ts DEFAULT_FIRST_KIND

Q: A draft's first date may have no occurrence row until the server materialises it. | Default used: the session step reads the occurrence from the workspace; if none, Next is off with "Pick the date first" | Cost if wrong: large (cannot save sessions if occurrences never appear for drafts) | Where: flows/new/NewFlow.tsx SessionStep

Q: Description is optional (rule 11) but the server still requires it to go live (AD1 as built). | Default used: screen says optional; the server check will block with its own code and the screen shows it | Cost if wrong: small | Where: flows/new/NewFlow.tsx FinishStep

Q: Pre-existing saved How to pay is not in the workspace read, so a returning draft shows nothing ticked. | Default used: local state starts empty; saving sends the full list | Cost if wrong: small | Where: flows/new/NewFlow.tsx FinishStep
