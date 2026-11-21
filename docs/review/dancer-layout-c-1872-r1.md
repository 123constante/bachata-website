# Review r1 (PR #1872, head 4a0bafa559e6d114922510a4cf103336cc075101): layout C Home

Reviewer: Sonnet (independent of the Opus builder). One round, risky class: screens with saves and routing.
Merge dark: every change is behind VITE_ENABLE_DANCER_LAYOUT_C, default off. Findings below are follow-ups
to close BEFORE the flag is turned on in production. None blocks a flag-off merge.

## Verdict: PASS WITH NITS

## Findings
- med: homeTicket.tsx:16, Home mounts useTicketCard and consumes the stored post-checkout order id into ?o=; the Tickets tab then loses the order. Add a consume:false read-only option. Moot once S2 removes the Tickets tab, still needed before flag flip if order of merge differs.
- low: homeTicket.tsx, check the tickets stylesheet loads in the Home chunk at 390x844 with the flag on.
