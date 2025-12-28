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
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

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
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
