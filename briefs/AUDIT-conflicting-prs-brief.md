# AUDIT -- the 73 CONFLICTING open PRs: what still matters? (READ-ONLY)

Lane: normal, READ-ONLY. You change no PR, push no PR branch, close nothing, merge nothing. Your only push is ONE commit to `claude/audit-conflicting-prs` with the report (path below), whose subject ends with the done marker from your prompt.

## Why (owner words and the finding)
Owner 2026-10-24: "ONE REBASE WORKER PER ARC ... nothing closed" and "Check if superseded first". PR Mergeable Guard fails main because 73 open PRs are CONFLICTING with main. A live paginated sweep showed NONE is docs-only: the "docs/review" PRs (e.g. `claude/org-r1-review-S5`, `claude/review-764`) are branched on top of unmerged code branches, so they carry 257-448 files. Before anyone spends rebase effort we need to know which PRs still add anything. Main moved ~88+ commits (the organiser rebuild "ER", the people arc, going, the dancer app all landed in part).

## The 73 (number branch), grouped
- Account/journey: #766 review-764, #767 journey-matrix, #768 account-system-plan, #772 account-grid-1a, #773 account-grid-1b, #776 account-grid-3ad, #777 account-grid-3c, #778 account-grid-3ad-review, #779 account-grid-3c-review, #780 account-grid-3b, #781 account-grid-3b-review, #782 account-pack-draft
- Dancer app: #787 djf-dancer-app, #788 djf-auth-chrome, #817 dancer-app-r1b-app, #819 dancer-app-r1b-public, #820 dancer-app-r1b-lock, #822 review-dancer-app-r1b
- Organiser R1 (cumulative stack): #790 org-r1-shell, #793 org-r1-core, #796 org-r1-home, #798 org-r1-change, #801 org-r1-addcancel, #804 org-r1-new, #811 org-r1-events, #812 org-r1-team, #815 org-r1-pagemore, #818 org-r1-door, #826 org-r1-parity, #828 org-r1-parity-series, #829 org-r1-parity-dates, #837 org-r1-parity-sw1, #839 org-r1-parity-sw1-fix, plus review/walk branches #791 #794 #799 #800 #805 #813 #814 #816 #823 #824 #825 #831 #832 #835 #838 #844 (all `claude/org-r1-review-*` / `org-r1-walk-final`)
- Organiser rebuild (ER): #903 er-s1-rules, #904 er-c5-venue, #905 er-c4-sessions, #908 er-wave1, #910 review-er-wave1, #911 er-c6-public, #912 er-c7-new, #914 er-c8-eventpage, #916 er-c10-festival, #917 er-c9-dates, #919 er-c11-organisers
- People/areas/search: #847 people-b-web1-areas, #850 search-v7-web, #895 people-b-web4, #896 people-b-web3
- Other: #742 hide-videographers-page, #758 event-creation-w1, #792 review-789, #803 review-vercel-build-budget, #884 s13-site-background, #894 w1-review, #926 review-restyle-a, #932 review-restyle-b, #990 review-design-977

## Method (git only; plain git, no `gh api`; fetch each branch)
For each PR branch B vs `origin/main`:
1. Own commits: `git log --oneline origin/main..origin/B` and the merge base. Name the parent stack branch it sits on (a branch whose tip is an ancestor of B).
2. Already on main? For each feature the PR adds, look for it on main (file exists with the same exports; subject text in `git log origin/main --grep`; a squash-merged `(#NNN)` subject). `git cherry` fails across squash merges, so compare FILE CONTENT: for each file the branch adds or changes relative to its own merge base, is main's version equal, a superset, or different? Count files: equal-to-main / main-newer / still-unique.
3. Conflict size: `git merge-tree --write-tree --name-only origin/main origin/B` conflicted file count.
4. Verdict per PR, exactly one of: `LANDED` (its content is on main: closing candidate), `SUPERSEDED-BY <PR/feature>` (main replaced it with a different design, say which), `STILL-UNIQUE-REBASE-CHEAP` (<= 10 conflicted files), `STILL-UNIQUE-REBASE-HEAVY`, `REVIEW-ONLY` (its own diff is only docs/review text; name the code branch it reviews and whether that branch is LANDED/SUPERSEDED), `UNCLEAR` (say what is needed).
5. For organiser R1: decide if the ER rebuild / main replaced the screens (home, change a date, add/cancel, new event, events, team, page/more, door, parity series/dates/sw1). Say PER SCREEN which still has unique behaviour. This is the owner's explicit question.

## Report
`docs/audit/conflicting-prs/REPORT.md` on `claude/audit-conflicting-prs`: a table (PR, branch, parent stack, commits, conflicted files, verdict, one-line evidence with the file or commit you compared), then a section per group with a recommended action in order (close / rebase / leave) FOR THE OWNER TO DECIDE, then Verified / Not verified. You recommend; you never act on a PR.

## Hard rules
- No PR changes, no branch deletion, no merge, no `supabase/**` writes (read-only if you use it at all; you should not need it).
- Stay under 50% context. If you cannot finish all 73, do the organiser R1 and ER groups first, then the rest, and mark the remainder `NOT AUDITED` with a PARTIAL commit.
- Counts and evidence only: do not paste file bodies into the report.
