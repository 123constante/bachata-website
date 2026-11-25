import { eventHostForwardUrl } from "./eventHostForward";
import { EVENT_SUBDOMAIN_WWW_HOME, parseEventHost } from "./eventSubdomain";

// On an event subdomain React Router navigates client-side, so the server 302 in
// the root loader never runs for in-site links. This resolves where a clicked
// link must really go (www), or null to let the router handle it.

/** www URL a link on an event host must open, or null to leave it alone. */
export function eventHostLinkTarget(host: string, rawHref: string | null | undefined): string | null {
  if (parseEventHost(host).kind === "none" || !rawHref) return null;
  let url: URL;
  try {
    url = new URL(rawHref, `https://${host}`);
  } catch {
    return null;
  }
  if (url.host.toLowerCase() !== host.toLowerCase()) return null;
  // Site chrome "/" (logo, "See full calendar") is the calendar home, not the event.
  if (rawHref === "/") return EVENT_SUBDOMAIN_WWW_HOME;
  return eventHostForwardUrl(host, url.pathname, url.search);
}

/** Capture-phase click handler (runs before <Link>). Returns an uninstaller. */
export function installEventHostLinkForward(host: string): () => void {
  const h = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]");
    if (!a) return;
    const t = a.getAttribute("target");
    if (t && t !== "_self") return;
    const to = eventHostLinkTarget(host, a.getAttribute("href"));
    if (!to) return;
    e.preventDefault();
    window.location.assign(to);
  };
  document.addEventListener("click", h, true);
  return () => document.removeEventListener("click", h, true);
}
