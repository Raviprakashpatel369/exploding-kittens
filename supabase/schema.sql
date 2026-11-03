-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.games (
  code        text primary key,
  state       jsonb not null,
  version     integer not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.games enable row level security;

-- Friends-only game: anyone with the anon key can read/create/update a game.
create policy "games_select" on public.games for select using (true);
create policy "games_insert" on public.games for insert with check (true);
create policy "games_update" on public.games for update using (true) with check (true);

-- Push changes to every player in real time.
alter publication supabase_realtime add table public.games;
