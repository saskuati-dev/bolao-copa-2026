'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { calculatePoints, formatStage } from '@/lib/points';
import { translateTeam } from '@/lib/teams';

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  match_datetime: string;
  stage: string;
  group_name: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
}

interface Vote {
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
}

interface User {
  id: string;
  name: string;
}

export default function ResultadosPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setAuthed(true);
      }
    });
  }, [router]);

  useEffect(() => {
    async function load() {
      if (!authed) return;
      const { data: m } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'FINISHED')
        .order('match_datetime', { ascending: false });
      setMatches(m || []);

      const { data: u } = await supabase.from('users').select('id, name, email');
      const userMap: Record<string, User> = {};
      (u || []).forEach((user: User) => {
        userMap[user.id] = user;
      });
      setUsers(userMap);

      const matchIds = (m || []).map((match) => match.id);
      if (matchIds.length > 0) {
        const { data: v } = await supabase
          .from('votes')
          .select('*')
          .in('match_id', matchIds);
        setAllVotes(v || []);
      }

      setLoading(false);
    }
    load();
  }, [authed]);

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">
          {!authed ? 'Verificando autenticação...' : 'Carregando resultados...'}
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Resultados
      </h2>
      <p className="section-subtitle">
        Jogos finalizados e palpites de cada participante.
      </p>

      {matches.length === 0 ? (
        <div className="empty">Nenhum jogo finalizado ainda.</div>
      ) : (
        matches.map((m) => {
          const matchVotes = allVotes.filter((v) => v.match_id === m.id);
          const dateStr = new Date(m.match_datetime).toLocaleString(
            'pt-BR',
            { dateStyle: 'short', timeStyle: 'short' },
          );

          return (
            <div key={m.id} className="card">
              <div className="match-header">
                <span className="stage-tag">{formatStage(m)}</span>
                <span className="status-tag finished">FINALIZADO</span>
              </div>

              <div className="teams-row">
                <div className="team home">
                  {m.home_flag && <img src={m.home_flag} alt="" />}
                  <span>{translateTeam(m.home_team)}</span>
                </div>
                <span className="score">
                  {m.home_score ?? '-'} x {m.away_score ?? '-'}
                </span>
                <div className="team away">
                  <span>{translateTeam(m.away_team)}</span>
                  {m.away_flag && <img src={m.away_flag} alt="" />}
                </div>
              </div>

              <div className="match-date">{dateStr}</div>

              <div className="vote-section">
                {matchVotes.length === 0 ? (
                  <span className="closed-text">Nenhum palpite registrado.</span>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Usuário</th>
                          <th>Palpite</th>
                          <th>Pontos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchVotes
                          .sort((a, b) => {
                            const pa = calculatePoints(
                              a.home_score, a.away_score,
                              m.home_score!, m.away_score!,
                            );
                            const pb = calculatePoints(
                              b.home_score, b.away_score,
                              m.home_score!, m.away_score!,
                            );
                            return pb - pa;
                          })
                          .map((v) => {
                            const pts = calculatePoints(
                              v.home_score, v.away_score,
                              m.home_score!, m.away_score!,
                            );
                            const cls =
                              pts === 5 ? 'pts-exact' : pts === 3 ? 'pts-good' : 'pts-miss';
                            const name = users[v.user_id]?.name || 'Desconhecido';
                            return (
                              <tr key={v.user_id + v.match_id}>
                                <td>{name}</td>
                                <td>
                                  <strong>
                                    {v.home_score} x {v.away_score}
                                  </strong>
                                </td>
                                <td className={cls}>{pts}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
