'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        if (!name.trim()) {
          setError('Informe seu nome.');
          setLoading(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          window.location.href = '/';
          return;
        }
        setError(
          'Conta criada! Verifique seu email para confirmar, ou desabilite a confirmação no Supabase.',
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao autenticar.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>{isSignup ? 'Criar conta' : 'Entrar'}</h2>
        <p className="subtitle">
          {isSignup
            ? 'Cadastre-se para participar do bolão.'
            : 'Entre com seu email e senha.'}
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className="form-group">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading
              ? 'Aguarde...'
              : isSignup
                ? 'Criar conta'
                : 'Entrar'}
          </button>
        </form>

        <p className="footer-text">
          {isSignup ? (
            <>
              Já tem conta?{' '}
              <Link href="#" onClick={(e) => { e.preventDefault(); setIsSignup(false); setError(''); }}>
                Faça login
              </Link>
            </>
          ) : (
            <>
              Não tem conta?{' '}
              <Link href="#" onClick={(e) => { e.preventDefault(); setIsSignup(true); setError(''); }}>
                Cadastre-se
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
