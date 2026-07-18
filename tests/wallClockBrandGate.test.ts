import { describe, expect, it } from 'vitest';
import ts from 'typescript';
// The REAL predicate the CI gate uses -- imported, not reimplemented, so this
// test is a genuine green+fail control for scripts/check-wallclock-brand.mjs.
// @ts-expect-error - .mjs script has no type declarations
import { isBrandMisuse } from '../scripts/check-wallclock-brand.mjs';

// Compile a tiny in-memory program that defines the opaque WallClock brand and
// a snippet, then return the flattened (code, message) diagnostics. This mirrors
// exactly how the gate reads the real program, but in ~milliseconds and without
// touching src/. If the brand's shape ever changes so that misuse stops erroring
// (or stops naming the brand), this test fails -- which is the point.
function diagnose(snippet: string): Array<{ code: number; message: string }> {
  const BRAND_PRELUDE = `
    declare const _b: unique symbol;
    type WallClock = { readonly [_b]: 'LondonLocalAsUtc' };
    declare const wc: WallClock;
    declare function takesString(s: string): void;
  `;
  const fileName = 'brandcase.ts';
  const source = BRAND_PRELUDE + '\n' + snippet;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2020, true);

  const host: ts.CompilerHost = {
    getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '',
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === fileName,
    readFile: () => '',
  };

  const program = ts.createProgram({
    rootNames: [fileName],
    // strict:false + noLib mirrors the repo (tsconfig.app.json); noLib keeps this
    // hermetic (no filesystem lib.d.ts). Date/string are declared in the prelude
    // only as far as each case needs.
    options: { strict: false, noLib: true, noEmit: true },
    host,
  });
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ({ code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
}

describe('WallClock brand gate (scripts/check-wallclock-brand.mjs)', () => {
  it('FAIL control: assigning a WallClock to a string is caught', () => {
    const diags = diagnose('const s: string = wc;');
    expect(diags.some((d) => isBrandMisuse(d.code, d.message))).toBe(true);
  });

  it('FAIL control: passing a WallClock where a string is expected is caught', () => {
    const diags = diagnose('takesString(wc);');
    expect(diags.some((d) => isBrandMisuse(d.code, d.message))).toBe(true);
  });

  it('FAIL control: casting a WallClock to string is caught', () => {
    const diags = diagnose('const s = wc as unknown as string; const t = wc as string;');
    expect(diags.some((d) => isBrandMisuse(d.code, d.message))).toBe(true);
  });

  it('GREEN control: a legitimate non-brand structural error is NOT flagged', () => {
    // A plain missing-property / wrong-type error that never names the brand
    // must pass the gate (this is why the rule is code-scoped, not "any error").
    const diags = diagnose('const n: number = "not a number";');
    expect(diags.length).toBeGreaterThan(0); // it IS a tsc error...
    expect(diags.some((d) => isBrandMisuse(d.code, d.message))).toBe(false); // ...but not a brand one
  });

  it('GREEN control: "Type instantiation is excessively deep" is not a false positive', () => {
    // The lowercase "instantiation" substring must never trip the /\bInstant\b/ token.
    expect(isBrandMisuse(2589, 'Type instantiation is excessively deep and possibly infinite.')).toBe(false);
  });

  it('the code set is exactly the four assignment/call/cast codes', () => {
    // A brand mention under a DIFFERENT code (e.g. TS2739 missing-properties on a
    // partial fixture whose type has a `date: WallClock` field) is not a misuse.
    expect(isBrandMisuse(2739, "Type '{ date: WallClock; }' is missing the following properties")).toBe(false);
    expect(isBrandMisuse(2769, "Argument of type 'WallClock' is not assignable to parameter of type 'string'")).toBe(true);
  });
});
