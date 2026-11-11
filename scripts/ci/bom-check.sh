#!/usr/bin/env bash
# BOM check for .github/workflows (moved out of workflow-lint.yml so the routed and the
# hosted job run the same lines). Exit 0 clean, 1 a BOM found. Uses od(1) (coreutils),
# not xxd: without xxd the old inline loop read every file as clean (fail open).
FAILED=0
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [ -f "$f" ] || continue
  # Detect standard BOM (ef bb bf) or double-encoded BOM (c3 af ...)
  FIRST=$(od -An -tx1 -N3 "$f" | tr -d " \n")
  if [ "$FIRST" = "efbbbf" ] || echo "$FIRST" | grep -q "^c3af"; then
    echo "BOM detected in $f (first bytes: $FIRST)"
    FAILED=1
  fi
done
if [ "$FAILED" = "1" ]; then
  echo ""
  echo "Fix: strip the BOM and re-write via safe-write.py --lf"
  exit 1
fi
echo "No BOMs found in .github/workflows/"
