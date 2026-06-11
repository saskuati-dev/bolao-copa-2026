"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { calculatePoints } from "@/lib/points";
import { translateTeam } from "@/lib/teams";

interface Vote {
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
}

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  match_datetime: string;
  status: string;
}

export default function PerfilPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    finished: 0,
    exact: 0,
    correct: 0,
    points: 0,
    aproveitamento: 0,
  });
  const [bestMatch, setBestMatch] = useState<{
    match: string;
    vote: string;
    pts: number;
  } | null>(null);
  const [championBet, setChampionBet] = useState("");
  const [championWinner, setChampionWinner] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
      else {
        setAuthed(true);
        loadData(session.user.id);
      }
    });
  }, [router]);

  async function loadData(userId: string) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    setName(
      authUser?.user_metadata?.name || authUser?.email?.split("@")[0] || "",
    );
    setEmail(authUser?.email || "");

    const { data: votes } = await supabase
      .from("votes")
      .select(
        "*, matches!inner(id, home_team, away_team, home_score, away_score, match_datetime, status)",
      )
      .eq("user_id", userId);

    const v: Vote[] = (votes || []) as Vote[];
    const finished = v.filter((vote) => {
      const m = (vote as any).matches as Match;
      return m && m.status === "FINISHED";
    });
    let pts = 0;
    let exact = 0;
    let correct = 0;
    let best: { match: string; vote: string; pts: number } | null = null;

    finished.forEach((vote) => {
      const m = (vote as any).matches as Match;
      if (m && m.home_score != null && m.away_score != null) {
        const p = calculatePoints(
          vote.home_score,
          vote.away_score,
          m.home_score,
          m.away_score,
        );
        pts += p;
        if (p === 5) exact++;
        else if (p === 3) correct++;

        if (!best || p > best.pts) {
          best = {
            match: `${m.home_team} vs ${m.away_team}`,
            vote: `${vote.home_score} x ${vote.away_score}`,
            pts: p,
          };
        }
      }
    });

    const ap =
      finished.length > 0
        ? Math.round(((exact + correct) / finished.length) * 100)
        : 0;

    // Soma +10 se acertou o campeão
    const { data: bet } = await supabase
      .from("champion_bets")
      .select("team_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (bet) {
      setChampionBet(bet.team_name);
      const { data: finalMatch } = await supabase
        .from("matches")
        .select("home_team, away_team, home_score, away_score")
        .eq("stage", "FINAL")
        .eq("status", "FINISHED")
        .maybeSingle();

      if (finalMatch && finalMatch.home_score != null) {
        const winner =
          finalMatch.home_score > finalMatch.away_score
            ? finalMatch.home_team
            : finalMatch.away_team;
        if (bet.team_name === winner) {
          pts += 10;
        }
        setChampionWinner(winner);
      }
    }

    setStats({
      total: v.length,
      finished: finished.length,
      exact,
      correct,
      points: pts,
      aproveitamento: ap,
    });
    setBestMatch(best);
    setLoading(false);
  }

  async function handleSaveName() {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    setSaveMsg("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: authError } = await supabase.auth.updateUser({
      data: { name },
    });
    if (authError) { setSaveMsg("Erro: " + authError.message); setSaving(false); return; }

    const { error: dbError } = await supabase
      .from("users")
      .update({ name })
      .eq("id", user.id);
    if (dbError) { setSaveMsg("Erro: " + dbError.message); setSaving(false); return; }

    setName(name);
    setEditing(false);
    setSaving(false);
    setSaveMsg("");
  }

  function startEditing() {
    setEditName(name);
    setEditing(true);
    setSaveMsg("");
  }

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">Carregando perfil...</div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Perfil
      </h2>

      <div style={{ marginBottom: "1.5rem" }}>
        {editing ? (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{
                padding: "0.4rem 0.6rem",
                fontSize: "1.1rem",
                fontWeight: 700,
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontFamily: "var(--font)",
                flex: "1 1 200px",
              }}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            {saveMsg && <span style={{ color: "var(--red)", fontSize: "0.85rem" }}>{saveMsg}</span>}
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>{name}</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={startEditing}
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            >
              ✏️
            </button>
          </div>
        )}
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.3rem" }}>
          {email}
        </p>
      </div>

      <div className="profile-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.points}</div>
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
      </div>

      {bestMatch && bestMatch.pts > 0 && (
        <div className="admin-section">
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            Melhor palpite
          </p>
          <p style={{ fontSize: "1rem" }}>
            <strong>{bestMatch.match}</strong> — {bestMatch.vote} (
            {bestMatch.pts} pts)
          </p>
        </div>
      )}

      {championBet && (
        <div className="admin-section">
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            Palpite do campeão
          </p>
          <p style={{ fontSize: "1rem" }}>
            <strong>{translateTeam(championBet)}</strong>
            {championWinner && (
              <span
                style={{
                  color:
                    championBet === championWinner
                      ? "var(--green)"
                      : "var(--red)",
                  marginLeft: "0.5rem",
                  fontSize: "0.85rem",
                }}
              >
                {championBet === championWinner ? "✅ +10 pts" : "❌"}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
