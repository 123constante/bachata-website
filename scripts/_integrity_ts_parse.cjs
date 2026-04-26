#!/usr/bin/env node
/**
 * _integrity_ts_parse.cjs — batch TS/TSX/JSX parse-check helper.
 *
 * Reads a JSON array of file paths from stdin, runs the TypeScript
 * compiler's parser on each (syntax-only — no type checking, no module
 * resolution, no lib loading), and writes a JSON array of issues to
 * stdout. Exits 0 always; the Python guard interprets the output.
 *
 * Why a batched helper: launching `node` per file is ~80ms overhead.
 * Batching ~500 files runs in ~3-5s vs. 40s per-file.
 *
 * Issue shape: { path, line, code, message }
 */

const fs = require('fs');
const path = require('path');

let ts;
try {
    // typescript is a project dep in both repos
    ts = require(path.join(process.cwd(), 'node_modules', 'typescript'));
} catch {
    try {
        ts = require('typescript');
    } catch {
        process.stderr.write('integrity-ts-parse: typescript module not found; skipping TS parse phase\n');
        process.stdout.write('[]\n');
        process.exit(0);
    }
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
    let files;
    try {
        files = JSON.parse(raw);
    } catch (e) {
        process.stderr.write(`integrity-ts-parse: bad input: ${e.message}\n`);
        process.exit(0);
    }

    const issues = [];
    for (const file of files) {
        let text;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch (e) {
            issues.push({ path: file, line: 0, code: 'IO', message: `unreadable: ${e.message}` });
            continue;
        }
        const isTsx = file.endsWith('.tsx') || file.endsWith('.jsx');
        const kind = isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, kind);
        const diags = src.parseDiagnostics || [];
        for (const d of diags) {
            const pos = d.start || 0;
            const { line } = src.getLineAndCharacterOfPosition(pos);
            const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
            issues.push({
                path: file,
                line: line + 1,
                code: `TS${d.code}`,
                message: message.slice(0, 200),
            });
        }
    }
    process.stdout.write(JSON.stringify(issues));
});
