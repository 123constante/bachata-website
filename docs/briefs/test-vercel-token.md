# Brief: test worker, can a cloud worker use VERCEL_TOKEN? (read-only, push NOTHING)

Repo 123constante/bachata-website. This is a connectivity test. Do not create, edit or push anything; do not open a PR. Never print the token value (print only whether it is set and its length).

1. `[ -n "$VERCEL_TOKEN" ] && echo "set, length ${#VERCEL_TOKEN}" || echo "NOT SET"`.
2. If set: `curl -sS -m 20 -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/user` and, if 200, print only the `username` field of the response (`| jq -r .user.username`).
3. List the 3 newest deployments of the Website project via the API (`GET https://api.vercel.com/v6/deployments?limit=3`, print only url, state, and the git branch from meta.githubCommitRef). No secrets in output.
4. Try `curl -sS -m 20 -o /dev/null -w "%{http_code}\n" https://bachata-website-93ekzig2o-rixz-4372s-projects.vercel.app/faq` (status code only; a 401/403 is an expected answer, just report it) and the same with `-H "Authorization: Bearer $VERCEL_TOKEN"`.
5. Report: for each step, the command shape (no secret) and the result or the exact error (for example "CONNECT tunnel failed, response 403" means the host is blocked by the environment's network allowlist). Do not retry a blocked host more than once and do not open any login page. Stop after the report.
