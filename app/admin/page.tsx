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
      const res = await fetch('/api/matches');
      const data = await res.json();

      if (!res.ok) {
        setMsg(data.error || `Erro: ${res.status}`);
        setLoading(false);
        return;
      }

      const now = new Date().toLocaleString('pt-BR');
      localStorage.setItem('copa2026_last_sync', now);
      setLastSync(now);
      setResult({ synced: data.synced, errors: data.errors, total: data.total });
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
