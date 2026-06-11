// Script para buscar jogos da Copa do Mundo via football-data.org
// e sincronizar com o Supabase (roda via GitHub Actions ou local).
//
// Uso local com Node.js 20+:
//   node --env-file=.env scripts/fetch-matches.mjs

import { createClient } from '@supabase/supabase-js';

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Erro: defina FOOTBALL_DATA_API_KEY, NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Buscando jogos da Copa do Mundo 2026...');

const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
  headers: { 'X-Auth-Token': API_KEY },
});

if (!res.ok) {
  console.error(`Erro na API: ${res.status} ${res.statusText}`);
  const body = await res.text();
  console.error(body);
  process.exit(1);
}

const data = await res.json();

if (!data.matches || data.matches.length === 0) {
  console.log('Nenhum jogo encontrado na API.');
  process.exit(0);
}

console.log(`${data.matches.length} jogos recebidos. Sincronizando...`);

let synced = 0;
let errors = 0;

for (const m of data.matches) {
  if (!m.homeTeam?.name || !m.awayTeam?.name) {
    console.log(`  Pulando jogo ${m.id}: times ainda não definidos`);
    continue;
  }
  try {
    const { error } = await sb.from('matches').upsert(
      {
        api_match_id: m.id,
        home_team: m.homeTeam.name,
        away_team: m.awayTeam.name,
        home_flag: m.homeTeam.crest || null,
        away_flag: m.awayTeam.crest || null,
        match_datetime: m.utcDate,
        stage: m.stage,
        group_name: m.group ? m.group.replace('GROUP_', '') : null,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        status: m.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'api_match_id' },
    );

    if (error) {
      console.error(`  Erro no jogo ${m.id}: ${error.message}`);
      errors++;
    } else {
      synced++;
    }
  } catch (err) {
    console.error(`  Erro no jogo ${m.id}: ${err.message}`);
    errors++;
  }
}

console.log(`Pronto! ${synced} jogos sincronizados, ${errors} erros.`);
