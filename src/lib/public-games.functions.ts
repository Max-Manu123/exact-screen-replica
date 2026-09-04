import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import type { GameConfig, GameType } from "@/lib/engine/types";

export interface PublicGame {
  id: string;
  name: string;
  game_type: GameType;
  game_config: GameConfig;
  share_slug: string;
  created_at: string;
}

export type PublicGameResult =
  | { status: "ok"; game: PublicGame }
  | { status: "private" }
  | { status: "not_found" };

/**
 * Public read for a shared game. Only safe columns are projected and only
 * public rows are returned; a private slug reports "private" without ever
 * exposing its configuration.
 */
export const getPublicGame = createServerFn({ method: "GET" })
  .validator((input) => z.object({ slug: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }): Promise<PublicGameResult> => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: row } = await supabasePublic
      .from("games")
      .select("id, name, game_type, game_config, share_slug, created_at")
      .eq("share_slug", data.slug)
      .eq("is_public", true)
      .maybeSingle();

    if (row) {
      return {
        status: "ok",
        game: {
          id: row.id,
          name: row.name,
          game_type: row.game_type as GameType,
          game_config: row.game_config as unknown as GameConfig,
          share_slug: row.share_slug,
          created_at: row.created_at,
        },
      };
    }

    // Distinguish "private" from "not found" without leaking any game data.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("games")
      .select("id")
      .eq("share_slug", data.slug)
      .maybeSingle();

    return existing ? { status: "private" } : { status: "not_found" };
  });
