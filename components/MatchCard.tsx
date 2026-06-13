'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  calculatePoints,
  formatStage,
  canVote,
  formatCountdown,
  canHavePenalties,
  hadPenalties,
  calculatePenaltyBonus,
} from '@/lib/points';
import { Toast } from '@/components/Toast';
import { translateTeam } from '@/lib/teams';

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
  home_score: number;
  away_score: number;
  predicted_penalties?: boolean | null;
}

interface Props {
  match: Match;
  existingVote?: Vote;
  userId?: string;
  onVoteChange: () => void;
}

export function MatchCard({ match, existingVote, userId, onVoteChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [homeVal, setHomeVal] = useState(existingVote?.home_score?.toString() || '');
  const [awayVal, setAwayVal] = useState(existingVote?.away_score?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [predictedPenalties, setPredictedPenalties] = useState(existingVote?.predicted_penalties ?? null);

  const knockoutMatch = canHavePenalties(match.stage);
  const hasPens = hadPenalties(match);

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE' || match.status === 'IN_PLAY';
  const canVoteNow = !isFinished && !isLive && canVote(match.match_datetime);
  const msUntil = new Date(match.match_datetime).getTime() - Date.now();
  const minUntil = msUntil / 60000;
  const urgentClass = !isFinished && !isLive && !existingVote
    ? minUntil <= 30 ? 'urgent' : minUntil <= 60 ? 'soon' : ''
    : '';

  const date = new Date(match.match_datetime);
  const dateStr = date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (isFinished || isLive) return;
    const tick = () => setCountdown(formatCountdown(match.match_datetime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match.match_datetime, isFinished, isLive]);

  async function submitVote(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !canVoteNow) return;

    const h = parseInt(homeVal, 10);
    const a = parseInt(awayVal, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError('Preencha os dois placares.');
      return;
    }
    setError('');
    setSaving(true);

    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const name = authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || 'Desconhecido';
      const email = authUser?.email || '';
      await supabase.from('users').upsert({ id: userId, name, email }, { onConflict: 'id' });
    }

    const { error: sbError } = await supabase.from('votes').upsert(
      { user_id: userId, match_id: match.id, home_score: h, away_score: a, predicted_penalties: knockoutMatch ? predictedPenalties : null },
      { onConflict: 'user_id,match_id' },
    );

    setSaving(false);
    if (sbError) {
      setToast({ message: 'Erro ao salvar palpite', type: 'error' });
      setError(sbError.message);
      return;
    }

    setEditing(false);
    setToast({ message: 'Palpite salvo!', type: 'success' });
    onVoteChange();
  }

  function renderVoteSection() {
    if (isFinished) {
      if (!existingVote) return null;
      const pts =
        match.home_score != null
          ? calculatePoints(
              existingVote.home_score,
              existingVote.away_score,
              match.home_score!,
              match.away_score!,
            )
          : null;
      const penaltyPts = knockoutMatch
        ? calculatePenaltyBonus(existingVote.predicted_penalties ?? null, hasPens)
        : 0;
      const totalPts = (pts ?? 0) + penaltyPts;
      const cls = pts === 5 ? 'pts-exact' : pts === 3 ? 'pts-good' : 'pts-miss';
      return (
        <div className="vote-section">
          <span className={`finished-vote ${cls}`}>
            Seu palpite: {existingVote.home_score} x {existingVote.away_score}
            {pts != null && ` (${pts} pts)`}
          </span>
          {knockoutMatch && (
            <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {existingVote.predicted_penalties
                ? 'Previu pênaltis: Sim'
                : 'Previu pênaltis: Não'}
              {penaltyPts > 0 && <span style={{ color: 'var(--green)', marginLeft: '0.3rem' }}>+{penaltyPts}pt</span>}
              {totalPts > 0 && <span style={{ marginLeft: '0.5rem', fontWeight: 600, color: 'var(--primary)' }}>Total: {totalPts} pts</span>}
            </div>
          )}
        </div>
      );
    }

    if (isLive) {
      return (
        <div className="vote-section">
          <span className="closed-text">AO VIVO — palpites encerrados</span>
        </div>
      );
    }

    if (!canVoteNow) {
      return (
        <div className="vote-section">
          <span className="closed-text">
            Palpites encerrados (jogo iniciado)
          </span>
          {existingVote && (
            <div className="existing-vote" style={{ marginTop: '0.3rem' }}>
              Seu palpite: <strong>{existingVote.home_score} x {existingVote.away_score}</strong>
            </div>
          )}
        </div>
      );
    }

    if (!userId) {
      return (
        <div className="vote-section">
          <span className="closed-text">Faça login para palpitar</span>
        </div>
      );
    }

    if (existingVote && !editing) {
      return (
        <div className="vote-section">
          <div className="existing-vote">
            Seu palpite: <strong>{existingVote.home_score} x {existingVote.away_score}</strong>
            {knockoutMatch && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {existingVote.predicted_penalties ? '☑ Pênaltis: Sim' : '☐ Pênaltis: Não'}
              </span>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setHomeVal(existingVote.home_score.toString());
                setAwayVal(existingVote.away_score.toString());
                setPredictedPenalties(existingVote.predicted_penalties ?? null);
                setEditing(true);
              }}
            >
              Editar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="vote-section">
        <form onSubmit={submitVote}>
          <div className="vote-row">
            <input
              type="number"
              min={0}
              max={99}
              value={homeVal}
              onChange={(e) => setHomeVal(e.target.value)}
              placeholder="0"
              required
            />
            <span className="vote-x">x</span>
            <input
              type="number"
              min={0}
              max={99}
              value={awayVal}
              onChange={(e) => setAwayVal(e.target.value)}
              placeholder="0"
              required
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              {saving ? '...' : 'Palpitar'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
            )}
          </div>
          {knockoutMatch && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={predictedPenalties ?? false}
                onChange={(e) => setPredictedPenalties(e.target.checked)}
              />
              Vai para pênaltis? (+1 pt se acertar)
            </label>
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.3rem' }}>{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className={`card ${isLive ? 'live' : ''} ${urgentClass}`}>
      <div className="match-header">
        <span className="stage-tag">{formatStage(match)}</span>
        {isLive && (
          <span className="status-tag live">
            AO VIVO
            {match.time_elapsed && match.time_elapsed !== 'notstarted' && match.time_elapsed !== 'finished'
              ? ` ${match.time_elapsed === 'HT' ? '— HT' : match.time_elapsed === '2H' ? '— 2ºT' : `— ${match.time_elapsed}'`}`
              : ''}
          </span>
        )}
        {isFinished && <span className="status-tag finished">FINALIZADO</span>}
        {!isFinished && !isLive && (
          <span className="countdown">{countdown}</span>
        )}
      </div>

      <div className="teams-row">
        <div className="team home">
          {match.home_flag && <img src={match.home_flag} alt="" />}
          <span>{translateTeam(match.home_team)}</span>
        </div>

        {isFinished || isLive ? (
          <span className="score">
            {match.home_score ?? '-'} x {match.away_score ?? '-'}
            {isFinished && hasPens && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                ({match.penalty_home_score} x {match.penalty_away_score} pen)
              </span>
            )}
          </span>
        ) : (
          <span className="vs">vs</span>
        )}

        <div className="team away">
          <span>{translateTeam(match.away_team)}</span>
          {match.away_flag && <img src={match.away_flag} alt="" />}
        </div>
      </div>

      <div className="match-date">{dateStr}</div>

      {renderVoteSection()}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
