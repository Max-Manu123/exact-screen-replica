CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  original_prompt text NOT NULL DEFAULT '',
  game_type text NOT NULL,
  game_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  share_slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX games_user_id_idx ON public.games (user_id);
CREATE INDEX games_share_slug_idx ON public.games (share_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT SELECT ON public.games TO anon;
GRANT ALL ON public.games TO service_role;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their games" ON public.games FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view public games" ON public.games FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "Owners can create games" ON public.games FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their games" ON public.games FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete their games" ON public.games FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  source text NOT NULL DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX waitlist_email_idx ON public.waitlist (lower(email));

GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT ALL ON public.waitlist TO service_role;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the waitlist" ON public.waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();