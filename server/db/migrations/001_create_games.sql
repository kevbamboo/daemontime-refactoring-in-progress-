-- Optional setup for a NEW project. Your existing currentGames table needs no
-- replacement or migration for the adapter; do not create daemontime_games.
create table if not exists public."currentGames" (
  game_id uuid primary key default gen_random_uuid(),
  host_id uuid not null,
  host_handle text not null,
  users_in_game uuid[] not null,
  state text not null,
  time_limit smallint not null,
  number_of_problems smallint not null,
  questions text[],
  time_created timestamptz not null default now()
);

alter table public."currentGames" enable row level security;
revoke all on table public."currentGames" from public, anon, authenticated;
grant select, insert, update, delete on table public."currentGames" to service_role;
