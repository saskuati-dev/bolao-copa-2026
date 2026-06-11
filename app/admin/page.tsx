'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Navbar } from '@/components/Navbar';

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ synced: number; errors: number; total: number } | null>(null);
  const [msg, setMsg] = useState('');
  const [lastSync, setLastSync] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
      else setAuthed(true);
    });
    setLastSync(localStorage.getItem('copa2026_last_sync') || '');
  }, [router]);

  async function handleFetch() {
    setLoading(true);
    setResult(null);
    setMsg('');

    try {
      const API_KEY = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY;
      if (!API_KEY) {
        setMsg('Variável FOOTBALL_DATA_API_KEY não configurada no frontend. Use a API route.');
        setLoading(false);
        return;
      }

      const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': API_KEY },
      });

      if (!res.ok) {
        setMsg(`Erro na API: ${res.status}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      let synced = 0;
      let errors = 0;

      for (const m of data.matches) {
        if (!m.homeTeam?.name || !m.awayTeam?.name) continue;
        const { error } = await supabase.from('matches').upsert(
          {
            api_match_id: m.id,
            home_team: m.homeTeam.name,
            away_team: m.awayTeam.name,
            home_flag: m.homeTeam.crest || null,
            away_flag: m.awayTeam.crest || null,
            match_datetime: m.utcDate,
            stage: m.stage,
            group_name: m.group ? m.group.replace('GROUP_', '') : null,
            home_score: m.score?.fullTime?.home ?? null,
            away_score: m.score?.fullTime?.away ?? null,
            status: m.status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'api_match_id' },
        );
        if (error) errors++;
        else synced++;
      }

      const now = new Date().toLocaleString('pt-BR');
      localStorage.setItem('copa2026_last_sync', now);
      setLastSync(now);
      setResult({ synced, errors, total: data.matches.length });
    } catch (err: any) {
      setMsg(err.message);
    }

    setLoading(false);
  }

  if (!authed) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">Verificando autenticação...</div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>Admin</h2>

      <div className="admin-section">
        <p style={{ margin: 0, marginBottom: '0.8rem' }}>
          Buscar jogos atualizados da API football-data.org e sincronizar com o banco.
        </p>

        {lastSync && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
            Última sincronização: {lastSync}
          </p>
        )}

        <button
          className="btn btn-primary"
          onClick={handleFetch}
          disabled={loading}
        >
          {loading ? 'Buscando...' : 'Buscar Jogos Agora'}
        </button>

        {msg && (
          <p style={{ color: 'var(--red)', marginTop: '0.8rem' }}>{msg}</p>
        )}

        {result && (
          <p style={{ color: 'var(--green)', marginTop: '0.8rem' }}>
            {result.synced} jogos sincronizados, {result.errors} erros (total API: {result.total}).
          </p>
        )}
      </div>
    </div>
  );
}
