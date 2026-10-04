import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// scripts/hooks/ctx-gate-cloud.mjs: the cloud copy of the PC's 40% context gate. Spawned as a
// process, exactly as Claude Code runs it, with a synthetic transcript.
const HOOK = path.resolve(__dirname, '..', 'scripts', 'hooks', 'ctx-gate-cloud.mjs');
let dir: string;

const turn = (ctx: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'assistant',
    isSidechain: false,
    message: { usage: { input_tokens: 2, cache_read_input_tokens: ctx - 102, cache_creation_input_tokens: 100, output_tokens: 50 } },
    ...extra,
  });

function transcript(name: string, lines: string[]): string {
  const f = path.join(dir, name);
  fs.writeFileSync(f, lines.join('\n') + '\n');
  return f;
}

function run(transcriptPath: string | undefined, env: Record<string, string> = {}, event = 'PostToolUse') {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 's', transcript_path: transcriptPath, hook_event_name: event }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CODE_REMOTE: '', CTX_GATE_FORCE: '', CTX_GATE_PCT: '', CTX_GATE_WINDOW_TOKENS: '', ...env },
  });
  return { code: r.status, out: r.stdout };
}

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxgate-')); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('ctx-gate-cloud', () => {
  it('in a cloud session at or above 40% of the window, injects the wrap-up rule', () => {
    const f = transcript('hi.jsonl', [turn(100_000), turn(410_000)]);
    const { code, out } = run(f, { CLAUDE_CODE_REMOTE: 'true' });
    expect(code).toBe(0);
    const ctx = JSON.parse(out).hookSpecificOutput;
    expect(ctx.hookEventName).toBe('PostToolUse');
    expect(ctx.additionalContext).toContain('CONTEXT GATE (cloud): context is at 41%');
    expect(ctx.additionalContext).toContain('docs/session-handover-');
  });

  it('below the threshold says nothing', () => {
    const f = transcript('lo.jsonl', [turn(410_000), turn(399_000)]); // the NEWEST turn decides
    expect(run(f, { CLAUDE_CODE_REMOTE: 'true' }).out).toBe('');
  });

  it('on the PC (no CLAUDE_CODE_REMOTE) says nothing, however full: the PC has its own gate', () => {
    const f = transcript('pc.jsonl', [turn(900_000)]);
    expect(run(f).out).toBe('');
  });

  it('ignores sidechain (subagent) turns and partial or foreign lines', () => {
    const f = transcript('side.jsonl', [
      '{"type":"assistant","message":{"usage":{"input_tok', // a tail read can start mid-line
      turn(100_000),
      turn(950_000, { isSidechain: true }),
      '{"type":"user","message":{"content":"x"}}',
    ]);
    expect(run(f, { CLAUDE_CODE_REMOTE: '1' }).out).toBe('');
  });

  it('honours CTX_GATE_PCT and CTX_GATE_WINDOW_TOKENS, and echoes the event name', () => {
    const f = transcript('cfg.jsonl', [turn(90_000)]);
    const { out } = run(f, { CTX_GATE_FORCE: '1', CTX_GATE_PCT: '40', CTX_GATE_WINDOW_TOKENS: '200000' }, 'UserPromptSubmit');
    const ctx = JSON.parse(out).hookSpecificOutput;
    expect(ctx.hookEventName).toBe('UserPromptSubmit');
    expect(ctx.additionalContext).toContain('45% (90K of 200K, limit 40%)');
  });

  it('fails silent on a missing transcript, a missing path, or bad stdin', () => {
    expect(run(path.join(dir, 'nope.jsonl'), { CLAUDE_CODE_REMOTE: 'true' })).toEqual({ code: 0, out: '' });
    expect(run(undefined, { CLAUDE_CODE_REMOTE: 'true' })).toEqual({ code: 0, out: '' });
    const r = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_REMOTE: 'true' } });
    expect([r.status, r.stdout]).toEqual([0, '']);
  });

  it('is registered on PostToolUse AND UserPromptSubmit in the project settings', () => {
    const s = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
    for (const ev of ['PostToolUse', 'UserPromptSubmit']) {
      const cmds = (s.hooks[ev] as Array<{ matcher?: string; hooks: Array<{ command: string }> }>)
        .filter((g) => !g.matcher)
        .flatMap((g) => g.hooks.map((h) => h.command));
      expect(cmds.some((c) => c.includes('scripts/hooks/ctx-gate-cloud.mjs')), ev).toBe(true);
    }
  });
});
