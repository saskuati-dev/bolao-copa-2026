'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';
import { RankingTable } from '@/components/RankingTable';
import { calculatePoints } from '@/lib/points';

interface Match {
  id: string;
  home_score: number | null;
  away_score: number | null;
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
  email: string;
  total_points: number;
}

interface RankingEntry {
  user: User;
  total: number;
  exact: number;
  correct: number;
  votes: number;
}

export default function ClassificacaoPage() {
  const router = useRouter();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setAuthed(true);
      }
    });
  }, [router]);

  const load = useCallback(async () => {
    if (!authed) return;

    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('name');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: finished } = await supabase
      .from('matches')
      .select('id, home_score, away_score')
      .or(
        `status.eq.FINISHED,` +
        `and(status.in.(LIVE,IN_PLAY,TIMED),match_datetime.lt.${twoHoursAgo},home_score.not.is.null)`,
      );

    const fMatches: Match[] = finished || [];
    const finishedIds = new Set(fMatches.map((m) => m.id));
    setHasFinished(fMatches.length > 0);

    const { data: allVotes } = await supabase
      .from('votes')
      .select('*')
      .order('created_at');

    const votesData: Vote[] = allVotes || [];

    // Verifica campeão
    let championWinner: string | null = null;
    const { data: final } = await supabase
      .from('matches')
      .select('home_team, away_team, home_score, away_score')
      .eq('stage', 'FINAL')
      .eq('status', 'FINISHED')
      .maybeSingle();

    if (final && final.home_score != null) {
      championWinner =
        final.home_score > final.away_score
          ? final.home_team
          : final.away_team;
    }

    let championBets: Record<string, string> = {};
    if (championWinner) {
      const { data: bets } = await supabase.from('champion_bets').select('*');
      (bets || []).forEach((b: any) => {
        championBets[b.user_id] = b.team_name;
      });
    }

    const entries: RankingEntry[] = (usersData || []).map((u: User) => {
      const userVotes = votesData.filter((v) => v.user_id === u.id);
      const userFinishedVotes = userVotes.filter((v) =>
        finishedIds.has(v.match_id),
      );

      let total = 0;
      let exact = 0;
      let correct = 0;

      userFinishedVotes.forEach((v) => {
        const match = fMatches.find((m) => m.id === v.match_id);
        if (
          !match ||
          match.home_score == null ||
          match.away_score == null
        )
          return;
        const pts = calculatePoints(
          v.home_score,
          v.away_score,
          match.home_score,
          match.away_score,
        );
        total += pts;
        if (pts === 5) { exact++; correct++; }
        else if (pts === 3) correct++;
      });

      if (championBets[u.id] && championBets[u.id] === championWinner) {
        total += 10;
      }

      return {
        user: u,
        total,
        exact,
        correct,
        votes: userVotes.length,
      };
    });

    entries.sort((a, b) => b.total - a.total || b.exact - a.exact);
    setRanking(entries);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id);

    setLoading(false);
  }, [authed]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('classificacao-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => load(),
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [load]);

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">
          {!authed ? 'Verificando autenticação...' : 'Carregando classificação...'}
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Classificação
      </h2>
      <p className="section-subtitle">
        Placar exato = 5 pts &middot; Resultado certo = 3 pts &middot; Errou = 0 pts
      </p>

      {!hasFinished && (
        <p className="section-subtitle" style={{ color: 'var(--yellow)' }}>
          Nenhum jogo finalizado — os pontos aparecerão aqui.
        </p>
      )}

      {ranking.length === 0 ? (
        <div className="empty">Nenhum participante ainda.</div>
      ) : (
        <RankingTable ranking={ranking} currentUserId={currentUserId} />
      )}
    </div>
  );
}
