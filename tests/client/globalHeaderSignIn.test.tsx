// @vitest-environment jsdom
/**
 * The signed-out "Sign in" entry point in src/components/GlobalHeader.tsx.
 *
 * Each case pins one way the link can be wrong where nobody would notice it:
 * a flash of "Sign in" at a signed-in visitor while auth resolves, a returnTo
 * that is not the page they were on, or a link on the auth pages that points
 * the sign-in form back at itself. jsdom does no layout, so the 44px target and
 * the colour are NOT asserted here; they are checked in the browser.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoading: false,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/contexts/CityContext", () => ({ useCity: () => ({ citySlug: "london" }) }));
vi.mock("@/components/search/HeaderSearch", () => ({ HeaderSearch: () => null }));
vi.mock("@/components/search/SearchTrigger", () => ({ SearchTrigger: () => null }));

import { GlobalHeader } from "@/components/GlobalHeader";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <GlobalHeader />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  auth.user = null;
  auth.isLoading = false;
});

describe("GlobalHeader sign-in link", () => {
  it("signed out: links to /auth with the current page, query included, as returnTo", () => {
    renderAt("/city/london/venues?x=1");
    const link = screen.getByTestId("header-signin-link");
    expect(link.textContent).toBe("Sign in");
    expect(link.getAttribute("href")).toBe(
      "/auth?mode=signin&returnTo=" + encodeURIComponent("/city/london/venues?x=1"),
    );
  });

  it("is absent while auth is still resolving", () => {
    auth.isLoading = true;
    renderAt("/");
    expect(screen.queryByTestId("header-signin-link")).toBeNull();
  });

  it("is absent when signed in", () => {
    auth.user = { id: "u1" };
    renderAt("/");
    expect(screen.queryByTestId("header-signin-link")).toBeNull();
  });

  it("is absent on the auth pages", () => {
    renderAt("/auth?mode=signin");
    expect(screen.queryByTestId("header-signin-link")).toBeNull();
    cleanup();
    renderAt("/auth/callback");
    expect(screen.queryByTestId("header-signin-link")).toBeNull();
  });
});
