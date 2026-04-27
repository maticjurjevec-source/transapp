import { useState, useEffect } from "react";
import { supabase } from './supabase';

const pad = (n) => String(n).padStart(2, "0");
const fmt = (iso) => { if (!iso) return "–"; const d = new Date(iso); return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`; };
const fmtT = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

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

const initState = () => ({
  voznik: { ime: "Voznik", vozilo: "" },
  nalogi: [],
  prostiCMR: [],
});

export default function App({ voznikId:propVoznikId=null, voznikIme='', voznikVozilo='', onOdjava=null }) {
  const [st, setSt] = useState(initState);
  const [tab, setTab] = useState("nalogi");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);
  const [selectedNalog, setSelectedNalog] = useState(null);
  const [voznikId, setVoznikId] = useState(null);

  useEffect(() => { if (propVoznikId) setVoznikId(propVoznikId); }, [propVoznikId]);
  useEffect(() => { if (voznikId) naložiNaloge(); }, [voznikId]);

  const naložiNaloge = async () => {
    try {
      const { data, error } = await supabase.from('nalogi').select('*').eq('voznik_id', voznikId).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const mapped = data.map(n => ({
          ...n, id: n.id, stevilkaNaloga: n.stevilka_naloga, nakKraj: n.nak_kraj, razKraj: n.raz_kraj,
          nakFirma: n.nak_firma, nakNaslov: n.nak_naslov, nakReferenca: n.nak_referenca, nakDatum: n.nak_datum, nakCas: n.nak_cas,
          razFirma: n.raz_firma, razNaslov: n.raz_naslov, razReferenca: n.raz_referenca, razDatum: n.raz_datum, razCas: n.raz_cas,
          poslan: n.poslan_cas || n.created_at, sprejetCas: n.sprejet_cas, zakljucenCas: n.zakljucen_cas, cmrSlike: [],
        }));
        setSt(s => ({ ...s, nalogi: mapped }));
      }
    } catch(err) { console.error('Napaka pri nalaganju:', err); }
  };

  const upd = (fn) => { const ns = fn(st); setSt(ns); };
  const showToast = (txt, err) => { setToast({txt,err}); setTimeout(()=>setToast(null),3500); };
  const closeModal = () => { setModal(null); setForm({}); };

  const sprejmiNalog = async (nalog) => {
    try {
      const { error } = await supabase.from('nalogi').update({ status: 'sprejet', sprejet_cas: new Date().toISOString() }).eq('id', nalog.id);
      if (error) throw error;
      upd(s=>({...s, nalogi:s.nalogi.map(n=>n.id===nalog.id?{...n,status:"sprejet",sprejetCas:new Date().toISOString()}:n)}));
      if (selectedNalog) setSelectedNalog(n=>({...n,status:"sprejet",sprejetCas:new Date().toISOString()}));
      showToast("✅ Nalog sprejet!");
    } catch(err) { showToast("❌ Napaka!", true); }
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
    reader.readAsDataURL(file); e.target.value="";
  };

  const odstraniSliko = (idx) => setForm(f=>({...f, slike:(f.slike||[]).filter((_,i)=>i!==idx)}));

  const potrdiZakljucitev = async () => {
    const nalog = st.nalogi.find(n=>n.id===form.nalogId);
    const slike = (form.slike||[]).filter(Boolean);
    try {
      for (const sl of slike) {
        const base64 = sl.img.split(',')[1];
        const byteArr = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const blob = new Blob([byteArr], { type: 'image/jpeg' });
        const pot = `${nalog.id}/${Date.now()}-${sl.ime||'cmr.jpg'}`;
        const { error: upErr } = await supabase.storage.from('cmr-dokumenti').upload(pot, blob, { contentType:'image/jpeg', upsert:false });
        if (upErr) throw upErr;
        await supabase.from('cmr_dokumenti').insert([{ nalog_id: nalog.id, ime_datoteke: sl.ime||'cmr.jpg', storage_pot: pot }]);
      }
      const { error } = await supabase.from('nalogi').update({ status: 'zakljucen', zakljucen_cas: new Date().toISOString() }).eq('id', nalog.id);
      if (error) throw error;
      upd(s=>({...s, nalogi:s.nalogi.map(n=>n.id===nalog.id?{...n,status:"zakljucen",zakljucenCas:new Date().toISOString(),cmrSlike:slike}:n)}));
      closeModal(); setSelectedNalog(null);
      showToast("✅ Nalog zaključen! CMR shranjen.");
    } catch(err) { showToast("❌ Napaka!", true); console.error(err); }
  };

  const novihNalogov = st.nalogi.filter(n=>n.status==="nov"||n.status==="poslan").length;
  const nepovezanihCMR = (st.prostiCMR||[]).filter(c=>!c.povezan).length;

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
          reader.readAsDataURL(file); e.target.value="";
        }}/>
        {modal==="zakljuci" && <ZakljuciModal form={form} nalog={st.nalogi.find(n=>n.id===form.nalogId)} dodajSlikoCMR={dodajSlikoCMR} odstraniSliko={odstraniSliko} onPotrdi={potrdiZakljucitev} onClose={closeModal}/>}
        {toast && <Toast toast={toast}/>}
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.hRow}>
          <div><div style={s.logo}>🚛 TransApp</div><div style={s.sub}>{voznikIme} · {voznikVozilo}</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {novihNalogov>0 && <div style={s.redBadge}>{novihNalogov} nov{novihNalogov>1?"a":""}</div>}
            {onOdjava && <button style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",padding:"5px 12px",borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:600}} onClick={onOdjava}>Odjava</button>}
          </div>
        </div>
      </div>
      {toast && <Toast toast={toast}/>}
      <div style={s.content}>
        {tab==="obracun" && <ObracunTab st={st} showToast={showToast} voznikId={voznikId}/>}
        {tab==="nalogi" && <NalogiTab nalogi={st.nalogi} onSelect={setSelectedNalog}/>}
        {tab==="prosticmr" && <ProstiCMRTab st={st} upd={upd} showToast={showToast}/>}
      </div>
      <div style={s.nav}>
        <NavBtn active={tab==="obracun"} onClick={()=>setTab("obracun")} icon="💶" label="Obračun"/>
        <NavBtn active={tab==="nalogi"} onClick={()=>setTab("nalogi")} icon="📋" label={`Nalogi${novihNalogov?` (${novihNalogov})`:""}`}/>
        <NavBtn active={tab==="prosticmr"} onClick={()=>setTab("prosticmr")} icon="📸" label={`CMR${nepovezanihCMR>0?` (${nepovezanihCMR})`:""}`}/>
      </div>
    </div>
  );
}

function ObracunTab({ st, showToast, voznikId }) {
  const TARIFA_KM = 0.185;
  const TARIFA_STR = 20;
  const TARIFA_DOPUST = 40;

  const getMonday = (date) => { const d = new Date(date); const day = d.getDay()||7; d.setDate(d.getDate()-day+1); d.setHours(0,0,0,0); return d; };
  const defaultZac = () => getMonday(new Date()).toISOString().slice(0,10);
  const defaultKon = () => { const d = getMonday(new Date()); d.setDate(d.getDate()+6); return d.toISOString().slice(0,10); };

  const [datZac, setDatZac] = useState(defaultZac);
  const [datKon, setDatKon] = useState(defaultKon);
  const [kmZacetek, setKmZacetek] = useState("");
  const [kmKonec, setKmKonec] = useState("");
  const [stranke, setStranke] = useState("");
  const [prevozi, setPrevozi] = useState([]);
  const [tankanja, setTankanja] = useState([]);
  const [dopustDni, setDopustDni] = useState("");
  const [cakanjeOpis, setCakanjeOpis] = useState("");
  const [bolniskaDni, setBolniskaDni] = useState("");
  const [drugiStroski, setDrugiStroski] = useState([]);
  const [novStrosek, setNovStrosek] = useState({opis:"", znesek:""});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [arhiv, setArhiv] = useState([]);
  const [pregledOdprt, setPregledOdprt] = useState(false);

  useEffect(() => {
    if (!voznikId || !datZac) return;
    setLoading(true);
    supabase.from("tedenski_obracuni").select("*").eq("voznik_id", voznikId).eq("datum_od", datZac).maybeSingle().then(({ data }) => {
      if (data) {
        setExistingId(data.id); setKmZacetek(data.km_zacetek?.toString()||""); setKmKonec(data.km_konec?.toString()||"");
        setStranke(data.stevilo_strank?.toString()||""); setPrevozi(data.prevozi||[]); setTankanja(data.tankanja||[]);
        setDopustDni(data.dopust_dni?.toString()||""); setCakanjeOpis(data.cakanje_opis||""); setBolniskaDni(data.bolniska_dni?.toString()||"");
        setDrugiStroski(data.drugi_stroski||[]); setSaved(data.status==="poslan");
      } else { resetForm(); }
      setLoading(false);
    });
    supabase.from("tedenski_obracuni").select("*").eq("voznik_id", voznikId).order("datum_od",{ascending:false}).limit(20).then(({data})=>{if(data)setArhiv(data);});
  }, [voznikId, datZac]);

  const resetForm = () => { setExistingId(null); setKmZacetek(""); setKmKonec(""); setStranke(""); setPrevozi([]); setTankanja([]); setDopustDni(""); setCakanjeOpis(""); setBolniskaDni(""); setDrugiStroski([]); setSaved(false); };

  const kmPrev = Math.max(0, (parseInt(kmKonec)||0) - (parseInt(kmZacetek)||0));
  const stStr = parseInt(stranke)||0;
  const stDopust = parseInt(dopustDni)||0;
  const zaslKm = kmPrev * TARIFA_KM;
  const zaslStr = stStr * TARIFA_STR;
  const zaslDopust = stDopust * TARIFA_DOPUST;
  const zaslStroski = drugiStroski.reduce((a,x) => a+(parseFloat(x.znesek)||0), 0);
  const sestevek = zaslKm + zaslStr + zaslDopust + zaslStroski;

  const dodajPrevoz = () => setPrevozi(p=>[...p,{st:p.length+1,nakKraj:"",razKraj:""}]);
  const updatePrevoz = (i,field,val) => setPrevozi(p=>p.map((x,j)=>j===i?{...x,[field]:val}:x));
  const odstraniPrevoz = (i) => setPrevozi(p=>p.filter((_,j)=>j!==i).map((x,j)=>({...x,st:j+1})));

  const dodajTankanje = () => setTankanja(t=>[...t,{dan:"",ura:"",kolicina:"",stStevca:"",lokacija:""}]);
  const updateTankanje = (i,field,val) => setTankanja(t=>t.map((x,j)=>j===i?{...x,[field]:val}:x));
  const odstraniTankanje = (i) => setTankanja(t=>t.filter((_,j)=>j!==i));

  const dodajStrosek = () => { if(!novStrosek.znesek)return; setDrugiStroski(d=>[...d,{...novStrosek,id:Date.now()}]); setNovStrosek({opis:"",znesek:""}); };
  const odstraniStrosek = (id) => setDrugiStroski(d=>d.filter(x=>x.id!==id));

  const shrani = async (status="osnutek") => {
    if(!voznikId) return showToast("Ni voznika!",true);
    setSaving(true);
    const payload = { voznik_id:voznikId, datum_od:datZac, datum_do:datKon, km_zacetek:parseInt(kmZacetek)||null, km_konec:parseInt(kmKonec)||null, km_prevozeni:kmPrev||null, stevilo_strank:stStr, prevozi, tankanja, dopust_dni:stDopust, cakanje_opis:cakanjeOpis||null, bolniska_dni:parseInt(bolniskaDni)||0, drugi_stroski:drugiStroski, sestevek, status };
    try {
      if(existingId){ const{error}=await supabase.from("tedenski_obracuni").update(payload).eq("id",existingId); if(error)throw error; }
      else{ const{data,error}=await supabase.from("tedenski_obracuni").insert([payload]).select().single(); if(error)throw error; setExistingId(data.id); }
      if(status==="poslan") setSaved(true);
      showToast(status==="poslan"?"✅ Obračun poslan dispečerju!":"💾 Shranjeno!");
      const{data:a}=await supabase.from("tedenski_obracuni").select("*").eq("voznik_id",voznikId).order("datum_od",{ascending:false}).limit(20);
      if(a) setArhiv(a);
    } catch(err) { showToast("❌ Napaka: "+err.message,true); }
    setSaving(false);
  };

  const obdobjeLabel = `${fmt(datZac+"T00:00:00")} – ${fmt(datKon+"T00:00:00")}`;
  if(loading) return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>⏳ Nalagam...</div>;

  return(<div>
    <div style={s.card}><div style={s.cardTitle}>📅 Tedenski obračun</div>
      <div style={s.datumRow}><div style={s.datumPolje}><label style={s.smallLabel}>Od</label><input style={s.input} type="date" value={datZac} onChange={e=>{setDatZac(e.target.value);const d=new Date(e.target.value);d.setDate(d.getDate()+6);setDatKon(d.toISOString().slice(0,10));}}/></div>
      <div style={s.datumSep}>–</div><div style={s.datumPolje}><label style={s.smallLabel}>Do</label><input style={s.input} type="date" value={datKon} onChange={e=>setDatKon(e.target.value)}/></div></div>
      <div style={s.obdobjeLabel}>{obdobjeLabel}</div></div>

    <div style={s.card}><div style={s.cardTitle}>🛣️ Kilometri</div>
      <div style={s.kmRazlikaWrap}><div style={s.kmPolje}><label style={s.smallLabel}>Začetni km</label><input style={s.input} type="number" placeholder="130365" value={kmZacetek} onChange={e=>setKmZacetek(e.target.value)}/></div>
      <div style={s.kmMinus}>→</div><div style={s.kmPolje}><label style={s.smallLabel}>Končni km</label><input style={s.input} type="number" placeholder="132167" value={kmKonec} onChange={e=>setKmKonec(e.target.value)}/></div></div>
      {kmPrev>0&&<div style={s.kmRezultat}><span style={s.kmRezultatNum}>{kmPrev.toLocaleString("sl-SI")} km</span><span style={s.kmRezultatZasl}>× {TARIFA_KM} € = <b>{zaslKm.toFixed(2)} €</b></span></div>}</div>

    <div style={s.card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={s.cardTitle}>🚛 Prevozi</div><button style={{background:"#0f2744",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={dodajPrevoz}>+ Dodaj</button></div>
      {prevozi.length===0&&<div style={{fontSize:13,color:"#94a3b8",textAlign:"center",padding:12}}>Dodaj prevoze s klikom na + Dodaj</div>}
      {prevozi.map((p,i)=><div key={i} style={{background:"#f8fafc",borderRadius:10,padding:10,marginBottom:8,border:"1px solid #e2e8f0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:12,fontWeight:700,color:"#2563eb"}}>#{p.st}</span><button style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:14}} onClick={()=>odstraniPrevoz(i)}>✕</button></div>
        <div style={{display:"flex",gap:8}}><div style={{flex:1}}><label style={s.smallLabel}>Kraj naklada</label><input style={s.input} placeholder="npr. Ptuj" value={p.nakKraj} onChange={e=>updatePrevoz(i,"nakKraj",e.target.value)}/></div>
        <div style={{flex:1}}><label style={s.smallLabel}>Kraj razklada</label><input style={s.input} placeholder="npr. Linz" value={p.razKraj} onChange={e=>updatePrevoz(i,"razKraj",e.target.value)}/></div></div></div>)}</div>

    <div style={s.card}><div style={s.cardTitle}>👥 Stranke</div>
      <div style={s.strankeWrap}><button style={s.strankeBtn} onClick={()=>setStranke(Math.max(0,stStr-1).toString())}>−</button>
      <input style={s.strankeInput} type="number" min="0" value={stranke} onChange={e=>setStranke(e.target.value)} placeholder="0"/>
      <button style={s.strankeBtn} onClick={()=>setStranke((stStr+1).toString())}>+</button></div>
      {stStr>0&&<div style={s.kmRezultat}><span style={s.kmRezultatNum}>{stStr} {stStr===1?"stranka":stStr<5?"stranke":"strank"}</span><span style={s.kmRezultatZasl}>× {TARIFA_STR} € = <b>{zaslStr.toFixed(2)} €</b></span></div>}</div>

    <div style={s.card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div style={s.cardTitle}>⛽ Tankanja</div><button style={{background:"#0f2744",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={dodajTankanje}>+ Dodaj</button></div>
      {tankanja.length===0&&<div style={{fontSize:13,color:"#94a3b8",textAlign:"center",padding:12}}>Ni vnosov tankanja.</div>}
      {tankanja.map((t,i)=><div key={i} style={{background:"#f8fafc",borderRadius:10,padding:10,marginBottom:8,border:"1px solid #e2e8f0"}}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:4}}><button style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:14}} onClick={()=>odstraniTankanje(i)}>✕</button></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}><div><label style={s.smallLabel}>Dan</label><input style={s.input} type="date" value={t.dan} onChange={e=>updateTankanje(i,"dan",e.target.value)}/></div>
        <div><label style={s.smallLabel}>Ura</label><input style={s.input} type="time" value={t.ura} onChange={e=>updateTankanje(i,"ura",e.target.value)}/></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}><div><label style={s.smallLabel}>Količina (L)</label><input style={s.input} type="number" placeholder="404" value={t.kolicina} onChange={e=>updateTankanje(i,"kolicina",e.target.value)}/></div>
        <div><label style={s.smallLabel}>Št. števca</label><input style={s.input} type="number" placeholder="130986" value={t.stStevca} onChange={e=>updateTankanje(i,"stStevca",e.target.value)}/></div>
        <div><label style={s.smallLabel}>Lokacija</label><input style={s.input} placeholder="Načerje" value={t.lokacija} onChange={e=>updateTankanje(i,"lokacija",e.target.value)}/></div></div></div>)}</div>

    <div style={s.card}><div style={s.cardTitle}>📋 Ostalo</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}><div><label style={s.smallLabel}>Dopust (dni × {TARIFA_DOPUST}€)</label><input style={s.input} type="number" placeholder="0" value={dopustDni} onChange={e=>setDopustDni(e.target.value)}/></div>
      <div><label style={s.smallLabel}>Bolniška (dni)</label><input style={s.input} type="number" placeholder="0" value={bolniskaDni} onChange={e=>setBolniskaDni(e.target.value)}/></div></div>
      <div style={{marginBottom:10}}><label style={s.smallLabel}>Čakanje (datum, opis)</label><input style={s.input} placeholder="npr. 22.04. čakanje na naklad 3h" value={cakanjeOpis} onChange={e=>setCakanjeOpis(e.target.value)}/></div>
      {stDopust>0&&<div style={s.kmRezultat}><span style={s.kmRezultatNum}>{stDopust} dni dopusta</span><span style={s.kmRezultatZasl}>× {TARIFA_DOPUST} € = <b>{zaslDopust.toFixed(2)} €</b></span></div>}</div>

    <div style={s.card}><div style={s.cardTitle}>🧾 Drugi stroški</div>
      {drugiStroski.length>0&&drugiStroski.map(x=><div key={x.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f1f5f9"}}>
        <span style={{fontSize:13,color:"#0f2744"}}>{x.opis||"Strošek"}</span><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:700,color:"#16a34a"}}>{parseFloat(x.znesek).toFixed(2)} €</span>
        <button style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:14}} onClick={()=>odstraniStrosek(x.id)}>✕</button></div></div>)}
      <div style={{display:"flex",gap:8,marginTop:8}}><input style={{...s.input,flex:2}} placeholder="Opis" value={novStrosek.opis} onChange={e=>setNovStrosek(n=>({...n,opis:e.target.value}))}/>
      <input style={{...s.input,flex:1}} type="number" placeholder="€" value={novStrosek.znesek} onChange={e=>setNovStrosek(n=>({...n,znesek:e.target.value}))}/>
      <button style={{background:"#0f2744",color:"#fff",border:"none",borderRadius:8,padding:"8px 12px",fontWeight:700,cursor:"pointer",flexShrink:0}} onClick={dodajStrosek}>+</button></div></div>

    {(kmPrev>0||stStr>0||stDopust>0||zaslStroski>0)&&<div style={s.skupajCard}>
      <div style={s.skupajLabel}>Tedenski obračun</div><div style={s.skupajLabel2}>{obdobjeLabel}</div>
      <div style={s.skupajVrstice}>
        <div style={s.skupajVrstica}><span>Km ({kmPrev.toLocaleString()} × {TARIFA_KM} €)</span><span>{zaslKm.toFixed(2)} €</span></div>
        <div style={s.skupajVrstica}><span>Stranke ({stStr} × {TARIFA_STR} €)</span><span>{zaslStr.toFixed(2)} €</span></div>
        {stDopust>0&&<div style={s.skupajVrstica}><span>Dopust ({stDopust} × {TARIFA_DOPUST} €)</span><span>{zaslDopust.toFixed(2)} €</span></div>}
        {zaslStroski>0&&<div style={s.skupajVrstica}><span>Drugi stroški</span><span>+ {zaslStroski.toFixed(2)} €</span></div>}
        <div style={s.skupajTotal}><span>SEŠTEVEK</span><span>{sestevek.toFixed(2)} €</span></div>
      </div>
      {saved?<div style={s.obracunZakljucen}>✅ Obračun poslan dispečerju</div>:
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button style={{flex:1,background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:12,padding:12,fontSize:13,fontWeight:700,cursor:"pointer",opacity:saving?0.5:1}} onClick={()=>shrani("osnutek")} disabled={saving}>💾 Shrani</button>
        <button style={{flex:2,background:"linear-gradient(135deg,#065f46,#16a34a)",color:"#fff",border:"none",borderRadius:12,padding:12,fontSize:14,fontWeight:700,cursor:"pointer",opacity:saving?0.5:1}} onClick={()=>shrani("poslan")} disabled={saving}>📤 Pošlji dispečerju →</button>
      </div>}
    </div>}

    {arhiv.length>0&&<div style={{marginTop:8}}>
      <button style={s.pregledBtn} onClick={()=>setPregledOdprt(!pregledOdprt)}>📊 Prejšnji obračuni {pregledOdprt?"▲":"▼"}</button>
      {pregledOdprt&&arhiv.map(a=><div key={a.id} style={s.arhivRow} onClick={()=>{setDatZac(a.datum_od);setDatKon(a.datum_do);}}>
        <div><div style={s.arhivLabel}>{fmt(a.datum_od+"T00:00:00")} – {fmt(a.datum_do+"T00:00:00")}</div>
        <div style={s.arhivMeta}>{(a.km_prevozeni||0).toLocaleString()} km · {a.stevilo_strank||0} strank {a.status==="poslan"?"· ✅ Poslan":"· ⏳ Osnutek"}</div></div>
        <div style={s.arhivZasl}>{(a.sestevek||0).toFixed(2)} €</div></div>)}
    </div>}
  </div>);
}

function NalogiTab({ nalogi, onSelect }) {
  const [filter, setFilter] = useState("aktivni");
  const filtered = nalogi.filter(n=>filter==="aktivni"?(n.status==="nov"||n.status==="poslan"||n.status==="sprejet"):filter==="zakljuceni"?n.status==="zakljucen":true).sort((a,b)=>new Date(b.poslan)-new Date(a.poslan));
  const sc = {nov:{color:"#64748b"},poslan:{color:"#2563eb"},sprejet:{color:"#d97706"},zakljucen:{color:"#16a34a"}};
  return(<div>
    <div style={s.filterRow}>{[["aktivni","Aktivni"],["zakljuceni","Zaključeni"],["vsi","Vsi"]].map(([f,l])=><button key={f} style={{...s.filterBtn,...(filter===f?s.filterOn:{})}} onClick={()=>setFilter(f)}>{l}</button>)}</div>
    {filtered.length===0&&<div style={s.empty}>{filter==="aktivni"?"🎉 Ni aktivnih nalogov.":"Ni nalogov."}</div>}
    {filtered.map(n=><button key={n.id} style={s.nalogRow} onClick={()=>onSelect(n)}>
      <div style={s.nalogRowLeft}><div style={{width:10,height:10,borderRadius:"50%",background:sc[n.status]?.color||"#94a3b8",marginRight:12,marginTop:4,flexShrink:0}}/>
      <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:"#2563eb",fontFamily:"monospace",marginBottom:3}}>📋 {n.stevilkaNaloga}</div>
      <div style={{fontSize:16,fontWeight:700,color:"#0f2744",marginBottom:2}}>{n.nakKraj} → {n.razKraj}</div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:1}}>{n.stranka}</div>
      <div style={{fontSize:12,color:"#94a3b8"}}>{fmt(n.nakDatum)} – {fmt(n.razDatum)}</div></div></div>
      <div style={{fontSize:22,color:"#94a3b8",marginLeft:8}}>›</div></button>)}
  </div>);
}

function NalogDetail({ nalog, onBack, onSprejmi, onZakljuci, onDodajCMR }) {
  if(!nalog) return null;
  const si = {nov:{label:"Nov",color:"#64748b",bg:"#f8fafc",icon:"🔘"},poslan:{label:"Poslan vozniku",color:"#2563eb",bg:"#eff6ff",icon:"📤"},sprejet:{label:"Sprejet",color:"#d97706",bg:"#fffbeb",icon:"✅"},zakljucen:{label:"Zaključen",color:"#16a34a",bg:"#f0fdf4",icon:"✔️"}}[nalog.status]||{};
  const slike = nalog.cmrSlike?.filter(Boolean)||[];
  return(<div style={s.wrap}>
    <div style={s.header}><button style={s.backBtn} onClick={onBack}>← Nazaj</button>
      <div style={{fontSize:13,opacity:0.75,marginBottom:2}}>{nalog.stevilkaNaloga} · {nalog.stranka}</div>
      <div style={{fontSize:18,fontWeight:800}}>{nalog.nakKraj} → {nalog.razKraj}</div></div>
    <div style={{...s.content,paddingBottom:120}}>
      <div style={{...s.statusCard,background:si.bg,borderColor:si.color+"33"}}><span style={{...s.statusPill2,background:si.color+"22",color:si.color}}>{si.icon} {si.label}</span>
        {nalog.sprejetCas&&<div style={s.statusMeta}>Sprejet: {fmt(nalog.sprejetCas)} ob {fmtT(nalog.sprejetCas)}</div>}
        {nalog.zakljucenCas&&<div style={s.statusMeta}>Zaključen: {fmt(nalog.zakljucenCas)} ob {fmtT(nalog.zakljucenCas)}</div>}</div>
      <Sec title="📦 Blago"><IR label="Blago" val={nalog.blago}/><IR label="Količina" val={nalog.kolicina}/><IR label="Teža" val={nalog.teza}/></Sec>
      <Sec title="📍 Naklad"><IR label="Firma" val={nalog.nakFirma||"–"} bold/><IR label="Naslov" val={nalog.nakNaslov}/><IR label="Referenca" val={nalog.nakReferenca} mono/><IR label="Datum" val={`${fmt(nalog.nakDatum)} ob ${nalog.nakCas}`}/></Sec>
      <Sec title="🏁 Razklad"><IR label="Firma" val={nalog.razFirma||"–"} bold/><IR label="Naslov" val={nalog.razNaslov}/><IR label="Referenca" val={nalog.razReferenca} mono/><IR label="Datum" val={`${fmt(nalog.razDatum)} ob ${nalog.razCas}`}/></Sec>
      {nalog.navodila&&<Sec title="⚠️ Navodila"><div style={s.navodilaBox}>{nalog.navodila}</div></Sec>}
      <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:slike.length>0?12:8}}>
          <div style={{fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5}}>📄 CMR dokumenti {slike.length>0&&<span style={{background:"#16a34a",color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:11,marginLeft:4}}>{slike.length}</span>}</div>
          {nalog.status==="sprejet"&&<div><input type="file" accept="image/*" capture="environment" id="cmr-inline" style={{display:"none"}} onChange={onDodajCMR}/><label htmlFor="cmr-inline" style={{background:"#0f2744",color:"#fff",padding:"7px 14px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}}>📷 Fotografiraj</label></div>}
        </div>
        {slike.length===0?<div style={{textAlign:"center",padding:"16px 0",color:"#94a3b8",fontSize:13}}>{nalog.status==="sprejet"?"Pritisni Fotografiraj za dodajanje CMR slik.":nalog.status==="poslan"?"CMR bo mogoče slikati po sprejemu.":"Ni CMR dokumentov."}</div>:
        <div><div style={s.cmrGrid}>{slike.map((sl,i)=><div key={i} style={s.cmrThumbWrap}><img src={sl.img||sl.url} alt={`CMR ${i+1}`} style={s.cmrThumb}/><div style={s.cmrThumbLabel}>✅ Slika {i+1}</div></div>)}
          {nalog.status==="sprejet"&&<div style={s.cmrThumbWrap}><input type="file" accept="image/*" capture="environment" id="cmr-inline3" style={{display:"none"}} onChange={onDodajCMR}/><label htmlFor="cmr-inline3" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:"100%",aspectRatio:"3/4",border:"2px dashed #cbd5e1",borderRadius:8,cursor:"pointer",background:"#f8fafc"}}><span style={{fontSize:24}}>📷</span><span style={{fontSize:11,color:"#64748b",marginTop:4}}>Dodaj</span></label></div>}
        </div>{nalog.status==="zakljucen"&&<div style={s.cmrPoslan}>✅ CMR poslan dispečerju</div>}</div>}
      </div>
      <div style={s.metaBox}>Poslan: {fmt(nalog.poslan)} ob {fmtT(nalog.poslan)}</div>
    </div>
    <div style={s.actionBar}>
      {nalog.status==="poslan"&&<button style={s.btnPrimary} onClick={onSprejmi}>✅ Sprejmi nalog</button>}
      {nalog.status==="sprejet"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontSize:12,color:"#64748b",textAlign:"center"}}>{slike.length>0?`✅ ${slike.length} CMR slik pripravljenih`:"💡 Fotografiraj CMR pred zaključitvijo"}</div>
        <button style={s.btnSuccess} onClick={onZakljuci}>{slike.length>0?"📤 Zaključi & pošlji CMR":"📸 Zaključi nalog (brez CMR)"}</button></div>}
      {nalog.status==="zakljucen"&&<div style={s.zakljucenoBar}>✅ Nalog zaključen</div>}
    </div>
  </div>);
}

function ZakljuciModal({ form, nalog, dodajSlikoCMR, odstraniSliko, onPotrdi, onClose }) {
  const slike = (form.slike||[]).filter(Boolean);
  return(<div style={s.overlay}><div style={{...s.modalBox,maxHeight:"95vh"}}><div style={s.modalHead}><span style={s.modalTitle}>Zaključi nalog</span><button style={s.closeBtn} onClick={onClose}>✕</button></div>
    <div style={s.modalBody}><div style={s.infoBox}><b>{nalog?.stranka}</b><br/><span style={{fontSize:13,color:"#475569"}}>{nalog?.stevilkaNaloga}</span></div>
      <div style={{marginBottom:10}}><div style={s.label}>📸 CMR dokumenti</div><div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Dodaj kolikor slik želiš.</div></div>
      {slike.length>0&&<div style={s.cmrGallery}>{slike.map((sl,i)=><div key={i} style={s.cmrGalleryItem}><img src={sl.img} alt={`CMR ${i+1}`} style={s.cmrGalleryImg}/><button style={s.cmrOdstraniBtn} onClick={()=>odstraniSliko(i)}>✕</button><div style={s.cmrGalleryLbl}>✅ {i+1}. slika</div></div>)}</div>}
      <input type="file" accept="image/*" capture="environment" id="cmr-add" style={{display:"none"}} onChange={dodajSlikoCMR}/>
      <label htmlFor="cmr-add" style={s.cmrDodajBtn}>📷 {slike.length===0?"Fotografiraj CMR":"+ Dodaj še sliko"}</label>
      {slike.length>0&&<div style={s.cmrSteviloBadge}>✅ {slike.length} {slike.length===1?"slika":"slik"} dodanih</div>}
      <button style={s.btnPrimary} onClick={onPotrdi}>Zaključi & pošlji dispečerju →</button>
    </div></div></div>);
}

function ProstiCMRTab({ st, upd, showToast }) {
  const [pogled, setPogled] = useState("nov");
  const [stevilkaNaloga, setStevilkaNaloga] = useState("");
  const [slike, setSlike] = useState([]);
  const [opomba, setOpomba] = useState("");
  const [poslan, setPostlan] = useState(false);
  const [arhiv, setArhiv] = useState([]);
  const [loading, setLoading] = useState(false);

  const nalogNajden = st.nalogi?.find(n => n.stevilkaNaloga?.toUpperCase() === stevilkaNaloga.toUpperCase());

  useEffect(()=>{
    setLoading(true);
    supabase.from("prosti_cmr").select("*").order("created_at",{ascending:false}).then(({data})=>{
      if(data)setArhiv(data);
      setLoading(false);
    });
  },[]);

  const dodajSliko = async(e)=>{const file=e.target.files[0];if(!file)return;showToast("⏳ Optimizacija...");const reader=new FileReader();reader.onload=async(ev)=>{const opt=await optimizejSliko(ev.target.result);setSlike(f=>[...f,{img:opt,ime:file.name,cas:new Date().toISOString()}]);showToast("✅ Dodana!");};reader.readAsDataURL(file);e.target.value="";};
  const odstraniSliko = (idx)=>setSlike(f=>f.filter((_,i)=>i!==idx));

  const posljiCMR = async()=>{
    if(!stevilkaNaloga)return showToast("Vnesi številko naloga!",true);
    if(slike.length===0)return showToast("Dodaj vsaj eno sliko!",true);
    try{
      // Upload slik v Storage
      const uploadedSlike=[];
      for(const sl of slike){
        const base64=sl.img.split(',')[1];
        const byteArr=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
        const blob=new Blob([byteArr],{type:'image/jpeg'});
        const pot=`prosti/${Date.now()}-${sl.ime||'cmr.jpg'}`;
        await supabase.storage.from('cmr-dokumenti').upload(pot,blob,{contentType:'image/jpeg',upsert:false});
        const{data:urlData}=supabase.storage.from('cmr-dokumenti').getPublicUrl(pot);
        uploadedSlike.push({url:urlData?.publicUrl,ime:sl.ime,pot});
      }
      // Shrani v Supabase
      const povezan=!!nalogNajden;
      const{error}=await supabase.from("prosti_cmr").insert([{
        stevilka_naloga:stevilkaNaloga.toUpperCase(),
        opomba,
        slike:uploadedSlike,
        povezan,
        nalog_id:nalogNajden?.id||null,
      }]);
      if(error)throw error;
      // Če je nalog najden, dodaj CMR tudi v cmr_dokumenti tabelo
      if(nalogNajden){
        for(const sl of uploadedSlike){
          await supabase.from('cmr_dokumenti').insert([{nalog_id:nalogNajden.id,ime_datoteke:sl.ime||'cmr.jpg',storage_pot:sl.pot}]);
        }
      }
      showToast(povezan?`✅ CMR dodan k nalogu ${stevilkaNaloga}!`:"✅ CMR poslan dispečerju.");
      setPostlan(true);setStevilkaNaloga("");setSlike([]);setOpomba("");
      // Osveži arhiv
      const{data:a}=await supabase.from("prosti_cmr").select("*").order("created_at",{ascending:false});
      if(a)setArhiv(a);
      setTimeout(()=>{setPostlan(false);setPogled("arhiv");},1500);
    }catch(err){
      showToast("❌ Napaka: "+err.message,true);
      console.error(err);
    }
  };

  return(<div>
    <div style={s.nacin}><button style={{...s.nacinBtn,...(pogled==="nov"?s.nacinOn:{})}} onClick={()=>setPogled("nov")}>📸 Nov CMR</button>
      <button style={{...s.nacinBtn,...(pogled==="arhiv"?s.nacinOn:{})}} onClick={()=>setPogled("arhiv")}>📋 Moji CMR {arhiv.length>0?`(${arhiv.length})`:""}</button></div>
    {pogled==="nov"&&<div style={s.card}><div style={s.cardTitle}>📸 CMR brez naloga</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16,lineHeight:1.6}}>Vnesi <b>številko naloga</b> ki piše na CMR listini.</div>
      <div style={{marginBottom:14}}><label style={s.label}>📋 Številka naloga *</label>
        <input style={{...s.inputBig,textTransform:"uppercase",borderColor:stevilkaNaloga?(nalogNajden?"#16a34a":"#f59e0b"):"#e2e8f0"}} placeholder="npr. NAL-2026-042" value={stevilkaNaloga} onChange={e=>setStevilkaNaloga(e.target.value)}/>
        {stevilkaNaloga&&<div style={{marginTop:6,fontSize:13,fontWeight:600,padding:"6px 12px",borderRadius:8,background:nalogNajden?"#f0fdf4":"#fffbeb",color:nalogNajden?"#16a34a":"#d97706"}}>{nalogNajden?`✅ ${nalogNajden.stranka} · ${nalogNajden.nakKraj} → ${nalogNajden.razKraj}`:"⚠️ Nalog ni v sistemu — CMR bo poslan dispečerju"}</div>}</div>
      <div style={{marginBottom:14}}><label style={s.smallLabel}>Opomba</label><input style={s.input} placeholder="npr. Preložitev iz kamiona" value={opomba} onChange={e=>setOpomba(e.target.value)}/></div>
      {slike.length>0&&<div style={s.cmrGallery}>{slike.map((sl,i)=><div key={i} style={s.cmrGalleryItem}><img src={sl.img} alt={`CMR ${i+1}`} style={s.cmrGalleryImg}/><button style={s.cmrOdstraniBtn} onClick={()=>odstraniSliko(i)}>✕</button><div style={s.cmrGalleryLbl}>✅ {i+1}.</div></div>)}</div>}
      <input type="file" accept="image/*" capture="environment" id="prosti-cmr-add" style={{display:"none"}} onChange={dodajSliko}/>
      <label htmlFor="prosti-cmr-add" style={s.cmrDodajBtn}>📷 {slike.length===0?"Fotografiraj CMR":"+ Dodaj še sliko"}</label>
      {slike.length>0&&<div style={s.cmrSteviloBadge}>✅ {slike.length} {slike.length===1?"slika":"slik"} dodanih</div>}
      {poslan&&<div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:12,padding:"12px 16px",textAlign:"center",fontSize:14,fontWeight:700,color:"#16a34a",marginBottom:14}}>✅ Uspešno!</div>}
      <button style={{...s.btnPrimary,opacity:(stevilkaNaloga&&slike.length>0)?1:0.45}} onClick={posljiCMR}>📤 Pošlji CMR</button></div>}
    {pogled==="arhiv"&&<div>{loading&&<div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>⏳ Nalagam...</div>}
      {!loading&&arhiv.length===0&&<div style={s.empty}>Ni prostih CMR.</div>}
      {arhiv.map(cmr=><div key={cmr.id} style={s.vnosCard}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:800,fontSize:15,fontFamily:"monospace",color:"#2563eb"}}>{cmr.stevilka_naloga}</span><span style={{fontSize:11,color:"#94a3b8"}}>{fmt(cmr.created_at)}</span></div>
        {cmr.opomba&&<div style={{fontSize:12,color:"#64748b",marginBottom:6}}>📝 {cmr.opomba}</div>}
        {cmr.slike?.length>0&&<div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>{cmr.slike.map((sl,i)=><img key={i} src={sl.url} alt="" style={{width:55,height:75,objectFit:"cover",borderRadius:6,border:"1px solid #e2e8f0"}}/>)}</div>}
        <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:cmr.povezan?"#16a34a":"#d97706"}}/><span style={{fontSize:12,fontWeight:700,color:cmr.povezan?"#16a34a":"#d97706"}}>{cmr.povezan?"Povezan z nalogom":"Čaka na dispečerja"}</span></div></div>)}</div>}
  </div>);
}

const Sec = ({title,children})=><div style={s.section}><div style={s.sectionTitle2}>{title}</div>{children}</div>;
const IR = ({label,val,bold,mono})=><div style={s.infoRow}><span style={s.infoLabel}>{label}</span><span style={{...s.infoVal,...(bold?{fontWeight:700,color:"#0f2744"}:{}),...(mono?{fontFamily:"monospace",fontSize:12,color:"#2563eb"}:{})}}>{val||"–"}</span></div>;
const NavBtn = ({active,onClick,icon,label})=><button onClick={onClick} style={s.navBtn}><span style={{fontSize:24}}>{icon}</span><span style={{fontSize:10,marginTop:2,fontWeight:active?700:500,color:active?"#2563eb":"#94a3b8",textAlign:"center"}}>{label}</span></button>;
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
  datumRow:{display:"flex",alignItems:"flex-end",gap:8},datumPolje:{flex:1},datumSep:{fontSize:18,color:"#94a3b8",paddingBottom:10,flexShrink:0},
  obdobjeLabel:{fontSize:12,color:"#16a34a",fontWeight:600,marginTop:8,textAlign:"center"},
  card:{background:"#fff",borderRadius:16,padding:18,marginBottom:14,boxShadow:"0 1px 5px rgba(0,0,0,0.07)"},
  cardTitle:{fontWeight:700,fontSize:16,color:"#0f2744",marginBottom:14},
  nacin:{display:"flex",gap:8,marginBottom:14},
  nacinBtn:{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:13,cursor:"pointer",fontWeight:500,color:"#475569"},
  nacinOn:{background:"#0f2744",color:"#fff",border:"1.5px solid #0f2744",fontWeight:700},
  kmRazlikaWrap:{display:"flex",alignItems:"flex-end",gap:8},kmPolje:{flex:1},kmMinus:{fontSize:20,color:"#94a3b8",paddingBottom:10,flexShrink:0},
  kmRezultat:{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,background:"#f0fdf4",borderRadius:10,padding:"10px 14px"},
  kmRezultatNum:{fontWeight:700,color:"#0f2744",fontSize:15},kmRezultatZasl:{fontSize:14,color:"#475569"},
  strankeWrap:{display:"flex",alignItems:"center",gap:12,margin:"12px 0"},
  strankeBtn:{width:44,height:44,borderRadius:12,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:22,cursor:"pointer",fontWeight:700,color:"#0f2744",flexShrink:0},
  strankeInput:{flex:1,border:"1.5px solid #e2e8f0",borderRadius:12,padding:"10px",fontSize:24,fontWeight:800,textAlign:"center",outline:"none",color:"#0f2744"},
  skupajCard:{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:16,padding:20,marginBottom:14,color:"#fff"},
  skupajLabel:{fontSize:13,opacity:0.75,marginBottom:2},skupajLabel2:{fontSize:12,opacity:0.6,marginBottom:14},skupajVrstice:{},
  skupajVrstica:{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"},
  skupajTotal:{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:22,paddingTop:12},
  obracunZakljucen:{textAlign:"center",color:"#dcfce7",fontWeight:700,fontSize:13,marginTop:14,background:"rgba(255,255,255,0.15)",borderRadius:12,padding:"11px"},
  pregledBtn:{width:"100%",background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",color:"#0f2744",marginBottom:8},
  arhivRow:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",borderRadius:10,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 3px rgba(0,0,0,0.05)",cursor:"pointer"},
  arhivLabel:{fontWeight:600,fontSize:13,color:"#1e293b",marginBottom:2},arhivMeta:{fontSize:12,color:"#94a3b8"},arhivZasl:{fontWeight:800,fontSize:16,color:"#16a34a"},
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
