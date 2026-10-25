# AUDIT: the 73 CONFLICTING open PRs -- what still matters?

Read-only audit, 2026-10-24. Brief: `briefs/AUDIT-conflicting-prs-brief.md` on `brief/people-arc`
(blob e3000fdc). Ticket dt_a59440142b59. **No PR, branch or label was changed. Recommendations only; the owner decides.**

Compared against `origin/main` at **4791d9f2** (#1022), full (unshallowed) history.

## Headline

| verdict | count | PRs |
|---|---|---|
| LANDED (content on main: closing candidate) | 29 | account 772 773 776 777 780; dancer 787 788 817 819 820; organiser R1 790 793 796 798 801 804 811 812 815 818 828 829 837 838 839; people 847 850 895 896 |
| REVIEW-ONLY (own diff is review/audit text; the code it reviews is LANDED or SUPERSEDED) | 31 | 766 767 768 778 779 781 782 822; R1 reviews 791 794 799 800 805 813 814 816 823 824 825 826 831 832 835 844; 910; 792 803 894 926 932 990 |
| SUPERSEDED-BY | 2 | #908 (by the #903..#914 ER stack), #758 (by #809 S4 New event) |
| STILL-UNIQUE-REBASE-CHEAP (<= 10 conflicted files) | 11 | ER 903 904 905 911 912 914 916 917 919; #742; #884 |
| STILL-UNIQUE-REBASE-HEAVY | 0 | -- |
| UNCLEAR | 0 | -- |

**Organiser R1 -- the owner's question.** Every R1 screen is on main. PR **#809** (squash 9d283c57,
2026-10-20, 492 files) carried the WHOLE R1 stack, not only S1-S4 as its title says: its squash
body lists S0a, S0b, S1 Home, S2 change a date, S3 add/cancel, S4 New event, S5 events, S6 team,
S7 page/more, S9 door, S8, P-SERIES, P-DATES, F-PAR, SW1, REVIEW-SW1, FIX-SW1, INT4, FIX-INT4.
No R1 screen still has unique behaviour (per-screen table below). All 31 R1 PRs are closing candidates.

**What is still unique:** only the ER code (9 PRs, two lineages, see the ER section), #742 (hide
/videographers) and #884 (S13 background mockups). All 11 are under 10 conflicted files.

## Method (plain git; no `gh api`)

PR -> branch mapping from the GitHub PR list (open PRs, 2 pages). For each branch B:

1. **Commits ahead** = `git rev-list origin/main..B`. **Parent stack** = the remote head whose tip is
   an ancestor of B, not on main, and has the most commits ahead of main (`main` = none found).
2. **Squash-aware landing check.** Every commit subject in `main..B` was searched in the full commit
   MESSAGE of every main commit since 2026-10-01 (squash bodies list the squashed subjects).
   "x/y subj on main" in the table. Unfound subjects were almost all `merge ...` commits, which a
   squash never lists, and the review doc commits themselves.
3. **File content** for every file B changed vs its merge base with main: `equal` (same blob as main),
   `main-has` (>= 90% of B's added lines are present in main's version: main equal or newer/superset),
   `still-unique` (otherwise, including files B adds that main does not have and files main later
   deleted). A still-unique count on a LANDED branch means main changed the file AFTER the squash
   (evidence column names the main commit where I checked one).
4. **Conflicts** = `git merge-tree --write-tree --name-only origin/main B`, conflicted path count.
5. Review-only: the branch's own commits (vs its parent) only add docs/screens; the code under it was
   checked as in 2-3. ER lineages: each ER branch's code was also compared to the `er-c8-eventpage`
   tip (#914) with the same rule.

Large conflict counts on REVIEW-ONLY branches (e.g. #766: 236) are from the stale code they carry,
not from the review text; nobody needs to resolve them if they are closed.

### Account / journey

| PR | branch | parent stack | commits ahead of main | files vs merge base: equal / main-has / still-unique | conflicted files | verdict | evidence |
|---|---|---|---|---|---|---|---|
| #766 | `review-764` | main | 4 (3/4 subj on main) | 257: 7/240/10 | 236 | **REVIEW-ONLY** | reviews #764 = LANDED (593971cf); own new work is 1 review doc |
| #767 | `journey-matrix` | main | 6 (4/6 subj on main) | 257: 9/239/9 | 235 | **REVIEW-ONLY** | own work = journey-matrix doc; code under it is #764 = LANDED (593971cf) |
| #768 | `account-system-plan` | journey-matrix | 9 (4/9 subj on main) | 265: 13/242/10 | 239 | **REVIEW-ONLY** | own work = account-system plan docs (3 commits, docs only); account system LANDED via #775 (ecc3432e) |
| #772 | `account-grid-1a` | main | 1 (1/1 subj on main) | 16: 11/4/1 | 5 | **LANDED** | 1/1 subject in #775 squash ecc3432e; 11/16 files equal to main, 1 test diverged (main newer) |
| #773 | `account-grid-1b` | main | 1 (1/1 subj on main) | 12: 8/4/0 | 3 | **LANDED** | 1/1 subject in #775 squash ecc3432e; 0 code files unique |
| #776 | `account-grid-3ad` | account-grid-1b | 7 (6/7 subj on main) | 66: 31/30/5 | 28 | **LANDED** | 6/6 non-merge subjects in #775 ecc3432e; 5 diverged files are main-newer |
| #777 | `account-grid-3c` | account-grid-1b | 7 (6/7 subj on main) | 52: 28/20/4 | 21 | **LANDED** | 6/6 non-merge subjects in #775 ecc3432e |
| #778 | `account-grid-3ad-review` | account-grid-1b | 7 (5/7 subj on main) | 68: 27/27/14 | 29 | **REVIEW-ONLY** | slice 3a+3d review doc; reviewed code LANDED via #775 ecc3432e |
| #779 | `account-grid-3c-review` | account-grid-1b | 7 (5/7 subj on main) | 50: 25/19/6 | 21 | **REVIEW-ONLY** | REVIEW-3C doc; reviewed code LANDED via #775 ecc3432e |
| #780 | `account-grid-3b` | account-grid-3c | 13 (10/13 subj on main) | 98: 49/39/10 | 42 | **LANDED** | 10/10 non-merge subjects in #775 ecc3432e |
| #781 | `account-grid-3b-review` | account-grid-3b | 14 (10/14 subj on main) | 99: 49/39/11 | 42 | **REVIEW-ONLY** | own diff = 1 review doc; slice 3b LANDED via #775 |
| #782 | `account-pack-draft` | account-grid-3b | 18 (13/18 subj on main) | 126: 53/63/10 | 39 | **REVIEW-ONLY** | merge-train review pack (27 new docs, 1 code line); #775 LANDED |

### Dancer app

| PR | branch | parent stack | commits ahead of main | files vs merge base: equal / main-has / still-unique | conflicted files | verdict | evidence |
|---|---|---|---|---|---|---|---|
| #787 | `djf-dancer-app` | main | 6 (6/6 subj on main) | 84: 27/29/28 | 49 | **LANDED** | 6/6 subjects in #789 squash c36fbafd |
| #788 | `djf-auth-chrome` | main | 8 (8/8 subj on main) | 36: 14/17/5 | 15 | **LANDED** | 8/8 subjects in #789 squash c36fbafd |
| #817 | `dancer-app-r1b-app` | main | 1 (1/1 subj on main) | 30: 6/15/9 | 17 | **LANDED** | 1/1 subject in #821 squash 0a9d2d4e; 9 diverged files are main-newer |
| #819 | `dancer-app-r1b-public` | main | 2 (2/2 subj on main) | 23: 14/5/4 | 9 | **LANDED** | 2/2 subjects in #821 squash 0a9d2d4e |
| #820 | `dancer-app-r1b-lock` | main | 2 (2/2 subj on main) | 9: 1/0/8 | 6 | **LANDED** | 2/2 subjects in #821 0a9d2d4e; useGoingLock.ts later removed on main by #992 (464c4eb3) |
| #822 | `review-dancer-app-r1b` | dancer-app-r1b-lock | 9 (5/9 subj on main) | 63: 21/20/22 | 32 | **REVIEW-ONLY** | B1b review doc; reviewed r1b LANDED via #821 0a9d2d4e |

### Organiser R1 (cumulative stack)

| PR | branch | parent stack | commits ahead of main | files vs merge base: equal / main-has / still-unique | conflicted files | verdict | evidence |
|---|---|---|---|---|---|---|---|
| #790 | `org-r1-shell` | main | 3 (3/3 subj on main) | 22: 11/4/7 | 7 | **LANDED** | S0a: 3/3 subjects in #809 squash 9d283c57 |
| #793 | `org-r1-core` | main | 3 (3/3 subj on main) | 24: 9/10/5 | 12 | **LANDED** | S0b: 3/3 subjects in #809 9d283c57 |
| #796 | `org-r1-home` | feat/organiser-r1 | 11 (9/11 subj on main) | 68: 27/22/19 | 26 | **LANDED** | S1 Home: 9/9 non-merge subjects in #809; StaleLink.tsx removed in-stack by F-INT e04dea00 |
| #798 | `org-r1-change` | feat/organiser-r1 | 11 (9/11 subj on main) | 66: 22/26/18 | 34 | **LANDED** | S2 change a date: 9/9 non-merge subjects in #809; Day.tsx later removed on main by #880 (C20) |
| #801 | `org-r1-addcancel` | feat/organiser-r1 | 10 (8/10 subj on main) | 64: 28/22/14 | 29 | **LANDED** | S3 add/cancel: 8/8 non-merge subjects in #809 |
| #804 | `org-r1-new` | feat/organiser-r1 | 10 (8/10 subj on main) | 61: 22/21/18 | 28 | **LANDED** | S4 New event: 8/8 non-merge subjects in #809 |
| #811 | `org-r1-events` | org-r1-change | 27 (22/27 subj on main) | 171: 74/50/47 | 65 | **LANDED** | S5 events: 22/22 non-merge subjects in #809 |
| #812 | `org-r1-team` | org-r1-change | 27 (22/27 subj on main) | 149: 54/56/39 | 67 | **LANDED** | S6 team: 22/22 non-merge subjects in #809 |
| #815 | `org-r1-pagemore` | org-r1-change | 25 (20/25 subj on main) | 150: 51/55/44 | 69 | **LANDED** | S7 page/more: 20/20 non-merge subjects in #809 |
| #818 | `org-r1-door` | org-r1-change | 24 (19/24 subj on main) | 139: 47/52/40 | 68 | **LANDED** | S9 door: 19/19 non-merge subjects in #809 |
| #826 | `org-r1-parity` | org-r1-team | 44 (34/44 subj on main) | 290: 154/71/65 | 74 | **REVIEW-ONLY** | R-PARITY audit doc (not on main); code under it LANDED via #809 |
| #828 | `org-r1-parity-series` | org-r1-team | 47 (38/47 subj on main) | 320: 182/73/65 | 80 | **LANDED** | P-SERIES: 38/38 non-merge subjects in #809 |
| #829 | `org-r1-parity-dates` | org-r1-team | 45 (36/45 subj on main) | 298: 161/74/63 | 80 | **LANDED** | P-DATES: 36/36 non-merge subjects in #809 |
| #837 | `org-r1-parity-sw1` | org-r1-parity-series | 56 (46/56 subj on main) | 409: 270/73/66 | 81 | **LANDED** | SW1: 46/46 non-merge subjects in #809 |
| #839 | `org-r1-parity-sw1-fix` | org-r1-review-SW1 | 59 (49/59 subj on main) | 426: 287/72/67 | 82 | **LANDED** | FIX-SW1: 49/49 non-merge subjects in #809 |
| #791 | `org-r1-review-S0a` | main | 3 (2/3 subj on main) | 27: 9/10/8 | 7 | **REVIEW-ONLY** | REVIEW-S0a doc; S0a LANDED via #809 |
| #794 | `org-r1-review-S0b` | main | 3 (2/3 subj on main) | 25: 6/13/6 | 15 | **REVIEW-ONLY** | REVIEW-S0b doc; S0b LANDED via #809 |
| #799 | `org-r1-review-S1` | feat/organiser-r1 | 11 (8/11 subj on main) | 69: 24/24/21 | 29 | **REVIEW-ONLY** | REVIEW-S1 doc; S1 LANDED via #809 |
| #800 | `org-r1-review-S2` | feat/organiser-r1 | 11 (8/11 subj on main) | 67: 21/24/22 | 35 | **REVIEW-ONLY** | REVIEW-S2 doc; S2 LANDED via #809 |
| #805 | `org-r1-review-S3` | feat/organiser-r1 | 10 (7/10 subj on main) | 65: 23/25/17 | 34 | **REVIEW-ONLY** | REVIEW-S3 doc; S3 LANDED via #809 |
| #813 | `org-r1-review-S5` | org-r1-change | 27 (21/27 subj on main) | 170: 67/54/49 | 70 | **REVIEW-ONLY** | REVIEW-S5 doc; S5 LANDED via #809 |
| #814 | `org-r1-review-S6` | org-r1-change | 26 (20/26 subj on main) | 148: 47/61/40 | 73 | **REVIEW-ONLY** | REVIEW-S6 doc; S6 LANDED via #809 |
| #816 | `org-r1-review-S7` | org-r1-change | 25 (19/25 subj on main) | 151: 49/56/46 | 71 | **REVIEW-ONLY** | REVIEW-S7 doc; S7 LANDED via #809 |
| #823 | `org-r1-review-INTA` | org-r1-team | 43 (33/43 subj on main) | 257: 113/74/70 | 88 | **REVIEW-ONLY** | REVIEW-INT-A doc of #809; #809 LANDED |
| #824 | `org-r1-review-INTB` | org-r1-team | 43 (33/43 subj on main) | 326: 113/139/74 | 88 | **REVIEW-ONLY** | REVIEW-INT-B doc + ~70 shots; #809 LANDED |
| #825 | `org-r1-walk-final` | org-r1-team | 44 (34/44 subj on main) | 436: 154/216/66 | 74 | **REVIEW-ONLY** | WALK-FINAL doc + ~150 shots; #809 LANDED |
| #831 | `org-r1-review-PARB` | org-r1-parity-series | 53 (42/53 subj on main) | 421: 209/148/64 | 84 | **REVIEW-ONLY** | REVIEW-PAR-B doc + ~70 shots; parity pass LANDED via #809 |
| #832 | `org-r1-review-PARA` | org-r1-parity-series | 53 (42/53 subj on main) | 350: 209/77/64 | 84 | **REVIEW-ONLY** | REVIEW-PAR-A doc; parity pass LANDED via #809 |
| #835 | `org-r1-review-PARC` | org-r1-parity-series | 55 (44/55 subj on main) | 377: 232/83/62 | 75 | **REVIEW-ONLY** | REVIEW-PAR-C doc; F-PAR LANDED via #809 |
| #838 | `org-r1-review-SW1` | org-r1-parity-sw1 | 57 (47/57 subj on main) | 410: 271/73/66 | 81 | **LANDED** | REVIEW-SW1 commit itself is in the #809 squash body (47/47 non-merge subjects) |
| #844 | `org-r1-review-INT4` | org-r1-parity-sw1-fix | 67 (55/67 subj on main) | 448: 310/73/65 | 81 | **REVIEW-ONLY** | REVIEW-INT4 doc; INT4 + FIX-INT4 LANDED via #809 |

### Organiser rebuild (ER)

| PR | branch | parent stack | commits ahead of main | files vs merge base: equal / main-has / still-unique | conflicted files | verdict | evidence |
|---|---|---|---|---|---|---|---|
| #903 | `er-s1-rules` | main | 5 (0/5 subj on main) | 33: 0/1/32 | 4 | **STILL-UNIQUE-REBASE-CHEAP** | ER-S1 rules/lookup/switch: 0/4 subjects on main; eventRules.ts, rebuildSwitch.ts absent on main; fully contained in #914 |
| #904 | `er-c5-venue` | er-s1-rules | 10 (0/10 subj on main) | 44: 0/1/43 | 4 | **STILL-UNIQUE-REBASE-CHEAP** | ER-C5 venue: venue/VenuePicker.tsx absent on main; contained in #914 |
| #905 | `er-c4-sessions` | er-s1-rules | 11 (0/11 subj on main) | 48: 0/2/46 | 4 | **STILL-UNIQUE-REBASE-CHEAP** | ER-C4 sessions: sessions/SessionSheet.tsx absent on main; contained in #914 |
| #908 | `er-wave1` | er-ui-ember | 15 (2/15 subj on main) | 67: 21/2/44 | 2 | **SUPERSEDED-BY #903..#914 ER stack** | older wave-1 merge (S1+C4+C5+ui-ember); vs #914 tip: 27 code files equal, 19 contained, 8 are pre-FIX2 versions (e.g. VenuePicker before the one-sheet fix) |
| #910 | `review-er-wave1` | main | 8 (1/8 subj on main) | 57: 15/5/37 | 5 | **REVIEW-ONLY** | ER-W1 review of wave 1 (#908 lineage, SUPERSEDED); its fixes (ER-FIX-C3/C4) ride in #903..#914 |
| #911 | `er-c6-public` | main | 2 (0/2 subj on main) | 30: 0/0/30 | 1 | **STILL-UNIQUE-REBASE-CHEAP** | ER-C6 public facts: event-page/publicFacts.ts absent on main; sits on OLD wave-1 lineage; ER-AUDIT #955 said REBUILD |
| #912 | `er-c7-new` | main | 8 (1/8 subj on main) | 66: 15/7/44 | 8 | **STILL-UNIQUE-REBASE-CHEAP** | ER-C7 New event: flows/new/NewFlow.tsx 180/230 added lines not on main; OLD wave-1 lineage; ER-AUDIT #952 said REBUILD |
| #914 | `er-c8-eventpage` | er-c11-organisers | 47 (1/47 subj on main) | 112: 0/6/106 | 7 | **STILL-UNIQUE-REBASE-CHEAP** | ER stack tip: carries #903 #904 #905 #917 #919; EventPage.tsx, organisers/, sessions/, venue/ absent on main; 1/47 subjects on main |
| #916 | `er-c10-festival` | main | 8 (1/8 subj on main) | 67: 15/5/47 | 5 | **STILL-UNIQUE-REBASE-CHEAP** | ER-C10 festival: events/festival/* (9 files) absent on main; OLD wave-1 lineage; ER-AUDIT #954 said REBUILD write path |
| #917 | `er-c9-dates` | er-c4-sessions | 27 (1/27 subj on main) | 72: 0/2/70 | 4 | **STILL-UNIQUE-REBASE-CHEAP** | ER-C9 dates: dates/dateChanges.ts absent on main; contained in #914 |
| #919 | `er-c11-organisers` | er-c9-dates | 35 (1/35 subj on main) | 84: 0/2/82 | 4 | **STILL-UNIQUE-REBASE-CHEAP** | ER-C11 co-organisers: organisers/* absent on main; contained in #914 |

### People / areas / search

| PR | branch | parent stack | commits ahead of main | files vs merge base: equal / main-has / still-unique | conflicted files | verdict | evidence |
|---|---|---|---|---|---|---|---|
| #847 | `people-b-web1-areas` | main | 2 (2/2 subj on main) | 46: 32/9/5 | 14 | **LANDED** | 2/2 subjects in #897 squash 5955daf9 |
| #850 | `search-v7-web` | main | 2 (2/2 subj on main) | 15: 3/8/4 | 6 | **LANDED** | 2/2 subjects in #851 squash c47ce6b7; searchV7 in 6 src files on main |
| #895 | `people-b-web4` | main | 1 (1/1 subj on main) | 25: 9/14/2 | 12 | **LANDED** | 1/1 subject in #897 5955daf9 |
| #896 | `people-b-web3` | people-b-web1-areas | 4 (3/4 subj on main) | 75: 48/15/12 | 20 | **LANDED** | all non-merge subjects in #897 5955daf9; invitePreview.ts later removed on main by a5a44c9e |

### Other

| PR | branch | parent stack | commits ahead of main | files vs merge base: equal / main-has / still-unique | conflicted files | verdict | evidence |
|---|---|---|---|---|---|---|---|
| #742 | `hide-videographers-page` | main | 2 (0/2 subj on main) | 10: 0/1/9 | 2 | **STILL-UNIQUE-REBASE-CHEAP** | 0/2 subjects on main; VIDEOGRAPHERS_PUBLIC_ENABLED absent; /videographers still routed + in sitemap on main |
| #758 | `event-creation-w1` | main | 4 (0/4 subj on main) | 15: 0/2/13 | 10 | **SUPERSEDED-BY #809 S4 New event flow** | edits NewEventPage.tsx/newEvent.ts which #809 retired (5 of its files deleted on main); 0/4 subjects on main |
| #792 | `review-789` | djf-auth-chrome | 32 (28/32 subj on main) | 156: 64/59/33 | 69 | **REVIEW-ONLY** | review of #789 = LANDED (c36fbafd) |
| #803 | `review-vercel-build-budget` | main | 2 (1/2 subj on main) | 17: 0/12/5 | 13 | **REVIEW-ONLY** | review of #802 = LANDED (56c45874) |
| #884 | `s13-site-background` | s12-mockups | 7 (0/7 subj on main) | 144: 0/126/18 | 1 | **STILL-UNIQUE-REBASE-CHEAP** | S13 background mockups (41 docs + s13Background.tsx, GlobalLayout 8 lines); stacked on #883>#882>#877>#875>#871 mockups, none on main |
| #894 | `w1-review` | w1-s1-lists | 10 (6/10 subj on main) | 91: 63/14/14 | 22 | **REVIEW-ONLY** | review of #893 = LANDED (66d65517) |
| #926 | `review-restyle-a` | people-b-web3 | 13 (9/13 subj on main) | 177: 105/53/19 | 50 | **REVIEW-ONLY** | review of Release B restyle slice A; slice LANDED via #897 5955daf9 |
| #932 | `review-restyle-b` | er-ui-ember | 8 (5/8 subj on main) | 142: 76/50/16 | 48 | **REVIEW-ONLY** | review of #925 = LANDED (3bbea896) |
| #990 | `review-design-977` | main | 14 (13/14 subj on main) | 63: 25/30/8 | 32 | **REVIEW-ONLY** | design critique of #977 = LANDED (e32b2239) |

## Organiser R1, per screen (owner's explicit question)

Main's organiser module today is R1 (from #809) plus later main work: #880 (removed "Move to another
day", C20), #885 (Go live needs a session), #869 (A1 + AW1 gates on), #757 (W3 one life mapping),
#933/#929 (Arc 1 onboarding / Go live), #998 (going parts). Comparing each R1 branch to #809's own
tree (9d283c57): the residual differences are earlier versions inside the same stack that later R1
fix passes rewrote, not lost behaviour.

| screen | R1 PR | in #809 squash? | still unique behaviour? |
|---|---|---|---|
| shell (no tabs, account gate, ORG_PATHS v2) | #790 S0a | yes | no -- routes.test / OrganiserRoutes diffs are pre-fix-pass versions |
| core (home jobs, date lists, runCommands) | #793 S0b | yes | no |
| home | #796 S1 | yes | no -- StaleLink.tsx was removed inside the stack by F-INT (e04dea00) |
| change a date | #798 S2 | yes | no -- its Day step ("Move to another day") was deliberately removed on main by #880 (C20) |
| add / cancel a date | #801 S3 | yes | no |
| new event | #804 S4 | yes | no |
| events (my events, one event, details) | #811 S5 | yes | no |
| team | #812 S6 | yes | no |
| page / more / help | #815 S7 | yes | no |
| door (find your page, claim, ask to join) | #818 S9 | yes | no |
| parity audit | #826 | doc only | the R-PARITY audit doc is not on main (REVIEW-ONLY) |
| parity series | #828 P-SERIES | yes | no -- DetailsExtras.tsx was folded into seriesExtras.ts in-stack |
| parity dates | #829 P-DATES | yes | no |
| parity SW1 / SW1 fix | #837 / #839 | yes | no |

The ER rebuild has NOT replaced these screens on main: no ER code is on main. ER lives only in its
open PRs (behind its own switch, `rebuildSwitch.ts`, also not on main).

## Per group: recommended action, in order (FOR THE OWNER TO DECIDE)

### Organiser R1 (31 PRs)
1. **Close** the 15 code PRs (790 793 796 798 801 804 811 812 815 818 828 829 837 838 839): LANDED via #809.
2. **Close** the 16 review/walk PRs (791 794 799 800 805 813 814 816 823 824 825 826 831 832 835 844):
   their findings were consumed by fix passes that are in #809. If the review text is wanted as a
   record, copy the docs into one docs-only PR first (most of the shots are already on main:
   e.g. #844 70/71 own docs, #823 37/38 are byte-identical on main).
3. **Leave** nothing; no rebase needed.

### Organiser rebuild ER (11 PRs)
Two lineages: (a) the NEW stack #903 -> #904/#905 -> #917 -> #919 -> **#914** (tip carries all five,
with the FIX2 passes); (b) the OLD wave-1 lineage #908 -> #910, #911, #912, #916 (built on the
pre-review wave-1 merges).
1. **Decide first** whether ER continues as built or the P3 redesign (open docs PRs #982-#1003,
   C3 mockup and test page) replaces it. If P3 replaces it, all 11 become SUPERSEDED; nothing to rebase.
2. If ER continues: **close #908** (SUPERSEDED by the new stack) and **#910** (review of #908's code,
   fixes ride in #903). **Rebase only #914** (7 conflicted files; one worker per arc) and close
   #903 #904 #905 #917 #919 as contained in it once #914 is rebased -- or rebase in order bottom-up
   (4 conflicted files each) if separate review per slice is wanted.
3. **#911 / #912 / #916**: still unique (public facts, New event, festival) but sit on the OLD
   lineage, so a rebase means onto the #914 stack, not plain main. The open ER-AUDIT PRs say REBUILD
   for all three (#955 C6, #952 C7, #954 C10 write path) -- recommend close-and-rebuild over rebase.

### Account / journey (12 PRs)
1. **Close** 772 773 776 777 780 (LANDED via #775; open PR #1021 reached the same conclusion).
2. **Close** 766 767 768 778 779 781 782 (review/plan/review-pack docs; the code is LANDED via #764 /
   #775). Copy the journey matrix (#767) / account plan (#768) into a docs PR first only if still wanted.

### Dancer app (6 PRs)
1. **Close** 787 788 (LANDED via #789) and 817 819 820 (LANDED via #821; #820's Going lock was later
   replaced on main by #992).
2. **Close** 822 (review of LANDED #821).

### People / areas / search (4 PRs)
1. **Close** 847 895 896 (LANDED via #897) and 850 (LANDED via #851).

### Other (9 PRs)
1. **Close** 792 803 894 926 932 990 (reviews of LANDED #789, #802, #893, Release B slice A, #925, #977).
2. **Close** #758 (SUPERSEDED: it edits NewEventPage/newEvent, which #809 retired for the S4 New
   event flow; ER-C7 #912 is the later rebuild of New event).
3. **Decide #742** (hide /videographers behind VIDEOGRAPHERS_PUBLIC_ENABLED): still unique, 2
   conflicted files -> rebase if still wanted, else close.
4. **Decide #884** (S13 site background mockups): still unique design record, 1 conflicted file,
   but stacked on five open mockup PRs (#883 #882 #877 #875 #871) none of which is on main; the
   people arc has since moved on (#975 wall, #999 worlds). Recommend close the whole S8-S13 mockup
   chain unless the owner still wants the S13 decision.

## Verified
- All 73 branches fetched and compared to origin/main 4791d9f2 with full history (unshallowed clone).
- Squash-body subject check for every commit of every branch (counts in the table).
- File-content comparison (equal / main-has / still-unique) for every file each branch changes.
- Conflicted-file counts from `git merge-tree --write-tree` on git 2.43.
- #809's squash body read: lists every R1 slice through FIX-INT4.
- ER code absent on main: `git grep` for rebuildSwitch / eventRules / RuleSeries / SessionSheet /
  VenuePicker / FestivalCreate / publicFacts finds nothing new on main (one unrelated hit in
  flows/change/Venue.tsx).
- Spot checks of "main-newer" claims: useGoingLock.ts (#992), Day.tsx (#880), StaleLink.tsx (e04dea00),
  DetailsExtras.tsx (folded into seriesExtras.ts in #809's tree), invitePreview.ts (a5a44c9e).

## Not verified
- The line-containment rule is a heuristic (>= 90% of added lines present, whitespace-trimmed); a
  LANDED verdict rests on the squash-body subject match, the content numbers are supporting evidence.
- I did not read the review docs to check that every finding was fixed; REVIEW-ONLY says only that
  the reviewed code is on main.
- Whether ER or the P3 redesign is the way forward is an owner decision; this audit cannot tell.
- No CI, no Vercel, no Supabase used (none needed for a read-only git audit).
- PR state was read once (the GitHub PR list); PRs changed after that are not reflected.
