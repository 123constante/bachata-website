import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loader,
  action,
  UPSTREAM_URL,
  PAGE_CSP,
  MAX_TOKEN_BYTES,
} from "./advertising-stop";

// /advertising-stop proxy contract: only `t` reaches the fixed upstream URL,
// every response carries the page headers, bad input never calls upstream.

const SITE = "https://www.bachatacalendar.co.uk/advertising-stop";
const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockResolvedValue(new Response("<p>upstream</p>", { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const get = (qs: string, init?: RequestInit) =>
  loader({ request: new Request(`${SITE}${qs}`, init) } as never);
const post = (body: string, init?: RequestInit) =>
  action({
    request: new Request(`${SITE}?t=from-query&evil=1`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: "sb=secret" },
      body,
      ...init,
    }),
  } as never);

function expectPageHeaders(res: Response) {
  expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("content-security-policy")).toBe(PAGE_CSP);
}

describe("/advertising-stop proxy", () => {
  it("GET forwards only t to the fixed upstream URL and passes body + status", async () => {
    fetchSpy.mockResolvedValue(new Response("<h1>Stop?</h1>", { status: 410 }));
    const res = await get("?t=abc.def&city=x&utm_source=mail", {
      headers: { cookie: "sb=secret", authorization: "Bearer x" },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe(UPSTREAM_URL);
    expect([...u.searchParams.keys()]).toEqual(["t"]);
    expect(u.searchParams.get("t")).toBe("abc.def");
    expect(init.method).toBe("GET");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(res.status).toBe(410);
    expect(await res.text()).toBe("<h1>Stop?</h1>");
    expectPageHeaders(res);
  });

  it("POST forwards only t (body), never the query string, cookies or other fields", async () => {
    const res = await post("t=tok%2B1&extra=2&event_id=999");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(UPSTREAM_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(init.body).toBe("t=tok%2B1");
    expect(new URLSearchParams(init.body).get("t")).toBe("tok+1");
    expect(res.status).toBe(200);
    expectPageHeaders(res);
  });

  it.each(["PUT", "DELETE", "PATCH"])("action %s = 405, no upstream call", async (method) => {
    const res = await action({ request: new Request(SITE, { method, body: "t=a" }) } as never);
    expect(res.status).toBe(405);
    expect(fetchSpy).not.toHaveBeenCalled();
    expectPageHeaders(res);
  });

  it("loader HEAD = 405, no upstream call", async () => {
    const res = await get("?t=a", { method: "HEAD" });
    expect(res.status).toBe(405);
    expect(fetchSpy).not.toHaveBeenCalled();
    expectPageHeaders(res);
  });

  it.each([
    ["missing", ""],
    ["empty", "?t="],
    ["oversized", `?t=${"a".repeat(MAX_TOKEN_BYTES + 1)}`],
  ])("GET %s token = friendly invalid page, no upstream call", async (_label, qs) => {
    const res = await get(qs);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Nothing was changed.");
    expectPageHeaders(res);
  });

  it("token of exactly the limit is forwarded", async () => {
    await get(`?t=${"a".repeat(MAX_TOKEN_BYTES)}`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing t", "x=1"],
    ["oversized t", `t=${"a".repeat(MAX_TOKEN_BYTES + 1)}`],
    ["oversized body", `t=a&pad=${"b".repeat(5000)}`],
  ])("POST %s = invalid page, no upstream call", async (_label, body) => {
    const res = await post(body);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    expectPageHeaders(res);
  });

  it("POST with non-form content type = invalid page, no upstream call", async () => {
    const res = await post(JSON.stringify({ t: "a" }), {
      headers: { "content-type": "application/json" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    expectPageHeaders(res);
  });

  it.each(["GET", "POST"])("%s upstream throws = 502 friendly page", async (method) => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    const res = method === "GET" ? await get("?t=a") : await post("t=a");
    expect(res.status).toBe(502);
    const html = await res.text();
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Nothing was changed.");
    expectPageHeaders(res);
  });

  it("upstream timeout (abort) = 502 and a 5 s timeout signal is passed", async () => {
    fetchSpy.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const res = await get("?t=a");
    expect(res.status).toBe(502);
    expect(fetchSpy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchSpy.mock.calls[0][1].redirect).toBe("error");
  });
});
