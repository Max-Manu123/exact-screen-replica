import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true });

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ user: data.session?.user ?? null, session: data.session, loading: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Only allow post-login returns to first-party app routes. */
export function isSafeInternalPath(path: string | undefined | null): path is string {
  if (!path) return false;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) {
    return false;
  }
  const pathname = (path.split("?")[0] ?? path).replace(/\/+$/, "") || "/";
  return (
    pathname === "/dashboard" ||
    pathname === "/create" ||
    pathname === "/games" ||
    pathname === "/settings" ||
    pathname === "/generating" ||
    pathname.startsWith("/game/")
  );
}
