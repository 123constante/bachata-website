# Going P2 fix round: 390x844 shots

These come from a scratch Vite harness (not committed). It renders the real components with mocked reads: Supabase, auth and city are swapped out, and the going switch is set from the URL. The live preview walk by the orchestrator is still to come. h-scroll = documentElement.scrollWidth - clientWidth.

| File | Surface | State | What to look at | h-scroll |
|---|---|---|---|---|
| [dashboard--completion-once.png](dashboard--completion-once.png) | /account dashboard | switch on, name+city+role+instagram, no photo | "60% ready" ONCE (badge). No Completion tile, no % bar. Tiles 2 + 1 + 2, no lone tile. Main showed 60% for this profile. | 0 |
| [dashboard--completion-once-going-off.png](dashboard--completion-once-going-off.png) | /account dashboard | switch OFF (production) | Same number and layout as the switch-on shot. | 0 |
| [dashboard--next-step-find-event-going-off.png](dashboard--next-step-find-event-going-off.png) | /account dashboard | photo set, switch OFF | 80% (main: 80%). Main&rsquo;s step 3 "Find your next event" is back. Its helper names no button that isn&rsquo;t on the page. | 0 |
| [dashboard--next-step-find-event-going-on.png](dashboard--next-step-find-event-going-on.png) | /account dashboard | photo set, switch on, no nights | Helper: "Open a night and tap I&rsquo;m going to add it here." | 0 |
| [calendar-list--cancelled-no-count.png](calendar-list--cancelled-no-count.png) | calendar list | live 3 / cancelled 7 / live 200 | The cancelled row shows NO going count. The other two show "3 going" and "200 going". | 0 |
| [event-tile--own-list-failed-finished.png](event-tile--own-list-failed-finished.png) | event tile | `get_my_going_v1` failed, finished profile | "Couldn&rsquo;t load who&rsquo;s going &middot; Try again"; button off ("Checking&hellip;"), never a wrong "I&rsquo;m going" | 0 |
| [event-tile--own-list-failed-unfinished.png](event-tile--own-list-failed-unfinished.png) | event tile | `get_my_going_v1` failed, unfinished profile | Never "Finish your profile" with a dead button (R13). The same retry state as the finished profile. | 0 |
