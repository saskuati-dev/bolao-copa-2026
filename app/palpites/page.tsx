'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { calculatePoints, formatStage } from '@/lib/points';
import { translateTeam } from '@/lib/teams';

interface Match {
  id: string;
  home_team: string;
  away_team: string;
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

export default function PalpitesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [filterUser, setFilterUser] = useState('');
  const [filterMatch, setFilterMatch] = useState('');
  const [filterTeam, setFilterTeam] = useState('');

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

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name')
        .order('name');

      const { data: matchesData } = await supabase
        .from('matches')
        .select('id, home_team, away_team, match_datetime, stage, group_name, home_score, away_score, status')
        .order('match_datetime', { ascending: true });

      const { data: votesData } = await supabase
        .from('votes')
        .select('*');

      setUsers(usersData || []);
      setMatches(matchesData || []);
      setVotes(votesData || []);
      setLoading(false);
    }
    load();
  }, [authed]);

  const usersById = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => { map[u.id] = u; });
    return map;
  }, [users]);

  const matchesById = useMemo(() => {
    const map: Record<string, Match> = {};
    matches.forEach((m) => { map[m.id] = m; });
    return map;
  }, [matches]);

  const filtered = useMemo(() => {
    return votes
      .filter((v) => {
        const user = usersById[v.user_id];
        const match = matchesById[v.match_id];
        if (!user || !match) return false;

        if (filterUser && v.user_id !== filterUser) return false;
        if (filterMatch && v.match_id !== filterMatch) return false;
        if (filterTeam) {
          const term = filterTeam.toLowerCase();
          if (
            !match.home_team.toLowerCase().includes(term) &&
            !match.away_team.toLowerCase().includes(term)
          )
            return false;
        }

        return true;
      })
      .sort((a, b) => {
        const ma = matchesById[a.match_id];
        const mb = matchesById[b.match_id];
        if (!ma || !mb) return 0;
        return new Date(ma.match_datetime).getTime() - new Date(mb.match_datetime).getTime();
      });
  }, [votes, usersById, matchesById, filterUser, filterMatch, filterTeam]);

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">
          {!authed ? 'Verificando autenticação...' : 'Carregando palpites...'}
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Palpites
      </h2>

      {/* Filtros */}
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          flexWrap: 'wrap',
          marginBottom: '1.2rem',
        }}
      >
        <select
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setFilterMatch(''); setFilterTeam(''); }}
          style={{
            flex: '1 1 160px',
            padding: '0.5rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          <option value="">Todos os usuários</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select
          value={filterMatch}
          onChange={(e) => { setFilterMatch(e.target.value); setFilterUser(''); setFilterTeam(''); }}
          style={{
            flex: '1 1 200px',
            padding: '0.5rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          <option value="">Todos os jogos</option>
          {matches.map((m) => {
            const d = new Date(m.match_datetime);
            const label = `${translateTeam(m.home_team)} vs ${translateTeam(m.away_team)} — ${d.toLocaleDateString('pt-BR', { dateStyle: 'short' })}`;
            return (
              <option key={m.id} value={m.id}>{label}</option>
            );
          })}
        </select>

        <input
          type="text"
          value={filterTeam}
          onChange={(e) => { setFilterTeam(e.target.value); setFilterUser(''); setFilterMatch(''); }}
          placeholder="Filtrar por time..."
          style={{
            flex: '1 1 140px',
            padding: '0.5rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        />
      </div>

      {/* Resultados */}
      {filtered.length === 0 ? (
        <div className="empty">
          {votes.length === 0
            ? 'Nenhum palpite registrado ainda.'
            : 'Nenhum resultado para esse filtro.'}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Jogo</th>
                <th>Data</th>
                <th>Palpite</th>
                <th>Placar</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const user = usersById[v.user_id];
                const match = matchesById[v.match_id];
                if (!user || !match) return null;

                const d = new Date(match.match_datetime);
                const dateStr = d.toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                });
                const finished = match.status === 'FINISHED';
                const pts =
                  finished && match.home_score != null && match.away_score != null
                    ? calculatePoints(
                        v.home_score,
                        v.away_score,
                        match.home_score,
                        match.away_score,
                      )
                    : null;
                const cls =
                  pts === 5 ? 'pts-exact' : pts === 3 ? 'pts-good' : pts != null ? 'pts-miss' : '';

                return (
                  <tr key={v.user_id + v.match_id}>
                    <td>{user.name}</td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {translateTeam(match.home_team)} vs {translateTeam(match.away_team)}
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {dateStr}
                    </td>
                    <td>
                      <strong>{v.home_score} x {v.away_score}</strong>
                    </td>
                    <td>
                      {finished
                        ? `${match.home_score} x ${match.away_score}`
                        : '-'}
                    </td>
                    <td className={cls}>{pts ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
