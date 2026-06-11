-- Tabela de palpites do campeão
create table if not exists public.champion_bets (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.users(id) on delete cascade unique not null,
  team_name  text not null,
  created_at timestamptz default now()
);

alter table champion_bets enable row level security;

create policy "Champion bets are viewable by everyone" on champion_bets
  for select using (true);

create policy "Users can insert own champion bet" on champion_bets
  for insert with check (auth.uid() = user_id);

create policy "Users can update own champion bet" on champion_bets
  for update using (auth.uid() = user_id);
