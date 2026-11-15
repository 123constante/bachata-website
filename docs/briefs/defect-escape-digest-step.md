# Brief: defect-escape-digest-step

Branch: claude/defect-escape-digest-step (off main). Hard tier (workflow file). One PR, bot-authored.

Narrow exception (owner click 2026-11-15), Website repo only, ONLY for the branch claude/defect-escape-digest-step: in .github/workflows/weekly-digest.yml you may add ONE report step (node scripts/defect-escape.mjs --markdown appended to digest.md, continue-on-error with a soft-signal comment) and its header comment lines. Never change triggers (on:), runs-on, secrets, pull_request_target, or widen permissions, and touch no other workflow file. The PR is hard tier and needs independent review.

## Job
In .github/workflows/weekly-digest.yml add, directly after the "Append rework-share section" step and before "Append footer":

    - name: Append defect-escape section
      # soft-signal: report channel, not a gate (same reasoning as the rework-share step above)
      continue-on-error: true
      run: |
        {
          echo ""
          node scripts/defect-escape.mjs --markdown || echo "_defect escape unavailable this week_"
        } >> digest.md

Also add one line to the header comment list (near line 11): "- defect escape count (defect-escape.mjs --markdown)".
No env block, no secrets. The script exists on main (scripts/defect-escape.mjs); verify with: node scripts/defect-escape.mjs --markdown (exit 0 expected).

## Done when
PR open, diff is only those lines, Workflow Lint green. Report the PR number.
