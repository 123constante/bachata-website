#!/usr/bin/env node
/**
 * seed-organiser-real-rpc.mjs -- the organiser logins the Website's real-RPC journey signs in as.
 *
 * Creates (or repairs) on the E2E Supabase project ONLY:
 *   - an OWNER user and a CONTRIBUTOR user, email + password, email confirmed;
 *   - one LIVE organiser, "E2E Real RPC Organiser", made by the owner through the real
 *     create_organiser_profile_v1 -> submit_organiser_profile_v1 -> admin_approve_entity_v1 path
 *     (so the owner's entity_members row is the one the RPC writes, role owner);
 *   - the contributor's membership, added by the OWNER through admin_add_entity_member_v1
 *     (the owner-gated RPC, role contributor).
 * Then it signs both users in with their passwords against E2E GoTrue and reads organiser_home_v1
 * with each token: the owner must see the organiser as `owner`; the contributor must sign in and must
 * NOT see it (D-8: organiser_home_v1 lists owner/manager organisers only).
 *
 * Idempotent: every step looks before it writes. A re-run resets both passwords to the env values
 * and leaves everything else as it is. By default it also deletes the series a previous journey
 * run created ("RPC Journey ..." under this organiser) and their uploaded flyers, so the R5 daily
 * cap (10 series per organiser per 24h) never blocks a re-run. --keep-journey skips that.
 *
 * Consumer: tests/e2e/organiser-real-rpc.spec.ts (npm run test:e2e:organiser-real-rpc).
 * Runbook: docs/e2e-organiser-real-rpc.md. Uses only the admin repo's existing RPCs/contracts; no DDL.
 *
 *   node scripts/e2e/seed-organiser-real-rpc.mjs [--dry-run] [--keep-journey]
 *
 * Env (process env only; NOTHING here is committed):
 *   SUPABASE_ACCESS_TOKEN                   Management API PAT (SQL as postgres, E2E only)
 *   E2E_ORGANISER_OWNER_PASSWORD            required, 10+ chars
 *   E2E_ORGANISER_CONTRIBUTOR_PASSWORD      required, 10+ chars
 *   E2E_ORGANISER_OWNER_EMAIL               default e2e-organiser-owner@fixtures.bachata-admin.test
 *   E2E_ORGANISER_CONTRIBUTOR_EMAIL         default e2e-organiser-contributor@fixtures.bachata-admin.test
 *   E2E_PROJECT_REF                         default srrpvuxldthwumzrngla (never the prod ref)
 * The E2E service-role key (GoTrue admin user API, Storage cleanup) and anon key are fetched
 * through the Management API for the E2E ref, held in memory and never printed.
 *
 * Safety: refuses when ANY configured Supabase URL/ref is the prod ref, when the resolved ref is
 * not E2E, or when a fetched key decodes to another project. Passwords are never printed.
 * Exit: 0 seeded and verified; 1 a step failed; 2 refused / missing input.
 */
// Self-contained (no admin-repo imports). Env comes from the PROCESS only: this repo's .env holds
// the PROD site keys, so no .env file is read here (a prod VITE_SUPABASE_URL in the shell is refused).
async function mgmtQuery(token, ref, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(String((body && (body.message || body.error)) || text).trim());
  return Array.isArray(body) ? body : [];
}

const PROD_REF = "stsdtacfauprzrdebmzg";
const E2E_REF = process.env.E2E_PROJECT_REF || "srrpvuxldthwumzrngla";
const LONDON = "00000000-0000-0000-0000-000000000001";
const ORG_NAME = "E2E Real RPC Organiser";
// The Website journey names every series it creates with this prefix; cleanup matches on it.
const JOURNEY_PREFIX = "RPC Journey ";
const FLYER_BUCKET = "organiser-flyers";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const KEEP_JOURNEY = args.has("--keep-journey");

const refuse = (m) => {
  console.error(`REFUSED: ${m}`);
  process.exit(2);
};

const refOf = (v) => (v && (/^https?:\/\/([a-z0-9]{20})\.supabase\.co/.exec(v)?.[1] || (/^[a-z0-9]{20}$/.test(v) ? v : null))) || null;
for (const k of ["VITE_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_PROJECT_REF", "E2E_PROJECT_REF", "E2E_SUPABASE_URL"]) {
  if (String(process.env[k] || "").includes(PROD_REF)) refuse(`${k} points at the PROD project (${PROD_REF}). This seed runs on E2E only.`);
}
if (E2E_REF === PROD_REF || refOf(E2E_REF) !== E2E_REF) refuse(`E2E_PROJECT_REF ${E2E_REF} is not a usable E2E ref.`);
const ref = E2E_REF;
const URL_E2E = `https://${ref}.supabase.co`;

const owner = {
  role: "owner",
  email: (process.env.E2E_ORGANISER_OWNER_EMAIL || "e2e-organiser-owner@fixtures.bachata-admin.test").trim().toLowerCase(),
  password: process.env.E2E_ORGANISER_OWNER_PASSWORD || "",
};
const contributor = {
  role: "contributor",
  email: (process.env.E2E_ORGANISER_CONTRIBUTOR_EMAIL || "e2e-organiser-contributor@fixtures.bachata-admin.test").trim().toLowerCase(),
  password: process.env.E2E_ORGANISER_CONTRIBUTOR_PASSWORD || "",
};

const PLAN = [
  `target: E2E ref ${ref} (prod ${PROD_REF} refused)`,
  `1 users: ${owner.email} (owner), ${contributor.email} (contributor): create confirmed, or reset password`,
  `2 organiser "${ORG_NAME}": create_organiser_profile_v1 as owner -> submit -> admin approve, until live`,
  `3 contributor membership: admin_add_entity_member_v1 as the owner, role contributor`,
  `4 ${KEEP_JOURNEY ? "SKIPPED (--keep-journey)" : `delete earlier journey series "${JOURNEY_PREFIX}*" of this organiser + their flyers`}`,
  `5 verify: password sign-in for both; organiser_home_v1 lists it for the owner, not the contributor (D-8)`,
].join("\n");
if (DRY) {
  console.log(`DRY RUN. Nothing is changed.\n${PLAN}`);
  process.exit(0);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) refuse("missing SUPABASE_ACCESS_TOKEN (Management API PAT).");
for (const u of [owner, contributor]) {
  if (u.password.length < 10) refuse(`E2E_ORGANISER_${u.role.toUpperCase()}_PASSWORD is missing or shorter than 10 characters.`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) refuse(`${u.role} email "${u.email}" is not an email address.`);
}
if (owner.email === contributor.email) refuse("owner and contributor emails must differ.");

// ---- keys: fetched for the E2E ref only, checked, never printed ---------------------------------
const jwtRef = (k) => {
  try {
    return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).ref || null;
  } catch {
    return null;
  }
};
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${token}` } });
if (!keysRes.ok) refuse(`could not read the E2E API keys (Management API ${keysRes.status}).`);
const keys = await keysRes.json();
const SERVICE = keys.find((k) => k.name === "service_role")?.api_key;
const ANON = keys.find((k) => k.name === "anon")?.api_key;
if (!SERVICE || jwtRef(SERVICE) !== ref) refuse("the fetched service-role key is missing or not for the E2E project.");
if (!ANON || jwtRef(ANON) !== ref) refuse("the fetched anon key is missing or not for the E2E project.");

// ---- helpers -------------------------------------------------------------------------------------
const lit = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const run = (q) => mgmtQuery(token, ref, q);
const q1 = async (q) => (await run(q))[0] ?? null;
const cleanErr = (e) => String(e?.message ?? e).replace(/^Failed to run sql query:\s*/, "").split("\n")[0].slice(0, 200);
/** One request = one transaction: act as `uid` (authenticated) for the final statement. */
const rpcAs = async (uid, fn, argList) => {
  const claims = JSON.stringify({ sub: uid, role: "authenticated", aud: "authenticated" });
  try {
    const rows = await run(`SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claims', ${lit(claims)}, true), set_config('request.jwt.claim.sub', ${lit(uid)}, true);
      SELECT public.${fn}(${argList}) AS r`);
    return { r: rows.at(-1)?.r ?? null };
  } catch (e) {
    return { error: cleanErr(e) };
  }
};
const authAdmin = async (method, path, body) => {
  const res = await fetch(`${URL_E2E}/auth/v1/admin/${path}`, {
    method,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`auth admin ${method} ${path.split("/")[0]}: ${res.status} ${json.msg || json.message || json.error_description || ""}`.trim());
  return json;
};

const results = [];
const record = (step, ok, detail = "") => {
  results.push({ step, ok });
  console.log(`${(ok ? "PASS" : "FAIL").padEnd(5)} ${step}${detail ? `  -- ${detail}` : ""}`);
};

// ---- 1. users ------------------------------------------------------------------------------------
async function ensureUser(u) {
  const row = await q1(`SELECT id, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE lower(email) = ${lit(u.email)}`);
  if (row) {
    await authAdmin("PUT", `users/${row.id}`, { password: u.password, email_confirm: true });
    u.id = row.id;
    return `exists ${row.id}; password reset${row.confirmed ? "" : ", email confirmed now"}`;
  }
  // email_confirm: true -> confirmed at creation, no email is sent (E2E allows 2 auth emails/hour).
  const made = await authAdmin("POST", "users", { email: u.email, password: u.password, email_confirm: true, user_metadata: { fixture: "e2e-organiser-real-rpc" } });
  u.id = made.id;
  return `created ${made.id}`;
}

// ---- 4. journey cleanup --------------------------------------------------------------------------
async function deleteJourneySeries(orgId) {
  const rows = await run(`SELECT id FROM event_series_p5 WHERE organiser_ids @> ARRAY[${lit(orgId)}]::uuid[] AND name LIKE ${lit(`${JOURNEY_PREFIX}%`)}`);
  const ids = rows.map((r) => r.id);
  if (!ids.length) return "none to delete";
  const L = ids.map(lit).join(",");
  // Flyers first (Storage API: the object rows are not deletable by SQL). Listing per series folder.
  let removed = 0;
  for (const id of ids) {
    // Page through the folder: a failed or partial listing must stop the run, never orphan objects.
    const names = [];
    for (let offset = 0; ; offset += 100) {
      const list = await fetch(`${URL_E2E}/storage/v1/object/list/${FLYER_BUCKET}`, {
        method: "POST",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
        body: JSON.stringify({ prefix: `${id}/`, limit: 100, offset }),
      });
      if (!list.ok) throw new Error(`flyer listing for series ${id}: ${list.status}`);
      const objs = await list.json();
      names.push(...objs.filter((o) => o.name).map((o) => `${id}/${o.name}`));
      if (objs.length < 100) break;
    }
    if (!names.length) continue;
    const del = await fetch(`${URL_E2E}/storage/v1/object/${FLYER_BUCKET}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: names }),
    });
    if (!del.ok) throw new Error(`flyer delete for series ${id}: ${del.status}`);
    removed += names.length;
  }
  await run(`
    DELETE FROM command_idempotency_p5 WHERE audit_id IN (SELECT id FROM event_audit_p5 WHERE target_id IN (${L})
                                                         OR target_id IN (SELECT id FROM event_occurrence_p5 WHERE series_id IN (${L})));
    DELETE FROM event_audit_p5 WHERE target_id IN (${L}) OR target_id IN (SELECT id FROM event_occurrence_p5 WHERE series_id IN (${L}));
    DELETE FROM entity_decision_audit WHERE target_id IN (${L});
    DELETE FROM event_series_p5 WHERE id IN (${L});`);
  const left = await q1(`SELECT count(*)::int AS n FROM event_series_p5 WHERE id IN (${L})`);
  if (left?.n) throw new Error(`${left.n} journey series still present after delete`);
  return `deleted ${ids.length} series, ${removed} flyer object(s)`;
}

// ---- 5. verify through the real auth + PostgREST -------------------------------------------------
async function signInAndReadHome(u) {
  const res = await fetch(`${URL_E2E}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  const s = await res.json().catch(() => ({}));
  if (!res.ok || !s.access_token) throw new Error(`password sign-in refused: ${res.status} ${s.error_description || s.msg || ""}`.trim());
  const home = await fetch(`${URL_E2E}/rest/v1/rpc/organiser_home_v1`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "content-type": "application/json" },
    body: "{}",
  });
  const body = await home.json().catch(() => null);
  if (!home.ok) throw new Error(`organiser_home_v1: ${home.status} ${body?.message || ""}`.trim());
  return body;
}

// ---- main ----------------------------------------------------------------------------------------
let fatal = null;
let orgId = null;
try {
  console.log(`Target: E2E ref ${ref}\n`);

  for (const u of [owner, contributor]) record(`1 user ${u.role} ${u.email}`, true, await ensureUser(u));

  const admin = (await q1(`SELECT user_id FROM admin_users ORDER BY created_at LIMIT 1`))?.user_id;
  if (!admin) throw new Error("no admin_users row on E2E: an admin is needed to approve the organiser");
  const city = await q1(`SELECT id FROM cities WHERE id = ${lit(LONDON)}`);
  if (!city) throw new Error("London city fixture row missing on E2E (supabase/seed.e2e.sql)");

  // 2. organiser, via the owner's own create RPC. Matched by name + creator so another fixture of
  // the same name (made by someone else) is never adopted.
  let org = await q1(`SELECT id, lifecycle_status FROM organiser_profiles WHERE name = ${lit(ORG_NAME)} AND created_by = ${lit(owner.id)} ORDER BY created_at LIMIT 1`);
  let how = "exists";
  if (!org) {
    const made = await rpcAs(owner.id, "create_organiser_profile_v1", `p_name => ${lit(ORG_NAME)}, p_city_id => ${lit(LONDON)}`);
    if (made.error || !made.r?.organiser_id) throw new Error(`create_organiser_profile_v1: ${made.error ?? "no organiser_id"}`);
    org = { id: made.r.organiser_id, lifecycle_status: made.r.lifecycle_status };
    how = "created";
  }
  orgId = org.id;
  if (org.lifecycle_status === "draft" || org.lifecycle_status === "rejected") {
    const s = await rpcAs(owner.id, "submit_organiser_profile_v1", `p_organiser_id => ${lit(orgId)}`);
    if (s.error) throw new Error(`submit_organiser_profile_v1: ${s.error}`);
    how += ", submitted";
  }
  org = await q1(`SELECT lifecycle_status FROM organiser_profiles WHERE id = ${lit(orgId)}`);
  if (org.lifecycle_status === "pending_review") {
    const a = await rpcAs(admin, "admin_approve_entity_v1", `'organiser', ${lit(orgId)}, 'e2e-organiser-real-rpc seed'`);
    if (a.error) throw new Error(`admin_approve_entity_v1: ${a.error}`);
    how += ", approved";
  }
  org = await q1(`SELECT lifecycle_status, city_id FROM organiser_profiles WHERE id = ${lit(orgId)}`);
  record(`2 organiser "${ORG_NAME}" live`, org.lifecycle_status === "live", `${how}; ${orgId} is ${org.lifecycle_status}`);

  // 3. memberships
  const roles = async (uid) =>
    (await run(`SELECT member_role FROM entity_members WHERE entity_type = 'organiser' AND entity_id = ${lit(orgId)} AND user_id = ${lit(uid)} ORDER BY 1`)).map((r) => r.member_role);
  const ownerRoles = await roles(owner.id);
  record("3 owner membership (written by create_organiser_profile_v1)", ownerRoles.includes("owner"), `roles [${ownerRoles}]`);
  let contribRoles = await roles(contributor.id);
  if (!contribRoles.includes("contributor")) {
    const add = await rpcAs(owner.id, "admin_add_entity_member_v1", `'organiser', ${lit(orgId)}, ${lit(contributor.email)}, 'contributor'`);
    if (add.error) throw new Error(`admin_add_entity_member_v1 (as owner): ${add.error}`);
    contribRoles = await roles(contributor.id);
  }
  // The journey's "a contributor cannot edit" step is only meaningful if the contributor holds
  // NO stronger role here; never silently demote, say so.
  const stronger = contribRoles.filter((r) => r === "owner" || r === "manager");
  record("3 contributor membership (added by the owner via admin_add_entity_member_v1)", contribRoles.includes("contributor") && !stronger.length,
    stronger.length ? `contributor ALSO holds [${stronger}]: remove that row by hand, the journey needs a plain contributor` : `roles [${contribRoles}]`);

  // 4. earlier journey runs
  if (!KEEP_JOURNEY) record(`4 earlier "${JOURNEY_PREFIX}*" series cleaned`, true, await deleteJourneySeries(orgId));

  // 5. verify through real auth
  for (const u of [owner, contributor]) {
    const home = await signInAndReadHome(u);
    const mine = (home?.organisers ?? []).find((o) => o.id === orgId);
    // D-8: organiser_home_v1 lists owner/manager organisers only, so a contributor must NOT see it.
    const ok = u.role === "owner" ? mine?.role === "owner" : !mine;
    record(`5 ${u.role}: password sign-in + organiser_home_v1`, ok,
      mine ? `sees "${mine.name}" as ${mine.role}` : "signed in; organiser not listed (D-8: contributors are not organisers of record)");
  }
} catch (e) {
  fatal = cleanErr(e);
  record("seed aborted", false, fatal);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `FAILED: ${failed} step(s)` : "SEEDED: E2E organiser fixtures ready"}  (organiser ${orgId ?? "?"}; passwords not printed)`);
process.exit(failed ? 1 : 0);
