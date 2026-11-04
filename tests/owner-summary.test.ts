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
    it(`${kind}: refuses secrets, missing arc, missing link`, () => {
      for (const bad of ["token=abc123", "ghp_abcdefghijkl1234", "Bearer: zzz", "a".repeat(64)]) {
        expect(formatMessage({ ...base, kind, what: bad }).ok).toBe(false);
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
