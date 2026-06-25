// QuickLinks.tsx — RSC (no 'use client')
// Hover behaviour is driven by a scoped <style> tag — zero client-side JS.
// All anchors carry rel="noopener noreferrer" to prevent tab-napping.

import type { ReactNode } from "react";

const RED = "#CC2229";

interface Shortcut {
  href: string;
  label: string;
  brandColor: string;
  icon: ReactNode;
}

const SHORTCUTS: Shortcut[] = [
  {
    href: "https://mail.google.com",
    label: "Gmail",
    brandColor: "#EA4335",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="4" width="20" height="16" rx="2" stroke="#EA4335" strokeWidth="1.6" fill="none"/>
        <path d="M2 7l10 7 10-7" stroke="#EA4335" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "https://www.google.com",
    label: "Google",
    brandColor: "#4285F4",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5c-.2 1.2-1 2.3-2 3v2.5h3.3c1.9-1.8 3-4.4 3-7.2z" fill="#4285F4"/>
        <path d="M12 22c2.8 0 5.1-.9 6.8-2.5l-3.3-2.5c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.8v2.6C4.5 19.8 8 22 12 22z" fill="#34A853"/>
        <path d="M6.2 13.7c-.2-.6-.3-1.2-.3-1.7s.1-1.2.3-1.7V7.7H2.8C2.3 8.8 2 10 2 12s.3 3.2.8 4.3l3.4-2.6z" fill="#FBBC05"/>
        <path d="M12 7c1.5 0 2.9.5 3.9 1.5l2.9-2.9C17.1 3.9 14.8 3 12 3 8 3 4.5 5.2 2.8 8.5l3.4 2.6C7 8.8 9.3 7 12 7z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    href: "https://www.instagram.com",
    label: "Instagram",
    brandColor: "#E1306C",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="#E1306C" strokeWidth="1.8"/>
        <circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="1.8"/>
        <circle cx="17.5" cy="6.5" r="1.1" fill="#E1306C"/>
      </svg>
    ),
  },
  {
    href: "https://www.linkedin.com",
    label: "LinkedIn",
    brandColor: "#0A66C2",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2"/>
        <rect x="6" y="10" width="2.5" height="8" fill="white"/>
        <circle cx="7.25" cy="7.25" r="1.5" fill="white"/>
        <path d="M11 10h2.5v1.1c.4-.7 1.3-1.3 2.5-1.3 2.2 0 3 1.5 3 3.5V18h-2.5v-4.4c0-1-.3-1.7-1.2-1.7-.9 0-1.3.7-1.3 1.7V18H11V10z" fill="white"/>
      </svg>
    ),
  },
  {
    href: "https://www.facebook.com",
    label: "Facebook",
    brandColor: "#1877F2",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#1877F2"/>
        <path d="M13.5 8.5h1.5V6h-1.8c-2 0-2.7 1.3-2.7 2.5V10H9v2.5h1.5V18h2.5v-5.5H15l.4-2.5h-2.4V8.8c0-.2.1-.3.5-.3z" fill="white"/>
      </svg>
    ),
  },
  {
    href: "https://www.ilist.gr",
    label: "i-list",
    brandColor: "#F59E0B",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L3 9.5V20a1 1 0 001 1h5v-5h6v5h5a1 1 0 001-1V9.5L12 3z" stroke="#F59E0B" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
        <line x1="9" y1="10.5" x2="15" y2="10.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="9" y1="13" x2="15" y2="13" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "https://drive.google.com",
    label: "Drive",
    brandColor: "#34A853",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        {/* Google Drive triangle logo — three coloured segments */}
        <path d="M8.5 3h7L21 14H3L8.5 3z" fill="#FBBC05"/>
        <path d="M3 14l4 7h10l-4-7H3z" fill="#EA4335"/>
        <path d="M13 14l4 7h4l-4-7h-4z" fill="#34A853"/>
        {/* Separator lines */}
        <line x1="3" y1="14" x2="21" y2="14" stroke="#111" strokeWidth="0.5"/>
        <line x1="8.5" y1="3" x2="13" y2="14" stroke="#111" strokeWidth="0.5"/>
      </svg>
    ),
  },
];

export default function QuickLinks() {
  // CSS delivered via <style> tag — keeps this component server-renderable
  // while still providing hover feedback. Class names are prefixed "ql-" to
  // avoid collisions with the rest of the stylesheet.
  const css = `
    .ql-shortcut {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 8px 12px;
      border-radius: 10px;
      background: #151515;
      border: 1px solid #1e1e1e;
      text-decoration: none;
      transition: border-color .15s ease, background .15s ease, transform .15s ease;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .ql-shortcut:hover {
      background: #1c1c1c;
      transform: translateY(-2px);
    }
    .ql-shortcut:hover .ql-dot { opacity: 1 !important; }
    .ql-shortcut-gmail:hover    { border-color: #EA4335; }
    .ql-shortcut-google:hover   { border-color: #4285F4; }
    .ql-shortcut-instagram:hover{ border-color: #E1306C; }
    .ql-shortcut-linkedin:hover { border-color: #0A66C2; }
    .ql-shortcut-facebook:hover { border-color: #1877F2; }
    .ql-shortcut-ilist:hover    { border-color: #F59E0B; }
    .ql-shortcut-drive:hover    { border-color: #34A853; }
    .ql-dot {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      opacity: 0;
      transition: opacity .15s;
    }
  `;

  // Map label → CSS modifier class
  const modifierMap: Record<string, string> = {
    Gmail: "ql-shortcut-gmail",
    Google: "ql-shortcut-google",
    Instagram: "ql-shortcut-instagram",
    LinkedIn: "ql-shortcut-linkedin",
    Facebook: "ql-shortcut-facebook",
    "i-list": "ql-shortcut-ilist",
    Drive: "ql-shortcut-drive",
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div
        style={{
          background: "#111",
          border: "1px solid #1e1e1e",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 20,
        }}
      >
        {/* Section header */}
        <div
          style={{
            fontSize: 11,
            color: "#555",
            textTransform: "uppercase",
            letterSpacing: ".1em",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 3,
              height: 10,
              borderRadius: 2,
              background: RED,
              flexShrink: 0,
            }}
          />
          Γρήγορη πρόσβαση
        </div>

        {/* Shortcuts row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 10,
          }}
        >
          {SHORTCUTS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              title={s.label}
              className={`ql-shortcut ${modifierMap[s.label] ?? ""}`}
            >
              {/* Brand accent dot — visible on hover via CSS */}
              <div
                className="ql-dot"
                style={{ background: s.brandColor }}
              />

              {/* Icon container */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "#1e1e1e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: 11,
                  color: "#666",
                  textAlign: "center",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                  lineHeight: 1.2,
                }}
              >
                {s.label}
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
