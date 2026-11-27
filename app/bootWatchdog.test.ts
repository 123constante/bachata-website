// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOOT_WATCHDOG_KEY, BOOT_WATCHDOG_TEXT, bootWatchdogScript } from "./bootWatchdog";

function run() {
  const reload = vi.fn();
  // eslint-disable-next-line no-new-func
  new Function("location", bootWatchdogScript({}))({ reload });
  return reload;
}

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
  document.body.innerHTML = "";
  delete window.__bcBoot;
});

describe("bootWatchdogScript", () => {
  it("is empty with the kill switch", () => {
    expect(bootWatchdogScript({ killSwitch: "off" })).toBe("");
  });

  it("reloads once when the app never boots, then shows the tap line", () => {
    vi.useFakeTimers();
    const reload = run();
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(6000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(BOOT_WATCHDOG_KEY)).toBe("1");

    const reload2 = run();
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(6000);
    expect(reload2).not.toHaveBeenCalled();
    const btn = document.getElementById("boot-watchdog") as HTMLButtonElement;
    expect(btn.textContent).toBe(BOOT_WATCHDOG_TEXT);
    btn.click();
    expect(reload2).toHaveBeenCalledTimes(1);
  });

  it("does nothing once the app has booted, and clears the key", () => {
    vi.useFakeTimers();
    sessionStorage.setItem(BOOT_WATCHDOG_KEY, "1");
    const reload = run();
    window.__bcBoot?.();
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(10000);
    expect(reload).not.toHaveBeenCalled();
    expect(document.getElementById("boot-watchdog")).toBeNull();
    expect(sessionStorage.getItem(BOOT_WATCHDOG_KEY)).toBeNull();
  });

  it("reacts fast to an /assets/ script error, ignores other errors", () => {
    vi.useFakeTimers();
    const reload = run();
    const img = document.createElement("img");
    document.body.appendChild(img);
    img.dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(2000);
    expect(reload).not.toHaveBeenCalled();
    const s = document.createElement("script");
    s.src = "https://www.bachatacalendar.co.uk/assets/entry.client-abc.js";
    document.head.appendChild(s);
    s.dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(1500);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
