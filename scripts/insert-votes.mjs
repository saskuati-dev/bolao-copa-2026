// Script para inserir votos manuais de usuarios que votaram por fora
// Uso:
//   node --env-file=.env scripts/insert-votes.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Erro: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Palpites a inserir: nome_busca, home_score, away_score
const VOTES = [
  { name: 'gordinho', home: 2, away: 0 },
];

async function main() {
  // 1. Buscar usuarios
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, name, email');

  if (userErr) { console.error('Erro users:', userErr); process.exit(1); }

  console.log('Usuarios encontrados:');
  users.forEach(u => console.log(`  ${u.id}  ${u.name}  ${u.email}`));

  // 2. Buscar partida Mexico x Africa do Sul
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, match_datetime, status')
    .ilike('home_team', '%mexico%')
    .ilike('away_team', '%africa%')
    .single();

  if (matchErr) { console.error('Erro match:', matchErr); process.exit(1); }

  console.log(`\nPartida: ${match.id}  ${match.home_team} x ${match.away_team}  [${match.status}]`);

  // 3. Inserir votos
  console.log('\nInserindo votos...');
  for (const t of VOTES) {
    const user = users.find(u =>
      u.name.toLowerCase().includes(t.name) ||
      u.email?.toLowerCase().includes(t.name)
    );

    if (!user) {
      console.log(`  "${t.name}" -> USUARIO NAO ENCONTRADO`);
      continue;
    }

    const { error } = await supabase
      .from('votes')
      .upsert({
        user_id: user.id,
        match_id: match.id,
        home_score: t.home,
        away_score: t.away,
      }, { onConflict: 'user_id, match_id' });

    if (error) {
      console.log(`  ${user.name} -> ${t.home}x${t.away}  ERRO: ${error.message}`);
    } else {
      console.log(`  ${user.name} -> ${t.home}x${t.away}  OK`);
    }
  }

  // 4. Confirmacao
  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, home_score, away_score')
    .eq('match_id', match.id);

  console.log('\nVotos na partida (confirmacao):');
  for (const v of votes || []) {
    const u = users.find(x => x.id === v.user_id);
    const nome = u ? u.name : v.user_id.slice(0, 8);
    console.log(`  ${nome}: ${v.home_score}x${v.away_score}`);
  }
}

main();
