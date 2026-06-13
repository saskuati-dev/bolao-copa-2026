'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { calculatePoints, calculatePenaltyBonus, formatStage, canHavePenalties, hadPenalties } from '@/lib/points';
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
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}

interface Vote {
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  predicted_penalties?: boolean | null;
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
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: m } = await supabase
        .from('matches')
        .select('*')
        .or(
          `status.eq.FINISHED,` +
          `and(status.in.(LIVE,IN_PLAY,TIMED),match_datetime.lt.${twoHoursAgo},home_score.not.is.null)`,
        )
        .order('match_datetime', { ascending: false });
      setMatches(m || []);

      const { data: u } = await supabase.from('users').select('id, name, email').is('deleted_at', null);
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
                  {hadPenalties(m) && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      ({m.penalty_home_score} x {m.penalty_away_score} pen)
                    </span>
                  )}
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
                            <th>Pênaltis</th>
                            <th>Pontos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchVotes
                            .sort((a, b) => {
                              const pa = calculatePoints(
                                a.home_score, a.away_score,
                                m.home_score ?? 0, m.away_score ?? 0,
                              ) + calculatePenaltyBonus(
                                a.predicted_penalties ?? null,
                                hadPenalties(m),
                              );
                              const pb = calculatePoints(
                                b.home_score, b.away_score,
                                m.home_score ?? 0, m.away_score ?? 0,
                              ) + calculatePenaltyBonus(
                                b.predicted_penalties ?? null,
                                hadPenalties(m),
                              );
                              return pb - pa;
                            })
                            .map((v) => {
                              const pts = calculatePoints(
                                v.home_score, v.away_score,
                                m.home_score ?? 0, m.away_score ?? 0,
                              );
                              const penaltyPts = canHavePenalties(m.stage)
                                ? calculatePenaltyBonus(v.predicted_penalties ?? null, hadPenalties(m))
                                : 0;
                              const totalPts = pts + penaltyPts;
                              const cls = pts === 5 ? 'pts-exact' : pts === 3 ? 'pts-good' : 'pts-miss';
                              const name = users[v.user_id]?.name || 'Desconhecido';
                              return (
                                <tr key={v.user_id + v.match_id}>
                                  <td>{name}</td>
                                  <td>
                                    <strong>
                                      {v.home_score} x {v.away_score}
                                    </strong>
                                  </td>
                                  <td style={{ fontSize: '0.8rem' }}>
                                    {canHavePenalties(m.stage) ? (
                                      <span>
                                        {v.predicted_penalties ? 'Sim' : 'Não'}
                                        {penaltyPts > 0 && <span style={{ color: 'var(--green)', marginLeft: '0.3rem' }}>+1</span>}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className={cls}>{totalPts > 0 ? totalPts : pts}</td>
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
