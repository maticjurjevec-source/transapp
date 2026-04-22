import { useState, useEffect } from "react";
import { supabase } from './supabase';

const pad=(n)=>String(n).padStart(2,"0");
const fmt=(iso)=>{if(!iso)return"–";const d=new Date(iso);return`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;};
const fmtT=(iso)=>{if(!iso)return"";const d=new Date(iso);return`${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const fmtDT=(iso)=>iso?`${fmt(iso)} ob ${fmtT(iso)}`:"–";

const VOZNIKI=[
  {id:"V001",ime:"Adnan Mujkanovic",vozilo:"CE-ES-555",tel:""},
  {id:"V002",ime:"Armin Gluhic",vozilo:"CE LU-099",tel:""},
  {id:"V003",ime:"Edin Vejzovic",vozilo:"CE-18-IFU",tel:""},
  {id:"V004",ime:"Fuad Smajlovic",vozilo:"CE-PG-007",tel:""},
  {id:"V005",ime:"Ismet Pelto",vozilo:"CE-IT-446",tel:""},
  {id:"V006",ime:"Jasmin Dulic",vozilo:"CE-03-HFK",tel:""},
  {id:"V007",ime:"Muris Saltagic",vozilo:"CE-TU-958",tel:""},
  {id:"V008",ime:"Nahid Ascic",vozilo:"CE-40-BRE",tel:""},
  {id:"V009",ime:"Nedim Halilovic",vozilo:"CE-PN-300",tel:""},
  {id:"V010",ime:"Nijaz Ascic",vozilo:"CE-BI-459",tel:""},
  {id:"V011",ime:"Rasim Mujanovic",vozilo:"CE-EM-850",tel:""},
  {id:"V012",ime:"Safet Hodzic",vozilo:"CE-AK-700",tel:""},
  {id:"V013",ime:"Samir Muhamedovic",vozilo:"CE-02-HFK",tel:""},
  {id:"V014",ime:"Sead Bajramovic",vozilo:"CE-TU-959",tel:""},
  {id:"V016",ime:"Sulejman Mujcinovic",vozilo:"CE-LI-731",tel:""},
];

const genId=(nalogi)=>{const l=new Date().getFullYear();const z=nalogi.map(n=>parseInt(n.stevilkaNaloga?.split("-")[2])||0).reduce((a,b)=>Math.max(a,b),0);return`NAL-${l}-${String(z+1).padStart(3,"0")}`;};

const SC={
  nov:{label:"Nov",color:"#64748b",bg:"#f8fafc",icon:"🔘"},
  poslan:{label:"Poslan vozniku",color:"#2563eb",bg:"#eff6ff",icon:"📤"},
  sprejet:{label:"Sprejeto",color:"#d97706",bg:"#fffbeb",icon:"✅"},
  zakljucen:{label:"Zaključeno",color:"#16a34a",bg:"#f0fdf4",icon:"✔️"},
  za_fakturo:{label:"Za fakturo",color:"#9333ea",bg:"#faf5ff",icon:"💶"},
  fakturirano:{label:"Fakturirano",color:"#15803d",bg:"#dcfce7",icon:"🧾"},
};
const SRed=["nov","poslan","sprejet","zakljucen","za_fakturo","fakturirano"];

const DEMO=[
  {id:"NAL-2025-0041",stevilkaNaloga:"NAL-2025-0041",voznikId:"V003",status:"sprejet",stranka:"Müller GmbH",blago:"Avtomobilski deli",kolicina:"24 palet",teza:"18.500 kg",nakFirma:"Logistika d.o.o.",nakKraj:"Ljubljana",nakNaslov:"Dunajska cesta 5, 1000 Ljubljana",nakReferenca:"REF-NAK-88123",nakDatum:"2025-04-10",nakCas:"07:00",razFirma:"Müller GmbH",razKraj:"München",razNaslov:"Schillerstraße 12, 80336 München",razReferenca:"REF-RAZ-99541",razDatum:"2025-04-11",razCas:"14:00",navodila:"Blago krhko!",poslan:new Date(Date.now()-7200000).toISOString(),sprejetCas:new Date(Date.now()-6000000).toISOString(),zakljucenCas:null,cmrSlike:[],nakFirmaKontakt:"",kontaktEmail:"finance@muller-gmbh.de"},
  {id:"NAL-2025-0042",stevilkaNaloga:"NAL-2025-0042",voznikId:"V002",status:"poslan",stranka:"Kaufland Logistik",blago:"Živila – suho blago",kolicina:"33 palet",teza:"22.000 kg",nakFirma:"Koper Terminal d.d.",nakKraj:"Koper",nakNaslov:"Industrijska ulica 8, 6000 Koper",nakReferenca:"REF-NAK-77234",nakDatum:"2025-04-12",nakCas:"05:30",razFirma:"Kaufland Berlin",razKraj:"Berlin",razNaslov:"Frankfurter Allee 99, 10247 Berlin",razReferenca:"REF-RAZ-44871",razDatum:"2025-04-14",razCas:"09:00",navodila:"Dostava samo s predhodno najavo.",poslan:new Date(Date.now()-3600000).toISOString(),sprejetCas:null,zakljucenCas:null,cmrSlike:[],kontaktEmail:"ap@kaufland.de"},
  {id:"NAL-2025-0038",stevilkaNaloga:"NAL-2025-0038",voznikId:"V001",status:"zakljucen",stranka:"DHL Express",blago:"Elektronska oprema",kolicina:"18 palet",teza:"9.200 kg",nakFirma:"DHL Ljubljana",nakKraj:"Ljubljana",nakNaslov:"Letališka cesta 12, 1000 Ljubljana",nakReferenca:"REF-NAK-65001",nakDatum:"2025-04-05",nakCas:"06:00",razFirma:"DHL Hamburg",razKraj:"Hamburg",razNaslov:"Am Stadtrand 50, 22047 Hamburg",razReferenca:"REF-RAZ-65002",razDatum:"2025-04-07",razCas:"10:00",navodila:"Antistatična zaščita obvezna.",poslan:new Date(Date.now()-86400000*5).toISOString(),sprejetCas:new Date(Date.now()-86400000*5+600000).toISOString(),zakljucenCas:new Date(Date.now()-86400000*2).toISOString(),cmrSlike:[],kontaktEmail:"dhl@dhl.si"},
  {id:"NAL-2025-0039",stevilkaNaloga:"NAL-2025-0039",voznikId:"V001",status:"nov",stranka:"Roth GmbH",blago:"Pohištveni elementi",kolicina:"20 palet",teza:"14.000 kg",nakFirma:"Roth Maribor",nakKraj:"Maribor",nakNaslov:"Tržaška cesta 5, 2000 Maribor",nakReferenca:"REF-NAK-70011",nakDatum:"2025-04-14",nakCas:"08:00",razFirma:"Roth GmbH",razKraj:"Hamburg",razNaslov:"Industriestraße 44, 20539 Hamburg",razReferenca:"REF-RAZ-70012",razDatum:"2025-04-16",razCas:"12:00",navodila:"",poslan:new Date(Date.now()-1800000).toISOString(),sprejetCas:null,zakljucenCas:null,cmrSlike:[],kontaktEmail:"buchhaltung@roth-gmbh.de"},
];

const LS="dispecar_v2";
const load=()=>{try{return JSON.parse(localStorage.getItem(LS))||null;}catch{return null;}};
const save=(s)=>{try{localStorage.setItem(LS,JSON.stringify(s));}catch{}};
const initState=()=>load()||{nalogi:DEMO,obracuni:[{id:"OBR-001",voznikId:"V001",datZac:"2025-03-31",datKon:"2025-04-06",km:1840,stranke:4,stroski:[{tip:"vikend",znesek:80}],zakljucen:true,zakljucenCas:new Date(Date.now()-86400000*3).toISOString()}],racuni:[{id:"RAC-2025-001",nalogId:"NAL-2025-0038",stranka:"DHL Express",znesek:1240,datum:"2025-04-07",rok:"2025-05-07",status:"poslan",opombe:""},{id:"RAC-2025-002",nalogId:"NAL-2025-0039",stranka:"Roth GmbH",znesek:980.50,datum:"2025-04-03",rok:"2025-05-03",status:"placano",opombe:""}],prostiCMR:[]};

export default function DispecarPlasca() {
  const [st,setSt]=useState(initState);
  const [tab,setTab]=useState("pregled");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [toast,setToast]=useState(null);
  const [selNalog,setSelNalog]=useState(null);
  const [selObracun,setSelObracun]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const [vozniki,setVozniki]=useState(VOZNIKI);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{ naložiPodatke(); },[]);

  const naložiPodatke = async () => {
    setLoading(true);
    try {
      const [{ data: sbVozniki }, { data: nalogi }, { data: obracuni }, { data: racuni }] = await Promise.all([
        supabase.from('vozniki').select('*').eq('aktiven',true).order('priimek'),
        supabase.from('nalogi').select('*, vozniki(id,ime,priimek,vozilo)').order('created_at',{ascending:false}),
        supabase.from('obracuni').select('*, vozniki(id,ime,priimek,vozilo)').order('created_at',{ascending:false}),
        supabase.from('racuni').select('*').order('created_at',{ascending:false}),
      ]);

      if (sbVozniki) {
        const mapped = sbVozniki.map(v=>({
          id: v.id,
          ime: `${v.ime} ${v.priimek}`,
          vozilo: v.vozilo||"",
          tel: v.tel||"",
        }));
        setVozniki(mapped);
      }

      const mapNalog = (n) => ({
        ...n,
        id: n.id,
        stevilkaNaloga: n.stevilka_naloga,
        stranka: n.stranka,
        blago: n.blago,
        kolicina: n.kolicina,
        teza: n.teza,
        nakFirma: n.nak_firma,
        nakKraj: n.nak_kraj,
        nakNaslov: n.nak_naslov,
        nakReferenca: n.nak_referenca,
        nakDatum: n.nak_datum,
        nakCas: n.nak_cas,
        razFirma: n.raz_firma,
        razKraj: n.raz_kraj,
        razNaslov: n.raz_naslov,
        razReferenca: n.raz_referenca,
        razDatum: n.raz_datum,
        razCas: n.raz_cas,
        navodila: n.navodila,
        voznikId: n.voznik_id,
        poslan: n.poslan_cas || n.created_at,
        sprejetCas: n.sprejet_cas,
        zakljucenCas: n.zakljucen_cas,
        cmrSlike: [],
      });
      setSt(s => ({
        ...s,
        nalogi: nalogi ? nalogi.map(mapNalog) : s.nalogi,
        obracuni: obracuni ? obracuni.map(o=>({...o, voznikId:o.voznik_id, datZac:o.dat_zac, datKon:o.dat_kon, zakljucen:o.zakljucen, zakljucenCas:o.zakljucen_cas})) : s.obracuni,
        racuni: racuni ? racuni.map(r=>({...r, nalogId:r.nalog_id, datum:r.datum_izdaje, rok:r.datum_rok})) : s.racuni,
      }));
    } catch(err) {
      console.error('Supabase napaka:', err);
    }
    setLoading(false);
  };

  const naložiCMR = async (nalogId) => {
    try {
      const { data } = await supabase.from('cmr_dokumenti').select('*').eq('nalog_id', nalogId).order('created_at');
      if (!data || data.length === 0) return [];
      return data.map(d => ({
        url: supabase.storage.from('cmr-dokumenti').getPublicUrl(d.storage_pot).data.publicUrl,
        ime: d.ime_datoteke
      }));
    } catch { return []; }
  };

  // POPRAVEK: odpriNalog vedno naloži CMR slike iz Supabase
  const odpriNalog = async (n) => {
    const cmr = await naložiCMR(n.id);
    setSelNalog({...n, cmrSlike: cmr});
  };

  const [aiParsing,setAiParsing]=useState(false);

  const upd=(fn)=>{const ns=fn(st);setSt(ns);save(ns);};
  const showToast=(txt,err)=>{setToast({txt,err});setTimeout(()=>setToast(null),3500);};
  const closeModal=()=>{setModal(null);setForm({});};
  const voz=(id)=>vozniki.find(v=>v.id===id);

  const openNovNalog=()=>{setForm({voznikId:"",stranka:"",blago:"",kolicina:"",teza:"",nakFirma:"",nakKraj:"",nakNaslov:"",nakReferenca:"",nakDatum:"",nakCas:"",razFirma:"",razKraj:"",razNaslov:"",razReferenca:"",razDatum:"",razCas:"",navodila:"",kontaktEmail:""});setModal("nalog");};

  const submitNalog=async()=>{
    if(!form.stranka||!form.nakKraj||!form.razKraj)return showToast("Izpolni obvezna polja!",true);
    try {
      const { data, error } = await supabase.from('nalogi').insert([{
        stevilka_naloga: '',
        status: 'nov',
        stranka: form.stranka,
        blago: form.blago,
        kolicina: form.kolicina,
        teza: form.teza,
        nak_firma: form.nakFirma,
        nak_kraj: form.nakKraj,
        nak_naslov: form.nakNaslov,
        nak_referenca: form.nakReferenca,
        nak_datum: form.nakDatum||null,
        nak_cas: form.nakCas ? form.nakCas.slice(0,5) : null,
        raz_firma: form.razFirma,
        raz_kraj: form.razKraj,
        raz_naslov: form.razNaslov,
        raz_referenca: form.razReferenca,
        raz_datum: form.razDatum||null,
        raz_cas: form.razCas ? form.razCas.slice(0,5) : null,
        navodila: form.navodila,
        voznik_id: form.voznikId||null,
      }]).select().single();
      if(error) throw error;
      await naložiPodatke();
      closeModal();showToast(`✅ Nalog ${data.stevilka_naloga} ustvarjen!`);
    } catch(err) {
      showToast("❌ Napaka pri shranjevanju!",true);
      console.error(err);
    }
  };

  const dodelijNalog=async(nalogId,voznikId)=>{
    try {
      const { error } = await supabase.from('nalogi').update({ voznik_id:voznikId, status:'poslan', poslan_cas:new Date().toISOString() }).eq('id',nalogId);
      if(error) throw error;
      upd(s=>({...s,nalogi:s.nalogi.map(n=>n.id===nalogId?{...n,voznikId,status:"poslan",poslanCas:new Date().toISOString()}:n)}));
      showToast(`✅ Nalog poslan vozniku ${voz(voznikId)?.ime}!`);setSelNalog(null);
    } catch(err) {
      showToast("❌ Napaka!",true);
    }
  };

  const spremenStatus=async(id,status)=>{
    try {
      const updates = { status };
      if(status==='poslan') updates.poslan_cas = new Date().toISOString();
      if(status==='sprejet') updates.sprejet_cas = new Date().toISOString();
      if(status==='zakljucen') updates.zakljucen_cas = new Date().toISOString();
      const { error } = await supabase.from('nalogi').update(updates).eq('id',id);
      if(error) throw error;
      upd(s=>({...s,nalogi:s.nalogi.map(n=>n.id===id?{...n,status}:n)}));
      showToast(`✅ Status: ${SC[status]?.label}`);
    } catch(err) {
      showToast("❌ Napaka pri posodobitvi!",true);
    }
  };

  const izbrisiNalog=async(id)=>{
    try {
      const { error } = await supabase.from('nalogi').delete().eq('id',id);
      if(error) throw error;
      upd(s=>({...s,nalogi:s.nalogi.filter(n=>n.id!==id)}));
      setSelNalog(null);showToast("Nalog izbrisan.");
    } catch(err) {
      showToast("❌ Napaka pri brisanju!",true);
    }
  };

  const handleDrop=async(e)=>{
    e.preventDefault();setDragOver(false);
    const file=e.dataTransfer?.files?.[0]||e.target?.files?.[0];
    if(!file)return;
    setAiParsing(true);showToast("⏳ AI bere dokument...");
    try{
      let txt="";
      if(file.type==="application/pdf"){
        try{
          const lib=await new Promise(res=>{if(window.pdfjsLib)return res(window.pdfjsLib);const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res(window.pdfjsLib);};document.head.appendChild(s);});
          const ab=await file.arrayBuffer();
          const pdf=await lib.getDocument({data:ab}).promise;
          for(let i=1;i<=Math.min(pdf.numPages,4);i++){const p=await pdf.getPage(i);const tc=await p.getTextContent();txt+=tc.items.map(x=>x.str).join(" ")+"\n";}
        }catch(e){txt="";}
      }
      if(!txt)txt=await file.text().catch(()=>file.name);
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:`Iz tega dokumenta izvleci podatke za transportni nalog. Vrni SAMO JSON:\n{"stranka":"","blago":"","kolicina":"","teza":"","nakFirma":"","nakKraj":"","nakNaslov":"","nakReferenca":"","nakDatum":"","nakCas":"","razFirma":"","razKraj":"","razNaslov":"","razReferenca":"","razDatum":"","razCas":"","navodila":"","kontaktEmail":""}\nDatumi: YYYY-MM-DD, casi: HH:MM.\n\nDokument:\n${txt}`}]})});
      const data=await res.json();
      const parsed=JSON.parse(data.content?.map(i=>i.text||"").join("").replace(/```json|```/g,"").trim());
      setForm(f=>({...f,...parsed}));setModal("nalog");showToast("✅ AI izpolnil nalog!");
    }catch(err){setModal("nalog");showToast("⚠️ AI ni mogel prebrati – izpolni ročno.",true);}
    setAiParsing(false);
  };

  const stats={skupaj:st.nalogi.length,novi:st.nalogi.filter(n=>n.status==="nov").length,aktivni:st.nalogi.filter(n=>["poslan","sprejet"].includes(n.status)).length,zaFakturo:st.nalogi.filter(n=>n.status==="za_fakturo").length};

  const [izVoz,setIzVoz]=useState("");

  // Nalog detail
  if(selNalog){
    const n=st.nalogi.find(x=>x.id===selNalog.id)||selNalog;
    // Uporabi cmrSlike iz selNalog (ki jih je naložil odpriNalog)
    const cmrSlike = selNalog.cmrSlike || [];
    const sc=SC[n.status]||{};
    const naslednji={poslan:{next:"sprejet",label:"Označi: Sprejeto",icon:"✅"},sprejet:{next:"zakljucen",label:"Označi: Zaključeno",icon:"✔️"},zakljucen:{next:"za_fakturo",label:"Premakni v Finance",icon:"💶"}}[n.status];
    return(
      <div style={s.wrap}>
        <div style={s.header}><button style={s.backBtn} onClick={()=>setSelNalog(null)}>← Nazaj</button><div style={s.htitle}>{n.nakKraj} → {n.razKraj}</div><div style={s.hsub}>{n.stevilkaNaloga} · {n.stranka}</div></div>
        {toast&&<Toast t={toast}/>}
        <div style={{...s.content,paddingBottom:80}}>
          <div style={{...s.scCard,background:sc.bg,borderColor:sc.color+"33"}}>
            <span style={{...s.sPill,background:sc.color+"22",color:sc.color}}>{sc.icon} {sc.label}</span>
            {voz(n.voznikId)&&<span style={{fontSize:13,color:"#475569",fontWeight:600,marginLeft:8}}>🚛 {voz(n.voznikId).ime} · {voz(n.voznikId).vozilo}</span>}
          </div>
          {/* Timeline */}
          <div style={{display:"flex",overflowX:"auto",marginBottom:14,paddingBottom:4}}>
            {SRed.slice(0,6).map((k,i)=>{const sc2=SC[k];const done=SRed.indexOf(n.status)>i;const cur=n.status===k;return(
              <div key={k} style={{display:"flex",flexDirection:"column",alignItems:"center",position:"relative",minWidth:70,flex:1}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:cur?sc2.color:done?"#16a34a":"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700,zIndex:1,marginBottom:4}}>{cur?sc2.icon:done?"✓":i+1}</div>
                <div style={{fontSize:9,textAlign:"center",color:cur?sc2.color:done?"#16a34a":"#94a3b8",fontWeight:cur?700:400}}>{sc2.label}</div>
                {i<5&&<div style={{position:"absolute",top:13,left:"50%",width:"100%",height:2,background:done?"#16a34a":"#e2e8f0",zIndex:0}}/>}
              </div>
            );})}
          </div>
          {/* Naslednji korak */}
          {naslednji&&<div style={{background:SC[naslednji.next].bg,border:`1.5px solid ${SC[naslednji.next].color}33`,borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:12,color:"#64748b"}}>Naslednji korak</div><div style={{fontWeight:700,color:SC[naslednji.next].color}}>{naslednji.icon} {naslednji.label}</div></div>
            <button style={{background:SC[naslednji.next].color,color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontWeight:700,cursor:"pointer"}} onClick={()=>spremenStatus(n.id,naslednji.next)}>Potrdi →</button>
          </div>}
          <Sec title="📦 Blago"><R label="Blago" val={n.blago}/><R label="Količina" val={n.kolicina}/><R label="Teža" val={n.teza}/></Sec>
          <Sec title="📍 Naklad"><R label="Firma" val={n.nakFirma} bold/><R label="Kraj" val={n.nakKraj}/><R label="Naslov" val={n.nakNaslov}/><R label="Referenca" val={n.nakReferenca} mono/><R label="Datum" val={`${fmt(n.nakDatum)} ob ${n.nakCas}`}/></Sec>
          <Sec title="🏁 Razklad"><R label="Firma" val={n.razFirma} bold/><R label="Kraj" val={n.razKraj}/><R label="Naslov" val={n.razNaslov}/><R label="Referenca" val={n.razReferenca} mono/><R label="Datum" val={`${fmt(n.razDatum)} ob ${n.razCas}`}/></Sec>
          {n.navodila&&<Sec title="⚠️ Navodila"><div style={{fontSize:13,background:"#fffbeb",borderRadius:8,padding:"10px 12px",border:"1px solid #fde68a"}}>{n.navodila}</div></Sec>}
          {n.kontaktEmail&&<Sec title="💶 Kontakt za račun"><R label="Email" val={n.kontaktEmail} mono/></Sec>}
          {/* CMR sekcija - vedno vidna za zaključene naloge */}
          <Sec title="📄 CMR dokumenti">
            {cmrSlike.length > 0 ? (
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {cmrSlike.map((sl,i)=>(
                  <a key={i} href={sl.url} target="_blank" rel="noopener noreferrer">
                    <img src={sl.url} alt={sl.ime||`CMR ${i+1}`} style={{width:80,height:107,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0",cursor:"pointer"}}/>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{fontSize:13,color:"#94a3b8"}}>
                {n.status==="zakljucen" ? "Ni CMR dokumentov." : "CMR bo prikazan po zaključitvi naloga."}
              </div>
            )}
          </Sec>
          {n.status==="nov"&&<div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:14,padding:16,marginTop:8}}>
            <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:10}}>📤 Dodeli voznika</div>
            <select style={s.sel} value={izVoz} onChange={e=>setIzVoz(e.target.value)}><option value="">– Izberi voznika –</option>{vozniki.map(v=><option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}</select>
            <button style={{...s.btnP,marginTop:10,opacity:izVoz?1:0.45}} onClick={()=>izVoz&&dodelijNalog(n.id,izVoz)}>📤 Pošlji vozniku</button>
          </div>}
          {(n.status==="nov"||n.status==="poslan")&&<button style={s.btnD} onClick={()=>izbrisiNalog(n.id)}>🗑️ Izbriši nalog</button>}
        </div>
      </div>
    );
  }

  // Obracun detail
  if(selObracun){
    const ob=selObracun;const v=voz(ob.voznikId);
    const zaslKm=(ob.km||0)*0.18,zaslStr=(ob.stranke||0)*20,ost=(ob.stroski||[]).reduce((a,x)=>a+(parseFloat(x.znesek)||0),0);
    return(
      <div style={s.wrap}>
        <div style={s.header}><button style={s.backBtn} onClick={()=>setSelObracun(null)}>← Nazaj</button><div style={s.htitle}>Obračun – {v?.ime}</div><div style={s.hsub}>{fmt(ob.datZac+"T00:00:00")} – {fmt(ob.datKon+"T00:00:00")}</div></div>
        <div style={s.content}>
          <div style={{background:"#fff",borderRadius:14,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <R label="Voznik" val={v?.ime}/><R label="Vozilo" val={v?.vozilo}/><div style={{borderTop:"1px solid #f1f5f9",margin:"8px 0"}}/>
            <R label={`Km (${ob.km?.toLocaleString()} × 0.18 €)`} val={`${zaslKm.toFixed(2)} €`}/>
            <R label={`Stranke (${ob.stranke} × 20 €)`} val={`${zaslStr.toFixed(2)} €`}/>
            {(ob.stroski||[]).map((x,i)=><R key={i} label={`Ostalo: ${x.tip}`} val={`+ ${parseFloat(x.znesek).toFixed(2)} €`}/>)}
            <div style={{borderTop:"1px solid #f1f5f9",margin:"8px 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:18,color:"#16a34a",padding:"8px 0"}}><span>SKUPAJ</span><span>{(zaslKm+zaslStr+ost).toFixed(2)} €</span></div>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={s.logo}>⚡ TransDispečer</div><div style={s.sub}>{VOZNIKI.length} voznikov</div></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {loading && <div style={{fontSize:12,opacity:0.7}}>⏳ Nalagam...</div>}
            <button style={s.novBtn} onClick={openNovNalog}>+ Nov nalog</button>
          </div>
        </div>
      </div>
      {toast&&<Toast t={toast}/>}
      <div style={s.content}>
        {/* AI drop zone */}
        <div style={{...s.drop,...(dragOver?s.dropA:{}),...(aiParsing?s.dropP:{})}} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop}>
          {aiParsing?<div style={{textAlign:"center"}}><div style={{fontSize:28,marginBottom:4}}>⏳</div><div style={{fontWeight:700,color:"#0f2744"}}>AI bere dokument...</div></div>:
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:4}}>🤖</div>
            <div style={{fontWeight:700,color:"#0f2744",marginBottom:2}}>{dragOver?"Spusti!":"Prenesi nalog sem"}</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>PDF · Word · Slika → AI ustvari nalog</div>
            <input type="file" id="drop-f" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" style={{display:"none"}} onChange={handleDrop}/>
            <label htmlFor="drop-f" style={s.dropBtn}>📂 Izberi datoteko</label>
          </div>}
        </div>
        {/* Tabs */}
        <div style={s.tabs}>
          {[["pregled","📊 Pregled"],["nalogi","📋 Nalogi"],["email","📧 Email → Nalog"],["vozniki","👥 Vozniki"],["obracuni","💶 Obračuni"],["finance","🧾 Finance"],["prosticmr",`📸 CMR${(st.prostiCMR||[]).filter(c=>!c.povezan).length>0?` (${(st.prostiCMR||[]).filter(c=>!c.povezan).length})`:""}`]].map(([id,label])=>(
            <button key={id} style={{...s.tab,...(tab===id?s.tabOn:{})}} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
        {tab==="pregled"&&<PregledTab stats={stats} nalogi={st.nalogi} obracuni={st.obracuni} onSelNalog={odpriNalog} onSelOb={setSelObracun}/>}
        {tab==="nalogi"&&<NalogiTab nalogi={st.nalogi} onSelect={odpriNalog} openNovNalog={openNovNalog}/>}
        {tab==="vozniki"&&<VoznikiTab nalogi={st.nalogi} vozniki={vozniki}/>}
        {tab==="obracuni"&&<ObracuniTab obracuni={st.obracuni} onSelect={setSelObracun}/>}
        {tab==="finance"&&<FinanceTab st={st} upd={upd} showToast={showToast}/>}
        {tab==="prosticmr"&&<ProstiCMRTab st={st} upd={upd} showToast={showToast}/>}
        {tab==="email"&&<EmailNalogTab upd={upd} showToast={showToast} naložiPodatke={naložiPodatke} vozniki={vozniki}/>}
      </div>
      {/* Nov nalog modal */}
      {modal==="nalog"&&(
        <div style={s.overlay}>
          <div style={{...s.mbox,maxWidth:680}}>
            <div style={s.mhead}><span style={s.mtitle}>Nov nalog</span><button style={s.mcls} onClick={closeModal}>✕</button></div>
            <div style={s.mbody}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>Voznik</label><select style={s.sel} value={form.voznikId||""} onChange={e=>setForm(f=>({...f,voznikId:e.target.value}))}><option value="">– Dodeli pozneje –</option>{vozniki.map(v=><option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}</select></div>
                <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>Stranka *</label><input style={s.inp} value={form.stranka||""} onChange={e=>setForm(f=>({...f,stranka:e.target.value}))} placeholder="Ime stranke"/></div>
                <I label="Blago" val={form.blago} set={v=>setForm(f=>({...f,blago:v}))} ph="Opis blaga"/>
                <I label="Količina" val={form.kolicina} set={v=>setForm(f=>({...f,kolicina:v}))} ph="24 palet"/>
                <I label="Teža" val={form.teza} set={v=>setForm(f=>({...f,teza:v}))} ph="18.500 kg"/>
                <div style={{gridColumn:"1/-1",borderTop:"1px solid #f1f5f9",paddingTop:8,fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>📍 Naklad</div>
                <I label="Firma naklada" val={form.nakFirma} set={v=>setForm(f=>({...f,nakFirma:v}))}/>
                <I label="Kraj naklada *" val={form.nakKraj} set={v=>setForm(f=>({...f,nakKraj:v}))} ph="Ljubljana"/>
                <div style={{gridColumn:"1/-1"}}><I label="Naslov naklada" val={form.nakNaslov} set={v=>setForm(f=>({...f,nakNaslov:v}))}/></div>
                <I label="Referenca" val={form.nakReferenca} set={v=>setForm(f=>({...f,nakReferenca:v}))}/>
                <I label="Datum" val={form.nakDatum} set={v=>setForm(f=>({...f,nakDatum:v}))} type="date"/>
                <I label="Ura" val={form.nakCas} set={v=>setForm(f=>({...f,nakCas:v}))} type="time"/>
                <div style={{gridColumn:"1/-1",borderTop:"1px solid #f1f5f9",paddingTop:8,fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>🏁 Razklad</div>
                <I label="Firma razklada" val={form.razFirma} set={v=>setForm(f=>({...f,razFirma:v}))}/>
                <I label="Kraj razklada *" val={form.razKraj} set={v=>setForm(f=>({...f,razKraj:v}))} ph="München"/>
                <div style={{gridColumn:"1/-1"}}><I label="Naslov razklada" val={form.razNaslov} set={v=>setForm(f=>({...f,razNaslov:v}))}/></div>
                <I label="Referenca" val={form.razReferenca} set={v=>setForm(f=>({...f,razReferenca:v}))}/>
                <I label="Datum" val={form.razDatum} set={v=>setForm(f=>({...f,razDatum:v}))} type="date"/>
                <I label="Ura" val={form.razCas} set={v=>setForm(f=>({...f,razCas:v}))} type="time"/>
                <div style={{gridColumn:"1/-1",borderTop:"1px solid #f1f5f9",paddingTop:8,fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>⚠️ Ostalo</div>
                <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>Navodila</label><textarea style={{...s.inp,resize:"vertical"}} rows={2} value={form.navodila||""} onChange={e=>setForm(f=>({...f,navodila:e.target.value}))}/></div>
                <div style={{gridColumn:"1/-1"}}><I label="💶 Email kontakta za račun" val={form.kontaktEmail} set={v=>setForm(f=>({...f,kontaktEmail:v}))} ph="finance@stranka.com"/></div>
              </div>
              <button style={s.btnP} onClick={submitNalog}>📤 Ustvari nalog</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PregledTab({stats,nalogi,obracuni,onSelNalog,onSelOb}){
  const novi=nalogi.filter(n=>n.status==="nov");
  const aktivni=nalogi.filter(n=>["poslan","sprejet"].includes(n.status));
  const zaFakturo=nalogi.filter(n=>n.status==="za_fakturo");
  const noviOb=obracuni.filter(o=>o.zakljucen);
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      {[["📋","Skupaj",stats.skupaj,"#2563eb"],["🔘","Novi",stats.novi,"#64748b"],["🚛","Aktivni",stats.aktivni,"#0891b2"],["💶","Za fakturo",stats.zaFakturo,"#9333ea"]].map(([ic,lb,vl,cl])=>(
        <div key={lb} style={{background:"#fff",borderRadius:14,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:20,marginBottom:4}}>{ic}</div>
          <div style={{fontSize:22,fontWeight:800,color:cl}}>{vl}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>{lb}</div>
        </div>
      ))}
    </div>
    {novi.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:10}}>🔘 Novi nalogi</div>{novi.map(n=><NC key={n.id} n={n} onClick={()=>onSelNalog(n)}/>)}</>}
    {aktivni.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:10,marginTop:12}}>🚛 Aktivni nalogi</div>{aktivni.map(n=><NC key={n.id} n={n} onClick={()=>onSelNalog(n)}/>)}</>}
    {zaFakturo.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#9333ea",marginBottom:10,marginTop:12}}>💶 Za fakturo</div>{zaFakturo.map(n=><NC key={n.id} n={n} onClick={()=>onSelNalog(n)}/>)}</>}
    {noviOb.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:10,marginTop:12}}>💶 Obračuni voznikov</div>{noviOb.map(o=><OC key={o.id} o={o} onClick={()=>onSelOb(o)}/>)}</>}
  </div>);
}

function NalogiTab({nalogi,onSelect,openNovNalog}){
  const [f,setF]=useState("vsi");
  const [q,setQ]=useState("");
  const list=nalogi.filter(n=>f==="vsi"||n.status===f).filter(n=>!q||n.stranka.toLowerCase().includes(q.toLowerCase())||n.stevilkaNaloga.includes(q));
  return(<div>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <input style={{...s.inp,flex:1,margin:0}} placeholder="🔍 Išči..." value={q} onChange={e=>setQ(e.target.value)}/>
      <button style={s.btnSm} onClick={openNovNalog}>+ Nov</button>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[["vsi","Vsi"],["nov","Novi"],["poslan","Poslani"],["sprejet","Sprejeto"],["zakljucen","Zaključeni"],["za_fakturo","Za fakturo"]].map(([v,l])=>(
        <button key={v} style={{...s.fBtn,...(f===v?s.fOn:{})}} onClick={()=>setF(v)}>{l}</button>
      ))}
    </div>
    {list.length===0&&<div style={s.empty}>Ni nalogov.</div>}
    {list.map(n=><NC key={n.id} n={n} onClick={()=>onSelect(n)}/>)}
  </div>);
}

function VoznikiTab({nalogi,vozniki}){
  return(<div>
    <div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:12}}>Vozniki ({vozniki.length})</div>
    {vozniki.map(v=>{
      const vn=nalogi.filter(n=>n.voznikId===v.id);
      const ak=vn.filter(n=>["poslan","sprejet"].includes(n.status));
      return(<div key={v.id} style={{background:"#fff",borderRadius:14,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{v.ime.charAt(0)}</div>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{v.ime}</div><div style={{fontSize:12,color:"#64748b"}}>{v.vozilo}</div></div>
          <div style={{padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:700,background:ak.length>0?"#fffbeb":"#f0fdf4",color:ak.length>0?"#d97706":"#16a34a"}}>{ak.length>0?`🟡 ${ak.length} aktiven`:"✅ Prost"}</div>
        </div>
        <div style={{display:"flex",borderTop:"1px solid #f1f5f9",paddingTop:10}}>
          {[["Nalogov",vn.length],["Aktivnih",ak.length],["Zaključenih",vn.filter(n=>n.status==="zakljucen").length]].map(([l,val])=>(
            <div key={l} style={{flex:1,textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#0f2744"}}>{val}</div><div style={{fontSize:11,color:"#94a3b8"}}>{l}</div></div>
          ))}
        </div>
      </div>);
    })}
  </div>);
}

function ObracuniTab({obracuni,onSelect}){
  const sk=obracuni.reduce((a,o)=>a+(o.km||0),0);
  const sz=obracuni.reduce((a,o)=>a+(o.km||0)*0.18+(o.stranke||0)*20+(o.stroski||[]).reduce((b,x)=>b+(parseFloat(x.znesek)||0),0),0);
  return(<div>
    <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:"16px 20px",marginBottom:14,color:"#fff",display:"flex",justifyContent:"space-around"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800}}>{obracuni.length}</div><div style={{fontSize:11,opacity:0.7}}>Obračunov</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800}}>{sk.toLocaleString()} km</div><div style={{fontSize:11,opacity:0.7}}>Skupaj km</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#86efac"}}>{sz.toFixed(0)} €</div><div style={{fontSize:11,opacity:0.7}}>Za izplačilo</div></div>
    </div>
    {obracuni.length===0&&<div style={s.empty}>Ni prejetih obračunov.</div>}
    {obracuni.map(o=><OC key={o.id} o={o} onClick={()=>onSelect(o)}/>)}
  </div>);
}

function FinanceTab({st,upd,showToast}){
  const [f,setF]=useState("vsi");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const racuni=st.racuni||[];
  const zaF=st.nalogi.filter(n=>n.status==="za_fakturo");
  const list=racuni.filter(r=>f==="vsi"||r.status===f);
  const rSC={osnutek:{label:"Osnutek",color:"#64748b",bg:"#f8fafc"},poslan:{label:"Poslan",color:"#2563eb",bg:"#eff6ff"},placano:{label:"Plačano",color:"#16a34a",bg:"#f0fdf4"},zapadlo:{label:"Zapadlo",color:"#dc2626",bg:"#fef2f2"}};
  const novRacun=(n)=>{setForm({nalogId:n?.id||"",stranka:n?.stranka||"",znesek:"",datum:new Date().toISOString().slice(0,10),rok:new Date(Date.now()+30*86400000).toISOString().slice(0,10),kontaktEmail:n?.kontaktEmail||"",opombe:""});setModal("racun");};
  const submitRacun=()=>{
    if(!form.stranka||!form.znesek)return showToast("Izpolni stranko in znesek!",true);
    const id="RAC-"+new Date().getFullYear()+"-"+String((racuni.length+1)).padStart(3,"0");
    upd(s=>({...s,racuni:[...(s.racuni||[]),{...form,id,znesek:parseFloat(form.znesek),status:"osnutek"}],nalogi:form.nalogId?s.nalogi.map(n=>n.id===form.nalogId?{...n,status:"fakturirano"}:n):s.nalogi}));
    setModal(null);setForm({});showToast(`✅ Račun ${id} ustvarjen!`);
  };
  const sprSt=(id,status)=>{upd(s=>({...s,racuni:(s.racuni||[]).map(r=>r.id===id?{...r,status}:r)}));showToast("✅ Status posodobljen.");};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
      {[["💶","Skupaj",racuni.reduce((a,r)=>a+r.znesek,0).toFixed(0)+" €","#0891b2"],["⏳","Odprto",racuni.filter(r=>r.status==="poslan").reduce((a,r)=>a+r.znesek,0).toFixed(0)+" €","#d97706"],["✅","Prejeto",racuni.filter(r=>r.status==="placano").reduce((a,r)=>a+r.znesek,0).toFixed(0)+" €","#16a34a"]].map(([ic,lb,vl,cl])=>(
        <div key={lb} style={{background:"#fff",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:18}}>{ic}</div><div style={{fontSize:18,fontWeight:800,color:cl}}>{vl}</div><div style={{fontSize:11,color:"#94a3b8"}}>{lb}</div></div>
      ))}
    </div>
    {zaF.length>0&&<div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:14,color:"#92400e",marginBottom:10}}>💶 Za fakturo ({zaF.length})</div>
      {zaF.map(n=><div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #fef3c7"}}>
        <div><div style={{fontWeight:700,fontSize:14}}>{n.stranka}</div><div style={{fontSize:12,color:"#64748b"}}>{n.stevilkaNaloga} · {n.nakKraj} → {n.razKraj}</div></div>
        <button style={s.btnSm} onClick={()=>novRacun(n)}>Ustvari račun</button>
      </div>)}
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>Računi</div>
      <button style={s.btnSm} onClick={()=>novRacun(null)}>+ Nov</button>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
      {[["vsi","Vsi"],["osnutek","Osnutki"],["poslan","Poslani"],["placano","Plačani"],["zapadlo","Zapadli"]].map(([v,l])=>(
        <button key={v} style={{...s.fBtn,...(f===v?s.fOn:{})}} onClick={()=>setF(v)}>{l}</button>
      ))}
    </div>
    {list.length===0&&<div style={s.empty}>Ni računov.</div>}
    {list.map(r=>{const sc=rSC[r.status]||rSC.osnutek;const zap=r.status==="poslan"&&new Date(r.rok)<new Date();return(
      <div key={r.id} style={{background:"#fff",borderRadius:12,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <div><div style={{display:"flex",gap:8,marginBottom:3}}><span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:"#2563eb"}}>{r.id}</span><span style={{...s.fBtn,padding:"2px 8px",background:zap?"#fef2f2":sc.bg,color:zap?"#dc2626":sc.color,border:"none",cursor:"default"}}>{zap?"⚠️ Zapadlo":sc.label}</span></div>
          <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{r.stranka}</div>
          {r.kontaktEmail&&<div style={{fontSize:12,color:"#64748b"}}>✉️ {r.kontaktEmail}</div>}
          <div style={{fontSize:12,color:"#64748b"}}>Rok: {fmt(r.rok+"T00:00:00")}</div></div>
          <div style={{fontWeight:800,fontSize:20,color:"#0f2744"}}>{r.znesek.toFixed(2)} €</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {r.status==="osnutek"&&<button style={s.rBtn} onClick={()=>sprSt(r.id,"poslan")}>📤 Poslan</button>}
          {r.status==="poslan"&&<button style={s.rBtn} onClick={()=>sprSt(r.id,"placano")}>✅ Plačan</button>}
          {(r.status==="poslan"||zap)&&<button style={{...s.rBtn,color:"#dc2626"}} onClick={()=>sprSt(r.id,"zapadlo")}>⚠️ Zapadlo</button>}
        </div>
      </div>
    );})}
    {modal==="racun"&&<div style={s.overlay}><div style={s.mbox}><div style={s.mhead}><span style={s.mtitle}>Nov račun</span><button style={s.mcls} onClick={()=>{setModal(null);setForm({});}}>✕</button></div>
      <div style={s.mbody}>
        {form.nalogId&&<div style={{background:"#eff6ff",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:13,color:"#1d4ed8",fontWeight:600}}>📋 {form.nalogId}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:12}}>
          <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>Stranka *</label><input style={s.inp} value={form.stranka||""} onChange={e=>setForm(f=>({...f,stranka:e.target.value}))}/></div>
          <div><label style={s.lbl}>Znesek (€) *</label><input style={s.inp} type="number" value={form.znesek||""} onChange={e=>setForm(f=>({...f,znesek:e.target.value}))}/></div>
          <div><label style={s.lbl}>Datum</label><input style={s.inp} type="date" value={form.datum||""} onChange={e=>setForm(f=>({...f,datum:e.target.value}))}/></div>
          <div><label style={s.lbl}>Plačilni rok</label><input style={s.inp} type="date" value={form.rok||""} onChange={e=>setForm(f=>({...f,rok:e.target.value}))}/></div>
          <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>💶 Email za račun</label><input style={s.inp} value={form.kontaktEmail||""} onChange={e=>setForm(f=>({...f,kontaktEmail:e.target.value}))} placeholder="finance@podjetje.com"/></div>
        </div>
        <button style={s.btnP} onClick={submitRacun}>Ustvari račun</button>
      </div></div></div>}
  </div>);
}

function ProstiCMRTab({st,upd,showToast}){
  const nepov=(st.prostiCMR||[]).filter(c=>!c.povezan);
  const pov=(st.prostiCMR||[]).filter(c=>c.povezan);
  const [sel,setSel]=useState(null);
  const [vn,setVn]=useState("");
  const poveziCMR=(cmr)=>{
    const n=st.nalogi.find(x=>x.stevilkaNaloga?.toUpperCase()===vn.toUpperCase());
    if(!n)return showToast("Nalog ne obstaja!",true);
    upd(s=>({...s,prostiCMR:(s.prostiCMR||[]).map(c=>c.id===cmr.id?{...c,povezan:true,nalogPovezan:n.stevilkaNaloga}:c),nalogi:s.nalogi.map(x=>x.id===n.id?{...x,cmrSlike:[...(x.cmrSlike||[]),...(cmr.slike||[])]}:x)}));
    showToast(`✅ CMR povezan z ${n.stevilkaNaloga}!`);setSel(null);setVn("");
  };
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <div style={{background:"#fff",borderRadius:12,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:20}}>⏳</div><div style={{fontSize:22,fontWeight:800,color:"#d97706"}}>{nepov.length}</div><div style={{fontSize:11,color:"#94a3b8"}}>Čakajo</div></div>
      <div style={{background:"#fff",borderRadius:12,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:20}}>✅</div><div style={{fontSize:22,fontWeight:800,color:"#16a34a"}}>{pov.length}</div><div style={{fontSize:11,color:"#94a3b8"}}>Povezani</div></div>
    </div>
    {nepov.length===0&&<div style={s.empty}>✅ Vsi prosti CMR so povezani.</div>}
    {nepov.map(cmr=>(
      <div key={cmr.id} style={{background:"#fff",borderRadius:12,padding:14,marginBottom:10,borderLeft:"4px solid #d97706",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <div><div style={{fontWeight:800,fontSize:16,fontFamily:"monospace",color:"#0f2744"}}>{cmr.stevilkaNaloga}</div><div style={{fontSize:12,color:"#475569"}}>🚛 {cmr.voznik} · {cmr.vozilo}</div></div>
          <div style={{fontSize:12,color:"#94a3b8"}}>{fmt(cmr.cas)}</div>
        </div>
        {cmr.opomba&&<div style={{fontSize:12,color:"#64748b",marginBottom:8}}>📝 {cmr.opomba}</div>}
        {sel===cmr.id?(
          <div style={{background:"#eff6ff",borderRadius:10,padding:12}}>
            <div style={{fontSize:13,fontWeight:600,color:"#1d4ed8",marginBottom:8}}>Vnesi številko naloga:</div>
            <input style={{...s.inp,marginBottom:8,fontFamily:"monospace"}} placeholder="npr. NAL-2025-042" value={vn} onChange={e=>setVn(e.target.value)} autoFocus/>
            {vn&&<div style={{fontSize:12,marginBottom:8,color:st.nalogi.find(n=>n.stevilkaNaloga?.toUpperCase()===vn.toUpperCase())?"#16a34a":"#dc2626"}}>{st.nalogi.find(n=>n.stevilkaNaloga?.toUpperCase()===vn.toUpperCase())?`✅ ${st.nalogi.find(n=>n.stevilkaNaloga?.toUpperCase()===vn.toUpperCase()).stranka}`:"❌ Nalog ne obstaja"}</div>}
            <div style={{display:"flex",gap:8}}><button style={{...s.btnP,flex:1,padding:"10px"}} onClick={()=>poveziCMR(cmr)}>Poveži →</button><button style={s.btnSm} onClick={()=>{setSel(null);setVn("");}}>Prekliči</button></div>
          </div>
        ):<button style={s.btnSm} onClick={()=>setSel(cmr.id)}>🔗 Poveži z nalogom</button>}
      </div>
    ))}
    {pov.length>0&&<><div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:10,marginTop:8}}>✅ Povezani ({pov.length})</div>{pov.map(c=><div key={c.id} style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:8,borderLeft:"4px solid #16a34a",display:"flex",justifyContent:"space-between"}}><div><div style={{fontWeight:700,fontFamily:"monospace",color:"#0f2744"}}>{c.stevilkaNaloga}</div><div style={{fontSize:12,color:"#16a34a"}}>✅ → {c.nalogPovezan}</div></div><div style={{fontSize:12,color:"#94a3b8"}}>{c.voznik}</div></div>)}</>}
  </div>);
}

function EmailNalogTab({ upd, showToast, naložiPodatke, vozniki }) {
  const [korak, setKorak] = useState("vnos");
  const [vnosText, setVnosText] = useState("");
  const [priponka, setPriponka] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({});
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const loadPdfJs = () => new Promise(res => {
    if (window.pdfjsLib) return res(window.pdfjsLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(window.pdfjsLib); };
    document.head.appendChild(s);
  });

  const naložiPriponko = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    showToast(`⏳ Berem: ${file.name}...`);
    try {
      if (file.type === "application/pdf") {
        const ab = await file.arrayBuffer();
        const lib = await loadPdfJs();
        const pdf = await lib.getDocument({data:ab}).promise;
        let txt = "";
        for (let i=1;i<=Math.min(pdf.numPages,5);i++) {
          const p = await pdf.getPage(i);
          const tc = await p.getTextContent();
          txt += tc.items.map(x=>x.str).join(" ") + "\n";
        }
        setPriponka({ ime: file.name, vsebina: txt.trim(), tip: "pdf" });
      } else {
        const txt = await file.text();
        setPriponka({ ime: file.name, vsebina: txt, tip: "text" });
      }
      showToast(`✅ Priponka naložena: ${file.name}`);
    } catch(err) {
      showToast("❌ Napaka pri branju priponke.", true);
    }
    e.target.value = "";
  };

  const razcleni = async () => {
    const vir = priponka?.vsebina || vnosText;
    if (!vir.trim()) return showToast("Vnesi besedilo emaila ali naloži priponko!", true);
    setAiLoading(true);
    showToast("⏳ AI razčlenjuje...");
    try {
      const { data, error } = await supabase.functions.invoke("ai-razcleni", {
        body: { tekst: vir }
      });
      if (error) throw error;
      const txt = data.content?.map(i=>i.text||"").join("").replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(txt);
      setForm({...parsed, voznikId:""});
      setKorak("forma");
      showToast("✅ AI je razčlenil! Preveri in potrdi.");
    } catch(err) {
      showToast("❌ AI napaka — izpolni ročno.", true);
      setForm({ stranka:"", nakKraj:"", razKraj:"", voznikId:"" });
      setKorak("forma");
    }
    setAiLoading(false);
  };

  const ustvariNalog = async () => {
    if (!form.stranka||!form.nakKraj||!form.razKraj) return showToast("Izpolni obvezna polja!", true);
    try {
      const { data, error } = await supabase.from('nalogi').insert([{
        stevilka_naloga: '',
        status: 'nov',
        stranka: form.stranka,
        blago: form.blago||"",
        kolicina: form.kolicina||"",
        teza: form.teza||"",
        nak_firma: form.nakFirma||"",
        nak_kraj: form.nakKraj,
        nak_naslov: form.nakNaslov||"",
        nak_referenca: form.nakReferenca||"",
        nak_datum: form.nakDatum||null,
        nak_cas: form.nakCas ? form.nakCas.slice(0,5) : null,
        raz_firma: form.razFirma||"",
        raz_kraj: form.razKraj,
        raz_naslov: form.razNaslov||"",
        raz_referenca: form.razReferenca||"",
        raz_datum: form.razDatum||null,
        raz_cas: form.razCas ? form.razCas.slice(0,5) : null,
        navodila: form.navodila||"",
        voznik_id: form.voznikId||null,
      }]).select().single();
      if (error) throw error;
      await naložiPodatke();
      showToast(`✅ Nalog ${data.stevilka_naloga} ustvarjen!`);
      setKorak("vnos");
      setVnosText("");
      setPriponka(null);
      setForm({});
    } catch(err) {
      showToast("❌ Napaka pri shranjevanju!", true);
      console.error(err);
    }
  };

  if (korak==="vnos") return (
    <div>
      <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>🤖 Email → Nalog</div>
        <div style={{fontSize:13,opacity:0.85}}>Prilepi besedilo emaila ali naloži PDF priponko — AI bo avtomatsko izpolnil nalog.</div>
      </div>
      <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:8}}>📎 Naloži priponko iz emaila</div>
        {priponka ? (
          <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:700,fontSize:13,color:"#16a34a"}}>📄 {priponka.ime}</div><div style={{fontSize:11,color:"#64748b"}}>{priponka.vsebina.slice(0,80)}...</div></div>
            <button style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18}} onClick={()=>setPriponka(null)}>✕</button>
          </div>
        ) : (
          <div
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#1d4ed8";e.currentTarget.style.background="#eff6ff";}}
            onDragLeave={e=>{e.currentTarget.style.borderColor="#cbd5e1";e.currentTarget.style.background="#f8fafc";}}
            onDrop={async e=>{
              e.preventDefault();
              e.currentTarget.style.borderColor="#cbd5e1";
              e.currentTarget.style.background="#f8fafc";
              const file = e.dataTransfer.files[0];
              if (file) {
                const fakeEvent = { target: { files: [file], value: "" } };
                await naložiPriponko(fakeEvent);
              }
            }}
            style={{border:"2px dashed #cbd5e1",borderRadius:10,padding:"24px 16px",cursor:"pointer",textAlign:"center",background:"#f8fafc",transition:"all 0.2s"}}
          >
            <div style={{fontSize:32,marginBottom:8}}>📂</div>
            <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:4}}>Povleci priponko sem</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>PDF · Word · TXT — povleci direktno iz Outlooka ali Gmaila</div>
            <input type="file" id="email-pdf" accept=".pdf,.txt,.doc,.docx" style={{display:"none"}} onChange={naložiPriponko}/>
            <label htmlFor="email-pdf" style={{background:"#0f2744",color:"#fff",padding:"8px 18px",borderRadius:10,fontWeight:700,fontSize:13,cursor:"pointer"}}>
              📂 Ali izberi datoteko
            </label>
          </div>
        )}
      </div>
      <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:8}}>📝 Ali prilepi besedilo emaila</div>
        <textarea
          style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",minHeight:150,background:"#f8fafc"}}
          placeholder="Prilepi besedilo emaila tukaj..."
          value={vnosText}
          onChange={e=>setVnosText(e.target.value)}
        />
      </div>
      <button style={{width:"100%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer",opacity:aiLoading?0.6:1}} onClick={razcleni} disabled={aiLoading}>
        {aiLoading?"⏳ AI razčlenjuje...":"🤖 Razčleni z AI →"}
      </button>
    </div>
  );

  if (korak==="forma") return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:16,color:"#0f2744"}}>✅ Preveri in potrdi nalog</div>
        <button style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:13,color:"#64748b"}} onClick={()=>setKorak("vnos")}>← Nazaj</button>
      </div>
      <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#16a34a",fontWeight:600}}>
        🤖 AI je izpolnil podatke — preveri in popravi po potrebi
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:14}}>
        <div style={{gridColumn:"1/-1"}}>
          <label style={s2.lbl}>Voznik</label>
          <select style={s2.sel} value={form.voznikId||""} onChange={e=>sf("voznikId",e.target.value)}>
            <option value="">– Dodeli pozneje –</option>
            {vozniki.map(v=><option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}
          </select>
        </div>
        <div style={{gridColumn:"1/-1"}}><Fi2 l="Stranka *" v={form.stranka} s={v=>sf("stranka",v)}/></div>
        <Fi2 l="Blago" v={form.blago} s={v=>sf("blago",v)}/>
        <Fi2 l="Količina" v={form.kolicina} s={v=>sf("kolicina",v)}/>
        <div style={{gridColumn:"1/-1",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",borderTop:"1px solid #f1f5f9",paddingTop:8}}>📍 Naklad</div>
        <Fi2 l="Firma" v={form.nakFirma} s={v=>sf("nakFirma",v)}/>
        <Fi2 l="Kraj *" v={form.nakKraj} s={v=>sf("nakKraj",v)}/>
        <div style={{gridColumn:"1/-1"}}><Fi2 l="Naslov" v={form.nakNaslov} s={v=>sf("nakNaslov",v)}/></div>
        <Fi2 l="Referenca" v={form.nakReferenca} s={v=>sf("nakReferenca",v)}/>
        <Fi2 l="Datum" v={form.nakDatum} s={v=>sf("nakDatum",v)} t="date"/>
        <Fi2 l="Ura" v={form.nakCas} s={v=>sf("nakCas",v)} t="time"/>
        <div style={{gridColumn:"1/-1",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",borderTop:"1px solid #f1f5f9",paddingTop:8}}>🏁 Razklad</div>
        <Fi2 l="Firma" v={form.razFirma} s={v=>sf("razFirma",v)}/>
        <Fi2 l="Kraj *" v={form.razKraj} s={v=>sf("razKraj",v)}/>
        <div style={{gridColumn:"1/-1"}}><Fi2 l="Naslov" v={form.razNaslov} s={v=>sf("razNaslov",v)}/></div>
        <Fi2 l="Referenca" v={form.razReferenca} s={v=>sf("razReferenca",v)}/>
        <Fi2 l="Datum" v={form.razDatum} s={v=>sf("razDatum",v)} t="date"/>
        <Fi2 l="Ura" v={form.razCas} s={v=>sf("razCas",v)} t="time"/>
        <div style={{gridColumn:"1/-1",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",borderTop:"1px solid #f1f5f9",paddingTop:8}}>💶 Kontakt za račun</div>
        <Fi2 l="Email za račun" v={form.kontaktEmail} s={v=>sf("kontaktEmail",v)} ph="finance@podjetje.com"/>
        <Fi2 l="Kontaktna oseba" v={form.kontaktIme} s={v=>sf("kontaktIme",v)}/>
        <div style={{gridColumn:"1/-1"}}><label style={s2.lbl}>Navodila</label><textarea style={{...s2.inp,resize:"vertical",height:60}} value={form.navodila||""} onChange={e=>sf("navodila",e.target.value)}/></div>
      </div>
      <button style={{width:"100%",background:"linear-gradient(135deg,#065f46,#16a34a)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={ustvariNalog}>
        📋 Ustvari nalog v sistemu →
      </button>
    </div>
  );

  return null;
}

const s2={lbl:{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4},inp:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box",background:"#f8fafc"},sel:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",background:"#f8fafc",boxSizing:"border-box"}};
const Fi2=({l,v,s,ph,t="text"})=><div><label style={s2.lbl}>{l}</label><input style={s2.inp} type={t} value={v||""} onChange={e=>s(e.target.value)} placeholder={ph||""}/></div>;

const NC=({n,onClick})=>{const sc=SC[n.status]||{};return(<button style={{width:"100%",background:"#fff",borderRadius:12,padding:"13px 14px",marginBottom:9,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",border:"none",cursor:"pointer",textAlign:"left"}} onClick={onClick}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}><span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:sc.bg,color:sc.color}}>{sc.label}</span><span style={{fontSize:11,fontFamily:"monospace",color:"#2563eb",fontWeight:700}}>{n.stevilkaNaloga}</span><span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{fmt(n.poslan)}</span></div><div style={{fontSize:16,fontWeight:800,color:"#0f2744",marginBottom:2}}>{n.nakKraj} → {n.razKraj}</div><div style={{fontSize:13,color:"#64748b"}}>{n.stranka} · {n.blago}</div></button>);};
const OC=({o,onClick,vozniki:vl})=>{const v=(vl||VOZNIKI).find(x=>x.id===o.voznikId);const z=(o.km||0)*0.18+(o.stranke||0)*20+(o.stroski||[]).reduce((a,x)=>a+(parseFloat(x.znesek)||0),0);return(<button style={{width:"100%",background:"#fff",borderRadius:12,padding:"13px 14px",marginBottom:9,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",border:"none",cursor:"pointer",textAlign:"left"}} onClick={onClick}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{v?.ime}</div><div style={{fontSize:12,color:"#64748b"}}>{fmt(o.datZac+"T00:00:00")} – {fmt(o.datKon+"T00:00:00")} · {v?.vozilo}</div></div><div style={{fontWeight:800,fontSize:18,color:"#16a34a"}}>{z.toFixed(2)} €</div></div></button>);};
const Sec=({title,children})=><div style={{background:"#fff",borderRadius:12,padding:"13px 14px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>{title}</div>{children}</div>;
const R=({label,val,bold,mono})=><div style={{display:"flex",justifyContent:"space-between",paddingBottom:5,marginBottom:5,borderBottom:"1px solid #f8fafc"}}><span style={{fontSize:12,color:"#94a3b8"}}>{label}</span><span style={{fontSize:13,color:"#1e293b",textAlign:"right",...(bold?{fontWeight:700,color:"#0f2744"}:{}),...(mono?{fontFamily:"monospace",color:"#2563eb",fontSize:12}:{})}}>{val||"–"}</span></div>;
const I=({label,val,set,ph,type="text"})=><div><label style={s.lbl}>{label}</label><input style={s.inp} type={type} value={val||""} onChange={e=>set(e.target.value)} placeholder={ph||""}/></div>;
const Toast=({t})=><div style={{position:"fixed",top:20,right:20,color:"#fff",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:14,zIndex:400,background:t.err?"#dc2626":"#16a34a",boxShadow:"0 4px 20px rgba(0,0,0,0.25)"}}>{t.txt}</div>;

const s={
  wrap:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:900,margin:"0 auto",display:"flex",flexDirection:"column"},
  header:{background:"linear-gradient(135deg,#0f2744 0%,#1d4ed8 100%)",padding:"16px 20px 14px",color:"#fff"},
  logo:{fontSize:22,fontWeight:800,letterSpacing:-0.5},
  sub:{fontSize:12,opacity:0.65,marginTop:2},
  htitle:{fontSize:18,fontWeight:800,marginTop:6},
  hsub:{fontSize:12,opacity:0.75,marginTop:2},
  backBtn:{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",padding:"6px 14px",borderRadius:20,fontSize:13,cursor:"pointer",marginBottom:8,display:"block"},
  novBtn:{background:"#fff",color:"#0f2744",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:800,fontSize:14,cursor:"pointer"},
  content:{flex:1,padding:"14px",overflowY:"auto"},
  tabs:{display:"flex",gap:6,marginBottom:14,overflowX:"auto"},
  tab:{padding:"7px 14px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:13,cursor:"pointer",fontWeight:500,color:"#475569",whiteSpace:"nowrap"},
  tabOn:{background:"#0f2744",color:"#fff",border:"1.5px solid #0f2744",fontWeight:700},
  drop:{border:"2px dashed #cbd5e1",borderRadius:14,padding:"18px",marginBottom:14,background:"#fff",cursor:"pointer"},
  dropA:{border:"2px dashed #1d4ed8",background:"#eff6ff"},
  dropP:{border:"2px dashed #d97706",background:"#fffbeb"},
  dropBtn:{background:"#f1f5f9",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:600,color:"#0f2744",cursor:"pointer"},
  scCard:{borderRadius:12,padding:"10px 14px",marginBottom:12,border:"1.5px solid",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"},
  sPill:{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:700},
  fBtn:{padding:"6px 12px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",fontSize:12,cursor:"pointer",fontWeight:500,color:"#475569"},
  fOn:{background:"#0f2744",color:"#fff",border:"1.5px solid #0f2744"},
  rBtn:{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer",color:"#0f2744"},
  btnP:{width:"100%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",border:"none",borderRadius:12,padding:13,fontSize:14,fontWeight:700,cursor:"pointer"},
  btnD:{width:"100%",background:"none",border:"1.5px solid #fca5a5",color:"#dc2626",borderRadius:12,padding:11,fontSize:13,fontWeight:600,cursor:"pointer",marginTop:8},
  btnSm:{background:"#0f2744",color:"#fff",border:"none",borderRadius:8,padding:"7px 12px",fontWeight:700,fontSize:13,cursor:"pointer"},
  sel:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",background:"#f8fafc"},
  lbl:{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4},
  inp:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box",background:"#f8fafc"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16},
  mbox:{background:"#fff",borderRadius:16,width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"},
  mhead:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 12px",borderBottom:"1px solid #e2e8f0",position:"sticky",top:0,background:"#fff"},
  mtitle:{fontWeight:700,fontSize:16,color:"#0f2744"},
  mcls:{background:"#f1f5f9",border:"none",borderRadius:"50%",width:30,height:30,fontSize:13,cursor:"pointer"},
  mbody:{padding:"14px 18px 22px"},
  empty:{textAlign:"center",color:"#94a3b8",padding:"40px 20px",fontSize:14},
};
