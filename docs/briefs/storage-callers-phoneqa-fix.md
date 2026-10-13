# Brief: fix the phone-qa failure on PR #744 (Website)

Repo 123constante/bachata-website. Read CLAUDE.md first and docs/ui-quality-bar.md if present. Never merge, never --no-verify, push once. Push ONLY to `claude/storage-callers` (PR #744, head 8f99e58); you are the only worker on it.

## CI rule (owner decision 2026-10-13)
GitHub Actions on billed runners may refuse to start ("payments have failed"); that is not a code failure and the owner will not pay. Therefore YOU run every CI job step (read .github/workflows) in your sandbox and put a per-job table (command, exit code) in the PR body and handover. Do not wait on GitHub checks beyond one look at the end. Never ask for local-machine runs.

## Problem
CI job `phone-qa` on #744: 151 passed, 1 failed, retried and failed again: `overlap.phone-overlap-auth ... bottom controls tappable, phone 360x640` with `Error: horizontal page scroll @top` (page scrolls sideways at 360x640). #744 changed upload UIs (AvatarUpload, VendorPortal, VendorDashboardPage: new size/type error messages, file inputs `accept`, proxy upload) so a longer text or an input may now overflow at 360 px. The same job passed on the previous PR head, so the cause is probably in the last commits. Website PR #743 (account settings) passes the same job.

## Task
1. Run the phone-qa suite for that one spec locally in your sandbox (read .github/workflows/phone-qa.yml for the exact command and env), reproduce, and find which element is wider than the viewport (measure scrollWidth vs clientWidth and the offending element rect).
2. Fix the layout (wrap/min-width:0/overflow-wrap on the message or container) without changing the message meaning. Add or extend a phone-size test that fails red on the unfixed code (360x640 and 390x844) and passes after.
3. Run the whole phone-qa job and the unit job as the workflows do; both must be green in your sandbox. Report anything that also fails on main separately.
4. Keep the PR body sections intact (`## Verified on real data` with its three lines, the Phone QA section); append a short "Phone QA fix" note and the per-job table.

## Output
New head SHA, per-job table, honest Verified / Not verified. Stop after the push.
