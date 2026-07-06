import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthGate from "../../auth/AuthGate";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn()
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signInAnonymously: authMocks.signInAnonymously,
      signInWithOtp: authMocks.signInWithOtp,
      signOut: authMocks.signOut
    }
  }
}));

describe("roadmap/15 dev auth", () => {
  beforeEach(() => {
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } }
    });
    authMocks.signInAnonymously.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("hides the anonymous dev login unless explicitly enabled", async () => {
    vi.stubEnv("VITE_ENABLE_DEV_LOGIN", "false");

    render(
      <AuthGate>
        <div>Authed app</div>
      </AuthGate>
    );

    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue as Dev User" })).toBeNull();
  });

  it("starts an anonymous Supabase session from the dev login button", async () => {
    vi.stubEnv("VITE_ENABLE_DEV_LOGIN", "true");

    render(
      <AuthGate>
        <div>Authed app</div>
      </AuthGate>
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Continue as Dev User" })
    );

    expect(authMocks.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
