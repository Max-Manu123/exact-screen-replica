CREATE OR REPLACE FUNCTION public.game_visibility(slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.games g WHERE g.share_slug = slug) THEN 'missing'
    WHEN EXISTS (SELECT 1 FROM public.games g WHERE g.share_slug = slug AND g.is_public) THEN 'public'
    ELSE 'private'
  END
$$;

GRANT EXECUTE ON FUNCTION public.game_visibility(text) TO anon, authenticated;