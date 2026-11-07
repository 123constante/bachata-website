# Handover: Team restructure slice C (Website)

Done: shared read in `fetchOrganiserTeam` (adds `listed`; `members`/`myRole` still from organiser_team_v1), Team screen
rows with Owner/Manager/Contributor/Listed label and hide switch (teamHide.ts rule, set_organiser_team_member_hidden_v1),
empty states (screen and own public page), `teamShared.matrix.test.tsx`, INVENTORY (18 / 18 rows covered).

Deviations: the shared read has no my_role/email/is_self, so the seat read stays for those callers (other tests'
mocks unchanged: a failed shared read degrades to the seat list plus a plain line). Seats are NOT forced to a disabled
switch: the RPC lets an owner/manager hide a seat holder, so the switch follows canSetHidden; stubs, no-profile,
not-visible, not-listed and no-rights rows are disabled with a reason.

Left: browser walk at 390x844 with prod-shaped data; `check:pr-*` PR body scripts; CI results. types.ts not regenerated
(untyped rpc cast used).

tsc run on HEAD: 0 errors. check:mojibake and check:integrity ok. vitest src/modules/organiser|profile|pages: all pass.
