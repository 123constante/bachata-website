// @ts-nocheck -- .mjs modules without types
import { describe, it, expect, vi } from "vitest";
import { makeKey, formatMessage, buildDigest, buildApprovalList, looksSecret } from "../scripts/lib/owner-summary.mjs";
import { createStore } from "../scripts/lib/owner-summary-store.mjs";
import { sendNtfy } from "../scripts/lib/ntfy-send.mjs";
import { deliver, main } from "../scripts/owner-summary.mjs";

function fakeClient() {
  const comments = [];
  return {
    comments,
    async list() { return comments.map((c) => ({ ...c })); },
    async create(body) { const c = { id: comments.length + 1, body }; comments.push(c); return c; },
    async edit(id, body) { comments.find((c) => c.id === id).body = body; },
  };
}
const K = { arc: "arc7", head: "abcdef1", kind: "finish" };
const okRes = (body = '{"id":"m1"}', status = 200) => ({ status, ok: status < 400, text: async () => body });
const T0 = new Date("2026-11-04T10:00:00Z");
const clock = (d) => () => d;
const ENV = { NTFY_PUBLISH_TOKEN: "tk_SECRETVALUE123456" };
const send = (fetch) => (text) => sendNtfy({ url: "https://ntfy.example", topic: "t1", body: text, fetch, env: ENV });
const msg = formatMessage({ ...K, link: "https://example.com/x", what: "done" }).text;

describe("N1 dedupe", () => {
  it("same key twice -> one send, second SKIP", async () => {
    const c = fakeClient(); const store = createStore({ client: c, now: clock(T0) });
    const fetch = vi.fn(async () => okRes());
    const key = makeKey(K);
    expect((await deliver({ store, key, message: msg, send: send(fetch) })).status).toBe("sent");
    expect((await deliver({ store, key, message: msg, send: send(fetch) })).status).toBe("skip");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(c.comments).toHaveLength(1);
    expect(c.comments[0].body).toContain("state=sent");
    expect(c.comments[0].body).toContain("proof=m1");
  });
  it("crash between begin and send -> rerun SKIPs; heartbeat at 16 min gives exactly one undelivered, second none", async () => {
    const c = fakeClient(); const key = makeKey(K);
    const s1 = createStore({ client: c, now: clock(T0) });
    await expect(deliver({ store: s1, key, message: msg, send: async () => { throw new Error("crash"); } })).resolves.toBeTruthy();
    const fetch = vi.fn(async () => okRes());
    expect((await deliver({ store: s1, key, message: msg, send: send(fetch) })).status).toBe("skip");
    expect(fetch).not.toHaveBeenCalled();
    const later = new Date(T0.getTime() + 16 * 60000);
    const early = new Date(T0.getTime() + 14 * 60000);
    expect(await s1.heartbeat({ now: early })).toHaveLength(0);
    expect(await s1.heartbeat({ now: later })).toHaveLength(1);
    expect(await s1.heartbeat({ now: later })).toHaveLength(0);
    expect(c.comments.filter((x) => x.body.includes("state=undelivered"))).toHaveLength(1);
  });
  it("different kind or head -> separate sends", async () => {
    const c = fakeClient(); const store = createStore({ client: c, now: clock(T0) });
    const fetch = vi.fn(async () => okRes());
    for (const k of [K, { ...K, kind: "stop" }, { ...K, head: "1234567" }]) {
      expect((await deliver({ store, key: makeKey(k), message: msg, send: send(fetch) })).status).toBe("sent");
    }
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("N2 notifier failure", () => {
  const cases = {
    "fetch rejects": async () => { throw new Error("boom"); },
    "HTTP 500": async () => okRes("{}", 500),
    "200 without id": async () => okRes("{}"),
  };
  for (const [name, fetch] of Object.entries(cases)) {
    it(`${name} -> pending, comment exists, pause flagged, never sent`, async () => {
      const c = fakeClient(); const store = createStore({ client: c, now: clock(T0) });
      const setPause = vi.fn();
      const r = await deliver({ store, key: makeKey(K), message: msg, send: send(fetch), setPause });
      expect(r.status).toBe("failed"); expect(r.pause).toBe(true);
      expect(setPause).toHaveBeenCalledTimes(1);
      expect(c.comments).toHaveLength(1);
      expect(c.comments[0].body).toContain("state=pending");
      expect(c.comments[0].body).not.toContain("state=sent");
    });
  }
});

describe("N3 token handling (pure half)", () => {
  it("no token -> refusal, zero fetch calls", async () => {
    const fetch = vi.fn();
    const r = await sendNtfy({ url: "https://ntfy.example", topic: "t1", body: "x", fetch, env: {} });
    expect(r.status).toBe("refused"); expect(fetch).not.toHaveBeenCalled();
  });
  it("token value only in the Authorization header handed to fetch", async () => {
    const log = vi.spyOn(console, "log"); const err = vi.spyOn(console, "error");
    let seen;
    const fetch = vi.fn(async (u, init) => { seen = init; return okRes("{}", 500); });
    const r = await sendNtfy({ url: "https://ntfy.example", topic: "t1", body: "hi", fetch, env: ENV });
    expect(seen.headers.Authorization).toBe(`Bearer ${ENV.NTFY_PUBLISH_TOKEN}`);
    expect(JSON.stringify(r)).not.toContain("SECRETVALUE");
    const rej = await sendNtfy({ url: "https://ntfy.example", topic: "t1", body: "hi", fetch: async () => { throw new Error(`leak ${ENV.NTFY_PUBLISH_TOKEN}`); }, env: ENV });
    expect(JSON.stringify(rej)).not.toContain("SECRETVALUE");
    expect(JSON.stringify([...log.mock.calls, ...err.mock.calls])).not.toContain("SECRETVALUE");
    log.mockRestore(); err.mockRestore();
  });
});

describe("paused", () => {
  it("live mode with the pause label sends and writes nothing", async () => {
    const issue = { number: 5, title: "AUTOMATION PAUSE SWITCH", state: "open", labels: [{ name: "automation-paused" }], user: { login: "123constante" } };
    const fetch = vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify([issue]) }));
    const client = fakeClient(); const out = [];
    const code = await main(["send", "--live", "--arc", "arc7", "--head", "abcdef1", "--kind", "finish", "--link", "https://example.com/x"],
      { env: { OWNER_SUMMARY_ARMED: "1", GITHUB_REPOSITORY: "123constante/bachata-website", GH_TOKEN: "x", ...ENV, NTFY_URL: "https://ntfy.example", NTFY_TOPIC: "t1" }, fetch, client, out: (s) => out.push(s) });
    expect(code).toBe(0); expect(out.join("\n")).toContain("paused: nothing sent");
    expect(client.comments).toHaveLength(0);
    expect(fetch.mock.calls.every(([u]) => String(u).includes("api.github.com"))).toBe(true);
  });
  it("default is dry-run: no I/O", async () => {
    const fetch = vi.fn(); const out = [];
    expect(await main(["send", "--arc", "a1", "--head", "abcdef1", "--kind", "stop", "--link", "https://example.com/x"], { env: {}, fetch, out: (s) => out.push(s) })).toBe(0);
    expect(fetch).not.toHaveBeenCalled(); expect(out[0]).toContain("dry-run");
  });
});

describe("formatter table", () => {
  const base = { arc: "a1", pr: 12, link: "https://example.com/p/12", what: "ok", next: "review", undone: "nothing" };
  for (const kind of ["finish", "stop", "undelivered"]) {
    it(`${kind}: normal, empty parts, long text`, () => {
      const a = formatMessage({ ...base, kind }); expect(a.ok).toBe(true); expect(a.text).toContain("https://example.com/p/12");
      expect(formatMessage({ kind, arc: "a1", link: base.link }).ok).toBe(true);
      const l = formatMessage({ ...base, kind, what: "x ".repeat(2000) });
      expect(l.ok).toBe(true); expect(l.text.length).toBeLessThanOrEqual(600); expect(l.text.endsWith(base.link)).toBe(true);
    });
    it(`${kind}: redacts secrets; refuses missing arc, missing link`, () => {
      for (const bad of ["token=abc123", "ghp_abcdefghijkl1234", "Bearer: zzzzzzzz12345", "a".repeat(64)]) {
        const f = formatMessage({ ...base, kind, what: bad });
        expect(f.redacted).toBe(true); expect(f.text).not.toContain(bad);
      }
      expect(formatMessage({ ...base, kind, arc: "" }).ok).toBe(false);
      expect(formatMessage({ ...base, kind, link: "" }).ok).toBe(false);
    });
  }
  it("makeKey shape and looksSecret", () => {
    expect(makeKey(K)).toBe("arc:arc7|head:abcdef1|kind:finish");
    expect(() => makeKey({ ...K, kind: "x" })).toThrow();
    expect(looksSecret("plain words")).toBe(false);
  });
});

describe("digest and approvals tables", () => {
  const stops = [{ arc: "b", pr: 2, what: "stuck", link: "https://e.com/2" }, { arc: "a", pr: 1, what: "stuck", link: "https://e.com/1" }];
  const markers = [{ key: "arc:z|head:abcdef1|kind:stop", state: "pending", at: "t" }, { key: "arc:y|head:abcdef1|kind:stop", state: "sent" }];
  const now = new Date("2026-11-04T10:00:00Z");
  it("no stops, no markers -> nothing open", () => expect(buildDigest({ now })).toContain("nothing open"));
  it("only stops, sorted", () => { const d = buildDigest({ stops, now }); expect(d.indexOf("arc a")).toBeLessThan(d.indexOf("arc b")); expect(d).not.toContain("not confirmed"); });
  it("only unsent markers; sent ones omitted", () => { const d = buildDigest({ markers, now }); expect(d).toContain("arc:z"); expect(d).not.toContain("arc:y"); });
  it("both", () => { const d = buildDigest({ stops, markers, now }); expect(d).toContain("Open stops (2)"); expect(d).toContain("not confirmed sent (1)"); });
  const prs = (n) => Array.from({ length: n }, (_, i) => ({ number: n - i, title: `T${i}`, head: "abcdef1234567", link: `https://e.com/${n - i}` }));
  it("0 / 1 / 30 PRs in one body", () => {
    expect(buildApprovalList({ prs: [] })).toContain("nothing waiting");
    expect(buildApprovalList({ prs: prs(1) })).toContain("head abcdef1)");
    const b = buildApprovalList({ prs: prs(30) });
    expect(b.split("\n")).toHaveLength(31); expect(b.indexOf("#1 ")).toBeLessThan(b.indexOf("#30 "));
  });
});

// ---- fix round r1 (F1/F2/F3 + surviving-mutant tests) ----
const REPO = "123constante/bachata-website";
const API = "https://api.github.com";
const PAUSE_OPEN = { number: 5, title: "AUTOMATION PAUSE SWITCH", state: "open", labels: [], user: { login: "123constante" } };
const LIVE_ENV = { OWNER_SUMMARY_ARMED: "1", GITHUB_REPOSITORY: REPO, GH_TOKEN: "x", OWNER_SUMMARY_ISSUE: "9", ...ENV, NTFY_URL: "https://ntfy.example", NTFY_TOPIC: "t1" };
const SEND_ARGS = ["send", "--arc", "arc7", "--head", "abcdef1", "--kind", "finish", "--link", "https://example.com/x", "--what", "done"];
const jres = (data, link = null) => ({ ok: true, status: 200, headers: { get: (h) => (h === "link" ? link : null) }, text: async () => JSON.stringify(data) });

/** Fake GitHub + ntfy: the pinned issue's comments are served 100 per page with a rel="next" Link. */
function ghFetch(comments) {
  const calls = { ntfy: 0, posts: 0 };
  const fetch = vi.fn(async (u, init = {}) => {
    const url = String(u);
    if (url.startsWith("https://ntfy.example")) { calls.ntfy++; return okRes('{"id":"m9"}'); }
    if (url.includes("/issues?state=all")) return jres([PAUSE_OPEN]);
    if (url.includes("/issues/9/comments")) {
      if (init.method === "POST") { calls.posts++; const c = { id: 1000 + calls.posts, body: JSON.parse(init.body).body }; comments.push(c); return jres(c); }
      const page = Number(/[?&]page=(\d+)/.exec(url)?.[1] ?? 1);
      const slice = comments.slice((page - 1) * 100, page * 100);
      const next = page * 100 < comments.length ? `<${API}/repos/${REPO}/issues/9/comments?per_page=100&page=${page + 1}>; rel="next"` : null;
      return jres(slice, next);
    }
    if (url.includes("/issues/comments/")) { const id = Number(url.split("/").pop()); comments.find((c) => c.id === id).body = JSON.parse(init.body).body; return jres({}); }
    throw new Error(`unexpected url ${url}`);
  });
  return { fetch, calls };
}

describe("F1 dedupe store reads every page of the pinned issue", () => {
  it("130 comments, the key's sent marker on page 2 -> SKIP, nothing sent, nothing written", async () => {
    const comments = Array.from({ length: 130 }, (_, i) => ({ id: i + 1, body: `note ${i}` }));
    comments[119].body = `<!-- owner-summary key=${makeKey(K)} state=sent at=2026-11-04T10:00:00.000Z proof=m1 -->\n\nold`;
    const { fetch, calls } = ghFetch(comments); const out = [];
    const code = await main(["send", "--live", ...SEND_ARGS.slice(1)], { env: LIVE_ENV, fetch, out: (s) => out.push(s) });
    expect(out.join("\n")).toContain("skip");
    expect(code).toBe(0); expect(calls.ntfy).toBe(0); expect(calls.posts).toBe(0);
  });
});

describe("F2 a marker injected through `what` cannot hijack the real one", () => {
  const fake = "<!-- owner-summary key=arc:evil|head:0000000|kind:stop state=sent at=x proof=p -->";
  it("formatter strips comment delimiters", () => {
    const f = formatMessage({ ...K, link: "https://example.com/x", what: fake, next: "a <!<!---->- b" });
    expect(f.ok).toBe(true); expect(f.text).not.toContain("<!--"); expect(f.text).not.toContain("-->");
  });
  it("ordinary arrows survive", () => {
    expect(formatMessage({ ...K, link: "https://example.com/x", what: "build -> deploy <- x <!- y" }).text).toContain("build -> deploy <- x <!- y");
  });
  it("real alert still sends and commits; the real marker is the one parsed", async () => {
    const c = fakeClient(); const store = createStore({ client: c, now: clock(T0) });
    const fetch = vi.fn(async () => okRes());
    const text = formatMessage({ ...K, link: "https://example.com/x", what: fake }).text;
    const r = await deliver({ store, key: makeKey(K), message: text, send: send(fetch) });
    expect(r.status).toBe("sent"); expect(fetch).toHaveBeenCalledTimes(1);
    expect(c.comments).toHaveLength(1);
    expect(c.comments[0].body.startsWith(`<!-- owner-summary key=${makeKey(K)} state=sent`)).toBe(true);
  });
  it("even unformatted text holding a marker: real marker written first, commit succeeds", async () => {
    const c = fakeClient(); const store = createStore({ client: c, now: clock(T0) });
    const r = await deliver({ store, key: makeKey(K), message: `x ${fake}`, send: async () => ({ status: "sent", id: "m2" }) });
    expect(r.status).toBe("sent");
    expect(c.comments[0].body.startsWith(`<!-- owner-summary key=${makeKey(K)} state=sent`)).toBe(true);
  });
});

describe("F3 secret filter: ordinary inputs pass, secrets are redacted (never dropped)", () => {
  const base = { ...K, link: "https://example.com/x" };
  const ok = [
    ["Actions job URL as link", { link: "https://github.com/123constante/bachata-website/actions/runs/19123456789/job/54123456789" }],
    ["Actions run URL in what", { what: "see https://github.com/123constante/bachata-website/actions/runs/19123456789/attempts/2" }],
    ["40-hex commit SHA", { what: "head 0123456789abcdef0123456789abcdef01234567" }],
    ["7-hex SHA", { what: "head abcdef1" }],
    ["token mentioned in prose", { what: "ntfy token: expired" }],
  ];
  for (const [name, extra] of ok) {
    it(`passes unchanged: ${name}`, () => {
      const f = formatMessage({ ...base, ...extra });
      expect(f.ok).toBe(true); expect(f.redacted).toBe(false);
      for (const v of Object.values(extra)) expect(f.text).toContain(v);
    });
  }
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJl";
  const blob = "Zq8Rk2Lm4Np6Tv8Xw0Yb2Cd4Ef6Gh8Jk0Lm2Np4Qr6St8Uv0Wx2Yz4Ab6Cd8";
  const bad = [
    ["token= value", "token=abc123"],
    ["ghp_ token", "ghp_abcdefghijkl1234"],
    ["Bearer value", "Bearer: zzzzzzzz12345"],
    ["JWT", jwt],
    ["long random blob", blob],
    ["64-hex", "a".repeat(64)],
  ];
  for (const [name, secret] of bad) {
    it(`redacts but still alerts: ${name}`, () => {
      const f = formatMessage({ ...base, what: `before ${secret} after` });
      expect(f.ok).toBe(true); expect(f.redacted).toBe(true);
      expect(f.text).not.toContain(secret); expect(f.text).toContain("[redacted]"); expect(f.text).toContain("before");
    });
  }
  it("M17 JWT and M22 long blob each detected on their own", () => {
    expect(looksSecret(`x ${jwt}`)).toBe(true);
    expect(looksSecret(`x ${blob}`)).toBe(true);
  });
  it("a secret in the link is redacted, alert still built", () => {
    const f = formatMessage({ ...base, link: "https://example.com/hook?token=abcdef123456" });
    expect(f.ok).toBe(true); expect(f.text).not.toContain("abcdef123456");
  });
  it("CLI with a secret in --what prints a redacted alert and exits 0 (dry-run)", async () => {
    const out = [];
    const code = await main([...SEND_ARGS.slice(0, -1), "token=abc123"], { env: {}, fetch: vi.fn(), out: (s) => out.push(s) });
    expect(code).toBe(0); expect(out.join("\n")).not.toContain("abc123"); expect(out.join("\n")).toContain("[redacted]");
  });
});

describe("M1 disarmed unless --live AND OWNER_SUMMARY_ARMED=1", () => {
  const combos = [
    ["--live only", ["send", "--live", ...SEND_ARGS.slice(1)], { ...LIVE_ENV, OWNER_SUMMARY_ARMED: undefined }],
    ["env only", SEND_ARGS, LIVE_ENV],
    ["ARMED=true", ["send", "--live", ...SEND_ARGS.slice(1)], { ...LIVE_ENV, OWNER_SUMMARY_ARMED: "true" }],
  ];
  for (const [name, argv, env] of combos) {
    it(`${name} -> dry-run, zero fetch, zero comments`, async () => {
      const { fetch } = ghFetch([]); const client = fakeClient(); const out = [];
      expect(await main(argv, { env, fetch, client, out: (s) => out.push(s) })).toBe(0);
      expect(fetch).not.toHaveBeenCalled(); expect(client.comments).toHaveLength(0); expect(out[0]).toContain("dry-run");
    });
  }
});

describe("M5 stale boundary", () => {
  it("exactly 15 min is not stale; 15 min + 1 ms is", async () => {
    const c = fakeClient(); const store = createStore({ client: c, now: clock(T0) });
    await store.begin(makeKey(K));
    expect(await store.heartbeat({ now: new Date(T0.getTime() + 15 * 60000) })).toHaveLength(0);
    expect(await store.heartbeat({ now: new Date(T0.getTime() + 15 * 60000 + 1) })).toHaveLength(1);
  });
});

describe("M13 makeKey head", () => {
  it("empty, short and non-hex heads throw", () => {
    for (const head of ["", undefined, "abc12", "zzzzzzz", "a".repeat(41)]) expect(() => makeKey({ ...K, head })).toThrow(/head/);
  });
});

describe("ntfy request shape", () => {
  const capture = async (title = "t") => {
    let seen, url;
    const fetch = vi.fn(async (u, init) => { url = u; seen = init; return okRes(); });
    await sendNtfy({ url: "https://ntfy.example", topic: "t1", title, body: "hi", fetch, env: ENV });
    return { seen, url };
  };
  it("M14 token appears in Authorization only: no other header, not body, not url", async () => {
    const { seen, url } = await capture();
    for (const [k, v] of Object.entries(seen.headers)) if (k !== "Authorization") expect(String(v)).not.toContain(ENV.NTFY_PUBLISH_TOKEN);
    expect(Object.keys(seen.headers).sort()).toEqual(["Authorization", "Title"]);
    expect(String(seen.body)).not.toContain(ENV.NTFY_PUBLISH_TOKEN); expect(String(url)).not.toContain(ENV.NTFY_PUBLISH_TOKEN);
  });
  it("M18 Title is ASCII-only and capped", async () => {
    const { seen } = await capture(`Bachata arc caf${String.fromCharCode(0xe9)} ${String.fromCharCode(0x2014)} ${"x".repeat(300)}\n`);
    expect(seen.headers.Title).toMatch(/^[\x20-\x7e]*$/);
    expect(seen.headers.Title.length).toBeLessThanOrEqual(100);
    expect(seen.headers.Title.startsWith("Bachata arc caf?")).toBe(true);
  });
  it("M23 the timeout timer is cleared after a reply", async () => {
    vi.useFakeTimers();
    try { await capture(); expect(vi.getTimerCount()).toBe(0); } finally { vi.useRealTimers(); }
  });
  it("M25 a hung request aborts at timeoutMs with reason timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetch = (u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
      const p = sendNtfy({ url: "https://ntfy.example", topic: "t1", body: "x", fetch, env: ENV, timeoutMs: 50 });
      await vi.advanceTimersByTimeAsync(50);
      expect(await p).toEqual({ status: "failed", reason: "timeout" });
    } finally { vi.useRealTimers(); }
  });
});

describe("item 5: long link and the failure line", () => {
  it("a 2000-char link keeps the message under the 600 limit", () => {
    const f = formatMessage({ ...K, link: `https://example.com/${"p".repeat(2000)}`, what: "done" });
    expect(f.ok).toBe(true); expect(f.text.length).toBeLessThanOrEqual(600); expect(f.text).toContain("done");
  });
  it("a failed live send says the pause was NOT set by this CLI", async () => {
    const comments = []; const { fetch } = ghFetch(comments);
    const failing = vi.fn(async (u, i) => (String(u).startsWith("https://ntfy.example") ? okRes("{}", 500) : fetch(u, i)));
    const out = [];
    const code = await main(["send", "--live", ...SEND_ARGS.slice(1)], { env: LIVE_ENV, fetch: failing, out: (s) => out.push(s) });
    expect(code).toBe(2); expect(out.join("\n")).toContain("pause NOT set");
    expect(comments[0].body).toContain("state=pending");
  });
});
