"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { translateTeam } from "@/lib/teams";

export default function CampeaoPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [existingBet, setExistingBet] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [finalWinner, setFinalWinner] = useState("");

  const deadline = new Date("2026-06-18T23:59:59Z");
  const now = new Date();
  const isOpen = now <= deadline;

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
    // Todos os times distintos
    const { data: matches } = await supabase
      .from("matches")
      .select("home_team, away_team");

    const teamSet = new Set<string>();
    (matches || []).forEach((m: any) => {
      teamSet.add(m.home_team);
      teamSet.add(m.away_team);
    });
    setTeams([...teamSet].sort());

    // Palpite existente
    const { data: bet } = await supabase
      .from("champion_bets")
      .select("team_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (bet) {
      setExistingBet(bet.team_name);
      setSelected(bet.team_name);
    }

    // Verifica se a final já aconteceu
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
      setFinalWinner(winner);
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setMsg("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!userId) return;

    const { error } = await supabase
      .from("champion_bets")
      .upsert(
        { user_id: userId, team_name: selected },
        { onConflict: "user_id" },
      );

    setSaving(false);
    if (error) {
      setMsg("Erro: " + error.message);
    } else {
      setExistingBet(selected);
      setMsg("Palpite salvo!");
    }
  }

  if (!authed || loading) {
    return (
      <div className="layout">
        <Navbar />
        <div className="empty">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Navbar />

      <h2 className="section-title" style={{ marginTop: 0 }}>
        Palpite do Campeão
      </h2>
      <p className="section-subtitle">
        Quem será o campeão da Copa 2026? (+10 pts)
      </p>

      <div className="campeao-card">
        {finalWinner ? (
          <div>
            <p style={{ fontSize: "1.1rem" }}>
              Campeão: <strong>{translateTeam(finalWinner)}</strong>
            </p>
            {existingBet && (
              <p
                style={{
                  color:
                    existingBet === finalWinner ? "var(--green)" : "var(--red)",
                  marginTop: "0.5rem",
                }}
              >
                Seu palpite: {translateTeam(existingBet)}
                {existingBet === finalWinner ? " (+10 pts!)" : ""}
              </p>
            )}
            <p className="closed-text">Aposta encerrada.</p>
          </div>
        ) : isOpen ? (
          <div>
            <p className="deadline">Válido até 18/06/2026</p>

            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Selecione um time...</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {translateTeam(t)}
                </option>
              ))}
            </select>

            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={handleSave}
              disabled={!selected || saving}
            >
              {saving
                ? "Salvando..."
                : existingBet
                  ? "Alterar Palpite"
                  : "Confirmar Palpite"}
            </button>

            {msg && (
              <p
                style={{
                  color: msg.includes("Erro") ? "var(--red)" : "var(--green)",
                  marginTop: "0.5rem",
                  fontSize: "0.85rem",
                }}
              >
                {msg}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="closed-text">As apostas encerraram em 18/06/2026.</p>
            {existingBet && (
              <p style={{ fontWeight: 600, marginTop: "0.5rem" }}>
                Seu palpite: {translateTeam(existingBet)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
