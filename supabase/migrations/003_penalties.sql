-- Adiciona colunas de pênaltis na tabela de jogos
alter table matches
  add column penalty_home_score int,
  add column penalty_away_score int;

-- Adiciona coluna de previsão de pênaltis na tabela de palpites
alter table votes
  add column predicted_penalties boolean;
