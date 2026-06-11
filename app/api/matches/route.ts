import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Variáveis de ambiente não configuradas.' }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': API_KEY },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API football-data retornou ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    if (!data.matches?.length) {
      return NextResponse.json({ message: 'Nenhum jogo encontrado.' });
    }

    let synced = 0;
    let errors = 0;

    for (const m of data.matches) {
      if (!m.homeTeam?.name || !m.awayTeam?.name) continue;

      const record: Record<string, any> = {
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

      const { error } = await sb.from('matches').upsert(
        record,
        { onConflict: 'api_match_id' },
      );

      if (error) errors++;
      else synced++;
    }

    return NextResponse.json({ synced, errors, total: data.matches.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
