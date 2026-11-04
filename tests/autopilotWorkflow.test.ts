// .github/workflows/autopilot.yml contract. Line-ending agnostic: the repo checks out CRLF on
// Windows, so every assertion runs on the file as read AND on a CRLF copy of it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const RAW = readFileSync(path.resolve(__dirname, '../.github/workflows/autopilot.yml'), 'utf8');
const VARIANTS: [string, string][] = [
  ['as read', RAW],
  ['CRLF', RAW.replace(/\r?\n/g, '\r\n')],
];

for (const [label, text] of VARIANTS) {
  describe(`autopilot.yml (${label})`, () => {
    const wf = parse(text);
    const on = wf.on ?? wf[true as unknown as string];
    it('triggers: hourly schedule + workflow_dispatch only (no PR trigger of any kind)', () => {
      expect(Object.keys(on).sort()).toEqual(['schedule', 'workflow_dispatch']);
      expect(on.schedule[0].cron).toMatch(/^\d{1,2} \* \* \* \*$/);
      expect(text).not.toMatch(/pull_request_target|pull_request:/);
    });
    it('dispatch inputs: repos defaults to this repo, dry_run defaults to true', () => {
      const inp = on.workflow_dispatch.inputs;
      expect(inp.repos.default).toBe('123constante/bachata-website');
      expect(String(inp.dry_run.default)).toBe('true');
      expect(inp.dry_run.type).toBe('boolean');
    });
    it('its own concurrency group, never cancelling', () => {
      expect(wf.concurrency).toEqual({ group: 'autopilot', 'cancel-in-progress': false });
    });
    it('the main job: queue runner class, not on a fork, minimal permissions, main checkout, one node run', () => {
      const j = wf.jobs.autopilot;
      expect(j['runs-on']).toBe('ubuntu-latest');
      expect(j.if).toMatch(/!github\.event\.repository\.fork/);
      expect(Object.keys(j.permissions).sort()).toEqual(['actions', 'checks', 'contents', 'issues', 'pull-requests', 'statuses']);
      expect(j.permissions.contents).toBe('read');
      const co = j.steps.find((s: { uses?: string }) => /actions\/checkout/.test(s.uses ?? ''));
      expect(co.with.ref).toBe('${{ github.event.repository.default_branch }}');
      expect(co.with['persist-credentials']).toBe(false);
      const runs = j.steps.filter((s: { run?: string }) => s.run).map((s: { run: string }) => s.run.trim());
      expect(runs).toEqual(['node scripts/autopilot-step.mjs']);
    });
    it('the bot token is the queue\'s secret, passed only through env, never echoed', () => {
      const step = wf.jobs.autopilot.steps.find((s: { run?: string }) => s.run);
      expect(step.env.BOT_TOKEN).toBe('${{ secrets.BOT_PR_TOKEN }}');
      // r4: the merge lane's switch is a repo VARIABLE and its credential the automerge secret.
      expect(step.env.AUTOPILOT_MERGE_MODE).toBe('${{ vars.AUTOPILOT_MERGE_MODE }}');
      expect(step.env.AUTOMERGE_TOKEN).toBe('${{ secrets.AUTOMERGE_TOKEN }}');
      expect(text).not.toMatch(/pull_request_target|pull_request:/);
      expect(text).not.toMatch(/echo[^\n]*secrets\./);
    });
    it('r5 ships OFF: a schedule is live only with AUTOPILOT_LIVE=true; a dispatch only with dry_run false', () => {
      const env = wf.jobs.autopilot.steps.find((s: { run?: string }) => s.run).env;
      // N1 (review 1204-r1): an empty dry_run on a dispatch is a DRY run, never live.
      expect(env.DRY_RUN).toBe("${{ (github.event_name == 'schedule' && vars.AUTOPILOT_LIVE == 'true') && 'false' || (github.event_name == 'workflow_dispatch' && github.event.inputs.dry_run == 'false' && 'false' || 'true') }}");
    });
    it('a failed scheduled run announces itself (announce-failure pattern)', () => {
      const a = wf.jobs['announce-failure'];
      expect(a.needs).toEqual(['autopilot']);
      expect(a.if).toMatch(/failure\(\) && github\.event_name == 'schedule' && vars\.AUTOPILOT_LIVE == 'true'/);
      expect(a.permissions.issues).toBe('write');
    });
  });
}
