'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { MatchCard } from '@/components/MatchCard';

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
}

interface Vote {
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
}

export default function MeusPalpitesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, Vote>>({});
  const [userId, setUserId] = useState<string | undefined>();
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'abertos' | 'finalizados'>('todos');
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setUserId(session.user.id);
        setAuthed(true);
      }
    });
  }, [router]);

  const loadData = useCallback(async () => {
    if (!userId) return;

    const { data: m } = await supabase
      .from('matches')
      .select('*')
      .order('match_datetime', { ascending: true });

    const { data: v } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', userId);

    const voteMap: Record<string, Vote> = {};
    (v || []).forEach((vote: Vote) => {
      voteMap[vote.match_id] = vote;
    });
    setMyVotes(voteMap);

    const allMatches: Match[] = m || [];
    const votedMatches = allMatches.filter((match) => voteMap[match.id]);
    setMatches(votedMatches);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!authed) return;
    loadData();

    const channel = supabase
      .channel('meus-palpites-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => loadData(),
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadData, authed]);

  const filteredMatches = useMemo(() => {
    const term = teamFilter.toLowerCase();
    return matches.filter((m) => {
      if (term && !m.home_team.toLowerCase().includes(term) && !m.away_team.toLowerCase().includes(term)) {
        return false;
      }
      if (statusFilter === 'abertos') {
        return m.status === 'SCHEDULED' || m.status === 'TIMED' || m.status === 'LIVE' || m.status === 'IN_PLAY';
      }
      if (statusFilter === 'finalizados') {
        return m.status === 'FINISHED';
      }
      return true;
    });
  }, [matches, teamFilter, statusFilter]);

  const PER_PAGE = 10;
  const totalPages = Math.ceil(filteredMatches.length / PER_PAGE);
  const visibleMatches = filteredMatches.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => { setPage(1); }, [teamFilter, statusFilter]);

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">
          {!authed ? 'Verificando autenticação...' : 'Carregando...'}
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Meus Palpites
      </h2>

      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          flexWrap: 'wrap',
          marginBottom: '1.2rem',
        }}
      >
        <input
          type="text"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          placeholder="Filtrar por time..."
          style={{
            flex: '1 1 160px',
            padding: '0.5rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'abertos' | 'finalizados')}
          style={{
            flex: '1 1 150px',
            padding: '0.5rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.85rem',
          }}
        >
          <option value="todos">Todos os status</option>
          <option value="abertos">Abertos</option>
          <option value="finalizados">Finalizados</option>
        </select>
      </div>

      {matches.length === 0 ? (
        <div className="empty">
          Você ainda não palpitol em nenhum jogo.{' '}
          <a href="/" style={{ color: 'var(--primary)' }}>
            Ir para os jogos
          </a>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="empty">
          Nenhum jogo encontrado para esse filtro.
        </div>
      ) : (
        <>
          <p className="section-subtitle">
            {filteredMatches.length} jogo{filteredMatches.length > 1 ? 's' : ''}
          </p>
          {visibleMatches.map((m) => (
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
    </div>
  );
}
