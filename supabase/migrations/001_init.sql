-- Habilita extensão para real-time
-- (já deve estar disponível, mas garantimos)
-- create extension if not exists pg_cron;

-- ================================================================
-- TABELA DE PERFIS (linkada ao auth.users do Supabase)
-- ================================================================
create table if not exists public.users (
  id           uuid references auth.users on delete cascade primary key,
  name         text not null,
  email        text not null,
  total_points int default 0,
  deleted_at   timestamptz,
  created_at   timestamptz default now()
);

-- Trigger: cria perfil automaticamente ao criar conta
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ================================================================
-- TABELA DE JOGOS
-- ================================================================
create table if not exists public.matches (
  id             uuid default gen_random_uuid() primary key,
  api_match_id   integer unique,
  home_team      text not null,
  away_team      text not null,
  home_flag      text,
  away_flag      text,
  match_datetime timestamptz not null,
  stage          text not null default 'GROUP',
  group_name     text,
  home_score     integer,
  away_score     integer,
  status         text not null default 'SCHEDULED'
    check (status in ('SCHEDULED','TIMED','LIVE','IN_PLAY','PAUSED','FINISHED','POSTPONED','SUSPENDED','CANCELLED','AWARDED')),
  updated_at     timestamptz default now()
);

-- ================================================================
-- TABELA DE PALPITES
-- ================================================================
create table if not exists public.votes (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.users(id) on delete cascade not null,
  match_id   uuid references public.matches(id) on delete cascade not null,
  home_score integer not null,
  away_score integer not null,
  created_at timestamptz default now(),
  unique(user_id, match_id)
);

-- ================================================================
-- ÍNDICES
-- ================================================================
create index if not exists idx_matches_status   on matches(status);
create index if not exists idx_matches_datetime on matches(match_datetime);
create index if not exists idx_votes_user       on votes(user_id);
create index if not exists idx_votes_match      on votes(match_id);

-- ================================================================
-- FUNÇÃO DE PONTUAÇÃO
-- ================================================================
create or replace function calculate_points(
  vote_home   int,
  vote_away   int,
  actual_home int,
  actual_away int
) returns int as $$
begin
  if vote_home is null or vote_away is null or actual_home is null or actual_away is null then
    return 0;
  end if;

  -- Placar exato: 5 pontos
  if vote_home = actual_home and vote_away = actual_away then
    return 5;
  end if;

  -- Acertou o resultado: 3 pontos
  if (vote_home > vote_away and actual_home > actual_away) or
     (vote_home < vote_away and actual_home < actual_away) or
     (vote_home = vote_away and actual_home = actual_away) then
    return 3;
  end if;

  return 0;
end;
$$ language plpgsql immutable;

-- ================================================================
-- HABILITA REAL-TIME
-- ================================================================
alter publication supabase_realtime add table matches;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
alter table users enable row level security;
alter table matches enable row level security;
alter table votes enable row level security;

-- Users: todos podem ver, só o dono pode editar
create policy "Users are viewable by everyone" on users
  for select using (true);

create policy "Users can update own profile" on users
  for update using (auth.uid() = id);

-- Matches: todos podem ver (somente service_role insere/atualiza)
create policy "Matches are viewable by everyone" on matches
  for select using (true);

-- Votes: cada um gerencia só os seus palpites
create policy "Votes are viewable by everyone" on votes
  for select using (true);

create policy "Users can insert own votes" on votes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own votes" on votes
  for update using (auth.uid() = user_id);
