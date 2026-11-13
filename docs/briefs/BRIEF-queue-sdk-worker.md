# Brief: queue worker via Agent SDK (careful lane: workflow edit)

Why: run 43518771917 on #1645 failed `billing_error: Credit balance is too low`. The owner's $200 promo credit does not list Claude Code (claude-code-action) but does list the Agent SDK / API. So replace the claude-code-action step with a direct Agent SDK step. Smallest change, ONE PR, branch `claude/queue-sdk-worker`.

## Do
1. Create `scripts/queue-sdk-worker.mjs` with EXACTLY the content in the block at the bottom (self-test must pass: `node scripts/queue-sdk-worker.mjs --self-test`). Check `scripts/check-script-conventions.mjs` rules and wire any lint/test registration other scripts have (see how `scripts/queue-claim.mjs` is registered).
2. In `.github/workflows/queue-worker.yml` replace the step "Run the worker (Sonnet)" (the `anthropics/claude-code-action@v1.0.275` step, keep its `if`, `id: claude`, `timeout-minutes`) with TWO steps:
   - `Install the Agent SDK`, same `if`: `npm i --no-save --no-audit --no-fund @anthropic-ai/claude-agent-sdk@0.3.314` (verify that exact version exists and is at least 2 weeks old via `npm view`; else pick the newest one that is).
   - `Run the worker (Sonnet, Agent SDK)`, `id: claude`, same `if` and `timeout-minutes`, `env`: `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}`, `GH_TOKEN: ${{ secrets.BOT_PR_TOKEN }}`, `MODEL: claude-sonnet-5-5`, `TURNS: ${{ steps.branch.outputs.turns }}`, `EXEC_FILE: ${{ runner.temp }}/queue-exec.json`, `PROMPT` = the SAME prompt text as today (multi-line `|`, same `${{ }}` expressions: issue number, branch, turns, minutes, 80% marks). `run: |` `node scripts/queue-sdk-worker.mjs` then `echo "execution_file=$EXEC_FILE" >> "$GITHUB_OUTPUT"`.
   - Exit non-zero from the script must fail the step so the checkpoint step's `OUTCOME` logic still works. The checkpoint step is unchanged (it already reads `steps.claude.outputs.execution_file`).
3. Update `docs/queue.md` (it names claude-code-action): say the worker uses the Agent SDK and why (billing product).
4. Keep every other workflow part unchanged. No PR-controlled text in shell (issue text is read by the worker itself). Pin versions exactly.

## Acceptance
`workflow-lint`, `architecture-guard`, script self-test green at the PR head. Push as the bot; PR opened by bot-pr.yml. Workflow change needs the owner's Approve: say so in the PR body. List "Not verified": the real run (needs a queue-labelled issue and credit).

## Out of scope
Anything else in the queue; merging; secrets/variables; relabelling issues.

## `scripts/queue-sdk-worker.mjs` content
```js
#!/usr/bin/env node
/**
 * queue-sdk-worker.mjs -- run the queue worker through the Agent SDK (plain API key billing)
 * instead of anthropics/claude-code-action. Writes the message list to $EXEC_FILE as a JSON array
 * with the same `result` fields the checkpoint step already reads (total_cost_usd, num_turns,
 * is_error, api_error_status, terminal_reason). Exit 0 when the file was written; 2 = bad env.
 *
 *   ANTHROPIC_API_KEY, PROMPT, MODEL, TURNS, EXEC_FILE
 *   node scripts/queue-sdk-worker.mjs [--self-test]
 */
import { writeFileSync } from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';

export async function run(env, deps = {}) {
  const query = deps.query || (await import('@anthropic-ai/claude-agent-sdk')).query;
  const msgs = [];
  try {
    for await (const m of query({
      prompt: env.PROMPT,
      options: {
        model: env.MODEL,
        maxTurns: Number(env.TURNS),
        allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        cwd: process.cwd(),
      },
    })) msgs.push(m);
  } catch (e) {
    msgs.push({
      type: 'result',
      is_error: true,
      api_error_status: e.status || 'error',
      terminal_reason: String(e.message || e).slice(0, 200),
    });
  }
  if (!msgs.some((m) => m.type === 'result')) {
    msgs.push({ type: 'result', is_error: true, api_error_status: 'error', terminal_reason: 'no result message' });
  }
  writeFileSync(env.EXEC_FILE, JSON.stringify(msgs));
  return msgs;
}

export async function main(argv, env = process.env, deps = {}) {
  if (argv.includes('--self-test')) return selfTest();
  for (const k of ['ANTHROPIC_API_KEY', 'PROMPT', 'MODEL', 'TURNS', 'EXEC_FILE']) {
    if (!env[k]) {
      console.error(`${k} not set`);
      return 2;
    }
  }
  await run(env, deps);
  return 0;
}

async function selfTest() {
  const { mkdtempSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const file = join(mkdtempSync(join(tmpdir(), 'qsw-')), 'exec.json');
  const env = { ANTHROPIC_API_KEY: 'x', PROMPT: 'p', MODEL: 'm', TURNS: '3', EXEC_FILE: file };
  const last = () => JSON.parse(readFileSync(file, 'utf8')).at(-1);
  const ok = async function* () {
    yield { type: 'assistant' };
    yield { type: 'result', is_error: false, num_turns: 2, total_cost_usd: 0.1 };
  };
  await main([], env, { query: ok });
  if (last().num_turns !== 2 || last().is_error) {
    console.error('FAIL: result not kept');
    return 1;
  }
  const boom = async function* () {
    const e = new Error('Credit balance is too low');
    e.status = 400;
    throw e;
  };
  await main([], env, { query: boom });
  if (!last().is_error || last().api_error_status !== 400 || !last().terminal_reason.includes('Credit')) {
    console.error('FAIL: api error not recorded');
    return 1;
  }
  const none = async function* () {
    yield { type: 'assistant' };
  };
  await main([], env, { query: none });
  if (!last().is_error) {
    console.error('FAIL: missing result not flagged');
    return 1;
  }
  if ((await main([], {}, {})) !== 2) {
    console.error('FAIL: missing env must be exit 2');
    return 1;
  }
  console.log('queue-sdk-worker self-test ok');
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
```
