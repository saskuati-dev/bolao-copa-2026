"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import {
  calculatePoints,
  calculatePenaltyBonus,
  formatStage,
  canHavePenalties,
} from "@/lib/points";
import { translateTeam } from "@/lib/teams";

interface Vote {
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  predicted_penalties?: boolean | null;
}

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_flag?: string | null;
  away_flag?: string | null;
  home_score: number | null;
  away_score: number | null;
  match_datetime: string;
  status: string;
  stage: string;
  group_name?: string | null;
  penalty_home_score?: number | null;
  penalty_away_score?: number | null;
}

interface UserData {
  id: string;
  name: string;
  total_points: number;
}

export default function PerfilPublicoPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
      } else {
        setAuthed(true);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!authed || !userId) return;
    loadData(userId);
  }, [authed, userId]);

  async function loadData(uid: string) {
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", uid)
      .maybeSingle();

    if (!userData) {
      setLoading(false);
      return;
    }
    setUser(userData);

    const { data: votesData } = await supabase
      .from("votes")
      .select("*, matches!inner(*)")
      .eq("user_id", uid);

    const v: Vote[] = (votesData || []) as Vote[];
    setVotes(v);

    const matchMap: Record<string, Match> = {};
    (votesData || []).forEach((row: any) => {
      if (row.matches) {
        matchMap[row.match_id] = row.matches as Match;
      }
    });
    setMatches(matchMap);
    setLoading(false);
  }

  const stats = useMemo(() => {
    let total = 0;
    let finished = 0;
    let exact = 0;
    let correct = 0;
    let pts = 0;
    let penaltyBonus = 0;
    let bestScore = 0;

    votes.forEach((v) => {
      const m = matches[v.match_id];
      if (!m) return;
      total++;
      if (
        m.status !== "FINISHED" ||
        m.home_score == null ||
        m.away_score == null
      )
        return;
      finished++;

      const p = calculatePoints(
        v.home_score,
        v.away_score,
        m.home_score,
        m.away_score,
      );
      pts += p;
      if (p === 5) {
        exact++;
        correct++;
      } else if (p === 3) correct++;
      if (p > bestScore) bestScore = p;

      if (canHavePenalties(m.stage)) {
        const hadPen =
          m.penalty_home_score != null && m.penalty_away_score != null;
        const pb = calculatePenaltyBonus(v.predicted_penalties ?? null, hadPen);
        penaltyBonus += pb;
        pts += pb;
      }
    });

    return {
      total,
      finished,
      exact,
      correct,
      pts,
      penaltyBonus,
      bestScore,
      aproveitamento:
        finished > 0 ? Math.round(((exact + correct) / finished) * 100) : 0,
    };
  }, [votes, matches]);

  const sortedVotes = useMemo(() => {
    return [...votes].sort((a, b) => {
      const ma = matches[a.match_id];
      const mb = matches[b.match_id];
      if (!ma || !mb) return 0;
      return (
        new Date(ma.match_datetime).getTime() -
        new Date(mb.match_datetime).getTime()
      );
    });
  }, [votes, matches]);

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">Usuário não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        {user.name}
      </h2>

      <div className="profile-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.pts}</div>
          <div className="stat-label">Pontos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Palpites</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.finished}</div>
          <div className="stat-label">Finalizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.exact}</div>
          <div className="stat-label">Placar exato</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.correct}</div>
          <div className="stat-label">Resultado</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.aproveitamento}%</div>
          <div className="stat-label">Aproveitamento</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.penaltyBonus}</div>
          <div className="stat-label">Bônus pênaltis</div>
        </div>
      </div>

      <h3
        className="section-title"
        style={{
          marginTop: "1.5rem",
          marginBottom: "0.8rem",
          fontSize: "1.1rem",
        }}
      >
        Palpites
      </h3>

      {sortedVotes.length === 0 ? (
        <div className="empty">Nenhum palpite registrado.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Jogo</th>
                <th>Data</th>
                <th>Palpite</th>
                <th>Placar</th>
                <th>Pênaltis</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {sortedVotes.map((v) => {
                const m = matches[v.match_id];
                if (!m) return null;
                const finished =
                  m.status === "FINISHED" &&
                  m.home_score != null &&
                  m.away_score != null;
                const pts = finished
                  ? calculatePoints(
                      v.home_score,
                      v.away_score,
                      m.home_score!,
                      m.away_score!,
                    )
                  : null;
                const hadPen =
                  m.penalty_home_score != null && m.penalty_away_score != null;
                const penaltyPts =
                  finished && canHavePenalties(m.stage)
                    ? calculatePenaltyBonus(
                        v.predicted_penalties ?? null,
                        hadPen,
                      )
                    : 0;
                const totalPts = (pts ?? 0) + penaltyPts;
                const cls =
                  pts === 5
                    ? "pts-exact"
                    : pts === 3
                      ? "pts-good"
                      : pts != null
                        ? "pts-miss"
                        : "";
                const d = new Date(m.match_datetime);
                const dateStr = d.toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                });
                return (
                  <tr key={v.match_id}>
                    <td style={{ fontSize: "0.82rem" }}>
                      {translateTeam(m.home_team)} vs{" "}
                      {translateTeam(m.away_team)}
                    </td>
                    <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {dateStr}
                    </td>
                    <td>
                      <strong>
                        {v.home_score} x {v.away_score}
                      </strong>
                    </td>
                    <td>
                      {finished ? `${m.home_score} x ${m.away_score}` : "-"}
                      {hadPen && finished && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            display: "block",
                          }}
                        >
                          ({m.penalty_home_score} x {m.penalty_away_score} pen)
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {canHavePenalties(m.stage)
                        ? v.predicted_penalties
                          ? "Sim"
                          : "Não"
                        : "-"}
                      {penaltyPts > 0 && (
                        <span
                          style={{
                            color: "var(--green)",
                            marginLeft: "0.2rem",
                          }}
                        >
                          +1
                        </span>
                      )}
                    </td>
                    <td className={cls}>
                      {totalPts > 0 ? totalPts : (pts ?? "-")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
