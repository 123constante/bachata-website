// The Vercel preset's streaming server entry. RR7 expects a default export
// (handleRequest) plus an optional streamTimeout. @vercel/react-router exports
// them as named — re-export handleRequest as default.
//
// NOTE (spike): the CSP-nonce experiment (Phase 3) needs a HAND-WRITTEN
// handleRequest to inject a per-request nonce into <Scripts nonce> and the
// response CSP header. Whether the Vercel preset tolerates a custom entry here
// (vs. hard-requiring this re-export) is itself a spike deliverable.
export { handleRequest as default, streamTimeout } from "@vercel/react-router/entry.server";
