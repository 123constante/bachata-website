// @vitest-environment jsdom
/**
 * /auth: code entry, role step defaults.
 *
 * jsdom does no layout, so nothing here says how the page LOOKS. This pins
 * behaviour only: where a verified code sends the user, what a wrong code
 * shows, and which roles are visible before the user asks for them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { installJsdomPolyfills } from "./jsdomPolyfills";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { signInWithOtp: mocks.signInWithOtp, verifyOtp: mocks.verifyOtp },
    rpc: vi.fn(),
  },
}));
vi.mock("@/lib/auth-intent", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth-intent")>()),
  checkAccountExistsByEmail: vi.fn(async () => "existing"),
}));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("@/components/layout/GlobalLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/city-picker", () => ({ CityPicker: () => <div /> }));
vi.mock("@/assets/bachata-calendar-logo-auth.png", () => ({ default: "logo.png" }));

import Auth from "@/pages/Auth";

const CallbackProbe = () => {
  const loc = useLocation();
  return <div data-testid="callback">{loc.pathname + loc.search}</div>;
};

const renderAuth = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<CallbackProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const reachCodeScreen = async (url: string) => {
  const user = userEvent.setup();
  renderAuth(url);
  await user.type(await screen.findByLabelText("Email"), "ada@example.com");
  await user.click(screen.getByRole("button", { name: /email me a sign-in link/i }));
  await screen.findByText("Check your email");
  return user;
};

beforeEach(() => {
  installJsdomPolyfills();
  // jsdom gap: input-otp's password-manager badge probe calls this on a timer.
  document.elementFromPoint = () => null;
  localStorage.clear();
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockReset();
});
afterEach(() => cleanup());

describe("/auth code entry", () => {
  it("verifies a 8-digit code and lands where the emailed link would (/auth/callback with returnTo)", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    const user = await reachCodeScreen("/auth?mode=signin&returnTo=%2Fevent%2F42");

    await user.type(screen.getByLabelText("8-digit code"), "12345678");

    await waitFor(() =>
      expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "ada@example.com", token: "12345678", type: "email" }),
    );
    const probe = await screen.findByTestId("callback");
    expect(probe.textContent).toBe("/auth/callback?mode=signin&returnTo=%2Fevent%2F42");
  });

  it("shows an inline error for a wrong or expired code and stays on the screen", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const user = await reachCodeScreen("/auth?mode=signin");

    await user.type(screen.getByLabelText("8-digit code"), "00000000");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/wrong or has expired/i);
    expect(screen.getByLabelText("8-digit code").getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByTestId("callback")).toBeNull();
  });

  it("disables Resend during the cooldown", async () => {
    await reachCodeScreen("/auth?mode=signin");
    const resend = screen.getByRole("button", { name: /resend code in/i }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
  });
});

describe("/auth role step", () => {
  it("pre-selects Dancer and hides the other roles until expanded", async () => {
    renderAuth("/auth?mode=signup");

    const dancer = await screen.findByRole("button", { name: /^dancer/i });
    expect(dancer.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /continue as dancer/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^organiser/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^teacher/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /i.m also an organiser/i }));

    expect(screen.getByRole("button", { name: /^organiser/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^teacher/i })).toBeTruthy();
  });
});
