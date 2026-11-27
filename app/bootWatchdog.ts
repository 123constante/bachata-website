// Boot watchdog (2026-11-27 blank-page self-heal). An inline head script that
// notices when the app never booted (entry JS 404, chunk error, crash before
// hydration) and reloads the page ONCE, silently. A second failure in the same
// tab shows one plain "Tap to refresh" button instead of looping.
//
// Signals: an /assets/ <script> or modulepreload error event (check 1.5 s
// later), or the window load event (check 6 s later). Booted = Layout's
// useEffect calls window.__bcBoot(), which cancels it and clears the key.
// Own sessionStorage key, separate from chunk-reload-attempted, so a spent
// chunk guard cannot block it. No sessionStorage = no silent reload (no loop).
//
// Kill switch: env BOOT_WATCHDOG=off (server runtime).
export const BOOT_WATCHDOG_KEY = "boot-watchdog-reloaded";
export const BOOT_WATCHDOG_TEXT = "This page didn't load. Tap to refresh";

export function bootWatchdogScript(opts: { killSwitch?: string | undefined }): string {
  if (opts.killSwitch === "off") return "";
  const K = JSON.stringify(BOOT_WATCHDOG_KEY);
  const T = JSON.stringify(BOOT_WATCHDOG_TEXT);
  return (
    `(function(){var K=${K},ok=0,fired=0;` +
    `window.__bcBoot=function(){ok=1;try{sessionStorage.removeItem(K)}catch(_){}};` +
    `function fail(){if(ok||fired)return;fired=1;var spent=1;` +
    `try{spent=sessionStorage.getItem(K)==="1";if(!spent)sessionStorage.setItem(K,"1")}catch(_){spent=1}` +
    `if(!spent){location.reload();return}` +
    `var b=document.createElement("button");b.type="button";b.id="boot-watchdog";b.textContent=${T};` +
    `var s=b.style;s.position="fixed";s.left="16px";s.right="16px";s.bottom="24px";s.zIndex="2147483647";` +
    `s.padding="16px";s.fontSize="16px";s.fontFamily="system-ui,sans-serif";s.borderRadius="12px";s.border="0";` +
    `s.background="#ffffff";s.color="#141519";s.boxShadow="0 4px 24px rgba(0,0,0,.4)";` +
    `b.onclick=function(){location.reload()};(document.body||document.documentElement).appendChild(b)}` +
    `function later(ms){setTimeout(fail,ms)}` +
    `window.addEventListener("load",function(){later(6000)});` +
    `document.addEventListener("error",function(e){var t=e.target;if(!t)return;` +
    `var u=t.tagName==="SCRIPT"?t.src:(t.tagName==="LINK"&&t.rel==="modulepreload"?t.href:"");` +
    `if(u&&u.indexOf("/assets/")>-1)later(1500)},true)})();`
  );
}

declare global {
  interface Window {
    __bcBoot?: () => void;
  }
}
