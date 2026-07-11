"use client";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { supabase } from "@/lib/supabase";

const RED = "#CC2229";

// `locked` links still navigate normally (simpler and more robust than
// intercepting the click here) — the destination page itself renders
// LockedFeature for anyone who fails its own gate. This is just the visual
// hint so it doesn't look like a normal, fully-working link.
type Ctx = { isCeoOrAdmin: boolean; hasGpiAccess: boolean };
type NavLink = { href: string; icon: string; label: string; locked?: (ctx: Ctx) => boolean };

const AGENT_LINKS: NavLink[] = [
  { href: "/intelligence", icon: "✦", label: "Intelligence OP", locked: (ctx) => !ctx.isCeoOrAdmin },
  { href: "/dashboard",    icon: "⊞", label: "Dashboard" },
  { href: "/submit",       icon: "✎", label: "Μετρησιμότητα" },
  { href: "/meeting",      icon: "⬡", label: "Meeting" },
  { href: "/import",       icon: "↑", label: "iList Import" },
  { href: "/profile",      icon: "◎", label: "Χάρτης" },
  { href: "/sprint",       icon: "▶", label: "Sprint Calls" },
  { href: "/board",        icon: "◈", label: "Ανακοινώσεις" },
  { href: "/gps",            icon: "◉", label: "GPS Goals" },
  { href: "/gpi",            icon: "🔑", label: "GPI", locked: (ctx) => !ctx.hasGpiAccess },
  { href: "/personal-admin", icon: "🎙", label: "Personal Admin" },
  { href: "/export",         icon: "↓", label: "Export" },
];

const CEO_LINKS: NavLink[] = [
  { href: "/monitor", icon: "⊕", label: "Monitor" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { role, agent } = useApp();
  const isCeo = role === "ceo"; // AppContext already folds 'admin' into 'ceo' for this Role type
  const ctx: Ctx = { isCeoOrAdmin: isCeo, hasGpiAccess: isCeo || agent?.gpi_access === true };
  const links = isCeo ? [...AGENT_LINKS, ...CEO_LINKS] : AGENT_LINKS;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "#111111", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column", zIndex: 100, overflowY: "auto" }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: RED, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "white", flexShrink: 0, letterSpacing: "-0.02em" }}>KW</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#f0f0f0", letterSpacing: "-0.01em" }}>KWAC OS</div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>ZadesHome</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "8px 0" }}>
        {links.map(l => {
          const active = path === l.href || path.startsWith(l.href + "/");
          const locked = l.locked?.(ctx) ?? false;
          return (
            <a key={l.href} href={l.href} title={locked ? "Κλειδωμένο feature" : undefined} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", margin: "1px 8px", borderRadius: 6, color: locked ? "#3a3a3a" : active ? "#f0f0f0" : "#555", fontSize: 13, textDecoration: "none", background: active ? "#1e1e1e" : "transparent", borderLeft: active ? `2px solid ${RED}` : "2px solid transparent", fontWeight: active ? 500 : 400, transition: "all .1s" }}>
              <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0, color: locked ? "#3a3a3a" : active ? RED : "#444" }}>{l.icon}</span>
              <span>{l.label}</span>
              {locked && <span style={{ marginLeft: "auto", fontSize: 11 }}>🔒</span>}
            </a>
          );
        })}
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e1e" }}>
        {agent && (
          <div style={{ fontSize: 11, color: "#666", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={agent.email}>
            👤 {agent.full_name || agent.email}
          </div>
        )}
        <button onClick={handleLogout} style={{ width: "100%", padding: "7px 10px", fontSize: 12, fontWeight: 600, background: "#1e1e1e", color: "#999", border: "1px solid #2a2a2a", borderRadius: 6, cursor: "pointer" }}>
          ⏻ Αποσύνδεση
        </button>
        <div style={{ fontSize: 10, color: "#333", textAlign: "center", marginTop: 10 }}>KWAC AC · Confidential</div>
      </div>
    </nav>
  );
}