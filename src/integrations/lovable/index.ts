/**
 * Minimal `lovable` integration stub.
 * The auth.tsx route calls `lovable.auth.signInWithOAuth` for Google sign-in.
 * We delegate directly to supabase so the real OAuth flow runs correctly.
 */
import { supabase } from "@/integrations/supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "github" | "facebook",
      options?: { redirect_uri?: string },
    ) => {
      const result = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: options?.redirect_uri,
        },
      });
      if (result.error) throw result.error;
      return result;
    },
  },
};
