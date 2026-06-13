"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function Navbar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [votesCount, setVotesCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const name =
          session.user.user_metadata?.name || session.user.email?.split("@")[0];
        setUserName(name || "");
        loadVotesCount(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  async function loadVotesCount(userId: string) {
    const { data } = await supabase
      .from("votes")
      .select("id, matches!inner(status)")
      .eq("user_id", userId)
      .in("matches.status", ["SCHEDULED", "TIMED", "LIVE", "IN_PLAY"]);
    setVotesCount(data?.length || 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const navItems = [
    { href: "/", label: "Jogos" },
    { href: "/meus-palpites", label: "Meus Palpites" },
    { href: "/grupos", label: "Grupos" },
    { href: "/campeao", label: "Campeão" },
    { href: "/resultados", label: "Resultados" },
    { href: "/palpites", label: "Palpites" },
    { href: "/classificacao", label: "Classificação" },
    { href: "/perfil", label: "Perfil" },
    { href: "/admin", label: "Admin" },
  ];

  const isActive = (href: string) =>
    (href === "/" && pathname === "/") ||
    (href !== "/" && pathname.startsWith(href));

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        Bolão Copa do Mudo 2026 🇧🇷🇧🇷🔇🔇🏆🏆
      </Link>

      <div className="navbar-right" ref={menuRef}>
        {votesCount > 0 && <span className="badge">{votesCount}</span>}

        <div className="menu-wrapper">
          <button
            className="btn btn-ghost btn-sm menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {userName} <span className="arrow">▾</span>
          </button>

          {menuOpen && (
            <div className="menu-dropdown">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`menu-item${isActive(item.href) ? " active" : ""}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="menu-divider" />
              <button className="menu-item menu-logout" onClick={handleLogout}>
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
