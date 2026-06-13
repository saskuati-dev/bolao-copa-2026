'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { translateTeam } from '@/lib/teams';

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  match_datetime: string;
  group_name: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
}

interface Standing {
  team: string;
  pts: number;
  pj: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  sg: number;
}

interface GroupData {
  name: string;
  standings: Standing[];
}

function calculateStandings(matches: Match[]): GroupData[] {
  const groupMap: Record<string, Standing[]> = {};

  for (const m of matches) {
    if (!groupMap[m.group_name]) groupMap[m.group_name] = [];
    const standings = groupMap[m.group_name];

    if (!standings.find((s) => s.team === m.home_team)) {
      standings.push({ team: m.home_team, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 });
    }
    if (!standings.find((s) => s.team === m.away_team)) {
      standings.push({ team: m.away_team, pts: 0, pj: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 });
    }

    if (m.status !== 'FINISHED' || m.home_score == null || m.away_score == null) continue;

    const home = standings.find((s) => s.team === m.home_team)!;
    const away = standings.find((s) => s.team === m.away_team)!;

    home.pj++; away.pj++;
    home.gp += m.home_score; home.gc += m.away_score;
    away.gp += m.away_score; away.gc += m.home_score;
    home.sg = home.gp - home.gc;
    away.sg = away.gp - away.gc;

    if (m.home_score > m.away_score) {
      home.pts += 3; home.v++;
      away.d++;
    } else if (m.home_score < m.away_score) {
      away.pts += 3; away.v++;
      home.d++;
    } else {
      home.pts += 1; away.pts += 1;
      home.e++; away.e++;
    }
  }

  return Object.entries(groupMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, standings]) => ({
      name,
      standings: standings.sort((a, b) =>
        b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || a.team.localeCompare(b.team),
      ),
    }));
}

export default function GruposPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setAuthed(true);
      }
    });
  }, [router]);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_flag, away_flag, match_datetime, group_name, home_score, away_score, status')
      .not('group_name', 'is', null)
      .order('match_datetime', { ascending: true });

    setMatches(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadData();

    const channel = supabase
      .channel('grupos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.new) {
            setMatches((prev) =>
              prev.map((m) =>
                m.id === payload.new.id ? { ...m, ...(payload.new as Match) } : m,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [loadData, authed]);

  const groups = useMemo(() => calculateStandings(matches), [matches]);

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">
          {!authed ? 'Verificando autenticação...' : 'Carregando grupos...'}
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Grupos
      </h2>
      <p className="section-subtitle">
        Classificação dos grupos com base nos jogos finalizados.
      </p>

      <div className="grupos-grid">
        {groups.map((group) => (
          <div key={group.name} className="grupo-card">
            <div className="grupo-card-header">Grupo {group.name}</div>
            <table className="grupo-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Pts</th>
                  <th>PJ</th>
                  <th>V</th>
                  <th>E</th>
                  <th>D</th>
                  <th>GP</th>
                  <th>GC</th>
                  <th>SG</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((s, i) => (
                  <tr key={s.team} className={i < 2 ? 'qualified' : undefined}>
                    <td className="pos">{i + 1}</td>
                    <td className="team-name">{translateTeam(s.team)}</td>
                    <td className="pts">{s.pts}</td>
                    <td>{s.pj}</td>
                    <td>{s.v}</td>
                    <td>{s.e}</td>
                    <td>{s.d}</td>
                    <td>{s.gp}</td>
                    <td>{s.gc}</td>
                    <td className={s.sg > 0 ? 'sg-plus' : s.sg < 0 ? 'sg-minus' : undefined}>
                      {s.sg > 0 ? '+' : ''}{s.sg}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
