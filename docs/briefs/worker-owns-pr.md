# Brief: worker owns its PR to green + rebased (#1494, child of #1492), repo bachata-admin, careful lane
Change the dispatch-worker brief template so the worker, after opening its PR, fixes red checks and rebases when behind main, up to 2 rounds, then leaves the PR green or labelled `parked` with a reason comment.
Acceptance contract: Ricky x worker opens PR x red or behind main: worker fixes/rebases up to 2 rounds, then PR is green or parked with a reason.
Touches ~/.claude/bin scripts only if the template lives there; add a self-test for the new prompt text.
Issue: https://github.com/123constante/bachata-admin/issues/1494
