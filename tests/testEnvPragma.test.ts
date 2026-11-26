// Guard: vitest.config.ts runs every test in `node`. A test that imports
// @testing-library/react or @testing-library/user-event needs a DOM, so it must
// carry `// @vitest-environment jsdom|happy-dom` in its first 15 lines.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["src", "tests", "app"];
const TEST_FILE = /\.test\.(ts|tsx)$/;
const TL_IMPORT = /from\s+['"]@testing-library\/(react|user-event)['"]|require\(\s*['"]@testing-library\/(react|user-event)['"]\s*\)/;
const PRAGMA = /@vitest-environment\s+(jsdom|happy-dom)/;

// pending follow-up
const ALLOWLIST: string[] = [];

export function needsPragma(source: string): boolean {
  if (!TL_IMPORT.test(source)) return false;
  const head = source.split(/\r?\n/).slice(0, 15).join("\n");
  return !PRAGMA.test(head);
}

function walk(dir: string, out: string[]) {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (TEST_FILE.test(name)) out.push(full.split(path.sep).join("/"));
  }
}

describe("test environment pragma guard", () => {
  it("every testing-library test file declares a DOM environment", () => {
    const files: string[] = [];
    for (const r of ROOTS) walk(r, files);
    const offenders = files
      .filter((f) => !ALLOWLIST.includes(f))
      .filter((f) => needsPragma(readFileSync(f, "utf8")));
    expect(
      offenders,
      `Add "// @vitest-environment jsdom" as line 1 of: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("flags a testing-library import with no pragma", () => {
    expect(needsPragma(`import { render } from '@testing-library/react';\nrender(null);`)).toBe(true);
    expect(needsPragma(`import userEvent from "@testing-library/user-event";`)).toBe(true);
  });

  it("does not flag a pragma'd file or react-dom/server", () => {
    expect(needsPragma(`// @vitest-environment jsdom\nimport { render } from '@testing-library/react';`)).toBe(false);
    expect(needsPragma(`// @vitest-environment happy-dom\nimport { screen } from '@testing-library/react';`)).toBe(false);
    expect(needsPragma(`import { renderToString } from 'react-dom/server';\nwindow.x;`)).toBe(false);
  });
});
