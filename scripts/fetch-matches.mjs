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

// Só faz fetch se tiver jogo em andamento ou começando nas próximas 2h
const now = new Date();
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
const twoHoursAhead = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

const { data: active } = await sb
  .from('matches')
  .select('id')
  .or(
    `status.in.(LIVE,IN_PLAY),` +
    `and(match_datetime.gt.${twoHoursAgo},match_datetime.lt.${twoHoursAhead},status.not.in.(FINISHED,CANCELLED,POSTPONED,SUSPENDED,AWARDED))`,
  )
  .limit(1);

if (!active || active.length === 0) {
  console.log('Nenhum jogo ativo ou próximo. Pulando sync.');
  process.exit(0);
}

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
    const record = {
      api_match_id: m.id,
      home_team: m.homeTeam.name,
      away_team: m.awayTeam.name,
      home_flag: m.homeTeam.crest || null,
      away_flag: m.awayTeam.crest || null,
      match_datetime: m.utcDate,
      stage: m.stage,
      group_name: m.group ? m.group.replace('GROUP_', '') : null,
      status: m.status,
      updated_at: new Date().toISOString(),
    };

    if (m.score?.fullTime?.home != null) record.home_score = m.score.fullTime.home;
    if (m.score?.fullTime?.away != null) record.away_score = m.score.fullTime.away;
    if (m.score?.penalties?.home != null && m.score?.penalties?.away != null) {
      record.penalty_home_score = m.score.penalties.home;
      record.penalty_away_score = m.score.penalties.away;
    }

    const { error } = await sb.from('matches').upsert(
      record,
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

// ---- worldcup26.ir live score sync ----
function normalizeTeam(name) {
  const map = {
    'Czech Republic': 'Czechia',
    'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
    'Cape Verde': 'Cape Verde Islands',
    'Democratic Republic of the Congo': 'Congo DR',
  };
  return map[name] || name;
}

console.log('Buscando placares ao vivo de worldcup26.ir...');
const wcRes = await fetch('https://worldcup26.ir/get/games');
if (!wcRes.ok) {
  console.error(`Erro worldcup26.ir: ${wcRes.status} ${wcRes.statusText}`);
} else {
  const wcData = await wcRes.json();
  const { data: allMatches } = await sb.from('matches').select('*');
  const matchMap = new Map();
  for (const m of allMatches || []) {
    const key = `${normalizeTeam(m.home_team)}|${normalizeTeam(m.away_team)}|${new Date(m.match_datetime).toISOString().slice(0, 10)}`;
    matchMap.set(key, m);
  }
  let wcSynced = 0;
  for (const game of wcData) {
    const home = normalizeTeam(game.home);
    const away = normalizeTeam(game.away);
    const gDate = game.local_date ? game.local_date.slice(0, 10).split('/').reverse().join('-') : '';
    const key = `${home}|${away}|${gDate}`;
    const match = matchMap.get(key);
    if (!match) continue;
    let status = match.status;
    let time_elapsed = game.time_elapsed;
    if (game.finished === 'TRUE' || game.time_elapsed === 'finished') {
      status = 'FINISHED';
      time_elapsed = null;
    } else if (game.time_elapsed && game.time_elapsed !== 'notstarted') {
      status = 'LIVE';
    } else {
      time_elapsed = null;
    }
    const homeScore = game.home_score != null ? parseInt(game.home_score, 10) : null;
    const awayScore = game.away_score != null ? parseInt(game.away_score, 10) : null;
    if (match.home_score !== homeScore || match.away_score !== awayScore || match.status !== status || match.time_elapsed !== time_elapsed) {
      const { error } = await sb.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status,
        time_elapsed,
        updated_at: new Date().toISOString(),
      }).eq('id', match.id);
      if (error) {
        console.error(`  Erro atualizando ${home} x ${away}: ${error.message}`);
      } else {
        console.log(`  Atualizado: ${home} ${homeScore ?? '-'} x ${awayScore ?? '-'} ${away} (${time_elapsed || ''})`);
        wcSynced++;
      }
    }
  }
  console.log(`Worldcup26.ir: ${wcSynced} jogos atualizados.`);
}
