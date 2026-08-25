-- 0004 — bannière de profil choisie par l'utilisateur (artwork / screenshot officiel).
alter table public.profiles add column if not exists banner_url text;
