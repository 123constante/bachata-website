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
  // ---- calendar-time authority (src/lib/londonDate.ts) ----------------------
  // Events live on the LONDON calendar; these patterns compute on the
  // BROWSER's calendar and produced the "in -1 days" / wrong-day-of-events
  // family of bugs. Derive today/day-diffs/weekdays/day-ranges from
  // src/lib/londonDate.ts (reactive "today": src/hooks/useLondonToday.ts).
  {
    id: 'no-browser-local-midnight',
    message:
      'Browser-local setHours(0,0,0,0) — use londonDayRangeUtc / londonDaysFromTodayForKey from @/lib/londonDate',
    pattern: /\.setHours\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/,
    allowFiles: new Set(['src/lib/londonDate.ts']),
  },
  {
    id: 'no-browser-now-weekday',
    message:
      "Browser-local new Date().getDay() — use weekdayOfKey(londonTodayKey()) from @/lib/londonDate",
    pattern: /new Date\(\)\s*\.getDay\(\)/,
    allowFiles: new Set(['src/lib/londonDate.ts']),
  },
  {
    id: 'no-browser-now-date-key',
    message:
      "Browser-now date key via new Date().toISOString().slice(0, 10) — use londonTodayKey() from @/lib/londonDate",
    pattern: /new Date\(\)\s*\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/,
    allowFiles: new Set(['src/lib/londonDate.ts']),
  },
  // ---- legacy organiser access ----------------------------------------------
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
    // The Lever 2 self-serve RPCs (claim/request/create/list, admin repo D4)
    // return `organiser_id` = an organiser_profiles id, not the legacy column.
    // Only their boundary file may read the key; it maps it to camelCase.
    // redeem_organiser_invite_v1 (arc PR 4b) answers with the same key; its parser and the specs
    // that feed it a server answer are the only other readers.
    // series_go_live_check_v1 (People arc A-WEB1a) answers profile_missing[].organiser_id the same way; its
    // boundary parser and the spec that feeds it a server answer (and a workspace row) read it.
    allowFiles: new Set([
      'src/modules/organiser/shared/selfServeApi.ts',
      'src/modules/organiser/shared/goLiveCheck.ts',
      'src/modules/organiser/events/__tests__/goLive.webA1a.test.tsx',
      'src/modules/organiser/events/__tests__/goLive.profilePage.test.tsx',
      'src/modules/organiser/shared/__tests__/goLiveCheck.parse.test.ts',
      // Invite W2: the same server answer with A1's teacher / DJ entries.
      'src/modules/organiser/shared/__tests__/goLiveCheck.roles.test.ts',
      // Invite W2 walk: the Go live x every screen matrix feeds the same server answer.
      'src/modules/organiser/shared/__tests__/goLiveWalk.matrix.test.tsx',
      'src/modules/admin-organisers/inviteModel.ts',
      // S4 front door RPCs (admin PR #1007) answer organiser_id; the typed boundary parser and its specs read it.
      'src/modules/admin-organisers/frontDoorApi.ts',
      'src/modules/admin-organisers/__tests__/frontDoor.models.test.ts',
      'src/modules/admin-organisers/__tests__/frontDoor.screens.test.tsx',
      'src/modules/admin-organisers/__tests__/inviteModel.test.ts',
      'src/modules/admin-organisers/__tests__/inviteReasons.test.tsx',
      'src/modules/admin-organisers/__tests__/routes.matrix.test.tsx',
      'src/modules/admin-organisers/__tests__/fixup1.test.tsx',
      // W1 (Option B join, PR #978): join/joinModel.ts is the redeem answer's parser on /invite; its specs
      // feed it server answers.
      'src/modules/admin-organisers/join/joinModel.ts',
      'src/modules/admin-organisers/join/__tests__/joinModel.test.ts',
      'src/modules/admin-organisers/join/__tests__/joinJourney.test.tsx',
      'src/modules/admin-organisers/join/__tests__/joinMachine.table.test.tsx',
      // claim_my_organisers_v1 (people arc A-WEB2) answers {claimed:[{organiser_id, name}]}.
      'src/lib/claimMyOrganisers.ts',
      'src/pages/__tests__/AuthCallbackOrganiserClaim.test.tsx',
      'src/pages/__tests__/AuthSignInOrganiserClaim.test.tsx',
      'src/pages/__tests__/AuthCallbackClaimFixPass.test.tsx',
      // The Arc 1 invite-request list and the issue RPC answer with the same key; the sender
      // model is their boundary parser, and these specs feed it server answers.
      'src/modules/admin-organisers/senderModel.ts',
      'src/modules/admin-organisers/__tests__/senderModel.test.ts',
      'src/modules/admin-organisers/__tests__/senderPage.test.tsx',
      // check_invitee_duplicates_v1 (invite journey A2) answers pairs[] / not_linked[] with the same key;
      // the duplicates model is its boundary parser, and this spec feeds it server answers.
      'src/modules/admin-organisers/duplicates/duplicatesModel.ts',
      'src/modules/admin-organisers/duplicates/__tests__/duplicates.matrix.test.tsx',
    ]),
  },
  {
    id: 'no-event-organisers-linkage',
    message: 'Forbidden legacy linkage: event_organisers (use event_entities / canonical entity endpoints)',
    pattern: /\bevent_organisers\b/,
  },
  {
    id: 'no-organiser-profiles-direct-write',
    message:
      "Forbidden direct write: .from('organiser_profiles').update/insert/upsert/delete - use organiser_profile_update_p5_v1",
    pattern: /\.from\(\s*['"]organiser_profiles['"]\s*\)\s*\.(update|insert|upsert|delete)\s*\(/,
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
        if (rule.allowFiles?.has(relativePath)) return;
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
