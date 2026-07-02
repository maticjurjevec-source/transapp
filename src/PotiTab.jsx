import { useState } from "react";

const loadXlsx = () => new Promise(res => {
  if (window.XLSX) return res(window.XLSX);
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  s.onload = () => res(window.XLSX);
  document.head.appendChild(s);
});

const DATE_RE = /^\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s*$/;
const normDatum = (d) => (d || "").replace(/\s+/g, "").trim();

export default function PotiTab({ showToast }) {
  const [korak, setKorak] = useState("vnos");
  const [loading, setLoading] = useState(false);
  const [podatki, setPodatki] = useState([]);
  const [odprti, setOdprti] = useState({});
  const [iskanje, setIskanje] = useState("");

  const obdelaj = async (file) => {
    if (!file) return;
    setLoading(true);
    showToast && showToast("Berem Excel...");
    try {
      const XLSX = await loadXlsx();
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const rezultat = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
        const postanki = [];
        for (const r of rows) {
          const datum = (r[1] || "").toString().trim();
          const vozilo = (r[3] || "").toString().trim();
          const kraj = (r[10] || "").toString().trim();
          const prihod = (r[14] || "").toString().trim();
          const odhod = (r[16] || "").toString().trim();
          if (DATE_RE.test(datum) && kraj) postanki.push({ datum: normDatum(datum), vozilo, kraj, prihod, odhod });
        }
        rezultat.push({ voznik: name, vozilo: postanki.find(p => p.vozilo)?.vozilo || "", postanki });
      }
      rezultat.sort((a, b) => b.postanki.length - a.postanki.length);
      setPodatki(rezultat);
      setKorak("rezultat");
      const skupaj = rezultat.reduce((a, v) => a + v.postanki.length, 0);
      showToast && showToast(`Prebranih ${rezultat.length} voznikov, ${skupaj} postankov`);
    } catch (err) {
      console.error(err);
      showToast && showToast("Napaka pri branju Excela", true);
    }
    setLoading(false);
  };

  const naloziPriponko = async (e) => {
    const f = e.target?.files?.[0];
    if (f) await obdelaj(f);
    if (e.target) e.target.value = "";
  };

  const toggle = (k) => setOdprti(p => ({ ...p, [k]: !p[k] }));

  const poDnevih = (postanki) => {
    const m = {};
    for (const p of postanki) { (m[p.datum] = m[p.datum] || []).push(p); }
    return Object.entries(m);
  };

  const skupajPostankov = podatki.reduce((a, v) => a + v.postanki.length, 0);
  const filtrirani = podatki.filter(v => {
    if (!iskanje.trim()) return true;
    const q = iskanje.toLowerCase().trim();
    if (v.voznik.toLowerCase().includes(q)) return true;
    if ((v.vozilo || "").toLowerCase().includes(q)) return true;
    return v.postanki.some(p => p.kraj.toLowerCase().includes(q));
  });

  if (korak === "vnos") {
    return (
      <div>
        <div style={st.banner}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>🚚 Poti voznikov</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Naloži tedenski Excel s potmi (potni nalogi iz CVS Mobile). Aplikacija prebere vse postanke po voznikih. V naslednji fazi bo iz tega predlagala voznika za vsak nalog.</div>
        </div>
        <div style={st.card}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0f2744", marginBottom: 12 }}>📂 Naloži Excel poti</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f2744" }}>Berem Excel...</div>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#1d4ed8"; e.currentTarget.style.background = "#eff6ff"; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              onDrop={async e => { e.preventDefault(); e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; const f = e.dataTransfer.files[0]; if (f) await obdelaj(f); }}
              style={{ border: "2px dashed #cbd5e1", borderRadius: 12, padding: "40px 16px", cursor: "pointer", textAlign: "center", background: "#f8fafc", transition: "all 0.2s" }}
            >
              <div style={{ fontSize: 44, marginBottom: 10 }}>🗺️</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f2744", marginBottom: 6 }}>Povleci Excel sem</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Tedenski izpis poti (.xlsx) — en list na voznika</div>
              <input type="file" id="poti-xlsx" accept=".xlsx,.xls" style={{ display: "none" }} onChange={naloziPriponko} />
              <label htmlFor="poti-xlsx" style={{ background: "#0f2744", color: "#fff", padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>📂 Ali izberi datoteko</label>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <button style={st.fBtn} onClick={() => { setKorak("vnos"); setPodatki([]); setIskanje(""); setOdprti({}); }}>← Nov Excel</button>
        <div style={{ fontSize: 12, color: "#64748b" }}>{podatki.length} voznikov · <strong>{skupajPostankov}</strong> postankov</div>
      </div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <input style={{ ...st.inp, paddingLeft: 34 }} placeholder="🔍 Išči po vozniku, vozilu ali kraju..." value={iskanje} onChange={e => setIskanje(e.target.value)} />
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#94a3b8", pointerEvents: "none" }}>🔍</span>
      </div>

      {filtrirani.length === 0 && <div style={st.empty}>Ni zadetkov.</div>}

      {filtrirani.map(v => {
        const odprt = odprti[v.voznik];
        return (
          <div key={v.voznik} style={{ background: "#fff", borderRadius: 12, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <button onClick={() => toggle(v.voznik)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#0f2744,#1d4ed8)", color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{v.voznik.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f2744" }}>{v.voznik}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{v.vozilo || "–"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ background: "#f1f5f9", color: "#0f2744", fontSize: 13, fontWeight: 800, padding: "4px 12px", borderRadius: 20 }}>{v.postanki.length}</span>
                <span style={{ fontSize: 14, color: "#94a3b8", transform: odprt ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
              </div>
            </button>
            {odprt && (
              <div style={{ borderTop: "1px solid #f1f5f9", padding: "8px 12px 12px" }}>
                {v.postanki.length === 0 && <div style={{ fontSize: 13, color: "#94a3b8", padding: "8px 4px" }}>Ni postankov za tega voznika ta teden.</div>}
                {poDnevih(v.postanki).map(([datum, list]) => (
                  <div key={datum} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, paddingLeft: 2 }}>📅 {datum}</div>
                    {list.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "5px 6px", borderBottom: "1px solid #f8fafc" }}>
                        <span style={{ fontSize: 12, fontFamily: "monospace", color: "#64748b", minWidth: 44, paddingTop: 1 }}>{p.prihod || "—"}</span>
                        <span style={{ fontSize: 13, color: "#0f2744" }}>{p.kraj}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const st = {
  banner: { background: "linear-gradient(135deg,#0f2744,#1d4ed8)", borderRadius: 14, padding: 18, color: "#fff", marginBottom: 14 },
  card: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  fBtn: { padding: "6px 12px", borderRadius: 20, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 500, color: "#475569" },
  inp: { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#f8fafc" },
  empty: { textAlign: "center", color: "#94a3b8", padding: "40px 20px", fontSize: 14 },
};
