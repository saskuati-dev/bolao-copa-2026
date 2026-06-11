'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AtualizarSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (type === 'recovery' && accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      }).then(({ data: { session }, error: sessionError }) => {
        if (sessionError || !session) {
          setError('Link inválido ou expirado. Solicite um novo reset de senha.');
          return;
        }
        setReady(true);
      });
    } else {
      setError('Link inválido ou expirado. Solicite um novo reset de senha.');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/login'), 3000);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {success ? (
          <>
            <h2>Senha atualizada!</h2>
            <p className="subtitle">
              Sua senha foi redefinida com sucesso. Redirecionando para o login...
            </p>
            <Link
              href="/login"
              className="btn btn-primary"
              style={{ width: '100%', textAlign: 'center', marginTop: '1rem' }}
            >
              Ir para o login
            </Link>
          </>
        ) : (
          <>
            <h2>Redefinir senha</h2>

            {error && <div className="error">{error}</div>}

            {!ready && !error && (
              <p className="subtitle">Verificando link de recuperação...</p>
            )}

            {ready && (
              <>
                <p className="subtitle">Digite sua nova senha.</p>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="new-password">Nova senha</label>
                    <input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirm-password">Confirmar senha</label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repita a senha"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    disabled={loading}
                  >
                    {loading ? 'Salvando...' : 'Salvar nova senha'}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
