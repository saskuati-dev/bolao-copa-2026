'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { MatchCard } from '@/components/MatchCard';
import { normalizeTeam } from '@/lib/teams';

interface Match {
  id: string;
  api_match_id: number | null;
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
  time_elapsed?: string | null;
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

export default function HomePage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, Vote>>({});
  const [userId, setUserId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [teamFilter, setTeamFilter] = useState('');
  const [page, setPage] = useState(1);

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
    const { data: m } = await supabase
      .from('matches')
      .select('*')
      .order('match_datetime', { ascending: true });

    setMatches(m || []);

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
      const { data: v } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', session.user.id);
      const map: Record<string, Vote> = {};
      (v || []).forEach((vote: Vote) => {
        map[vote.match_id] = vote;
      });
      setMyVotes(map);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!authed) return;
    loadData();

    const matchesChannel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.new) {
            setMatches((prev) =>
              prev.map((m) => (m.id === payload.new.id ? { ...m, ...(payload.new as Match) } : m)),
            );
          }
        },
      )
      .subscribe();

    const votesChannel = supabase
      .channel('votes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        (payload) => {
          if (payload.eventType === 'DELETE' && payload.old) {
            setMyVotes((prev) => {
              const next = { ...prev };
              delete next[payload.old.match_id];
              return next;
            });
          } else if (payload.new) {
            const row = payload.new as Record<string, unknown>;
            if (row.user_id) {
              setMyVotes((prev) => ({ ...prev, [row.match_id as string]: payload.new as Vote }));
            }
          }
        },
      )
      .subscribe();

    const pollingTimer = setInterval(async () => {
      try {
        const res = await fetch('https://worldcup26.ir/get/games');
        if (!res.ok) return;
        const games: any[] = await res.json();
        setMatches((prev) => {
          const updated = prev.map((m) => {
            if (m.status !== 'LIVE' && m.status !== 'IN_PLAY') return m;
            const mHome = normalizeTeam(m.home_team);
            const mAway = normalizeTeam(m.away_team);
            const mDate = new Date(m.match_datetime).toISOString().slice(0, 10);
            const game = games.find((g: any) => {
              const gDate = g.local_date ? g.local_date.slice(0, 10).split('/').reverse().join('-') : '';
              return normalizeTeam(g.home) === mHome && normalizeTeam(g.away) === mAway && gDate === mDate;
            });
            if (!game) return m;
            let status = m.status;
            let time_elapsed = game.time_elapsed;
            if (game.finished === 'TRUE' || game.time_elapsed === 'finished') {
              status = 'FINISHED';
              time_elapsed = null;
            } else if (game.time_elapsed && game.time_elapsed !== 'notstarted') {
              status = 'IN_PLAY';
            } else {
              time_elapsed = null;
            }
            const homeScore = game.home_score != null ? parseInt(game.home_score, 10) : null;
            const awayScore = game.away_score != null ? parseInt(game.away_score, 10) : null;
            return { ...m, home_score: homeScore, away_score: awayScore, status, time_elapsed };
          });
          return updated;
        });
      } catch {
      }
    }, 30000);

    return () => {
      matchesChannel.unsubscribe();
      votesChannel.unsubscribe();
      clearInterval(pollingTimer);
    };
  }, [loadData, authed]);

  const liveMatches = useMemo(() => {
    const now = new Date();
    return matches.filter((m) =>
      m.status === 'LIVE' ||
      m.status === 'IN_PLAY' ||
      (new Date(m.match_datetime) <= now &&
        !['FINISHED', 'CANCELLED', 'POSTPONED', 'SUSPENDED', 'AWARDED'].includes(m.status)),
    );
  }, [matches]);

  const todayTomorrow = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayAfterTomorrow = new Date(todayStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    return matches.filter(
      (m) =>
        (m.status === 'SCHEDULED' || m.status === 'TIMED') &&
        !myVotes[m.id] &&
        new Date(m.match_datetime) >= todayStart &&
        new Date(m.match_datetime) < dayAfterTomorrow,
    );
  }, [matches, myVotes]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayAfterTomorrow = new Date(todayStart);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const term = teamFilter.toLowerCase();
    return matches.filter(
      (m) =>
        (m.status === 'SCHEDULED' || m.status === 'TIMED') &&
        !myVotes[m.id] &&
        new Date(m.match_datetime) >= dayAfterTomorrow &&
        (!term ||
          m.home_team.toLowerCase().includes(term) ||
          m.away_team.toLowerCase().includes(term)),
    );
  }, [matches, myVotes, teamFilter]);

  const finished = useMemo(() =>
    matches
      .filter((m) => m.status === 'FINISHED')
      .slice(-10)
      .reverse(),
    [matches],
  );

  const PER_PAGE = 10;
  const totalPages = Math.ceil(upcoming.length / PER_PAGE);
  const visibleUpcoming = upcoming.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => { setPage(1); }, [teamFilter]);

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">
          {!authed ? 'Verificando autenticação...' : 'Carregando jogos...'}
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      {liveMatches.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 0, marginBottom: '0.8rem' }}>
              Ao Vivo
            </h2>
          {liveMatches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              existingVote={myVotes[m.id]}
              userId={userId}
              onVoteChange={loadData}
            />
          ))}
        </>
      )}

      {todayTomorrow.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: liveMatches.length > 0 || upcoming.length > 0 ? '1.5rem' : 0 }}>
            Hoje e Amanhã
          </h2>
          {todayTomorrow.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              existingVote={myVotes[m.id]}
              userId={userId}
              onVoteChange={loadData}
            />
          ))}
        </>
      )}

      <h2 className="section-title" style={{ marginTop: liveMatches.length > 0 || todayTomorrow.length > 0 ? '1.5rem' : 0 }}>
        Próximos Jogos
      </h2>

      <input
        type="text"
        value={teamFilter}
        onChange={(e) => setTeamFilter(e.target.value)}
        placeholder="Filtrar por time..."
        style={{
          width: '100%',
          maxWidth: '300px',
          padding: '0.5rem',
          marginBottom: '1rem',
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          fontSize: '0.85rem',
        }}
      />

      {upcoming.length === 0 ? (
        <div className="empty">
          {teamFilter
            ? 'Nenhum jogo encontrado para esse time.'
            : 'Nenhum jogo agendado. Assim que a tabela for divulgada, os jogos aparecerão aqui automaticamente.'}
        </div>
      ) : (
        <>
          {visibleUpcoming.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              existingVote={myVotes[m.id]}
              userId={userId}
              onVoteChange={loadData}
            />
          ))}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.3rem',
              marginTop: '1rem',
              flexWrap: 'wrap',
              fontSize: '0.85rem',
            }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
              {(() => {
                const pages: (number | string)[] = [];
                const delta = 2;
                const left = Math.max(2, page - delta);
                const right = Math.min(totalPages - 1, page + delta);
                pages.push(1);
                if (left > 2) pages.push('...');
                for (let i = left; i <= right; i++) pages.push(i);
                if (right < totalPages - 1) pages.push('...');
                if (totalPages > 1) pages.push(totalPages);
                return pages.map((p, i) =>
                  typeof p === 'string' ? (
                    <span key={`e${i}`} style={{ padding: '0 0.2rem', color: 'var(--text-muted)' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setPage(p)}
                      style={{ minWidth: '2.2rem' }}
                    >
                      {p}
                    </button>
                  )
                );
              })()}
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          )}
        </>
      )}

      {finished.length > 0 && (
        <>
          <h2 className="section-title">Últimos Resultados</h2>
          {finished.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              existingVote={myVotes[m.id]}
              userId={userId}
              onVoteChange={loadData}
            />
          ))}
        </>
      )}
    </div>
  );
}
