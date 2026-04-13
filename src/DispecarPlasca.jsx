import { useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const fmt = (iso) => { if (!iso) return "–"; const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`; };
const fmtT = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDT = (iso) => iso ? `${fmt(iso)} ob ${fmtT(iso)}` : "–";

// ─── AI email/doc parser ─────────────────────────────────────────────────────
const JSON_TEMPLATE = `{"stranka":"","blago":"","kolicina":"","teza":"","nakFirma":"","nakKraj":"","nakNaslov":"","nakReferenca":"","nakDatum":"","nakCas":"","razFirma":"","razKraj":"","razNaslov":"","razReferenca":"","razDatum":"","razCas":"","navodila":""}`;

const AI_PROMPT = (doc) => `Si asistent dispečerja transportnega podjetja. Iz dokumenta izvleci podatke za transportni nalog.
Vrni SAMO JSON, brez markdown, brez razlage:
${JSON_TEMPLATE}
Pravila: datumi v YYYY-MM-DD, časi v HH:MM, manjkajoče pusti "".
Dokument:
${doc}`;

const callAI = async (messages) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages })
  });
  const data = await res.json();
  const text = data.content?.map(i=>i.text||"").join("").replace(/```json|```/g,"").trim();
  return JSON.parse(text);
};

const loadPdfJs = () => new Promise((resolve) => {
  if (window.pdfjsLib) return resolve(window.pdfjsLib);
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  script.onload = () => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    resolve(window.pdfjsLib);
  };
  document.head.appendChild(script);
});

const pdfToText = async (arrayBuffer) => {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(" ") + "\n";
  }
  return fullText.trim();
};

const pdfToImage = async (arrayBuffer) => {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
};

const readFileContent = async (file) => {
  if (file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();
    // Try text extraction first
    try {
      const text = await pdfToText(arrayBuffer);
      if (text.length > 50) return { type:"text", data: text };
    } catch(e) {}
    // Fallback: render as image
    const imgData = await pdfToImage(arrayBuffer);
    return { type:"image", data: imgData, mime:"image/jpeg" };
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    if (file.type.startsWith("image/")) {
      reader.onload = (e) => resolve({ type:"image", data: e.target.result, mime: file.type });
      reader.readAsDataURL(file);
    } else {
      reader.onload = (e) => resolve({ type:"text", data: e.target.result });
      reader.readAsText(file);
    }
  });
};

// ─── Demo data ───────────────────────────────────────────────────────────────
const VOZNIKI = [
  { id:"V001", ime:"Adnan Mujkanovic",  vozilo:"CE-ES-555", tel:"" },
  { id:"V002", ime:"Armin Gluhic",      vozilo:"CE LU-099", tel:"" },
  { id:"V003", ime:"Edin Vejzovic",     vozilo:"CE-18-IFU", tel:"" },
  { id:"V004", ime:"Fuad Smajlovic",    vozilo:"CE-PG-007", tel:"" },
  { id:"V005", ime:"Ismet Pelto",       vozilo:"CE-IT-446", tel:"" },
  { id:"V006", ime:"Jasmin Dulic",      vozilo:"CE-03-HFK", tel:"" },
  { id:"V007", ime:"Muris Saltagic",    vozilo:"CE-TU-958", tel:"" },
  { id:"V008", ime:"Nahid Ascic",       vozilo:"CE-40-BRE", tel:"" },
  { id:"V009", ime:"Nedim Halilovic",   vozilo:"CE-PN-300", tel:"" },
  { id:"V010", ime:"Nijaz Ascic",       vozilo:"CE-BI-459", tel:"" },
  { id:"V011", ime:"Rasim Mujanovic",   vozilo:"CE-EM-850", tel:"" },
  { id:"V012", ime:"Safet Hodzic",      vozilo:"CE-AK-700", tel:"" },
  { id:"V013", ime:"Samir Muhamedovic", vozilo:"CE-02-HFK", tel:"" },
  { id:"V014", ime:"Sead Bajramovic",   vozilo:"CE-TU-959", tel:"" },
  { id:"V016", ime:"Sulejman Mujcinovic",vozilo:"CE-LI-731", tel:"" },
];

const genId = (nalogi) => {
  const leto = new Date().getFullYear();
  const zadnja = nalogi
    .map(n => parseInt(n.stevilkaNaloga?.split("-")[2]) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `NAL-${leto}-${String(zadnja + 1).padStart(3, "0")}`;
};

const DEMO_NALOGI = [
  { id:"NAL-2025-0041", stevilkaNaloga:"NAL-2025-0041", voznikId:"V001", status:"v_tranzitu",
    stranka:"Müller GmbH", blago:"Avtomobilski deli", kolicina:"24 palet", teza:"18.500 kg",
    nakFirma:"Logistika d.o.o.", nakKraj:"Ljubljana", nakNaslov:"Dunajska cesta 5, 1000 Ljubljana", nakReferenca:"REF-NAK-88123", nakDatum:"2025-04-10", nakCas:"07:00",
    razFirma:"Müller GmbH", razKraj:"München", razNaslov:"Schillerstraße 12, 80336 München", razReferenca:"REF-RAZ-99541", razDatum:"2025-04-11", razCas:"14:00",
    navodila:"Blago krhko – previdno ravnanje!", poslan:new Date(Date.now()-7200000).toISOString(), sprejetCas:new Date(Date.now()-6000000).toISOString(), zakljucenCas:null, cmrSlike:[], cmrPdf:null },
  { id:"NAL-2025-0042", stevilkaNaloga:"NAL-2025-0042", voznikId:"V002", status:"poslan",
    stranka:"Kaufland Logistik", blago:"Živila – suho blago", kolicina:"33 palet", teza:"22.000 kg",
    nakFirma:"Koper Terminal d.d.", nakKraj:"Koper", nakNaslov:"Industrijska ulica 8, 6000 Koper", nakReferenca:"REF-NAK-77234", nakDatum:"2025-04-12", nakCas:"05:30",
    razFirma:"Kaufland Berlin", razKraj:"Berlin", razNaslov:"Frankfurter Allee 99, 10247 Berlin", razReferenca:"REF-RAZ-44871", razDatum:"2025-04-14", razCas:"09:00",
    navodila:"Dostava samo s predhodno najavo. CMR mora biti žigosan.", poslan:new Date(Date.now()-3600000).toISOString(), sprejetCas:null, zakljucenCas:null, cmrSlike:[], cmrPdf:null },
  { id:"NAL-2025-0038", stevilkaNaloga:"NAL-2025-0038", voznikId:"V003", status:"zakljucen",
    stranka:"DHL Express", blago:"Elektronska oprema", kolicina:"18 palet", teza:"9.200 kg",
    nakFirma:"DHL Ljubljana", nakKraj:"Ljubljana", nakNaslov:"Letališka cesta 12, 1000 Ljubljana", nakReferenca:"REF-NAK-65001", nakDatum:"2025-04-05", nakCas:"06:00",
    razFirma:"DHL Hamburg", razKraj:"Hamburg", razNaslov:"Am Stadtrand 50, 22047 Hamburg", razReferenca:"REF-RAZ-65002", razDatum:"2025-04-07", razCas:"10:00",
    navodila:"Elektronika – antistatična zaščita obvezna.", poslan:new Date(Date.now()-86400000*5).toISOString(), sprejetCas:new Date(Date.now()-86400000*5+600000).toISOString(), zakljucenCas:new Date(Date.now()-86400000*2).toISOString(), cmrSlike:[], cmrPdf:null },
  { id:"NAL-2025-0039", stevilkaNaloga:"NAL-2025-0039", voznikId:"V001", status:"zakljucen",
    stranka:"Roth GmbH", blago:"Pohištveni elementi", kolicina:"20 palet", teza:"14.000 kg",
    nakFirma:"Roth Maribor", nakKraj:"Maribor", nakNaslov:"Tržaška cesta 5, 2000 Maribor", nakReferenca:"REF-NAK-70011", nakDatum:"2025-04-01", nakCas:"08:00",
    razFirma:"Roth GmbH", razKraj:"Hamburg", razNaslov:"Industriestraße 44, 20539 Hamburg", razReferenca:"REF-RAZ-70012", razDatum:"2025-04-03", razCas:"12:00",
    navodila:"", poslan:new Date(Date.now()-86400000*8).toISOString(), sprejetCas:new Date(Date.now()-86400000*8+900000).toISOString(), zakljucenCas:new Date(Date.now()-86400000*6).toISOString(), cmrSlike:[], cmrPdf:null },
];

const DEMO_OBRACUNI = [
  { id:"OBR-001", voznikId:"V001", datZac:"2025-03-31", datKon:"2025-04-06", km:1840, stranke:4, stroski:[{tip:"vikend",znesek:80,opis:""}], zakljucen:true, zakljucenCas:new Date(Date.now()-86400000*3).toISOString() },
];

const LS = "dispatcher_v1";
const load = () => { try { return JSON.parse(localStorage.getItem(LS))||null; } catch { return null; } };
const save = (s) => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch {} };

const DEMO_RACUNI = [
  { id:"RAC-2025-001", nalogId:"NAL-2025-0038", stranka:"DHL Express", znesek:1240.00, datum:"2025-04-07", rok:"2025-04-37", status:"poslan", opombe:"" },
  { id:"RAC-2025-002", nalogId:"NAL-2025-0039", stranka:"Roth GmbH",   znesek:980.50,  datum:"2025-04-03", rok:"2025-05-03", status:"placano", opombe:"" },
];

const initState = () => load() || { nalogi: DEMO_NALOGI, obracuni: DEMO_OBRACUNI, racuni: DEMO_RACUNI };

const TARIFA_KM = 0.18, TARIFA_STR = 20;

const statusCfg = {
  nov:         { label:"Nov",            color:"#64748b", bg:"#f8fafc", icon:"🔘" },
  poslan:      { label:"Poslan vozniku", color:"#2563eb", bg:"#eff6ff", icon:"📤" },
  sprejet:     { label:"Sprejeto",       color:"#d97706", bg:"#fffbeb", icon:"✅" },
  zakljucen:   { label:"Zaključeno",     color:"#16a34a", bg:"#f0fdf4", icon:"✔️" },
  za_fakturo:  { label:"Za fakturo",     color:"#9333ea", bg:"#faf5ff", icon:"💶" },
  fakturirano: { label:"Fakturirano",    color:"#15803d", bg:"#dcfce7", icon:"🧾" },
};

const STATUS_VRSTNI_RED = ["nov","poslan","sprejet","zakljucen","za_fakturo","fakturirano"];

// ═══════════════════════════════════════════════════════════════════════════
export default function DispecarPlasca() {
  const [st, setSt] = useState(initState);
  const [tab, setTab] = useState("pregled");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [selectedNalog, setSelectedNalog] = useState(null);
  const [selectedObracun, setSelectedObracun] = useState(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upd = (fn) => { const ns = fn(st); setSt(ns); save(ns); };
  const showToast = (txt, err) => { setToast({txt,err}); setTimeout(()=>setToast(null),3500); };
  const closeModal = () => { setModal(null); setForm({}); };

  // Dodeli nalog vozniku in ga pošlji
  const dodelijNalog = (nalogId, voznikId) => {
    upd(s=>({...s, nalogi:s.nalogi.map(n=>n.id===nalogId?{...n, voznikId, status:"poslan", poslanCas:new Date().toISOString()}:n)}));
    const voz = voznik(voznikId);
    showToast(`✅ Nalog poslan vozniku ${voz?.ime}!`);
    setSelectedNalog(null);
  };

  const handleDrop = async (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;
    setAiParsing(true);
    showToast("⏳ AI bere dokument...");
    try {
      const { type, data, mime } = await readFileContent(file);
      let parsed;
      if (type === "image") {
        parsed = await callAI([{ role:"user", content:[
          { type:"image", source:{ type:"base64", media_type: mime, data: data.split(",")[1] }},
          { type:"text", text:`Iz tega dokumenta izvleci podatke za transportni nalog. Vrni SAMO JSON brez markdown:\n${JSON_TEMPLATE}\nPravila: datumi YYYY-MM-DD, časi HH:MM, manjkajoče pusti "".` }
        ]}]);
      } else {
        parsed = await callAI([{ role:"user", content: AI_PROMPT(data) }]);
      }
      setForm(f => ({ ...f, ...parsed }));
      setModal("nov_nalog");
      showToast("✅ AI je izpolnil nalog! Preveri in pošlji.");
    } catch(err) {
      console.error("AI parse error:", err);
      // Fallback: open empty form
      setModal("nov_nalog");
      showToast("⚠️ AI ni mogel prebrati dokumenta – izpolni ročno.", true);
    }
    setAiParsing(false);
  };

  const voznik = (id) => VOZNIKI.find(v=>v.id===id);

  // ── Ustvari nalog ────────────────────────────────────────────────────────
  const openNovNalog = () => {
    setForm({
      voznikId:"", stranka:"", blago:"", kolicina:"", teza:"",
      nakFirma:"", nakKraj:"", nakNaslov:"", nakReferenca:"", nakDatum:"", nakCas:"",
      razFirma:"", razKraj:"", razNaslov:"", razReferenca:"", razDatum:"", razCas:"",
      navodila:"",
    });
    setModal("nov_nalog");
  };

  const submitNovNalog = () => {
    if (!form.stranka||!form.nakKraj||!form.razKraj) return showToast("Izpolni obvezna polja (stranka, kraja)!", true);
    const id = genId(st.nalogi);
    const nalog = {
      ...form, id, stevilkaNaloga: id, status:"nov", poslan: new Date().toISOString(), sprejetCas:null, zakljucenCas:null, cmrSlike:[], cmrPdf:null,
    };
    upd(s=>({...s, nalogi:[nalog,...s.nalogi]}));
    closeModal(); showToast(`✅ Nalog ${id} poslan vozniku ${voznik(form.voznikId)?.ime}!`);
  };

  const izbrisiNalog = (id) => {
    upd(s=>({...s, nalogi:s.nalogi.filter(n=>n.id!==id)}));
    setSelectedNalog(null);
    showToast("Nalog izbrisan.");
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    skupajNalogov: st.nalogi.length,
    novih: st.nalogi.filter(n=>n.status==="nov").length,
    vTranzitu: st.nalogi.filter(n=>["poslan","sprejet"].includes(n.status)).length,
    zakljucenih: st.nalogi.filter(n=>n.status==="zakljucen"||n.status==="za_fakturo"||n.status==="fakturirano").length,
    zaFakturo: st.nalogi.filter(n=>n.status==="za_fakturo").length,
    zakljucenih: st.nalogi.filter(n=>n.status==="zakljucen").length,
    obracunov: st.obracuni.filter(o=>o.zakljucen).length,
  };

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedNalog) {
    const live = st.nalogi.find(n=>n.id===selectedNalog.id) || selectedNalog;
    return (
      <div style={s.wrap}>
        <NalogDetail nalog={live} voznik={voznik(live.voznikId)} vozniki={VOZNIKI} onBack={()=>setSelectedNalog(null)} onIzbrisi={()=>izbrisiNalog(live.id)} onDodeli={(voznikId)=>dodelijNalog(live.id, voznikId)} onSprememba={(id,status)=>{ upd(s=>({...s,nalogi:s.nalogi.map(n=>n.id===id?{...n,status,statusCas:{...n.statusCas,[status]:new Date().toISOString()}}:n)})); showToast(`✅ Status spremenjen: ${statusCfg[status]?.label}`); }} showToast={showToast}/>
        {toast && <Toast toast={toast}/>}
      </div>
    );
  }

  if (selectedObracun) {
    const ob = selectedObracun;
    const voz = voznik(ob.voznikId);
    const zaslKm = ob.km*TARIFA_KM, zaslStr = ob.stranke*TARIFA_STR;
    const skupajOst = (ob.stroski||[]).reduce((a,s)=>a+(parseFloat(s.znesek)||0),0);
    const skupaj = zaslKm+zaslStr+skupajOst;
    return (
      <div style={s.wrap}>
        <div style={s.header}>
          <div style={s.hRow}>
            <button style={s.backBtn} onClick={()=>setSelectedObracun(null)}>← Nazaj</button>
          </div>
          <div style={s.headerTitle}>Obračun – {voz?.ime}</div>
          <div style={s.headerSub}>{fmt(ob.datZac+"T00:00:00")} – {fmt(ob.datKon+"T00:00:00")}</div>
        </div>
        <div style={s.content}>
          <div style={s.obDetailCard}>
            <Row label="Voznik" val={voz?.ime}/><Row label="Vozilo" val={voz?.vozilo}/>
            <Row label="Obdobje" val={`${fmt(ob.datZac+"T00:00:00")} – ${fmt(ob.datKon+"T00:00:00")}`}/>
            <div style={s.divider}/>
            <Row label={`Kilometri (${ob.km?.toLocaleString()} × ${TARIFA_KM} €)`} val={`${zaslKm.toFixed(2)} €`}/>
            <Row label={`Stranke (${ob.stranke} × ${TARIFA_STR} €)`} val={`${zaslStr.toFixed(2)} €`}/>
            {(ob.stroski||[]).map((s2,i)=><Row key={i} label={`Ostalo: ${s2.tip}${s2.opis?" – "+s2.opis:""}`} val={`+ ${parseFloat(s2.znesek).toFixed(2)} €`}/>)}
            <div style={s.divider}/>
            <div style={s.obTotal}><span>SKUPAJ ZA IZPLAČILO</span><span>{skupaj.toFixed(2)} €</span></div>
          </div>
          <div style={s.metaBox}>Poslan: {fmtDT(ob.zakljucenCas)}</div>
        </div>
        {toast && <Toast toast={toast}/>}
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={s.hRow}>
          <div>
            <div style={s.logo}>⚡ TransDispečer</div>
            <div style={s.sub}>Upravljanje transporta · {VOZNIKI.length} voznikov</div>
          </div>
          <button style={s.novNalogBtn} onClick={openNovNalog}>+ Nov nalog</button>
        </div>
      </div>

      {toast && <Toast toast={toast}/>}

      <div style={s.content}>
        {/* AI DROP ZONE */}
        <div
          style={{...s.dropZone,...(dragOver?s.dropZoneActive:{}),...(aiParsing?s.dropZoneParsing:{})}}
          onDragOver={e=>{e.preventDefault();setDragOver(true)}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={handleDrop}
        >
          {aiParsing ? (
            <div style={s.dropContent}>
              <div style={s.dropSpinner}>⏳</div>
              <div style={s.dropTitle}>AI bere dokument...</div>
              <div style={s.dropSub}>Prosim počakaj</div>
            </div>
          ) : (
            <div style={s.dropContent}>
              <div style={s.dropIcon}>🤖</div>
              <div style={s.dropTitle}>{dragOver ? "Spusti dokument!" : "Prenesi nalog sem"}</div>
              <div style={s.dropSub}>PDF · Word · Email · Slika · Besedilo → AI avtomatsko ustvari nalog</div>
              <input type="file" id="doc-upload" style={{display:"none"}} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,image/*" onChange={handleDrop}/>
              <label htmlFor="doc-upload" style={s.dropBtn}>📂 Ali izberi datoteko</label>
            </div>
          )}
        </div>

        {/* NAV TABS */}
        <div style={s.tabs}>
          {[["pregled","📊 Pregled"],["nalogi","📋 Nalogi"],["vozniki","👥 Vozniki"],["obracuni","💶 Obračuni"],["finance","🧾 Finance"]].map(([id,label])=>(
            <button key={id} style={{...s.tab,...(tab===id?s.tabOn:{})}} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>

        {tab==="pregled"  && <PregledTab stats={stats} nalogi={st.nalogi} obracuni={st.obracuni} vozniki={VOZNIKI} onSelectNalog={setSelectedNalog} onSelectObracun={setSelectedObracun}/>}
        {tab==="nalogi"   && <NalogiTab nalogi={st.nalogi} vozniki={VOZNIKI} onSelect={setSelectedNalog} openNovNalog={openNovNalog}/>}
        {tab==="vozniki"  && <VoznikiTab vozniki={VOZNIKI} nalogi={st.nalogi}/>}
        {tab==="obracuni" && <ObracuniTab obracuni={st.obracuni} vozniki={VOZNIKI} onSelect={setSelectedObracun}/>}
        {tab==="finance"  && <FinanceTab st={st} upd={upd} showToast={showToast} nalogi={st.nalogi}/>}
      </div>

      {/* MODAL – nov nalog */}
      {modal==="nov_nalog" && (
        <Modal title="Pošlji nov nalog" onClose={closeModal} wide>
          <div style={s.formGrid}>
            {/* voznik - optional at creation */}
            <div style={s.formFull}>
              <label style={s.label}>Voznik (neobvezno – dodeli pozneje)</label>
              <select style={s.select} value={form.voznikId||""} onChange={e=>setForm(f=>({...f,voznikId:e.target.value}))}>
                <option value="">– Dodeli pozneje –</option>
                {VOZNIKI.map(v=><option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}
              </select>
            </div>
            {/* stranka */}
            <div style={s.formFull}>
              <label style={s.label}>Stranka *</label>
              <input style={s.input} placeholder="Ime stranke" value={form.stranka} onChange={e=>setForm(f=>({...f,stranka:e.target.value}))}/>
            </div>
            {/* blago */}
            <Inp label="Opis blaga" val={form.blago} set={v=>setForm(f=>({...f,blago:v}))} ph="npr. Avtomobilski deli"/>
            <Inp label="Količina" val={form.kolicina} set={v=>setForm(f=>({...f,kolicina:v}))} ph="npr. 24 palet"/>
            <Inp label="Teža" val={form.teza} set={v=>setForm(f=>({...f,teza:v}))} ph="npr. 18.500 kg"/>
            <div style={s.formSpacer}/>

            <div style={s.formDivider}>📍 NAKLAD</div>
            <Inp label="Firma naklada *" val={form.nakFirma} set={v=>setForm(f=>({...f,nakFirma:v}))} ph="Ime podjetja"/>
            <Inp label="Kraj naklada *" val={form.nakKraj} set={v=>setForm(f=>({...f,nakKraj:v}))} ph="npr. Ljubljana"/>
            <div style={s.formFull}><Inp label="Naslov naklada" val={form.nakNaslov} set={v=>setForm(f=>({...f,nakNaslov:v}))} ph="Ulica in poštna številka"/></div>
            <Inp label="Referenca naklada" val={form.nakReferenca} set={v=>setForm(f=>({...f,nakReferenca:v}))} ph="REF-NAK-XXXXX"/>
            <Inp label="Datum naklada" val={form.nakDatum} set={v=>setForm(f=>({...f,nakDatum:v}))} type="date"/>
            <Inp label="Ura naklada" val={form.nakCas} set={v=>setForm(f=>({...f,nakCas:v}))} type="time"/>

            <div style={s.formDivider}>🏁 RAZKLAD</div>
            <Inp label="Firma razklada *" val={form.razFirma} set={v=>setForm(f=>({...f,razFirma:v}))} ph="Ime podjetja"/>
            <Inp label="Kraj razklada *" val={form.razKraj} set={v=>setForm(f=>({...f,razKraj:v}))} ph="npr. München"/>
            <div style={s.formFull}><Inp label="Naslov razklada" val={form.razNaslov} set={v=>setForm(f=>({...f,razNaslov:v}))} ph="Ulica in poštna številka"/></div>
            <Inp label="Referenca razklada" val={form.razReferenca} set={v=>setForm(f=>({...f,razReferenca:v}))} ph="REF-RAZ-XXXXX"/>
            <Inp label="Datum razklada" val={form.razDatum} set={v=>setForm(f=>({...f,razDatum:v}))} type="date"/>
            <Inp label="Ura razklada" val={form.razCas} set={v=>setForm(f=>({...f,razCas:v}))} type="time"/>

            <div style={s.formDivider}>⚠️ NAVODILA</div>
            <div style={s.formFull}>
              <label style={s.label}>Navodila za voznika</label>
              <textarea style={s.textarea} rows={3} placeholder="Posebna navodila, kontakti..." value={form.navodila} onChange={e=>setForm(f=>({...f,navodila:e.target.value}))}/>
            </div>
          </div>
          <button style={s.btnPrimary} onClick={submitNovNalog}>📤 Pošlji nalog vozniku</button>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PREGLED TAB
// ═══════════════════════════════════════════════════════════════════════════
function PregledTab({ stats, nalogi, obracuni, vozniki, onSelectNalog, onSelectObracun }) {
  const novi = nalogi.filter(n=>n.status==="nov");
  const aktivni = nalogi.filter(n=>["poslan","sprejet"].includes(n.status));
  const zaFakturo = nalogi.filter(n=>n.status==="za_fakturo");
  const noviObracuni = obracuni.filter(o=>o.zakljucen);

  return (
    <div>
      {/* stats */}
      <div style={s.statsGrid}>
        <StatCard icon="📋" label="Skupaj" val={stats.skupajNalogov} color="#2563eb"/>
        <StatCard icon="🚛" label="V tranzitu" val={stats.vTranzitu} color="#0891b2"/>
        <StatCard icon="💶" label="Za fakturo" val={stats.zaFakturo} color="#9333ea"/>
        <StatCard icon="✔️" label="Zaključeni" val={stats.zakljucenih} color="#16a34a"/>
      </div>

      {/* aktivni nalogi */}
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>🟡 Aktivni nalogi</span>
      </div>
      {aktivni.length===0 && <div style={s.empty}>Ni aktivnih nalogov.</div>}
      {aktivni.map(n=>(
        <NalogCard key={n.id} nalog={n} voznik={vozniki.find(v=>v.id===n.voznikId)} onClick={()=>onSelectNalog(n)}/>
      ))}

      {/* novi obračuni */}
      {noviObracuni.length>0 && (
        <>
          <div style={s.sectionHeader}><span style={s.sectionTitle}>💶 Novi obračuni voznikov</span></div>
          {noviObracuni.map(o=>(
            <ObracunCard key={o.id} obracun={o} voznik={vozniki.find(v=>v.id===o.voznikId)} onClick={()=>onSelectObracun(o)}/>
          ))}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NALOGI TAB
// ═══════════════════════════════════════════════════════════════════════════
function NalogiTab({ nalogi, vozniki, onSelect, openNovNalog }) {
  const [filter, setFilter] = useState("vsi");
  const [search, setSearch] = useState("");

  const filtered = nalogi
    .filter(n=>filter==="vsi"||n.status===filter)
    .filter(n=>!search||n.stranka.toLowerCase().includes(search.toLowerCase())||n.stevilkaNaloga.includes(search)||n.nakKraj?.toLowerCase().includes(search.toLowerCase())||n.razKraj?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>new Date(b.poslan)-new Date(a.poslan));

  return (
    <div>
      <div style={s.nalogToolbar}>
        <input style={s.searchInput} placeholder="🔍 Išči nalog, stranko, kraj..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <button style={s.btnSm} onClick={openNovNalog}>+ Nov</button>
      </div>
      <div style={s.filterRow}>
        {[["vsi","Vsi"],["nov","Novi"],["poslan","Poslani"],["sprejet","Sprejeto"],["zakljucen","Zaključeni"],["za_fakturo","Za fakturo"]].map(([f,l])=>(
          <button key={f} style={{...s.filterBtn,...(filter===f?s.filterOn:{})}} onClick={()=>setFilter(f)}>{l}</button>
        ))}
      </div>
      {filtered.length===0 && <div style={s.empty}>Ni nalogov.</div>}
      {filtered.map(n=>(
        <NalogCard key={n.id} nalog={n} voznik={vozniki.find(v=>v.id===n.voznikId)} onClick={()=>onSelect(n)}/>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VOZNIKI TAB
// ═══════════════════════════════════════════════════════════════════════════
function VoznikiTab({ vozniki, nalogi }) {
  return (
    <div>
      <div style={s.sectionTitle}>Vozniki ({vozniki.length})</div>
      {vozniki.map(v=>{
        const vNalogi = nalogi.filter(n=>n.voznikId===v.id);
        const aktivni = vNalogi.filter(n=>n.status==="nov"||n.status==="sprejet");
        const zakljuceni = vNalogi.filter(n=>n.status==="zakljucen");
        return (
          <div key={v.id} style={s.voznikCard}>
            <div style={s.voznikHeader}>
              <div style={s.voznikAvatar}>{v.ime.charAt(0)}</div>
              <div>
                <div style={s.voznikIme}>{v.ime}</div>
                <div style={s.voznikSub}>{v.vozilo} · {v.tel}</div>
              </div>
              <div style={{...s.voznikStatus, background: aktivni.length>0?"#fffbeb":"#f0fdf4", color: aktivni.length>0?"#d97706":"#16a34a"}}>
                {aktivni.length>0 ? `🟡 ${aktivni.length} aktiven` : "✅ Prost"}
              </div>
            </div>
            <div style={s.voznikStats}>
              <div style={s.voznikStat}><span style={s.voznikStatNum}>{vNalogi.length}</span><span style={s.voznikStatLabel}>Nalogov</span></div>
              <div style={s.voznikStat}><span style={s.voznikStatNum}>{aktivni.length}</span><span style={s.voznikStatLabel}>Aktivnih</span></div>
              <div style={s.voznikStat}><span style={s.voznikStatNum}>{zakljuceni.length}</span><span style={s.voznikStatLabel}>Zaključenih</span></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OBRAČUNI TAB
// ═══════════════════════════════════════════════════════════════════════════
function ObracuniTab({ obracuni, vozniki, onSelect }) {
  const skupajKm = obracuni.reduce((a,o)=>a+(o.km||0),0);
  const skupajZasl = obracuni.reduce((a,o)=>{
    const ost=(o.stroski||[]).reduce((b,s)=>b+(parseFloat(s.znesek)||0),0);
    return a+(o.km||0)*TARIFA_KM+(o.stranke||0)*TARIFA_STR+ost;
  },0);

  return (
    <div>
      <div style={s.obSkupajCard}>
        <div style={s.obSkupajRow}>
          <div style={s.obSkupajStat}><div style={s.obSkupajNum}>{obracuni.length}</div><div style={s.obSkupajLabel}>Obračunov</div></div>
          <div style={s.obSkupajStat}><div style={s.obSkupajNum}>{skupajKm.toLocaleString()} km</div><div style={s.obSkupajLabel}>Skupaj km</div></div>
          <div style={s.obSkupajStat}><div style={{...s.obSkupajNum,color:"#16a34a"}}>{skupajZasl.toFixed(0)} €</div><div style={s.obSkupajLabel}>Za izplačilo</div></div>
        </div>
      </div>
      {obracuni.length===0 && <div style={s.empty}>Ni prejetih obračunov.</div>}
      {obracuni.map(o=>(
        <ObracunCard key={o.id} obracun={o} voznik={vozniki.find(v=>v.id===o.voznikId)} onClick={()=>onSelect(o)}/>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NALOG DETAIL
// ═══════════════════════════════════════════════════════════════════════════
function NalogDetail({ nalog, voznik, vozniki, onBack, onIzbrisi, onDodeli, onSprememba }) {
  const [izbraniVoznik, setIzbraniVoznik] = useState("");
  const sc = statusCfg[nalog.status]||{};
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← Nazaj</button>
        <div style={s.headerTitle}>{nalog.nakKraj} → {nalog.razKraj}</div>
        <div style={s.headerSub}>{nalog.stevilkaNaloga} · {nalog.stranka}</div>
      </div>
      <div style={{...s.content,paddingBottom:80}}>
        {/* status */}
        <div style={{...s.statusCard,background:sc.bg,borderColor:sc.color+"33"}}>
          <span style={{...s.statusPill,background:sc.color+"22",color:sc.color}}>{sc.label}</span>
          {voznik && <span style={s.statusVoznik}>🚛 {voznik.ime} · {voznik.vozilo}</span>}
          {nalog.sprejetCas && <div style={s.statusMeta}>Sprejet: {fmtDT(nalog.sprejetCas)}</div>}
          {nalog.zakljucenCas && <div style={s.statusMeta}>Zaključen: {fmtDT(nalog.zakljucenCas)}</div>}
        </div>

        {/* STATUS TIMELINE */}
        <div style={s.timelineWrap}>
          {STATUS_VRSTNI_RED.slice(0,7).map((st2,i)=>{
            const sc2 = statusCfg[st2];
            const isDone = STATUS_VRSTNI_RED.indexOf(nalog.status) > i;
            const isCurrent = nalog.status === st2;
            return (
              <div key={st2} style={s.timelineStep}>
                <div style={{...s.timelineDot, background: isCurrent?sc2.color:isDone?"#16a34a":"#e2e8f0", transform:isCurrent?"scale(1.3)":"scale(1)"}}>
                  {isCurrent?sc2.icon:isDone?"✓":""}
                </div>
                <div style={{...s.timelineLabel, color:isCurrent?sc2.color:isDone?"#16a34a":"#94a3b8", fontWeight:isCurrent?700:400}}>
                  {sc2.label}
                </div>
                {i<6 && <div style={{...s.timelineLine, background:isDone||isCurrent?"#16a34a":"#e2e8f0"}}/>}
              </div>
            );
          })}
        </div>

        {/* SPREMEMBA STATUSA */}
        {nalog.status !== "fakturirano" && (
          <StatusSprememba nalog={nalog} onSprememba={onSprememba}/>
        )}

        <Sec title="📦 Blago"><Row label="Blago" val={nalog.blago}/><Row label="Količina" val={nalog.kolicina}/><Row label="Teža" val={nalog.teza}/></Sec>
        <Sec title="📍 Naklad"><Row label="Firma" val={nalog.nakFirma} bold/><Row label="Kraj" val={nalog.nakKraj}/><Row label="Naslov" val={nalog.nakNaslov}/><Row label="Referenca" val={nalog.nakReferenca} mono/><Row label="Datum" val={`${fmt(nalog.nakDatum)} ob ${nalog.nakCas}`}/></Sec>
        <Sec title="🏁 Razklad"><Row label="Firma" val={nalog.razFirma} bold/><Row label="Kraj" val={nalog.razKraj}/><Row label="Naslov" val={nalog.razNaslov}/><Row label="Referenca" val={nalog.razReferenca} mono/><Row label="Datum" val={`${fmt(nalog.razDatum)} ob ${nalog.razCas}`}/></Sec>
        {nalog.navodila && <Sec title="⚠️ Navodila"><div style={s.navodilaBox}>{nalog.navodila}</div></Sec>}

        {/* CMR dokumenti */}
        {nalog.cmrSlike?.length>0 && (
          <Sec title="📄 CMR dokumenti">
            <div style={s.cmrGrid}>
              {nalog.cmrSlike.filter(Boolean).map((sl,i)=>(
                <div key={i} style={s.cmrThumbWrap}>
                  <img src={sl.img} alt={`CMR ${i+1}`} style={s.cmrThumb}/>
                  <div style={s.cmrThumbLabel}>Slika {i+1}</div>
                </div>
              ))}
            </div>
            {nalog.cmrPdf && <a href={nalog.cmrPdf} download={`CMR-${nalog.stevilkaNaloga}.pdf`} style={s.pdfBtn}>⬇️ Prenesi PDF CMR</a>}
          </Sec>
        )}

        <div style={s.metaBox}>Poslan: {fmtDT(nalog.poslan)}</div>
        {nalog.status==="nov" && (
          <div style={s.dodelijBox}>
            <div style={s.dodelijTitle}>📤 Dodeli nalog vozniku</div>
            <select style={s.select} value={izbraniVoznik} onChange={e=>setIzbraniVoznik(e.target.value)}>
              <option value="">– Izberi voznika –</option>
              {vozniki.map(v=><option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}
            </select>
            <button style={{...s.btnPrimary, marginTop:10, opacity:izbraniVoznik?1:0.45}} onClick={()=>izbraniVoznik&&onDodeli(izbraniVoznik)}>
              📤 Pošlji vozniku
            </button>
          </div>
        )}
        {(nalog.status==="nov"||nalog.status==="poslan") && (
          <button style={s.btnDanger} onClick={onIzbrisi}>🗑️ Izbriši nalog</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED CARDS
// ═══════════════════════════════════════════════════════════════════════════
function NalogCard({ nalog, voznik, onClick }) {
  const sc = statusCfg[nalog.status]||{};
  return (
    <button style={s.nalogCard} onClick={onClick}>
      <div style={s.nalogCardTop}>
        <span style={{...s.statusPillSm,background:sc.bg,color:sc.color}}>{sc.label}</span>
        <span style={s.nalogCardId}>{nalog.stevilkaNaloga}</span>
        <span style={s.nalogCardDat}>{fmt(nalog.poslan)}</span>
      </div>
      <div style={s.nalogCardRuta}>{nalog.nakKraj} → {nalog.razKraj}</div>
      <div style={s.nalogCardSub}>{nalog.stranka} · {nalog.blago}</div>
      {voznik ? <div style={s.nalogCardVoznik}>🚛 {voznik.ime} · {voznik.vozilo}</div> : <div style={{...s.nalogCardVoznik,color:"#94a3b8",background:"#f8fafc"}}>⚪ Voznik ni dodeljen</div>}
    </button>
  );
}

function ObracunCard({ obracun, voznik, onClick }) {
  const zaslKm=(obracun.km||0)*TARIFA_KM, zaslStr=(obracun.stranke||0)*TARIFA_STR;
  const ost=(obracun.stroski||[]).reduce((a,s)=>a+(parseFloat(s.znesek)||0),0);
  const skupaj=zaslKm+zaslStr+ost;
  return (
    <button style={s.obracunCard} onClick={onClick}>
      <div style={s.obracunCardTop}>
        <span style={s.obracunCardIme}>{voznik?.ime}</span>
        <span style={s.obracunCardZasl}>{skupaj.toFixed(2)} €</span>
      </div>
      <div style={s.obracunCardSub}>{fmt(obracun.datZac+"T00:00:00")} – {fmt(obracun.datKon+"T00:00:00")}</div>
      <div style={s.obracunCardMeta}>{obracun.km?.toLocaleString()} km · {obracun.stranke} strank · {voznik?.vozilo}</div>
    </button>
  );
}

function StatCard({ icon, label, val, color }) {
  return (
    <div style={s.statCard}>
      <div style={s.statIcon}>{icon}</div>
      <div style={{...s.statVal,color}}>{val}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// FINANCE TAB
// ═══════════════════════════════════════════════════════════════════════════
function FinanceTab({ st, upd, showToast, nalogi }) {
  const [filter, setFilter] = useState("vsi");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const racuni = st.racuni || [];
  const zaFakturo = nalogi.filter(n=>n.status==="za_fakturo");

  const filtered = racuni.filter(r=>filter==="vsi"||r.status===filter);

  const skupajOdprtih = racuni.filter(r=>r.status==="poslan"||r.status==="osnutek").reduce((a,r)=>a+r.znesek,0);
  const skupajPlacanih = racuni.filter(r=>r.status==="placano").reduce((a,r)=>a+r.znesek,0);
  const skupajVsih = racuni.reduce((a,r)=>a+r.znesek,0);

  const racunStatusCfg = {
    osnutek: { label:"Osnutek",  color:"#64748b", bg:"#f8fafc" },
    poslan:  { label:"Poslan",   color:"#2563eb", bg:"#eff6ff" },
    placano: { label:"Plačano",  color:"#16a34a", bg:"#f0fdf4" },
    zapadlo: { label:"Zapadlo",  color:"#dc2626", bg:"#fef2f2" },
  };

  const novRacun = (nalog) => {
    setForm({
      nalogId: nalog?.id||"",
      stranka: nalog?.stranka||"",
      znesek: "",
      datum: new Date().toISOString().slice(0,10),
      rok: new Date(Date.now()+30*86400000).toISOString().slice(0,10),
      status: "osnutek",
      opombe: "",
    });
    setModal("nov_racun");
  };

  const submitRacun = () => {
    if (!form.stranka||!form.znesek) return showToast("Izpolni stranko in znesek!", true);
    const id = "RAC-"+new Date().getFullYear()+"-"+String((racuni.length+1)).padStart(3,"0");
    upd(s=>({...s,
      racuni:[...( s.racuni||[]), {...form, id, znesek:parseFloat(form.znesek)}],
      nalogi: form.nalogId ? s.nalogi.map(n=>n.id===form.nalogId?{...n,status:"fakturirano"}:n) : s.nalogi,
    }));
    setModal(null); setForm({});
    showToast("✅ Račun "+id+" ustvarjen!");
  };

  const spremenStatus = (id, status) => {
    upd(s=>({...s, racuni:(s.racuni||[]).map(r=>r.id===id?{...r,status}:r)}));
    showToast("✅ Status računa posodobljen.");
  };

  return (
    <div>
      {/* KPI */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        <div style={s.statCard}><div style={s.statIcon}>💶</div><div style={{...s.statVal,color:"#0891b2"}}>{skupajVsih.toFixed(0)} €</div><div style={s.statLabel}>Skupaj fakturirano</div></div>
        <div style={s.statCard}><div style={s.statIcon}>⏳</div><div style={{...s.statVal,color:"#d97706"}}>{skupajOdprtih.toFixed(0)} €</div><div style={s.statLabel}>Odprte terjatve</div></div>
        <div style={s.statCard}><div style={s.statIcon}>✅</div><div style={{...s.statVal,color:"#16a34a"}}>{skupajPlacanih.toFixed(0)} €</div><div style={s.statLabel}>Prejeto</div></div>
      </div>

      {/* Nalogi za fakturo */}
      {zaFakturo.length>0 && (
        <div style={s.zaFakturoBox}>
          <div style={s.zaFakturoTitle}>💶 Nalogi pripravljeni za fakturo ({zaFakturo.length})</div>
          {zaFakturo.map(n=>(
            <div key={n.id} style={s.zaFakturoRow}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>{n.stranka}</div>
                <div style={{fontSize:12,color:"#64748b"}}>{n.stevilkaNaloga} · {n.nakKraj} → {n.razKraj}</div>
              </div>
              <button style={s.btnSm} onClick={()=>novRacun(n)}>Ustvari račun</button>
            </div>
          ))}
        </div>
      )}

      {/* Računi toolbar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={s.sectionTitle}>Računi</div>
        <button style={s.btnSm} onClick={()=>novRacun(null)}>+ Nov račun</button>
      </div>

      {/* Filter */}
      <div style={s.filterRow}>
        {[["vsi","Vsi"],["osnutek","Osnutki"],["poslan","Poslani"],["placano","Plačani"],["zapadlo","Zapadli"]].map(([f,l])=>(
          <button key={f} style={{...s.filterBtn,...(filter===f?s.filterOn:{})}} onClick={()=>setFilter(f)}>{l}</button>
        ))}
      </div>

      {/* Seznam računov */}
      {filtered.length===0 && <div style={s.empty}>Ni računov.</div>}
      {filtered.map(r=>{
        const sc = racunStatusCfg[r.status]||racunStatusCfg.osnutek;
        const jeZapadlo = r.status==="poslan" && new Date(r.rok)<new Date();
        return (
          <div key={r.id} style={s.racunCard}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:"#2563eb"}}>{r.id}</span>
                  <span style={{...s.statusPillSm,background:jeZapadlo?"#fef2f2":sc.bg,color:jeZapadlo?"#dc2626":sc.color}}>
                    {jeZapadlo?"⚠️ Zapadlo":sc.label}
                  </span>
                </div>
                <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{r.stranka}</div>
                <div style={{fontSize:12,color:"#64748b"}}>Izdan: {fmt(r.datum+"T00:00:00")} · Rok: {fmt(r.rok+"T00:00:00")}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:20,color:"#0f2744"}}>{r.znesek.toFixed(2)} €</div>
              </div>
            </div>
            {r.opombe && <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>{r.opombe}</div>}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {r.status==="osnutek" && <button style={s.racunBtn} onClick={()=>spremenStatus(r.id,"poslan")}>📤 Označi kot poslan</button>}
              {r.status==="poslan"  && <button style={s.racunBtn} onClick={()=>spremenStatus(r.id,"placano")}>✅ Označi kot plačan</button>}
              {(r.status==="poslan"||jeZapadlo) && <button style={{...s.racunBtn,color:"#dc2626",borderColor:"#fca5a5"}} onClick={()=>spremenStatus(r.id,"zapadlo")}>⚠️ Zapadlo</button>}
            </div>
          </div>
        );
      })}

      {/* Modal nov račun */}
      {modal==="nov_racun" && (
        <div style={s.overlay}>
          <div style={s.modalBox}>
            <div style={s.modalHead}>
              <span style={s.modalTitle}>Nov račun</span>
              <button style={s.closeBtn} onClick={()=>{setModal(null);setForm({});}}>✕</button>
            </div>
            <div style={s.modalBody}>
              {form.nalogId && <div style={{background:"#eff6ff",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#1d4ed8",fontWeight:600}}>📋 Nalog: {form.nalogId}</div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:14}}>
                <div style={{gridColumn:'1 / -1'}}>
                  <label style={s.label}>Stranka *</label>
                  <input style={s.input} value={form.stranka||""} onChange={e=>setForm(f=>({...f,stranka:e.target.value}))} placeholder="Ime stranke"/>
                </div>
                <div>
                  <label style={s.label}>Znesek (€) *</label>
                  <input style={s.input} type="number" value={form.znesek||""} onChange={e=>setForm(f=>({...f,znesek:e.target.value}))} placeholder="0.00"/>
                </div>
                <div>
                  <label style={s.label}>Datum izdaje</label>
                  <input style={s.input} type="date" value={form.datum||""} onChange={e=>setForm(f=>({...f,datum:e.target.value}))}/>
                </div>
                <div>
                  <label style={s.label}>Plačilni rok</label>
                  <input style={s.input} type="date" value={form.rok||""} onChange={e=>setForm(f=>({...f,rok:e.target.value}))}/>
                </div>
                <div style={{gridColumn:'1 / -1'}}>
                  <label style={s.label}>Opombe</label>
                  <textarea style={{...s.input,resize:"vertical"}} rows={2} value={form.opombe||""} onChange={e=>setForm(f=>({...f,opombe:e.target.value}))} placeholder="Dodatne opombe..."/>
                </div>
              </div>
              <button style={s.btnPrimary} onClick={submitRacun}>Ustvari račun</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusSprememba({ nalog, onSprememba }) {
  const naslednji = {
    poslan:    { next:"sprejet",     label:"Označi: Sprejeto",               icon:"✅" },
    sprejet:   { next:"zakljucen",   label:"Označi: Zaključeno",             icon:"✔️" },
    zakljucen: { next:"za_fakturo",  label:"Premakni v Finance (za fakturo)", icon:"💶" },
  }[nalog.status];

  if (!naslednji) return null;
  const sc = statusCfg[naslednji.next];
  return (
    <div style={{background:sc.bg,border:`1.5px solid ${sc.color}33`,borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:2}}>Naslednji korak</div>
        <div style={{fontWeight:700,fontSize:14,color:sc.color}}>{naslednji.icon} {naslednji.label}</div>
      </div>
      <button
        style={{background:sc.color,color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0,marginLeft:12}}
        onClick={()=>onSprememba(nalog.id, naslednji.next)}
      >
        Potrdi →
      </button>
    </div>
  );
}

const Toast = ({toast})=><div style={{...s.toast,background:toast.err?"#dc2626":"#16a34a"}}>{toast.txt}</div>;
const Modal = ({title,children,onClose,wide})=>(
  <div style={s.overlay}>
    <div style={{...s.modalBox,...(wide?{maxWidth:700}:{})}}>
      <div style={s.modalHead}><span style={s.modalTitle}>{title}</span><button style={s.closeBtn} onClick={onClose}>✕</button></div>
      <div style={s.modalBody}>{children}</div>
    </div>
  </div>
);
const Sec = ({title,children})=><div style={s.sec}><div style={s.secTitle}>{title}</div>{children}</div>;
const Row = ({label,val,bold,mono})=>(
  <div style={s.detailRow}>
    <span style={s.detailLabel}>{label}</span>
    <span style={{...s.detailVal,...(bold?{fontWeight:700,color:"#0f2744"}:{}),...(mono?{fontFamily:"monospace",fontSize:12,color:"#2563eb"}:{})}}>{val||"–"}</span>
  </div>
);
const Inp = ({label,val,set,ph,type="text"})=>(
  <div>
    <label style={s.label}>{label}</label>
    <input style={s.input} type={type} placeholder={ph} value={val||""} onChange={e=>set(e.target.value)}/>
  </div>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  wrap:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:900,margin:"0 auto",display:"flex",flexDirection:"column"},
  header:{background:"linear-gradient(135deg,#0f2744 0%,#1d4ed8 100%)",padding:"18px 24px 16px",color:"#fff"},
  hRow:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  logo:{fontSize:22,fontWeight:800,letterSpacing:-0.5},
  sub:{fontSize:12,opacity:0.65,marginTop:3},
  headerTitle:{fontSize:20,fontWeight:800,marginTop:8},
  headerSub:{fontSize:13,opacity:0.75,marginTop:2},
  backBtn:{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",padding:"6px 14px",borderRadius:20,fontSize:13,cursor:"pointer",marginBottom:10,display:"inline-block"},
  novNalogBtn:{background:"#fff",color:"#0f2744",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:800,fontSize:14,cursor:"pointer"},
  toast:{position:"fixed",top:20,right:20,color:"#fff",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:14,zIndex:400,boxShadow:"0 4px 20px rgba(0,0,0,0.25)"},
  content:{flex:1,padding:"16px",overflowY:"auto"},
  // tabs
  tabs:{display:"flex",gap:6,marginBottom:16,overflowX:"auto"},
  tab:{padding:"8px 16px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:13,cursor:"pointer",fontWeight:500,color:"#475569",whiteSpace:"nowrap"},
  tabOn:{background:"#0f2744",color:"#fff",border:"1.5px solid #0f2744",fontWeight:700},
  // stats
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20},
  statCard:{background:"#fff",borderRadius:14,padding:"16px 12px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  statIcon:{fontSize:22,marginBottom:6},
  statVal:{fontSize:26,fontWeight:800,marginBottom:4},
  statLabel:{fontSize:11,color:"#94a3b8"},
  sectionHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,marginTop:16},
  sectionTitle:{fontWeight:700,fontSize:15,color:"#0f2744"},
  // nalog card
  nalogCard:{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 5px rgba(0,0,0,0.07)",border:"none",cursor:"pointer",textAlign:"left"},
  nalogCardTop:{display:"flex",alignItems:"center",gap:8,marginBottom:6},
  nalogCardId:{fontSize:12,fontFamily:"monospace",color:"#2563eb",fontWeight:700},
  nalogCardDat:{fontSize:11,color:"#94a3b8",marginLeft:"auto"},
  nalogCardRuta:{fontSize:17,fontWeight:800,color:"#0f2744",marginBottom:3},
  nalogCardSub:{fontSize:13,color:"#64748b",marginBottom:4},
  nalogCardVoznik:{fontSize:12,color:"#475569",background:"#f8fafc",padding:"4px 8px",borderRadius:8,display:"inline-block"},
  statusPillSm:{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700},
  // vozniki
  voznikCard:{background:"#fff",borderRadius:14,padding:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  voznikHeader:{display:"flex",alignItems:"center",gap:12,marginBottom:12},
  voznikAvatar:{width:44,height:44,borderRadius:"50%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",fontSize:18,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  voznikIme:{fontWeight:700,fontSize:16,color:"#0f2744"},
  voznikSub:{fontSize:12,color:"#64748b",marginTop:2},
  voznikStatus:{padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:700,marginLeft:"auto"},
  voznikStats:{display:"flex",gap:0,borderTop:"1px solid #f1f5f9",paddingTop:12},
  voznikStat:{flex:1,textAlign:"center"},
  voznikStatNum:{display:"block",fontSize:20,fontWeight:800,color:"#0f2744"},
  voznikStatLabel:{fontSize:11,color:"#94a3b8"},
  // obračuni
  obSkupajCard:{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:"16px 20px",marginBottom:16,color:"#fff"},
  obSkupajRow:{display:"flex",justifyContent:"space-around"},
  obSkupajStat:{textAlign:"center"},
  obSkupajNum:{fontSize:22,fontWeight:800},
  obSkupajLabel:{fontSize:11,opacity:0.7,marginTop:2},
  obracunCard:{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,border:"none",cursor:"pointer",textAlign:"left",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  obracunCardTop:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4},
  obracunCardIme:{fontWeight:700,fontSize:16,color:"#0f2744"},
  obracunCardZasl:{fontWeight:800,fontSize:18,color:"#16a34a"},
  obracunCardSub:{fontSize:13,color:"#64748b",marginBottom:3},
  obracunCardMeta:{fontSize:12,color:"#94a3b8"},
  obDetailCard:{background:"#fff",borderRadius:14,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",marginBottom:12},
  obTotal:{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:18,color:"#16a34a",paddingTop:10},
  // nalog detail
  statusCard:{borderRadius:12,padding:"12px 14px",marginBottom:14,border:"1.5px solid",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"},
  statusPill:{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:700},
  statusVoznik:{fontSize:13,color:"#475569",fontWeight:600},
  statusMeta:{fontSize:12,color:"#64748b",width:"100%"},
  sec:{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  secTitle:{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:10,textTransform:"uppercase",letterSpacing:0.5},
  detailRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",paddingBottom:7,marginBottom:7,borderBottom:"1px solid #f8fafc"},
  detailLabel:{fontSize:12,color:"#94a3b8",flexShrink:0,marginRight:10},
  detailVal:{fontSize:13,color:"#1e293b",textAlign:"right",flex:1},
  navodilaBox:{fontSize:13,color:"#1e293b",lineHeight:1.6,background:"#fffbeb",borderRadius:8,padding:"10px 12px",border:"1px solid #fde68a"},
  cmrGrid:{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"},
  cmrThumbWrap:{width:"calc(33% - 6px)",textAlign:"center"},
  cmrThumb:{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"},
  cmrThumbLabel:{fontSize:11,color:"#64748b",marginTop:4},
  pdfBtn:{display:"block",textAlign:"center",background:"#eff6ff",color:"#2563eb",border:"1.5px solid #bfdbfe",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,textDecoration:"none"},
  metaBox:{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"8px 0"},
  divider:{borderTop:"1px solid #f1f5f9",margin:"8px 0"},
  // toolbar
  nalogToolbar:{display:"flex",gap:8,marginBottom:12},
  searchInput:{flex:1,border:"1.5px solid #e2e8f0",borderRadius:10,padding:"9px 13px",fontSize:14,outline:"none",background:"#fff"},
  btnSm:{background:"#0f2744",color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontWeight:700,fontSize:14,cursor:"pointer"},
  filterRow:{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"},
  filterBtn:{padding:"7px 14px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:13,cursor:"pointer",fontWeight:500,color:"#475569"},
  filterOn:{background:"#0f2744",color:"#fff",border:"1.5px solid #0f2744"},
  // form
  formGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:16},
  formFull:{gridColumn:"1 / -1"},
  formSpacer:{gridColumn:"1 / -1",borderTop:"1px solid #f1f5f9",margin:"4px 0"},
  formDivider:{gridColumn:"1 / -1",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,paddingTop:4},
  label:{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4},
  input:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:9,padding:"9px 12px",fontSize:14,outline:"none",boxSizing:"border-box",background:"#f8fafc"},
  select:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:9,padding:"9px 12px",fontSize:14,outline:"none",boxSizing:"border-box",background:"#f8fafc"},
  textarea:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:9,padding:"9px 12px",fontSize:14,outline:"none",boxSizing:"border-box",background:"#f8fafc",resize:"vertical"},
  btnPrimary:{width:"100%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer"},
  btnDanger:{width:"100%",background:"none",border:"1.5px solid #fca5a5",color:"#dc2626",borderRadius:12,padding:12,fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16},
  modalBox:{background:"#fff",borderRadius:18,width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"},
  modalHead:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px 12px",borderBottom:"1px solid #e2e8f0",position:"sticky",top:0,background:"#fff",zIndex:1},
  modalTitle:{fontWeight:700,fontSize:17,color:"#0f2744"},
  closeBtn:{background:"#f1f5f9",border:"none",borderRadius:"50%",width:32,height:32,fontSize:14,cursor:"pointer"},
  modalBody:{padding:"16px 20px 24px"},
  empty:{textAlign:"center",color:"#94a3b8",padding:"40px 20px",fontSize:14},
  racunCard:{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 5px rgba(0,0,0,0.07)"},
  racunBtn:{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",color:"#0f2744"},
  zaFakturoBox:{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:14,padding:16,marginBottom:16},
  zaFakturoTitle:{fontWeight:700,fontSize:14,color:"#92400e",marginBottom:12},
  zaFakturoRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #fef3c7"},
  dodelijBox:{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:14,padding:16,marginTop:8},
  timelineWrap:{display:"flex",alignItems:"flex-start",marginBottom:16,overflowX:"auto",paddingBottom:4},
  timelineStep:{display:"flex",flexDirection:"column",alignItems:"center",position:"relative",minWidth:70},
  timelineDot:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700,transition:"all 0.3s",zIndex:1,marginBottom:4},
  timelineLabel:{fontSize:9,textAlign:"center",lineHeight:1.2,maxWidth:65},
  timelineLine:{position:"absolute",top:14,left:"50%",width:"100%",height:2,zIndex:0},
  dodelijTitle:{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:10},
  dropZone:{border:"2px dashed #cbd5e1",borderRadius:16,padding:"20px",marginBottom:16,background:"#fff",transition:"all 0.2s",cursor:"pointer",textAlign:"center"},
  dropZoneActive:{border:"2px dashed #1d4ed8",background:"#eff6ff",transform:"scale(1.01)"},
  dropZoneParsing:{border:"2px dashed #d97706",background:"#fffbeb"},
  dropContent:{display:"flex",flexDirection:"column",alignItems:"center",gap:6},
  dropIcon:{fontSize:32},
  dropSpinner:{fontSize:32,animation:"spin 1s linear infinite"},
  dropTitle:{fontWeight:700,fontSize:15,color:"#0f2744"},
  dropSub:{fontSize:12,color:"#64748b",maxWidth:340},
  dropBtn:{marginTop:8,background:"#f1f5f9",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"7px 16px",fontSize:13,fontWeight:600,color:"#0f2744",cursor:"pointer"},
};