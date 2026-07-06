import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthGate.");
  }
  return value;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error" | "dev-error">("idle");

  const devLoginEnabled =
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_LOGIN === "true";

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleSendLink = async () => {
    if (!email.trim()) return;
    const redirectTo =
      import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo
      }
    });
    setStatus(error ? "error" : "sent");
  };

  const handleDevLogin = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    setStatus(error ? "dev-error" : "idle");
  };

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      signOut: async () => {
        await supabase.auth.signOut();
      }
    }),
    [session]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment/80 flex items-center justify-center">
        <div className="text-sm font-ui text-ink-soft">Loading session…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-parchment/80 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-page-edge bg-parchment/90 shadow-page p-6 space-y-4">
          <div className="text-2xl font-display text-ink">Welcome back</div>
          <p className="text-sm font-ui text-ink-soft">
            Sign in with a magic link to access your world vault.
          </p>
          {devLoginEnabled && (
            <button
              onClick={() => handleDevLogin().catch(() => setStatus("dev-error"))}
              className="w-full rounded-xl border border-ember/40 bg-ember/10 px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ember hover:bg-ember/15"
            >
              Continue as Dev User
            </button>
          )}
          {devLoginEnabled && (
            <div className="flex items-center gap-3 text-[10px] font-ui uppercase tracking-[0.2em] text-ink-faint">
              <div className="h-px flex-1 bg-page-edge" />
              <span>or</span>
              <div className="h-px flex-1 bg-page-edge" />
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@adventure.com"
            className="w-full rounded-xl border border-page-edge bg-parchment/80 px-4 py-2 text-sm font-ui"
          />
          <button
            onClick={() => handleSendLink().catch(() => undefined)}
            className="w-full rounded-xl border border-page-edge px-4 py-2 text-xs font-ui uppercase tracking-[0.2em] text-ink-soft hover:text-ember"
          >
            Send Magic Link
          </button>
          {status === "sent" && (
            <div className="text-xs font-ui text-ink-soft">
              Link sent. Check your inbox.
            </div>
          )}
          {status === "error" && (
            <div className="text-xs font-ui text-ember">
              Could not send link. Check your email and try again.
            </div>
          )}
          {status === "dev-error" && (
            <div className="text-xs font-ui text-ember">
              Could not start a dev session. Check local Supabase anonymous auth.
            </div>
          )}
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
