'use client';

import { calculatePoints } from '@/lib/points';

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
  penaltyBonus?: number;
}

interface Props {
  ranking: RankingEntry[];
  currentUserId?: string;
}

export function RankingTable({ ranking, currentUserId }: Props) {
  if (ranking.length === 0) {
    return <div className="empty">Nenhum dado de classificação disponível.</div>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Usuário</th>
            <th>Pontos</th>
            <th>Placar exato</th>
            <th>Resultado</th>
            <th>+Pênaltis</th>
            <th>Palpites</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => {
            const pos =
              i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
            return (
              <tr
                key={r.user.id}
                className={r.user.id === currentUserId ? 'highlight' : ''}
              >
                <td className="pos-cell">{pos}</td>
                <td>{r.user.name}</td>
                <td>
                  <strong>{r.total}</strong>
                </td>
                <td>{r.exact}</td>
                <td>{r.correct}</td>
                <td>{r.penaltyBonus ?? 0}</td>
                <td>{r.votes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
