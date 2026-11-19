#!/usr/bin/env node
/**
 * Print the files a pull request changes, one per line, from the pulls API.
 * Needs no git history (a shallow checkout cannot find a merge base once the PR
 * base moves). Env: PR_API (the .../pulls/N/files URL), GITHUB_TOKEN.
 * Exit 1 on an API error. Used by phone-qa.yml's auto-walk step.
 */
const api = process.env.PR_API;
const token = process.env.GITHUB_TOKEN;
if (!api) {
  console.error('ci-pr-files: PR_API is not set');
  process.exit(1);
}
const headers = { Accept: 'application/vnd.github+json' };
if (token) headers.Authorization = `Bearer ${token}`;
const names = [];
for (let page = 1; page <= 30; page += 1) {
  const res = await fetch(`${api}?per_page=100&page=${page}`, { headers });
  if (!res.ok) {
    console.error(`ci-pr-files: files API answered ${res.status}`);
    process.exit(1);
  }
  const batch = await res.json();
  names.push(...batch.map((f) => f.filename));
  if (batch.length < 100) break;
}
console.log(names.join('\n'));
