import { supabase } from "@/integrations/supabase/client";
import { sanitizeConfig } from "@/lib/engine/LevelDesignEngine";
import type { GameConfig, GameType } from "@/lib/engine/types";

export interface GameRecord {
  id: string;
  user_id: string;
  name: string;
  original_prompt: string;
  game_type: GameType;
  game_config: GameConfig;
  is_public: boolean;
  share_slug: string;
  created_at: string;
  updated_at: string;
}

export interface DraftGame {
  name: string;
  original_prompt: string;
  game_type: GameType;
  game_config: GameConfig;
}

const DRAFT_KEY = "gameforge.draft";

export function slugify(name: string): string {
  const base = (name || "game")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "game"}-${suffix}`;
}

function normalizeRow(row: Record<string, unknown>): GameRecord {
  return {
    ...(row as unknown as GameRecord),
    game_config: sanitizeConfig(row["game_config"]),
  };
}

export function saveDraft(draft: DraftGame) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
}

export function readDraft(): DraftGame | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftGame;
    return { ...parsed, game_config: sanitizeConfig(parsed.game_config) };
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function listGames(): Promise<GameRecord[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
}

export async function getGame(id: string): Promise<GameRecord | null> {
  const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalizeRow(data as Record<string, unknown>) : null;
}

export async function insertGame(draft: DraftGame): Promise<GameRecord> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("not_authenticated");

  let lastError: unknown = null;
  // Retry on the (very unlikely) slug collision.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("games")
      .insert({
        user_id: userData.user.id,
        name: draft.name.slice(0, 60),
        original_prompt: draft.original_prompt,
        game_type: draft.game_type,
        game_config: draft.game_config as never,
        share_slug: slugify(draft.name),
        is_public: true,
      })
      .select("*")
      .single();
    if (!error && data) return normalizeRow(data as Record<string, unknown>);
    lastError = error;
  }
  throw lastError ?? new Error("insert_failed");
}

export async function updateGame(
  id: string,
  patch: Partial<Pick<GameRecord, "name" | "game_config" | "is_public">>,
): Promise<GameRecord> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload["name"] = patch.name.slice(0, 60);
  if (patch.game_config !== undefined) payload["game_config"] = patch.game_config;
  if (patch.is_public !== undefined) payload["is_public"] = patch.is_public;

  const { data, error } = await supabase
    .from("games")
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeRow(data as Record<string, unknown>);
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test((email ?? "").trim());
}

export type WaitlistResult = "added" | "duplicate";

export async function joinWaitlist(email: string, source: string): Promise<WaitlistResult> {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) throw new Error("invalid_email");
  const { error } = await supabase.from("waitlist").insert({ email: clean, source });
  if (!error) return "added";
  // 23505 = unique violation on the lower(email) index → already on the list.
  if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate")) return "duplicate";
  throw error;
}

export function publicUrlForSlug(slug: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/play/${slug}`;
}
