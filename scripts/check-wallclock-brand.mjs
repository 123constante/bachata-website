// NB: deliberately NO `#!/usr/bin/env node` shebang. tests/wallClockBrandGate.test.ts
// imports isBrandMisuse from this file directly (so the test exercises the REAL
// predicate); Vitest inlines the module and a leading `#!` is an invalid token there --
// it fails the whole file with "SyntaxError: Invalid or unexpected token" and collects
// ZERO tests, while pointing at the importer rather than here. The shebang was
// decorative: this is only ever invoked as `node scripts/check-wallclock-brand.mjs`
// (package.json `check:wallclock-brand` + .github/workflows/typecheck.yml), never as
// `./check-wallclock-brand.mjs`. Please don't re-add it.
/**
 * check-wallclock-brand.mjs
 *
 * The enforcement backstop for the WallClock/Instant branded-type boundary
 * (src/lib/time/wallClock.ts). Event/session times are stored "local-as-UTC"
 * (a naive London wall clock tagged +00); the brands make `new Date(wc)`,
 * `wc.toLocaleString()`-style misuse a COMPILE error so the +1h-in-BST /
 * wrong-day bug class is unrepresentable. But nothing else in CI runs tsc
 * (the production build is esbuild, transpile-only), so a brand violation
 * would otherwise ship silently. This is that missing gate.
 *
 * WHY MESSAGE-SCOPED, NOT A tsc-ERROR-COUNT RATCHET:
 * The repo carries ~168 pre-existing tsc errors (mostly react-router loader
 * union-narrowing; TS2589 from the large generated Database type). A
 * (file,code) baseline ratchet is DEFEATED by that debt: FestivalDetail.tsx
 * and useEventPageQuery.ts already carry a TS2769 / TS2345 for unrelated
 * reasons, so a NEW `new Date(occurrence.startsAt)` in those files produces a
 * code already in the baseline and passes silently -- blind in exactly the
 * files the brand exists to protect.
 *
 * Instead we key on the DIAGNOSTIC MESSAGE. Every brand violation names the
 * brand: assigning/parsing/`new Date()`-ing a WallClock or Instant yields a
 * TS2769/TS2345/TS2322/TS2352 whose (fully-flattened) message contains the
 * literal token `WallClock` or `Instant`. At the boundary this gate was added
 * there are ZERO such diagnostics, so it is ZERO-TOLERANCE from day one, needs
 * no baseline, and is immune to the churn when the generated types.ts is
 * regenerated (which re-baselines every count-based signal).
 *
 * A non-brand structural error that merely mentions the brand type by name in
 * a DIFFERENT code (e.g. a TS2739 "missing properties" on a partial test
 * fixture whose type includes a `date: WallClock` field) is NOT a brand
 * violation -- that is why the code set is restricted to the four assignment/
 * call/cast codes below, not "any diagnostic mentioning the brand".
 *
 * Wired into: package.json `lint` + .github/workflows/typecheck.yml.
 * Run locally: `npm run check:wallclock-brand` (runs `react-router typegen`
 * first, or the generated ./+types/* route modules read as missing and add
 * ~13 spurious TS2307s -- harmless to this gate, which is message-scoped, but
 * confusing).
 */

import ts from 'typescript';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const TSCONFIG = path.join(ROOT, 'tsconfig.app.json');

// The codes TS emits when a WallClock/Instant is used as a bare string:
//   2769 - No overload matches this call        (new Date(wc), fn(wc: string))
//   2345 - Argument not assignable              (Date.parse(wc), f(wc))
//   2322 - Type not assignable                  (const s: string = wc)
//   2352 - Unsafe conversion                    (wc as string)
export const BRAND_MISUSE_CODES = new Set([2769, 2345, 2322, 2352]);

// Case-sensitive, word-bounded: matches the brand type tokens `WallClock` /
// `Instant` but NOT the substring in "Type instantiation is excessively deep"
// (lowercase, and not a standalone word).
export const BRAND_TOKEN = /\b(WallClock|Instant)\b/;

/**
 * The gate's core predicate, exported so tests exercise the REAL rule rather
 * than a copy. `message` must be the FULLY-FLATTENED diagnostic text
 * (ts.flattenDiagnosticMessageText) so a brand token nested in a TS2769
 * overload chain is seen.
 */
export function isBrandMisuse(code, flattenedMessage) {
  return (
    code !== undefined &&
    BRAND_MISUSE_CODES.has(code) &&
    BRAND_TOKEN.test(flattenedMessage)
  );
}

// --- Pass 2: stringification leaks -------------------------------------------
// The tsc diagnostics above catch a WallClock/Instant used where a STRING is
// required (new Date(wc), fn(wc: string), wc as string). They CANNOT catch the
// coercion hatches, because the brand is an object type so `String(wc)`,
// `` `${wc}` ``, `wc.toLocaleString()`, `JSON.stringify(wc)` and `'x' + wc` all
// type-check. And `asWallClock` is a pure cast, so at runtime those emit the RAW
// wall-clock string ("2026-07-17 20:00:00+00") -- which then flows into a
// `new Date(...)` elsewhere and IS the +1h-in-BST bug, silently. This pass walks
// the AST with full type info and flags a branded value fed into any coercion.

// Files that legitimately construct/format brand values and must be exempt.
const STRINGIFY_EXEMPT = [
  path.join('src', 'lib', 'time', 'wallClock.ts'), // the module itself
];
function isExempt(fileName) {
  const rel = path.relative(ROOT, fileName);
  if (rel.startsWith('..') || rel.includes('node_modules')) return true;
  if (rel.endsWith('.d.ts')) return true;
  if (/\.(test|spec)\.[tj]sx?$/.test(rel)) return true;
  if (rel.split(path.sep).includes('tests')) return true;
  if (!rel.startsWith('src' + path.sep) && !rel.startsWith('app' + path.sep)) return true;
  return STRINGIFY_EXEMPT.some((e) => rel === e);
}

const COERCING_METHODS = new Set([
  'toLocaleString',
  'toLocaleDateString',
  'toLocaleTimeString',
  'toString',
]);

function isBrandType(checker, type) {
  // A union keeps the alias token ("WallClock | null"); a bare brand prints
  // "WallClock" / "Instant". typeToString is stable for these named aliases.
  return BRAND_TOKEN.test(checker.typeToString(type));
}

function findStringificationLeaks(program) {
  const checker = program.getTypeChecker();
  const leaks = [];
  const record = (node, expr, kind) => {
    const sf = node.getSourceFile();
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
    leaks.push({
      where: `${path.relative(ROOT, sf.fileName)}:${line + 1}:${character + 1}`,
      kind,
      text: expr.getText().slice(0, 80),
    });
  };
  const brandy = (node) => {
    try {
      return isBrandType(checker, checker.getTypeAtLocation(node));
    } catch {
      return false;
    }
  };

  for (const sf of program.getSourceFiles()) {
    if (isExempt(sf.fileName)) continue;
    const visit = (node) => {
      // `${wc}` and any interpolation of a branded value
      if (ts.isTemplateExpression(node)) {
        for (const span of node.templateSpans) {
          if (brandy(span.expression)) record(span.expression, span.expression, 'template ${...}');
        }
      }
      // String(wc)
      else if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'String' &&
        node.arguments.length === 1 &&
        brandy(node.arguments[0])
      ) {
        record(node, node.arguments[0], 'String(...)');
      }
      // wc.toLocaleString() / wc.toString() etc.
      else if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        COERCING_METHODS.has(node.expression.name.text) &&
        brandy(node.expression.expression)
      ) {
        record(node, node.expression.expression, `.${node.expression.name.text}()`);
      }
      // JSON.stringify(wc) -- only when the ARGUMENT itself is branded (an object
      // that merely CONTAINS branded fields prints as an object type, not caught).
      else if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'stringify' &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'JSON' &&
        node.arguments.length >= 1 &&
        brandy(node.arguments[0])
      ) {
        record(node, node.arguments[0], 'JSON.stringify(...)');
      }
      // 'x' + wc  /  wc + 'x'  (string concatenation of a branded value)
      else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        (brandy(node.left) || brandy(node.right))
      ) {
        record(node, node, 'string concat (+)');
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return leaks;
}

function loadProgram() {
  const configFile = ts.readConfigFile(TSCONFIG, ts.sys.readFile);
  if (configFile.error) {
    console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    process.exit(2);
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(TSCONFIG),
  );
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
  });
}

function main() {
  const program = loadProgram();
  const diagnostics = ts.getPreEmitDiagnostics(program);

  const violations = [];
  for (const d of diagnostics) {
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (!isBrandMisuse(d.code, message)) continue;
    let where = '(unknown)';
    if (d.file && d.start !== undefined) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      where = `${path.relative(ROOT, d.file.fileName)}:${line + 1}:${character + 1}`;
    }
    violations.push({ where, code: d.code, message });
  }

  const leaks = findStringificationLeaks(program);

  if (violations.length === 0 && leaks.length === 0) {
    console.log('OK: WallClock/Instant brand: no misuse diagnostics, no stringification leaks.');
    process.exit(0);
  }

  if (violations.length > 0) {
    console.error(
      `\nFAIL: WallClock/Instant used as a bare string (${violations.length}):\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.where}  TS${v.code}`);
      for (const line of v.message.split('\n')) console.error(`      ${line}`);
      console.error('');
    }
    console.error(
      '  A WallClock/Instant is being used where a string is required -- e.g.\n' +
        '  new Date(wc), Date.parse(wc), or an implicit string cast. Route it through\n' +
        '  a sanctioned reader in src/lib/time/wallClock.ts (formatWallClockTime,\n' +
        '  wallClockToInstant, wallClockDateKey, ...).\n',
    );
  }

  if (leaks.length > 0) {
    console.error(`\nFAIL: WallClock/Instant coerced to a string (${leaks.length}):\n`);
    for (const l of leaks) console.error(`  ${l.where}  ${l.kind}   ${l.text}`);
    console.error(
      '\n  A branded value is being stringified (template `${...}`, String(), .toLocaleString(),\n' +
        '  JSON.stringify, or `+`). Because the brand is a pure cast, this leaks the RAW\n' +
        '  wall-clock string ("2026-07-17 20:00:00+00"), which reproduces the +1h-in-BST /\n' +
        '  wrong-day bug when it reaches a new Date(). Format it via a wallClock.ts reader,\n' +
        '  or if you truly need a stable key use wallClockDateKey / wallClockExactDateKey.\n',
    );
  }

  process.exit(1);
}

// Run only when invoked directly, so tests can import the predicate above
// without loading (and exiting on) the whole app program.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
