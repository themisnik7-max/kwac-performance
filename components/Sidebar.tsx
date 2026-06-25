"use client";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/AppContext";

const RED = "#CC2229";

const AGENT_LINKS = [
  { href: "/intelligence", icon: "✦", label: "Intelligence" },
  { href: "/dashboard",    icon: "⊞", label: "Dashboard" },
  { href: "/submit",       icon: "✎", label: "Μετρησιμότητα" },
  { href: "/meeting",      icon: "⬡", label: "Meeting" },
  { href: "/import",       icon: "↑", label: "iList Import" },
  { href: "/profile",      icon: "◎", label: "Χάρτης" },
  { href: "/sprint",       icon: "▶", label: "Sprint Calls" },
  { href: "/board",        icon: "◈", label: "Ανακοινώσεις" },
  { href: "/gps",          icon: "◉", label: "GPS Goals" },
  { href: "/export",       icon: "↓", label: "Export" },
];

const CEO_LINKS = [
  { href: "/monitor", icon: "⊕", label: "Monitor" },
];

export default function Sidebar() {
  const path = usePathname();
  const { role } = useApp();
  const isCeo = role === "ceo" || role === "admin";
  const links = isCeo ? [...AGENT_LINKS, ...CEO_LINKS] : AGENT_LINKS;

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
          return (
            <a key={l.href} href={l.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", margin: "1px 8px", borderRadius: 6, color: active ? "#f0f0f0" : "#555", fontSize: 13, textDecoration: "none", background: active ? "#1e1e1e" : "transparent", borderLeft: active ? `2px solid ${RED}` : "2px solid transparent", fontWeight: active ? 500 : 400, transition: "all .1s" }}>
              <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0, color: active ? RED : "#444" }}>{l.icon}</span>
              <span>{l.label}</span>
            </a>
          );
        })}
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e1e", fontSize: 10, color: "#333", textAlign: "center" }}>KWAC AC · Confidential</div>
    </nav>
  );
}