# Bolão Copa 2026

Bolão da Copa do Mundo 2026 — **Next.js + Supabase + Vercel**.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | [Next.js 15](https://nextjs.org) (App Router) |
| Autenticação | [Supabase Auth](https://supabase.com) — email + senha |
| Banco de dados | Supabase PostgreSQL (plano gratuito) |
| Hospedagem | [Vercel](https://vercel.com) (plano gratuito) |
| API de jogos | [football-data.org](https://football-data.org) (plano gratuito) |

## Setup

### 1. Criar conta no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Em **Authentication > Settings**, desabilite **Confirm email** (para login direto após cadastro)
4. Em **Project Settings > API**, copie:
   - `URL`
   - `anon public key`
   - `service_role key`

### 2. Criar arquivo `.env`

```bash
cp .env.example .env
```

Preencha com os valores do Supabase e football-data.org.

### 3. Rodar a migration

No SQL Editor do Supabase, cole o conteúdo de `supabase/migrations/001_init.sql` e execute.

### 4. Criar conta na football-data.org

Registre-se em [football-data.org](https://www.football-data.org/client/register) e pegue a API key gratuita. Coloque no `.env`.

### 5. Rodar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### 6. Buscar jogos

```bash
node --env-file=.env scripts/fetch-matches.mjs
```

### 7. Deploy no Vercel

1. Crie uma conta em [vercel.com](https://vercel.com)
2. Conecte seu repositório GitHub
3. Adicione as mesmas variáveis do `.env` em **Settings > Environment Variables**
4. Faça deploy

### 8. Automatizar busca (GitHub Actions)

No GitHub, vá em **Settings > Secrets and variables > Actions** e adicione:

- `FOOTBALL_DATA_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

A Action roda a cada 6 horas.

## Pontuação

- **5 pontos** — placar exato
- **3 pontos** — acertou o vencedor/empate mas errou o placar
- **0 pontos** — errou o resultado

## Funcionalidades

- Login/cadastro com email + senha (Supabase Auth)
- Palpites até 20 minutos antes de cada jogo
- Atualização em tempo real via Supabase Realtime
- Página de resultados com todos os palpites
- Ranking com classificação geral
- Dark theme responsivo
