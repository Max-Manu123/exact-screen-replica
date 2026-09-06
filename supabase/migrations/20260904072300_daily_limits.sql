CREATE TABLE public.daily_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date text NOT NULL, -- Format: YYYY-MM-DD
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX daily_limits_user_date_idx ON public.daily_limits (user_id, date);
CREATE INDEX daily_limits_user_id_idx ON public.daily_limits (user_id);
CREATE INDEX daily_limits_date_idx ON public.daily_limits (date);

GRANT SELECT, INSERT, UPDATE ON public.daily_limits TO authenticated;
GRANT ALL ON public.daily_limits TO service_role;

ALTER TABLE public.daily_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily limits" ON public.daily_limits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own daily limits" ON public.daily_limits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own daily limits" ON public.daily_limits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_daily_limits_updated_at BEFORE UPDATE ON public.daily_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
