"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { authedFetch } from "@/lib/authedFetch";
import { getWeekInfo } from "@/lib/weekInfo";

const RED = "#CC2229";

// Field groups mirror app/api/submit/route.js's XP_MAP exactly — that route
// is the source of truth for both the schema and the point values. Keep
// these two files in sync if either changes.
const SECTIONS = [
  { key: "lead", label: "Lead Generation", color: "#3b82f6", fields: [
    { k: "cold_calls", l: "Cold Calls" },
    { k: "leads_cold", l: "Leads (Cold)" },
    { k: "leads_cultivation", l: "Leads (Cultivation)" },
    { k: "leads_mail", l: "Leads (Mail)" },
    { k: "leads_social", l: "Leads (Social)" },
    { k: "leads_database", l: "Leads (Database)" },
  ]},
  { key: "followup", label: "Follow Up", color: "#f59e0b", fields: [
    { k: "follow_up", l: "Follow Up Calls" },
  ]},
  { key: "meetings_seller", label: "Ραντεβού Πωλητή", color: "#22c55e", fields: [
    { k: "meet1_seller_live", l: "1ο Ραντεβού (ζωντανά)" },
    { k: "meet1_seller_phone", l: "1ο Ραντεβού (τηλεφ.)" },
    { k: "meet2_seller", l: "2ο Ραντεβού" },
  ]},
  { key: "meetings_buyer", label: "Ραντεβού Αγοραστή / Ενοικιαστή", color: "#16a34a", fields: [
    { k: "meet1_buyer_live", l: "Αγοραστής (ζωντανά)" },
    { k: "meet1_buyer_phone", l: "Αγοραστής (τηλεφ.)" },
    { k: "meet1_tenant_live", l: "Ενοικιαστής (ζωντανά)" },
    { k: "meet1_tenant_phone", l: "Ενοικιαστής (τηλεφ.)" },
  ]},
  { key: "mandates", label: "Αναθέσεις", color: RED, fields: [
    { k: "excl_listing_sale", l: "Αποκλειστική Πώλησης" },
    { k: "simple_listing_sale", l: "Απλή Πώλησης" },
    { k: "excl_rental_high", l: "Αποκλειστική Ενοικίου (υψηλό)" },
    { k: "excl_rental_low", l: "Αποκλειστική Ενοικίου (χαμηλό)" },
    { k: "simple_rental", l: "Απλή Ενοικίου" },
  ]},
  { key: "contracts", label: "Συμβόλαια & Προσφορές", color: "#a855f7", fields: [
    { k: "contract_seller", l: "Συμβόλαιο Πωλητή" },
    { k: "contract_buyer", l: "Συμβόλαιο Αγοραστή" },
    { k: "offer_buyer", l: "Προσφορά Αγοραστή" },
    { k: "offer_tenant", l: "Προσφορά Ενοικιαστή" },
    { k: "deposit_office", l: "Προκαταβολή (γραφείο)" },
    { k: "deposit_client", l: "Προκαταβολή (πελάτης)" },
  ]},
  { key: "marketing", label: "Marketing", color: "#06b6d4", fields: [
    { k: "photo_professional", l: "Επαγγελματική Φωτογράφιση" },
    { k: "open_house", l: "Open House" },
    { k: "matterport", l: "Matterport" },
  ]},
  { key: "network", label: "Συνεργασίες & Referrals", color: "#84cc16", fields: [
    { k: "collab_internal", l: "Συνεργασία (εσωτερική)" },
    { k: "collab_external", l: "Συνεργασία (εξωτερική)" },
    { k: "new_partner", l: "Νέος Συνεργάτης" },
    { k: "referral_sent", l: "Παραπομπή (έδωσα)" },
    { k: "referral_received", l: "Παραπομπή (έλαβα)" },
  ]},
  { key: "training", label: "Training & Admin", color: "#f97316", fields: [
    { k: "training_meeting", l: "Εκπαίδευση" },
    { k: "admin_1on1", l: "1-on-1" },
  ]},
];

const XP_MAP = {cold_calls:1,follow_up:1,leads_cold:3,leads_cultivation:3,leads_mail:3,leads_social:3,leads_database:3,meet1_seller_live:15,meet1_seller_phone:10,meet2_seller:25,meet1_buyer_live:15,meet1_buyer_phone:10,meet1_tenant_live:10,meet1_tenant_phone:7,excl_listing_sale:80,simple_listing_sale:40,excl_rental_high:60,excl_rental_low:40,simple_rental:20,contract_seller:150,contract_buyer:150,collab_internal:30,collab_external:30,offer_buyer:10,offer_tenant:10,deposit_office:15,deposit_client:15,photo_professional:5,open_house:20,matterport:15,new_partner:25,referral_sent:10,referral_received:10,training_meeting:5,admin_1on1:5};

function Counter({ value, onChange, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#151515", border: "1px solid #2a2a2a", borderRadius: 8, overflow: "hidden", opacity: disabled ? 0.5 : 1 }}>
      <button disabled={disabled} onClick={() => onChange(Math.max(0, (value || 0) - 1))} style={{ width: 32, height: 36, background: "transparent", border: "none", color: "#555", fontSize: 18, cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0 }}>−</button>
      <div style={{ width: 40, textAlign: "center", fontSize: 14, fontWeight: 600, color: "#f0f0f0" }}>{value || 0}</div>
      <button disabled={disabled} onClick={() => onChange((value || 0) + 1)} style={{ width: 32, height: 36, background: "transparent", border: "none", color: "#555", fontSize: 18, cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0 }}>+</button>
    </div>
  );
}

export default function SubmitPage() {
  const { agent, loading: agentLoading } = useApp();
  const init = SECTIONS.reduce((acc, s) => { s.fields.forEach(f => acc[f.k] = 0); return acc; }, {});
  const [vals, setVals] = useState(init);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [isEditable, setIsEditable] = useState(true);
  const [error, setError] = useState("");

  const now = new Date();
  const { week, year } = getWeekInfo(now);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));
  const totalXP = Object.entries(vals).reduce((sum, [k, v]) => sum + (XP_MAP[k] || 0) * (v || 0), 0);

  useEffect(() => {
    if (!agent) { setLoadingExisting(false); return; }
    authedFetch(`/api/submit?agent_id=${agent.id}&week=${week}&year=${year}`)
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          const next = { ...init };
          Object.keys(init).forEach(k => { if (data[k] != null) next[k] = data[k]; });
          setVals(next);
          setIsEditable(data.is_editable !== false);
        }
        setLoadingExisting(false);
      })
      .catch(() => setLoadingExisting(false));
  }, [agent]);

  async function save() {
    if (!agent) return;
    setSaving(true); setError("");
    try {
      const res = await authedFetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agent.id, week_number: week, year, data: vals }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Κάτι πήγε στραβά"); setSaving(false); return; }
      setSaved(true);
    } catch (e) {
      setError("Κάτι πήγε στραβά — δοκίμασε ξανά");
    } finally {
      setSaving(false);
    }
  }

  if (agentLoading || loadingExisting) {
    return <div style={{ padding: "32px 40px", minHeight: "100vh", background: "#0d0d0d", color: "#888" }}>Φόρτωση...</div>;
  }
  if (!agent) {
    return <div style={{ padding: "32px 40px", minHeight: "100vh", background: "#0d0d0d", color: "#888" }}>Χρειάζεται σύνδεση για να υποβάλεις δεδομένα.</div>;
  }

  const locked = !isEditable;

  return (
    <div style={{ padding: "32px 40px", minHeight: "100vh", background: "#0d0d0d" }}>
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 6 }}>Μετρησιμότητα</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#f0f0f0", margin: 0 }}>Εβδομαδιαίες ενέργειες</h1>
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            Εβδομάδα {week}/{year} · {weekStart.toLocaleDateString("el-GR")} · Deadline Κυριακή 23:59
            {locked && <span style={{ color: RED, marginLeft: 8 }}>· Κλειδωμένο (έχει κλείσει η εβδομάδα)</span>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>XP εβδομάδας</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: RED, letterSpacing: "-0.02em" }}>{totalXP}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {SECTIONS.map(sec => (
          <div key={sec.key} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "20px", borderTop: "2px solid " + sec.color }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: sec.color, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 16 }}>{sec.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sec.fields.map(f => (
                <div key={f.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "#888", flex: 1 }}>{f.l}</span>
                  <Counter value={vals[f.k]} onChange={v => set(f.k, v)} disabled={locked} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(204,34,41,0.08)", border: "1px solid rgba(204,34,41,0.2)", borderRadius: 8, color: RED, fontSize: 13 }}>{error}</div>}

      {locked
        ? <div style={{ padding: "16px 24px", background: "#151515", border: "1px solid #2a2a2a", borderRadius: 12, color: "#888", fontWeight: 500, fontSize: 14 }}>Η εβδομάδα έχει κλείσει — δεν μπορείς να κάνεις αλλαγές.</div>
        : saved
          ? <div style={{ padding: "16px 24px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, color: "#22c55e", fontWeight: 500, fontSize: 14 }}>✓ Αποθηκεύτηκε — καλή εβδομάδα!</div>
          : <button onClick={save} disabled={saving} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: saving ? "#1a1a1a" : RED, color: saving ? "#555" : "white", fontSize: 15, fontWeight: 600, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Αποθήκευση..." : "Αποθήκευση εβδομάδας →"}
            </button>
      }
    </div>
  );
}
