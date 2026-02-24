import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDED_FILES = new Set([
  'src/types/supabase.ts',
  'src/integrations/supabase/types.ts',
  'src/vite-env.d.ts',
]);

const RULES = [
  {
    id: 'no-organisers-table',
    message: "Forbidden runtime access: .from('organisers')",
    pattern: /\.from\(\s*['\"]organisers['\"]\s*\)/,
  },
  {
    id: 'no-claim-organiser-rpc',
    message: 'Forbidden runtime RPC: claim_organiser_profile',
    pattern: /\.rpc\(\s*['\"]claim_organiser_profile['\"]\s*[,) ]/,
  },
  {
    id: 'no-legacy-organiser-fields',
    message: 'Forbidden legacy field: organiser_id / organiser_ids',
    pattern: /\borganiser_ids?\b/,
  },
  {
    id: 'no-event-organisers-linkage',
    message: 'Forbidden legacy linkage: event_organisers (use event_entities / canonical entity endpoints)',
    pattern: /\bevent_organisers\b/,
  },
];

const toPosixRelative = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join('/');

const isRuntimeSourceFile = (relativePath) => {
  if (!relativePath.startsWith('src/')) return false;
  if (EXCLUDED_FILES.has(relativePath)) return false;
  if (relativePath.endsWith('.d.ts')) return false;
  return ALLOWED_EXTENSIONS.has(path.extname(relativePath));
};

const collectFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }
      return [fullPath];
    })
  );
  return nested.flat();
};

const run = async () => {
  const allPaths = await collectFiles(SRC_DIR);
  const sourceFiles = allPaths.filter((absolutePath) => isRuntimeSourceFile(toPosixRelative(absolutePath)));

  const violations = [];

  for (const absolutePath of sourceFiles) {
    const relativePath = toPosixRelative(absolutePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      RULES.forEach((rule) => {
        if (rule.pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            rule: rule.id,
            message: rule.message,
            snippet: line.trim(),
          });
        }
      });
    });
  }

  if (violations.length > 0) {
    console.error('\nRuntime architecture guard failed.\n');
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
      if (violation.snippet) {
        console.error(`  ${violation.snippet}`);
      }
    }
    console.error(`\nTotal violations: ${violations.length}`);
    process.exit(1);
  }

  console.log('Runtime architecture guard passed.');
};

run().catch((error) => {
  console.error('Failed to run runtime architecture guard:', error);
  process.exit(1);
});
