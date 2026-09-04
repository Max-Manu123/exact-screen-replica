import { supabase } from "@/integrations/supabase/client";

export type FeedbackType = "bug" | "suggestion" | "problem" | "other";
export const FEEDBACK_TYPES: FeedbackType[] = ["bug", "suggestion", "problem", "other"];

export interface FeedbackInput {
  type: FeedbackType;
  message: string;
  rating?: number | null;
}

export async function sendFeedback(input: FeedbackInput): Promise<void> {
  const message = (input.message ?? "").trim();
  if (message.length === 0) throw new Error("empty_message");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("not_authenticated");

  const rating =
    typeof input.rating === "number" && Number.isFinite(input.rating)
      ? Math.min(5, Math.max(1, Math.round(input.rating)))
      : null;

  const { error } = await supabase.from("feedback").insert({
    user_id: userData.user.id,
    type: FEEDBACK_TYPES.includes(input.type) ? input.type : "other",
    message: message.slice(0, 2000),
    rating,
  });
  if (error) throw error;
}
