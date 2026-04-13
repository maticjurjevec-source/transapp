import { useState, useEffect } from "react";
import { supabase } from './supabase';

const pad = (n) => String(n).padStart(2, "0");
const fmt = (iso) => { if (!iso) return "–"; const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`; };
const fmtT = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const getMonday = (date) => { const d = new Date(date); const day = d.getDay()||7; d.setDate(d.getDate()-day+1); d.setHours(0,0,0,0); return d; };
const weekKey = (iso) => getMonday(new Date(iso)).toISOString().slice(0,10);
const weekLabel = (key) => { const mon = new Date(key); const sun = new Date(mon); sun.setDate(mon.getDate()+6); return `${fmt(mon.toISOString())} – ${fmt(sun.toISOString())}`; };
const thisWeekKey = () => weekKey(new Date().toISOString());
const toInputDate = (iso) => iso ? iso.slice(0,10) : "";

const TARIFA_KM = 0.18;
const TARIFA_STR = 20;
const LS = "transapp_v8";
const load = () => { try { return JSON.parse(localStorage.getItem(LS))||null; } catch { return null; } };
const save = (s) => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch {} };

const optimizejSliko = (dataUrl) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
      const c = (gray - 128) * 1.45 + 128;
      const v = Math.max(0, Math.min(255, c < 100 ? c - 18 : c + 12));
      d[i] = d[i+1] = d[i+2] = v;
    }
    ctx.putImageData(id, 0, 0);
    resolve(canvas.toDataURL("image/jpeg", 0.93));
  };
  img.src = dataUrl;
});

const DEMO_NALOGI = [
  { id:"NAL-2025-0041", status:"nov", stevilkaNaloga:"NAL-2025-0041", stranka:"Müller GmbH", blago:"Avtomobilski deli", kolicina:"24 palet", teza:"18.500 kg", nakFirma:"Logistika d.o.o.", nakKraj:"Ljubljana", nakNaslov:"Dunajska cesta 5, 1000 Ljubljana", nakReferenca:"REF-NAK-88123", nakDatum:"2025-04-10", nakCas:"07:00", razFirma:"Müller GmbH", razKraj:"München", razNaslov:"Schillerstraße 12, 80336 München", razReferenca:"REF-RAZ-99541", razDatum:"2025-04-11", razCas:"14:00", navodila:"Blago krhko – previdno ravnanje!", poslan:new Date(Date.now()-3600000).toISOString(), sprejetCas:null, zakljucenCas:null, cmrSlike:[] },
  { id:"NAL-2025-0042", status:"poslan", stevilkaNaloga:"NAL-2025-0042", stranka:"Kaufland Logistik", blago:"Živila – suho blago", kolicina:"33 palet", teza:"22.000 kg", nakFirma:"Koper Terminal d.d.", nakKraj:"Koper", nakNaslov:"Industrijska ulica 8, 6000 Koper", nakReferenca:"REF-NAK-77234", nakDatum:"2025-04-12", nakCas:"05:30", razFirma:"Kaufland Berlin", razKraj:"Berlin", razNaslov:"Frankfurter Allee 99, 10247 Berlin", razReferenca:"REF-RAZ-44871", razDatum:"2025-04-14", razCas:"09:00", navodila:"Dostava samo s predhodno najavo.", poslan:new Date(Date.now()-7200000).toISOString(), sprejetCas:null, zakljucenCas:null, cmrSlike:[] },
];

const initState = () => ({
  voznik: { ime: "Voznik", vozilo: "" },
  tarifa: { stranka: TARIFA_STR, km: TARIFA_KM },
  tedni: {},
  nalogi: [],
  prostiCMR: [],
});

const tipIkona = { cakanje:"⏳", vikend:"📅", ostalo:"📌" };

export default function App({ voznikId:propVoznikId=null, voznikIme='', voznikVozilo='', onOdjava=null }) {
  const [st, setSt] = useState(initState);
  const [tab, setTab] = useState("nalogi");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [selectedNalog, setSelectedNalog] = useState(null);

  const [voznikId, setVoznikId] = useState(null);

  // Naloži naloge za tega voznika
  useEffect(() => {
    if (propVoznikId) {
      setVoznikId(propVoznikId);
    }
  }, [propVoznikId]);

  useEffect(() => {
    if (voznikId) naložiNaloge();
  }, [voznikId]);

  const naložiNaloge = async () => {
    try {
      const { data, error } = await supabase
        .from('nalogi')
        .select('*')
        .eq('voznik_id', voznikId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const mapped = data.map(n => ({
          ...n,
          id: n.id,
          stevilkaNaloga: n.stevilka_naloga,
          nakKraj: n.nak_kraj,
          razKraj: n.raz_kraj,
          nakFirma: n.nak_firma,
          nakNaslov: n.nak_naslov,
          nakReferenca: n.nak_referenca,
          nakDatum: n.nak_datum,
          nakCas: n.nak_cas,
          razFirma: n.raz_firma,
          razNaslov: n.raz_naslov,
          razReferenca: n.raz_referenca,
          razDatum: n.raz_datum,
          razCas: n.raz_cas,
          poslan: n.poslan_cas || n.created_at,
          sprejetCas: n.sprejet_cas,
          zakljucenCas: n.zakljucen_cas,
          cmrSlike: [],
        }));
        setSt(s => ({ ...s, nalogi: mapped }));
      }
    } catch(err) {
      console.error('Napaka pri nalaganju:', err);
    }
  };

  const upd = (fn) => { const ns = fn(st); setSt(ns); save(ns); };
  const showToast = (txt, err) => { setToast({txt,err}); setTimeout(()=>setToast(null),3500); };
  const closeModal = () => { setModal(null); setForm({}); };

  const getTeden = (key) => st.tedni[key] || { kmNacin:"rocno", kmZacetek:"", kmKonec:"", kmRocno:"", stranke:"", stroski:[] };
  const setTeden = (key, data) => upd(s => ({...s, tedni:{...s.tedni,[key]:{...getTeden(key),...data}}}));
  const izracunajKm = (t) => t.kmNacin==="razlika" ? Math.max(0,(parseFloat(t.kmKonec)||0)-(parseFloat(t.kmZacetek)||0)) : (parseFloat(t.kmRocno)||0);

  const sprejmiNalog = async (nalog) => {
    try {
      const { error } = await supabase.from('nalogi').update({
        status: 'sprejet',
        sprejet_cas: new Date().toISOString()
      }).eq('id', nalog.id);
      if (error) throw error;
      upd(s=>({...s, nalogi:s.nalogi.map(n=>n.id===nalog.id?{...n,status:"sprejet",sprejetCas:new Date().toISOString()}:n)}));
      if (selectedNalog) setSelectedNalog(n=>({...n,status:"sprejet",sprejetCas:new Date().toISOString()}));
      showToast("✅ Nalog sprejet! Dispečer je obveščen.");
    } catch(err) {
      showToast("❌ Napaka pri sprejemu!", true);
    }
  };

  const zacniZakljucitev = (nalog) => { setForm({nalogId:nalog.id, slike:[]}); setModal("zakljuci"); };

  const dodajSlikoCMR = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    showToast("⏳ Optimizacija slike...");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const optimized = await optimizejSliko(ev.target.result);
      setForm(f => ({...f, slike:[...(f.slike||[]), {img:optimized, ime:file.name, cas:new Date().toISOString()}]}));
      showToast("✅ Slika optimizirana!");
    };
    reader.readAsDataURL(file);
    e.target.value="";
  };

  const odstraniSliko = (idx) => setForm(f=>({...f, slike:(f.slike||[]).filter((_,i)=>i!==idx)}));

  const potrdiZakljucitev = async () => {
    const nalog = st.nalogi.find(n=>n.id===form.nalogId);
    const slike = (form.slike||[]).filter(Boolean);
    try {
      const { error } = await supabase.from('nalogi').update({
        status: 'zakljucen',
        zakljucen_cas: new Date().toISOString()
      }).eq('id', nalog.id);
      if (error) throw error;
      upd(s=>({...s, nalogi:s.nalogi.map(n=>n.id===nalog.id?{...n,status:"zakljucen",zakljucenCas:new Date().toISOString(),cmrSlike:slike}:n)}));
      closeModal(); setSelectedNalog(null);
      showToast("✅ Nalog zaključen! CMR poslan dispečerju.");
    } catch(err) {
      showToast("❌ Napaka pri zaključitvi!", true);
    }
  };

  const novihNalogov = st.nalogi.filter(n=>n.status==="nov"||n.status==="poslan").length;
  const nepovezanihCMR = (st.prostiCMR||[]).filter(c=>!c.povezan).length;

  // Prijava - handled by parent App.jsx
  if (!voznikId) return null;

  if (selectedNalog) {
    const live = st.nalogi.find(n=>n.id===selectedNalog.id);
    return (
      <div style={s.wrap}>
        <NalogDetail nalog={live} onBack={()=>setSelectedNalog(null)} onSprejmi={()=>sprejmiNalog(live)} onZakljuci={()=>zacniZakljucitev(live)} onDodajCMR={async(e)=>{
          const file=e.target.files[0]; if(!file)return;
          showToast("⏳ Optimizacija slike...");
          const reader=new FileReader();
          reader.onload=async(ev)=>{
            const optimized=await optimizejSliko(ev.target.result);
            const novaSlika={img:optimized,ime:file.name,cas:new Date().toISOString()};
            upd(s=>({...s,nalogi:s.nalogi.map(n=>n.id===live.id?{...n,cmrSlike:[...(n.cmrSlike||[]),novaSlika]}:n)}));
            setSelectedNalog(prev=>({...prev,cmrSlike:[...(prev.cmrSlike||[]),novaSlika]}));
            showToast("✅ CMR slika dodana!");
          };
          reader.readAsDataURL(file);
          e.target.value="";
        }}/>
        {modal==="zakljuci" && (
          <ZakljuciModal form={form} nalog={st.nalogi.find(n=>n.id===form.nalogId)} dodajSlikoCMR={dodajSlikoCMR} odstraniSliko={odstraniSliko} onPotrdi={potrdiZakljucitev} onClose={closeModal} />
        )}
        {toast && <Toast toast={toast}/>}
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.hRow}>
          <div><div style={s.logo}>🚛 TransApp</div><div style={s.sub}>{st.voznik.ime} · {st.voznik.vozilo}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {novihNalogov>0 && <div style={s.redBadge}>{novihNalogov} nov{novihNalogov>1?"a":""}</div>}
            {onOdjava && <button style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",padding:"5px 12px",borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:600}} onClick={onOdjava}>Odjava</button>}
          </div>
        </div>
      </div>
      {toast && <Toast toast={toast}/>}
      <div style={s.content}>
        {tab==="obracun"   && <ObracunTab st={st} getTeden={getTeden} setTeden={setTeden} izracunajKm={izracunajKm} showToast={showToast}/>}
        {tab==="nalogi"    && <NalogiTab nalogi={st.nalogi} onSelect={setSelectedNalog}/>}
        {tab==="prosticmr" && <ProstiCMRTab st={st} upd={upd} showToast={showToast}/>}
      </div>
      <div style={s.nav}>
        <NavBtn active={tab==="obracun"}   onClick={()=>setTab("obracun")}   icon="💶" label="Obračun"/>
        <NavBtn active={tab==="nalogi"}    onClick={()=>setTab("nalogi")}    icon="📋" label={`Nalogi${novihNalogov?` (${novihNalogov})`:""}`}/>
        <NavBtn active={tab==="prosticmr"} onClick={()=>setTab("prosticmr")} icon="📸" label={`Prosti CMR${nepovezanihCMR>0?` (${nepovezanihCMR})`:""}`}/>
      </div>
    </div>
  );
}

function ObracunTab({ st, getTeden, setTeden, izracunajKm, showToast }) {
  const [pregledOdprt, setPregledOdprt] = useState(false);
  const defaultZac = () => { const d = getMonday(new Date()); return toInputDate(d.toISOString()); };
  const defaultKon = () => { const d = getMonday(new Date()); d.setDate(d.getDate()+6); return toInputDate(d.toISOString()); };
  const [datZac, setDatZac] = useState(defaultZac);
  const [datKon, setDatKon] = useState(defaultKon);
  const prikazanTeden = datZac || thisWeekKey();
  const teden = getTeden(prikazanTeden);
  const km = izracunajKm(teden);
  const stranke = parseInt(teden.stranke)||0;
  const zaslKm = km*TARIFA_KM, zaslStr = stranke*TARIFA_STR;
  const stroski = teden.stroski || [];
  const skupajStroski = stroski.reduce((a,x)=>a+(parseFloat(x.znesek)||0),0);
  const skupaj = zaslKm + zaslStr;
  const obdobjeLabel = datZac && datKon ? `${fmt(datZac+"T00:00:00")} – ${fmt(datKon+"T00:00:00")}` : "–";
  const [novStrosek, setNovStrosek] = useState({tip:"cakanje", znesek:"", opis:""});
  const dodajStrosek = () => {
    if (!novStrosek.znesek) return;
    setTeden(prikazanTeden, {stroski:[...stroski, {...novStrosek, id:Date.now(), cas:new Date().toISOString()}]});
    setNovStrosek({tip:"cakanje", znesek:"", opis:""});
  };
  const odstraniStrosek = (id) => setTeden(prikazanTeden, {stroski:stroski.filter(x=>x.id!==id)});

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>📅 Obdobje obračuna</div>
        <div style={s.datumRow}>
          <div style={s.datumPolje}><label style={s.smallLabel}>Začetni datum</label><input style={s.input} type="date" value={datZac} onChange={e=>setDatZac(e.target.value)}/></div>
          <div style={s.datumSep}>–</div>
          <div style={s.datumPolje}><label style={s.smallLabel}>Končni datum</label><input style={s.input} type="date" value={datKon} onChange={e=>setDatKon(e.target.value)}/></div>
        </div>
        {datZac && datKon && <div style={s.obdobjeLabel}>{obdobjeLabel}</div>}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>🛣️ Kilometri</div>
        <div style={s.nacin}>
          <button style={{...s.nacinBtn,...(teden.kmNacin==="razlika"?s.nacinOn:{})}} onClick={()=>setTeden(prikazanTeden,{kmNacin:"razlika"})}>Začetni / končni</button>
          <button style={{...s.nacinBtn,...(teden.kmNacin==="rocno"?s.nacinOn:{})}} onClick={()=>setTeden(prikazanTeden,{kmNacin:"rocno"})}>Vpišem sam</button>
        </div>
        {teden.kmNacin==="razlika" ? (
          <div style={s.kmRazlikaWrap}>
            <div style={s.kmPolje}><label style={s.smallLabel}>Začetni km</label><input style={s.input} type="number" placeholder="150000" value={teden.kmZacetek||""} onChange={e=>setTeden(prikazanTeden,{kmZacetek:e.target.value})}/></div>
            <div style={s.kmMinus}>→</div>
            <div style={s.kmPolje}><label style={s.smallLabel}>Končni km</label><input style={s.input} type="number" placeholder="151840" value={teden.kmKonec||""} onChange={e=>setTeden(prikazanTeden,{kmKonec:e.target.value})}/></div>
          </div>
        ) : (
          <div><label style={s.smallLabel}>Prevoženi km</label><input style={s.inputBig} type="number" placeholder="npr. 1840" value={teden.kmRocno||""} onChange={e=>setTeden(prikazanTeden,{kmRocno:e.target.value})}/></div>
        )}
        {km>0 && <div style={s.kmRezultat}><span style={s.kmRezultatNum}>{km.toLocaleString("sl-SI")} km</span><span style={s.kmRezultatZasl}>× {TARIFA_KM} € = <b>{zaslKm.toFixed(2)} €</b></span></div>}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>👥 Stranke</div>
        <div style={s.strankeWrap}>
          <button style={s.strankeBtn} onClick={()=>setTeden(prikazanTeden,{stranke:Math.max(0,stranke-1).toString()})}>−</button>
          <input style={s.strankeInput} type="number" min="0" value={teden.stranke||""} onChange={e=>setTeden(prikazanTeden,{stranke:e.target.value})} placeholder="0"/>
          <button style={s.strankeBtn} onClick={()=>setTeden(prikazanTeden,{stranke:(stranke+1).toString()})}>+</button>
        </div>
        {stranke>0 && <div style={s.kmRezultat}><span style={s.kmRezultatNum}>{stranke} {stranke===1?"stranka":stranke<5?"stranke":"strank"}</span><span style={s.kmRezultatZasl}>× {TARIFA_STR} € = <b>{zaslStr.toFixed(2)} €</b></span></div>}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>🧾 Ostalo</div>
        {stroski.length>0 && (
          <div style={{marginBottom:14}}>
            {stroski.map(x=>(
              <div key={x.id} style={s.strosekRow}>
                <div style={s.strosekLeft}>
                  <span style={s.strosekTip}>{tipIkona[x.tip]||"📌"} {x.tip.charAt(0).toUpperCase()+x.tip.slice(1)}</span>
                  {x.opis && <span style={s.strosekOpis}>{x.opis}</span>}
                </div>
                <div style={s.strosekDesno}>
                  <span style={s.strosekZnesek}>{parseFloat(x.znesek).toFixed(2)} €</span>
                  <button style={s.strosekOdstrani} onClick={()=>odstraniStrosek(x.id)}>✕</button>
                </div>
              </div>
            ))}
            <div style={s.strosekSkupaj}>Skupaj ostalo: <b>+ {skupajStroski.toFixed(2)} €</b></div>
          </div>
        )}
        <div style={s.novStrosekWrap}>
          <select style={s.strosekSelect} value={novStrosek.tip} onChange={e=>setNovStrosek(n=>({...n,tip:e.target.value}))}>
            <option value="cakanje">⏳ Čakanje</option>
            <option value="vikend">📅 Vikend</option>
            <option value="ostalo">📌 Ostalo</option>
          </select>
          <input style={s.strosekInput} type="number" placeholder="€" value={novStrosek.znesek} onChange={e=>setNovStrosek(n=>({...n,znesek:e.target.value}))}/>
        </div>
        <input style={{...s.input, marginBottom:10}} placeholder="Opis (neobvezno)" value={novStrosek.opis} onChange={e=>setNovStrosek(n=>({...n,opis:e.target.value}))}/>
        <button style={s.btnDodajStrosek} onClick={dodajStrosek}>+ Dodaj</button>
      </div>

      {(km>0||stranke>0||stroski.length>0) && (
        <div style={s.skupajCard}>
          <div style={s.skupajLabel}>Zaslužek za teden</div>
          <div style={s.skupajLabel2}>{obdobjeLabel}</div>
          <div style={s.skupajVrstice}>
            <div style={s.skupajVrstica}><span>Kilometri ({km.toLocaleString()} × {TARIFA_KM} €)</span><span>{zaslKm.toFixed(2)} €</span></div>
            <div style={s.skupajVrstica}><span>Stranke ({stranke} × {TARIFA_STR} €)</span><span>{zaslStr.toFixed(2)} €</span></div>
            {skupajStroski>0 && <div style={s.skupajVrstica}><span>Ostalo</span><span>+ {skupajStroski.toFixed(2)} €</span></div>}
            <div style={s.skupajTotal}><span>SKUPAJ</span><span>{(skupaj+skupajStroski).toFixed(2)} €</span></div>
          </div>
          {teden.zakljucen ? (
            <div style={s.obracunZakljucen}>✅ Obračun poslan dispečerju · {fmt(teden.zakljucenCas)}</div>
          ) : (
            <button style={s.btnZakljuciObracun} onClick={()=>{ setTeden(prikazanTeden,{zakljucen:true,zakljucenCas:new Date().toISOString()}); showToast("✅ Obračun poslan dispečerju!"); }}>
              Zaključi obračun & pošlji dispečerju →
            </button>
          )}
        </div>
      )}

      {Object.keys(st.tedni).some(k=>{ const t=st.tedni[k]; return izracunajKm(t)>0||(parseInt(t.stranke)||0)>0; }) && (
        <div style={{marginTop:8}}>
          <button style={s.pregledBtn} onClick={()=>setPregledOdprt(!pregledOdprt)}>📊 Pregled vseh tednov {pregledOdprt?"▲":"▼"}</button>
          {pregledOdprt && Object.keys(st.tedni).sort((a,b)=>b.localeCompare(a)).map(k=>{
            const t=getTeden(k); const km=izracunajKm(t); const str=parseInt(t.stranke)||0;
            if (!km&&!str) return null;
            return (
              <div key={k} style={s.arhivRow}>
                <div><div style={s.arhivLabel}>{weekLabel(k)}</div><div style={s.arhivMeta}>{km.toLocaleString()} km · {str} strank {t.zakljucen?"· ✅":""}</div></div>
                <div style={s.arhivZasl}>{(km*TARIFA_KM+str*TARIFA_STR).toFixed(2)} €</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NalogiTab({ nalogi, onSelect }) {
  const [filter, setFilter] = useState("aktivni");
  const filtered = nalogi
    .filter(n=>filter==="aktivni"?(n.status==="nov"||n.status==="poslan"||n.status==="sprejet"):filter==="zakljuceni"?n.status==="zakljucen":true)
    .sort((a,b)=>new Date(b.poslan)-new Date(a.poslan));
  const sc = { nov:{color:"#64748b"}, poslan:{color:"#2563eb"}, sprejet:{color:"#d97706"}, zakljucen:{color:"#16a34a"} };

  return (
    <div>
      <div style={s.filterRow}>
        {[["aktivni","Aktivni"],["zakljuceni","Zaključeni"],["vsi","Vsi"]].map(([f,l])=>(
          <button key={f} style={{...s.filterBtn,...(filter===f?s.filterOn:{})}} onClick={()=>setFilter(f)}>{l}</button>
        ))}
      </div>
      {filtered.length===0 && <div style={s.empty}>{filter==="aktivni"?"🎉 Ni aktivnih nalogov.":"Ni nalogov."}</div>}
      {filtered.map(n=>(
        <button key={n.id} style={s.nalogRow} onClick={()=>onSelect(n)}>
          <div style={s.nalogRowLeft}>
            <div style={{width:10,height:10,borderRadius:"50%",background:sc[n.status]?.color||"#94a3b8",marginRight:12,marginTop:4,flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#2563eb",fontFamily:"monospace",marginBottom:3}}>📋 {n.stevilkaNaloga}</div>
              <div style={{fontSize:16,fontWeight:700,color:"#0f2744",marginBottom:2}}>{n.nakKraj} → {n.razKraj}</div>
              <div style={{fontSize:13,color:"#64748b",marginBottom:1}}>{n.stranka}</div>
              <div style={{fontSize:12,color:"#94a3b8"}}>{fmt(n.nakDatum)} – {fmt(n.razDatum)}</div>
            </div>
          </div>
          <div style={{fontSize:22,color:"#94a3b8",marginLeft:8}}>›</div>
        </button>
      ))}
    </div>
  );
}

function NalogDetail({ nalog, onBack, onSprejmi, onZakljuci, onDodajCMR }) {
  if (!nalog) return null;
  const si = {nov:{label:"Nov",color:"#64748b",bg:"#f8fafc",icon:"🔘"},poslan:{label:"Poslan vozniku",color:"#2563eb",bg:"#eff6ff",icon:"📤"},sprejet:{label:"Sprejet",color:"#d97706",bg:"#fffbeb",icon:"✅"},zakljucen:{label:"Zaključen",color:"#16a34a",bg:"#f0fdf4",icon:"✔️"}}[nalog.status]||{};
  const slike = nalog.cmrSlike?.filter(Boolean)||[];

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← Nazaj</button>
        <div style={{fontSize:13,opacity:0.75,marginBottom:2}}>{nalog.stevilkaNaloga} · {nalog.stranka}</div>
        <div style={{fontSize:18,fontWeight:800}}>{nalog.nakKraj} → {nalog.razKraj}</div>
      </div>
      <div style={{...s.content,paddingBottom:120}}>
        <div style={{...s.statusCard,background:si.bg,borderColor:si.color+"33"}}>
          <span style={{...s.statusPill2,background:si.color+"22",color:si.color}}>{si.icon} {si.label}</span>
          {nalog.sprejetCas && <div style={s.statusMeta}>Sprejet: {fmt(nalog.sprejetCas)} ob {fmtT(nalog.sprejetCas)}</div>}
          {nalog.zakljucenCas && <div style={s.statusMeta}>Zaključen: {fmt(nalog.zakljucenCas)} ob {fmtT(nalog.zakljucenCas)}</div>}
        </div>
        <Sec title="📦 Blago"><IR label="Blago" val={nalog.blago}/><IR label="Količina" val={nalog.kolicina}/><IR label="Teža" val={nalog.teza}/></Sec>
        <Sec title="📍 Naklad"><IR label="Firma" val={nalog.nakFirma||"–"} bold/><IR label="Naslov" val={nalog.nakNaslov}/><IR label="Referenca" val={nalog.nakReferenca} mono/><IR label="Datum" val={`${fmt(nalog.nakDatum)} ob ${nalog.nakCas}`}/></Sec>
        <Sec title="🏁 Razklad"><IR label="Firma" val={nalog.razFirma||"–"} bold/><IR label="Naslov" val={nalog.razNaslov}/><IR label="Referenca" val={nalog.razReferenca} mono/><IR label="Datum" val={`${fmt(nalog.razDatum)} ob ${nalog.razCas}`}/></Sec>
        {nalog.navodila && <Sec title="⚠️ Navodila"><div style={s.navodilaBox}>{nalog.navodila}</div></Sec>}

        {/* CMR sekcija — dostopna tudi med nalogom */}
        <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:slike.length>0?12:0}}>
            <div style={{fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5}}>
              📄 CMR dokumenti {slike.length>0&&<span style={{background:"#16a34a",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,marginLeft:4}}>{slike.length}</span>}
            </div>
            {nalog.status==="sprejet" && (
              <div>
                <input type="file" accept="image/*" capture="environment" id="cmr-inline" style={{display:"none"}} onChange={onDodajCMR}/>
                <label htmlFor="cmr-inline" style={{background:"#0f2744",color:"#fff",padding:"7px 14px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  📷 Fotografiraj
                </label>
              </div>
            )}
          </div>

          {slike.length===0 ? (
            <div>
              {nalog.status==="sprejet" ? (
                <div style={{textAlign:"center",padding:"20px 0"}}>
                  <div style={{fontSize:32,marginBottom:6}}>📄</div>
                  <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Ni še priloženih CMR dokumentov</div>
                  <input type="file" accept="image/*" capture="environment" id="cmr-inline2" style={{display:"none"}} onChange={onDodajCMR}/>
                  <label htmlFor="cmr-inline2" style={{...s.cmrDodajBtn, display:"inline-block", width:"auto", padding:"10px 20px"}}>
                    📷 Fotografiraj CMR
                  </label>
                </div>
              ) : (
                <div style={{fontSize:13,color:"#94a3b8",textAlign:"center",padding:"12px 0"}}>
                  {nalog.status==="poslan"?"CMR bo mogoče slikati po sprejemu naloga.":"Ni CMR dokumentov."}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={s.cmrGrid}>
                {slike.map((sl,i)=>(
                  <div key={i} style={s.cmrThumbWrap}>
                    <img src={sl.img} alt={`CMR ${i+1}`} style={s.cmrThumb}/>
                    <div style={s.cmrThumbLabel}>✅ Slika {i+1}</div>
                  </div>
                ))}
                {/* Dodaj še gumb */}
                {nalog.status==="sprejet" && (
                  <div style={{...s.cmrThumbWrap}}>
                    <input type="file" accept="image/*" capture="environment" id="cmr-inline3" style={{display:"none"}} onChange={onDodajCMR}/>
                    <label htmlFor="cmr-inline3" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:"100%",aspectRatio:"3/4",border:"2px dashed #cbd5e1",borderRadius:8,cursor:"pointer",background:"#f8fafc"}}>
                      <span style={{fontSize:24}}>📷</span>
                      <span style={{fontSize:11,color:"#64748b",marginTop:4}}>Dodaj</span>
                    </label>
                  </div>
                )}
              </div>
              {nalog.status==="zakljucen" && <div style={s.cmrPoslan}>✅ CMR poslan dispečerju</div>}
              {nalog.status==="sprejet" && (
                <div style={{fontSize:12,color:"#d97706",fontWeight:600,textAlign:"center",padding:"6px",background:"#fffbeb",borderRadius:8,marginTop:8}}>
                  ⏳ {slike.length} {slike.length===1?"slika dodana":"slike/slik dodanih"} — pošlji ob zaključitvi naloga
                </div>
              )}
            </div>
          )}
        </div>

        <div style={s.metaBox}>Poslan: {fmt(nalog.poslan)} ob {fmtT(nalog.poslan)}</div>
      </div>
      <div style={s.actionBar}>
        {nalog.status==="poslan" && <button style={s.btnPrimary} onClick={onSprejmi}>✅ Sprejmi nalog</button>}
        {nalog.status==="sprejet" && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{fontSize:12,color:"#64748b",textAlign:"center"}}>
              {slike.length>0?`✅ ${slike.length} CMR slik pripravljenih`:"💡 Fotografiraj CMR pred zaključitvijo"}
            </div>
            <button style={s.btnSuccess} onClick={onZakljuci}>
              {slike.length>0?"📤 Zaključi & pošlji CMR dispečerju":"📸 Zaključi nalog (brez CMR)"}
            </button>
          </div>
        )}
        {nalog.status==="zakljucen" && <div style={s.zakljucenoBar}>✅ Nalog zaključen – CMR poslan dispečerju</div>}
      </div>
    </div>
  );
}

function ZakljuciModal({ form, nalog, dodajSlikoCMR, odstraniSliko, onPotrdi, onClose }) {
  const slike = (form.slike||[]).filter(Boolean);
  return (
    <div style={s.overlay}>
      <div style={{...s.modalBox,maxHeight:"95vh"}}>
        <div style={s.modalHead}><span style={s.modalTitle}>Zaključi nalog</span><button style={s.closeBtn} onClick={onClose}>✕</button></div>
        <div style={s.modalBody}>
          <div style={s.infoBox}><b>{nalog?.stranka}</b><br/><span style={{fontSize:13,color:"#475569"}}>{nalog?.stevilkaNaloga}</span></div>
          <div style={{marginBottom:10}}><div style={s.label}>📸 CMR transportni dokumenti</div><div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Dodaj kolikor slik želiš.</div></div>
          {slike.length>0 && (
            <div style={s.cmrGallery}>
              {slike.map((sl,i)=>(
                <div key={i} style={s.cmrGalleryItem}>
                  <img src={sl.img} alt={`CMR ${i+1}`} style={s.cmrGalleryImg}/>
                  <button style={s.cmrOdstraniBtn} onClick={()=>odstraniSliko(i)}>✕</button>
                  <div style={s.cmrGalleryLbl}>✅ {i+1}. slika</div>
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" id="cmr-add" style={{display:"none"}} onChange={dodajSlikoCMR}/>
          <label htmlFor="cmr-add" style={s.cmrDodajBtn}>📷 {slike.length===0?"Fotografiraj CMR":"+ Dodaj še sliko"}</label>
          {slike.length>0 && <div style={s.cmrSteviloBadge}>✅ {slike.length} {slike.length===1?"slika":"slike/slik"} dodanih</div>}
          <button style={s.btnPrimary} onClick={onPotrdi}>Zaključi & pošlji dispečerju →</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VOZNIK LOGIN
// ═══════════════════════════════════════════════════════════════════════════
function VoznikLogin({ onLogin }) {
  const [vozniki, setVozniki] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState("");

  useEffect(() => {
    supabase.from('vozniki').select('*').eq('aktiven', true).order('priimek').then(({ data }) => {
      if (data) setVozniki(data);
      setLoading(false);
    });
  }, []);

  const prijava = () => {
    const v = vozniki.find(x => x.id === sel);
    if (!v) return;
    onLogin(v.id, `${v.ime} ${v.priimek}`, v.vozilo || "");
  };

  return (
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:48,marginBottom:12}}>🚛</div>
      <div style={{fontSize:26,fontWeight:800,color:"#fff",marginBottom:4}}>TransApp</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginBottom:32}}>Jurjevec Transport</div>
      <div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{fontWeight:700,fontSize:18,color:"#0f2744",marginBottom:6}}>Prijava</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Izberi svoje ime</div>
        {loading ? (
          <div style={{textAlign:"center",color:"#64748b",padding:"20px 0"}}>⏳ Nalagam voznike...</div>
        ) : (
          <>
            <select style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"12px 14px",fontSize:15,outline:"none",background:"#f8fafc",marginBottom:16,boxSizing:"border-box"}}
              value={sel} onChange={e=>setSel(e.target.value)}>
              <option value="">– Izberi voznika –</option>
              {vozniki.map(v=>(
                <option key={v.id} value={v.id}>{v.ime} {v.priimek} · {v.vozilo}</option>
              ))}
            </select>
            <button style={{width:"100%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer",opacity:sel?1:0.45}}
              onClick={prijava} disabled={!sel}>
              Prijava →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProstiCMRTab({ st, upd, showToast }) {
  const [pogled, setPogled] = useState("nov");
  const [stevilkaNaloga, setStevilkaNaloga] = useState("");
  const [slike, setSlike] = useState([]);
  const [opomba, setOpomba] = useState("");
  const [poslan, setPostlan] = useState(false);

  const nalogNajden = st.nalogi?.find(n => n.stevilkaNaloga?.toUpperCase() === stevilkaNaloga.toUpperCase());
  const arhiv = (st.prostiCMR || []).slice().reverse();

  const dodajSliko = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    showToast("⏳ Optimizacija slike...");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const optimized = await optimizejSliko(ev.target.result);
      setSlike(f => [...f, { img: optimized, ime: file.name, cas: new Date().toISOString() }]);
      showToast("✅ Slika dodana!");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const odstraniSliko = (idx) => setSlike(f => f.filter((_, i) => i !== idx));

  const posljiCMR = () => {
    if (!stevilkaNaloga) return showToast("Vnesi številko naloga s CMR listine!", true);
    if (slike.length === 0) return showToast("Dodaj vsaj eno sliko CMR!", true);
    const cmr = { id: Date.now(), stevilkaNaloga: stevilkaNaloga.toUpperCase(), slike, opomba, cas: new Date().toISOString(), voznik: st.voznik.ime, vozilo: st.voznik.vozilo };
    if (nalogNajden) {
      upd(s => ({ ...s, nalogi: s.nalogi.map(n => n.id===nalogNajden.id ? {...n, cmrSlike:[...(n.cmrSlike||[]),...slike]} : n), prostiCMR: [...(s.prostiCMR||[]), {...cmr, povezan:true}] }));
      showToast(`✅ CMR dodan k nalogu ${stevilkaNaloga}!`);
    } else {
      upd(s => ({ ...s, prostiCMR: [...(s.prostiCMR||[]), {...cmr, povezan:false}] }));
      showToast("✅ CMR poslan dispečerju – bo povezan z nalogom.");
    }
    setPostlan(true);
    setStevilkaNaloga(""); setSlike([]); setOpomba("");
    setTimeout(() => { setPostlan(false); setPogled("arhiv"); }, 1500);
  };

  return (
    <div>
      <div style={s.nacin}>
        <button style={{...s.nacinBtn,...(pogled==="nov"?s.nacinOn:{})}} onClick={()=>setPogled("nov")}>📸 Nov CMR</button>
        <button style={{...s.nacinBtn,...(pogled==="arhiv"?s.nacinOn:{})}} onClick={()=>setPogled("arhiv")}>
          📋 Moji CMR {arhiv.length>0?`(${arhiv.length})`:""}
        </button>
      </div>

      {pogled==="nov" && (
        <div style={s.card}>
          <div style={s.cardTitle}>📸 CMR brez naloga</div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16,lineHeight:1.6}}>
            Vnesi <b>številko naloga</b> ki piše na CMR listini. CMR bo avtomatsko dodan k pravemu nalogu.
          </div>
          <div style={{marginBottom:14}}>
            <label style={s.label}>📋 Številka naloga (s CMR listine) *</label>
            <input
              style={{...s.inputBig, textTransform:"uppercase", borderColor: stevilkaNaloga?(nalogNajden?"#16a34a":"#f59e0b"):"#e2e8f0"}}
              placeholder="npr. NAL-2025-042"
              value={stevilkaNaloga}
              onChange={e=>setStevilkaNaloga(e.target.value)}
            />
            {stevilkaNaloga && (
              <div style={{marginTop:6,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,background:nalogNajden?"#f0fdf4":"#fffbeb",color:nalogNajden?"#16a34a":"#d97706"}}>
                {nalogNajden ? `✅ Nalog najden: ${nalogNajden.stranka} · ${nalogNajden.nakKraj} → ${nalogNajden.razKraj}` : "⚠️ Nalog ni v sistemu – CMR bo poslan dispečerju"}
              </div>
            )}
          </div>
          <div style={{marginBottom:14}}>
            <label style={s.smallLabel}>Opomba (neobvezno)</label>
            <input style={s.input} placeholder="npr. Preložitev iz kamiona CE-PG-007" value={opomba} onChange={e=>setOpomba(e.target.value)}/>
          </div>
          <label style={s.label}>📷 Fotografiraj CMR dokument</label>
          <div style={{fontSize:12,color:"#64748b",marginBottom:10}}>Vsaka slika se avtomatsko optimizira (čb + kontrast).</div>
          {slike.length>0 && (
            <div style={s.cmrGallery}>
              {slike.map((sl,i)=>(
                <div key={i} style={s.cmrGalleryItem}>
                  <img src={sl.img} alt={`CMR ${i+1}`} style={s.cmrGalleryImg}/>
                  <button style={s.cmrOdstraniBtn} onClick={()=>odstraniSliko(i)}>✕</button>
                  <div style={s.cmrGalleryLbl}>✅ {i+1}. slika</div>
                </div>
              ))}
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" id="prosti-cmr-add" style={{display:"none"}} onChange={dodajSliko}/>
          <label htmlFor="prosti-cmr-add" style={s.cmrDodajBtn}>📷 {slike.length===0?"Fotografiraj CMR":"+ Dodaj še sliko"}</label>
          {slike.length>0 && <div style={s.cmrSteviloBadge}>✅ {slike.length} {slike.length===1?"slika":"slike/slik"} dodanih</div>}
          {poslan && <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:12,padding:"12px 16px",textAlign:"center",fontSize:14,fontWeight:700,color:"#16a34a",marginBottom:14}}>✅ CMR uspešno poslan!</div>}
          <button style={{...s.btnPrimary,opacity:(stevilkaNaloga&&slike.length>0)?1:0.45}} onClick={posljiCMR}>
            📤 {nalogNajden?`Dodaj CMR k nalogu ${stevilkaNaloga}`:"Pošlji CMR dispečerju →"}
          </button>
        </div>
      )}

      {pogled==="arhiv" && (
        <div>
          {arhiv.length===0 && <div style={s.empty}>Ni poslanih prostih CMR dokumentov.<br/>Ko pošlješ CMR brez naloga, se pojavi tukaj.</div>}
          {arhiv.map(cmr=>(
            <div key={cmr.id} style={s.vnosCard}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontWeight:800,fontSize:15,fontFamily:"monospace",color:"#2563eb"}}>{cmr.stevilkaNaloga}</span>
                <span style={{fontSize:11,color:"#94a3b8"}}>{fmt(cmr.cas)} {fmtT(cmr.cas)}</span>
              </div>
              {cmr.opomba && <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>📝 {cmr.opomba}</div>}
              {cmr.slike?.length>0 && (
                <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                  {cmr.slike.filter(Boolean).map((sl,i)=>(
                    <img key={i} src={sl.img} alt={`CMR ${i+1}`} style={{width:55,height:75,objectFit:"cover",borderRadius:6,border:"1px solid #e2e8f0"}}/>
                  ))}
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:cmr.povezan?"#16a34a":"#d97706"}}/>
                <span style={{fontSize:12,fontWeight:700,color:cmr.povezan?"#16a34a":"#d97706"}}>
                  {cmr.povezan?"Povezan z nalogom":"Čaka na potrditev pri dispečerju"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Sec = ({title,children})=>(<div style={s.section}><div style={s.sectionTitle2}>{title}</div>{children}</div>);
const IR = ({label,val,bold,mono})=>(<div style={s.infoRow}><span style={s.infoLabel}>{label}</span><span style={{...s.infoVal,...(bold?{fontWeight:700,color:"#0f2744"}:{}),...(mono?{fontFamily:"monospace",fontSize:12,color:"#2563eb"}:{})}}>{val||"–"}</span></div>);
const NavBtn = ({active,onClick,icon,label})=>(<button onClick={onClick} style={s.navBtn}><span style={{fontSize:24}}>{icon}</span><span style={{fontSize:10,marginTop:2,fontWeight:active?700:500,color:active?"#2563eb":"#94a3b8",textAlign:"center"}}>{label}</span></button>);
const Toast = ({toast})=><div style={{...s.toast,background:toast.err?"#dc2626":"#16a34a"}}>{toast.txt}</div>;

const s = {
  wrap:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column"},
  header:{background:"linear-gradient(135deg,#0f2744 0%,#1d4ed8 100%)",padding:"16px 20px 14px",color:"#fff"},
  hRow:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  logo:{fontSize:21,fontWeight:800,letterSpacing:-0.5},
  sub:{fontSize:12,opacity:0.65,marginTop:3},
  redBadge:{background:"#ef4444",color:"#fff",padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:700},
  backBtn:{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",padding:"6px 14px",borderRadius:20,fontSize:13,cursor:"pointer",marginBottom:10,display:"block"},
  toast:{position:"fixed",top:74,left:"50%",transform:"translateX(-50%)",color:"#fff",padding:"12px 24px",borderRadius:30,fontWeight:700,fontSize:14,zIndex:400,boxShadow:"0 4px 20px rgba(0,0,0,0.25)",whiteSpace:"nowrap",maxWidth:"90vw"},
  content:{flex:1,padding:"14px 14px 90px",overflowY:"auto"},
  nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,display:"flex",background:"#fff",borderTop:"1px solid #e2e8f0",padding:"6px 0 4px",zIndex:50},
  navBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",background:"none",border:"none",cursor:"pointer",padding:"4px 2px"},
  datumRow:{display:"flex",alignItems:"flex-end",gap:8},
  datumPolje:{flex:1},
  datumSep:{fontSize:18,color:"#94a3b8",paddingBottom:10,flexShrink:0},
  obdobjeLabel:{fontSize:12,color:"#16a34a",fontWeight:600,marginTop:8,textAlign:"center"},
  card:{background:"#fff",borderRadius:16,padding:18,marginBottom:14,boxShadow:"0 1px 5px rgba(0,0,0,0.07)"},
  cardTitle:{fontWeight:700,fontSize:16,color:"#0f2744",marginBottom:14},
  nacin:{display:"flex",gap:8,marginBottom:14},
  nacinBtn:{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:13,cursor:"pointer",fontWeight:500,color:"#475569"},
  nacinOn:{background:"#0f2744",color:"#fff",border:"1.5px solid #0f2744",fontWeight:700},
  kmRazlikaWrap:{display:"flex",alignItems:"flex-end",gap:8},
  kmPolje:{flex:1},
  kmMinus:{fontSize:20,color:"#94a3b8",paddingBottom:10,flexShrink:0},
  kmRezultat:{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,background:"#f0fdf4",borderRadius:10,padding:"10px 14px"},
  kmRezultatNum:{fontWeight:700,color:"#0f2744",fontSize:15},
  kmRezultatZasl:{fontSize:14,color:"#475569"},
  strankeWrap:{display:"flex",alignItems:"center",gap:12,margin:"12px 0"},
  strankeBtn:{width:44,height:44,borderRadius:12,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:22,cursor:"pointer",fontWeight:700,color:"#0f2744",flexShrink:0},
  strankeInput:{flex:1,border:"1.5px solid #e2e8f0",borderRadius:12,padding:"10px",fontSize:24,fontWeight:800,textAlign:"center",outline:"none",color:"#0f2744"},
  skupajCard:{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:16,padding:20,marginBottom:14,color:"#fff"},
  skupajLabel:{fontSize:13,opacity:0.75,marginBottom:2},
  skupajLabel2:{fontSize:12,opacity:0.6,marginBottom:14},
  skupajVrstice:{},
  skupajVrstica:{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"},
  skupajTotal:{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:22,paddingTop:12},
  btnZakljuciObracun:{width:"100%",background:"linear-gradient(135deg,#065f46,#16a34a)",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:14},
  obracunZakljucen:{textAlign:"center",color:"#dcfce7",fontWeight:700,fontSize:13,marginTop:14,background:"rgba(255,255,255,0.15)",borderRadius:12,padding:"11px"},
  pregledBtn:{width:"100%",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",color:"#0f2744",marginBottom:8},
  arhivRow:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",borderRadius:10,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"},
  arhivLabel:{fontWeight:600,fontSize:13,color:"#1e293b",marginBottom:2},
  arhivMeta:{fontSize:12,color:"#94a3b8"},
  arhivZasl:{fontWeight:800,fontSize:16,color:"#16a34a"},
  strosekRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"},
  strosekLeft:{display:"flex",flexDirection:"column",gap:2},
  strosekTip:{fontSize:13,fontWeight:600,color:"#1e293b"},
  strosekOpis:{fontSize:11,color:"#94a3b8"},
  strosekDesno:{display:"flex",alignItems:"center",gap:8},
  strosekZnesek:{fontWeight:700,color:"#16a34a",fontSize:14},
  strosekOdstrani:{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:16,padding:"0 2px"},
  strosekSkupaj:{fontSize:13,color:"#16a34a",fontWeight:700,textAlign:"right",marginTop:8,paddingTop:8,borderTop:"1px solid #dcfce7"},
  novStrosekWrap:{display:"flex",gap:8,marginBottom:8},
  strosekSelect:{flex:1.5,border:"1.5px solid #e2e8f0",borderRadius:10,padding:"10px 8px",fontSize:13,outline:"none",background:"#f8fafc"},
  strosekInput:{flex:1,border:"1.5px solid #e2e8f0",borderRadius:10,padding:"10px 8px",fontSize:15,fontWeight:700,outline:"none",textAlign:"center"},
  btnDodajStrosek:{width:"100%",background:"#f1f5f9",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"10px",fontSize:14,fontWeight:700,color:"#0f2744",cursor:"pointer"},
  filterRow:{display:"flex",gap:6,marginBottom:14},
  filterBtn:{padding:"7px 14px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:13,cursor:"pointer",fontWeight:500,color:"#475569"},
  filterOn:{background:"#0f2744",color:"#fff",border:"1.5px solid #0f2744"},
  nalogRow:{width:"100%",background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 5px rgba(0,0,0,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",border:"none",cursor:"pointer",textAlign:"left"},
  nalogRowLeft:{display:"flex",alignItems:"flex-start",flex:1},
  statusCard:{borderRadius:12,padding:"12px 14px",marginBottom:14,border:"1.5px solid"},
  statusPill2:{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:700,display:"inline-block",marginBottom:6},
  statusMeta:{fontSize:12,color:"#64748b",marginTop:4},
  section:{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  sectionTitle2:{fontSize:13,fontWeight:700,color:"#64748b",marginBottom:10,textTransform:"uppercase",letterSpacing:0.5},
  infoRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",paddingBottom:7,marginBottom:7,borderBottom:"1px solid #f8fafc"},
  infoLabel:{fontSize:12,color:"#94a3b8",flexShrink:0,marginRight:10,paddingTop:1},
  infoVal:{fontSize:13,color:"#1e293b",textAlign:"right",flex:1},
  navodilaBox:{fontSize:13,color:"#1e293b",lineHeight:1.6,background:"#fffbeb",borderRadius:8,padding:"10px 12px",border:"1px solid #fde68a"},
  cmrGrid:{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"},
  cmrThumbWrap:{width:"calc(33% - 6px)",textAlign:"center"},
  cmrThumb:{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0"},
  cmrThumbLabel:{fontSize:11,color:"#64748b",marginTop:4},
  cmrPoslan:{fontSize:12,color:"#16a34a",fontWeight:600,textAlign:"center",padding:"8px",background:"#f0fdf4",borderRadius:8},
  metaBox:{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"8px 0"},
  actionBar:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#fff",borderTop:"1px solid #e2e8f0",padding:"12px 16px 20px",zIndex:50},
  zakljucenoBar:{textAlign:"center",color:"#16a34a",fontWeight:700,fontSize:14,padding:"14px"},
  cmrGallery:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:14},
  cmrGalleryItem:{position:"relative",width:"calc(33% - 7px)"},
  cmrGalleryImg:{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:10,border:"2px solid #16a34a",display:"block"},
  cmrGalleryLbl:{fontSize:11,color:"#16a34a",fontWeight:700,textAlign:"center",marginTop:3},
  cmrOdstraniBtn:{position:"absolute",top:4,right:4,background:"#dc2626",color:"#fff",border:"none",borderRadius:"50%",width:22,height:22,fontSize:11,cursor:"pointer",fontWeight:700,lineHeight:"22px",padding:0},
  cmrDodajBtn:{display:"block",width:"100%",textAlign:"center",background:"#0f2744",color:"#fff",padding:"13px",borderRadius:12,fontWeight:700,fontSize:15,cursor:"pointer",marginBottom:12,boxSizing:"border-box"},
  cmrSteviloBadge:{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#1d4ed8",marginBottom:14,textAlign:"center"},
  vnosCard:{background:"#fff",borderRadius:12,padding:"13px 15px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"},
  label:{display:"block",fontSize:13,fontWeight:600,color:"#475569",marginBottom:6},
  smallLabel:{display:"block",fontSize:12,color:"#64748b",marginBottom:6},
  input:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"11px 13px",fontSize:15,outline:"none",boxSizing:"border-box",background:"#f8fafc"},
  inputBig:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"13px 16px",fontSize:22,fontWeight:700,outline:"none",boxSizing:"border-box",background:"#f8fafc",color:"#0f2744"},
  infoBox:{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"12px 14px",marginBottom:16,lineHeight:1.7},
  btnPrimary:{width:"100%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4},
  btnSuccess:{width:"100%",background:"linear-gradient(135deg,#065f46,#16a34a)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200},
  modalBox:{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:430,overflowY:"auto"},
  modalHead:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px 12px",borderBottom:"1px solid #e2e8f0"},
  modalTitle:{fontWeight:700,fontSize:17,color:"#0f2744"},
  closeBtn:{background:"#f1f5f9",border:"none",borderRadius:"50%",width:32,height:32,fontSize:14,cursor:"pointer"},
  modalBody:{padding:"16px 20px 32px"},
  empty:{textAlign:"center",color:"#94a3b8",padding:"40px 20px",fontSize:14,lineHeight:1.7},
};
