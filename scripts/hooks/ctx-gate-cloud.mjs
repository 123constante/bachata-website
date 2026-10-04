#!/usr/bin/env node
// Cloud context wrap-up gate (PostToolUse + UserPromptSubmit). The PC's gate lives in the
// owner's ~/.claude (never cloned into a cloud session) and reads a percentage the STATUS LINE
// records -- a headless cloud run draws no status line, so that file is never written. This hook
// measures for itself: the last main-thread assistant turn's usage in `transcript_path`
// (input + cache_read + cache_creation = the context that turn carried), over the window.
//
// Active only in a cloud session (CLAUDE_CODE_REMOTE), so the PC keeps its own gate and never
// gets the rule twice. Fails silent: any missing or unreadable input -> no output, exit 0.
//
// Same file in bachata-admin and bachata-website; keep them identical.
//   CTX_GATE_PCT            threshold percent (default 40, the PC's)
//   CTX_GATE_WINDOW_TOKENS  context window (default 1000000; the PC sessions run 1M)
//   CTX_GATE_FORCE=1        run outside the cloud (tests)
import fs from 'node:fs';

const PCT = Number(process.env.CTX_GATE_PCT) || 40;
const WINDOW = Number(process.env.CTX_GATE_WINDOW_TOKENS) || 1_000_000;
const TAIL_BYTES = 4 * 1024 * 1024;

const remote = /^(1|true)$/i.test(process.env.CLAUDE_CODE_REMOTE || '');
if (!remote && process.env.CTX_GATE_FORCE !== '1') process.exit(0);

let payload;
try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const file = payload.transcript_path;
if (!file) process.exit(0);

/** Context carried by the newest main-thread assistant turn, or null. */
function lastContextTokens(text) {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.includes('"assistant"') || !line.includes('"usage"')) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; } // the first line of a tail read is partial
    if (row.type !== 'assistant' || row.isSidechain) continue;
    const u = row.message && row.message.usage;
    if (!u) continue;
    const n = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    if (n > 0) return n;
  }
  return null;
}

let text;
try {
  const fd = fs.openSync(file, 'r');
  const size = fs.fstatSync(fd).size;
  const len = Math.min(size, TAIL_BYTES);
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, size - len);
  fs.closeSync(fd);
  text = buf.toString('utf8');
} catch { process.exit(0); }

const tokens = lastContextTokens(text);
if (tokens === null) process.exit(0);
const pct = (tokens / WINDOW) * 100;
if (pct < PCT) process.exit(0);

const rule =
  `CONTEXT GATE (cloud): context is at ${Math.round(pct)}% (${Math.round(tokens / 1000)}K of ${Math.round(WINDOW / 1000)}K, ` +
  `limit ${PCT}%). OWNER RULE - wrap up now, in this order: ` +
  `(1) finish only the current step, start nothing new; ` +
  `(2) commit and push your work to your branch (never --no-verify); ` +
  `(3) commit and push docs/session-handover-<date>-<slice>.md (done / open / next, with branch and PR numbers); ` +
  `(4) end your final message with the exact prompt to start a NEW cloud session that continues from that handover, ` +
  `and each owner action on its own line as 🟧 YOUR TURN.`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: payload.hook_event_name || 'PostToolUse', additionalContext: rule },
}));
