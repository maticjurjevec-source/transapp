import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { supabase } from './supabase'; import PotiTab from './PotiTab';
import { loginToOutlook, logoutFromOutlook, getActiveAccount, getRecentEmails, getEmailWithAttachments, markEmailAsRead } from './outlookService';

const pad=(n)=>String(n).padStart(2,"0");
const fmt=(iso)=>{if(!iso)return"–";const d=new Date(iso);return`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;};
const fmtT=(iso)=>{if(!iso)return"";const d=new Date(iso);return`${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const fmtDT=(iso)=>iso?`${fmt(iso)} ob ${fmtT(iso)}`:"–";
const isoDan=(d)=>{const x=new Date(d);return`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;};
const obdobjeRange=(r)=>{const t=new Date();t.setHours(0,0,0,0);if(r==="danes")return[isoDan(t),isoDan(t)];if(r==="teden"){const p=new Date(t);const day=(p.getDay()+6)%7;p.setDate(p.getDate()-day);const n=new Date(p);n.setDate(p.getDate()+6);return[isoDan(p),isoDan(n)];}if(r==="mesec"){const p=new Date(t.getFullYear(),t.getMonth(),1);const n=new Date(t.getFullYear(),t.getMonth()+1,0);return[isoDan(p),isoDan(n)];}return["",""];};

// Natisni original nalog + CMR z interno NAL številko na vrhu vsake strani
const natisniVse=(n,cmrSlike=[])=>{
  const nalUrl=n.original_pdf_url||n.originalPdfUrl;
  const nalStevilka=n.stevilkaNaloga||n.stevilka_naloga||"";
  const w=window.open("","_blank");
  if(!w){alert("Brskalnik je blokiral pojavno okno. Dovoli pojavna okna za tiskanje.");return;}
  const jePdf=nalUrl&&/\.pdf(\?|$)/i.test(nalUrl);
  const datum=new Date().toLocaleDateString("sl-SI");
  const header=(naslov)=>`<div class="hdr"><div><div class="hdr-l">${naslov}</div><div class="hdr-num">${nalStevilka}</div></div><div class="hdr-r"><div><b>MATJA\u017d JURJEVEC s.p.</b></div><div>${datum}</div></div></div>`;
  let body="";
  if(nalUrl){
    body+=jePdf
      ?`<div class="page">${header("Original nalog naro\u010dnika")}<embed src="${nalUrl}" type="application/pdf" class="pdf"/></div>`
      :`<div class="page">${header("Original nalog naro\u010dnika")}<img src="${nalUrl}" class="doc"/></div>`;
  }
  (cmrSlike||[]).forEach((sl,i)=>{
    const url=sl.url||sl.img;
    if(!url)return;
    body+=`<div class="page">${header(`CMR dokument ${i+1}/${cmrSlike.length}`)}<img src="${url}" class="doc"/></div>`;
  });
  if(!body){w.document.write("<p style='font-family:sans-serif;padding:20px'>Ni dokumentov za tiskanje.</p>");w.document.close();return;}
  w.document.write(`<!DOCTYPE html><html><head><title>${nalStevilka} - nalog + CMR</title><style>@page{size:A4;margin:8mm;}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;}.page{page-break-after:always;}.page:last-child{page-break-after:auto;}.hdr{background:#0f2744;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}.hdr-l{font-size:10px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;}.hdr-num{font-size:22px;font-weight:800;font-family:monospace;letter-spacing:1px;}.hdr-r{text-align:right;font-size:11px;opacity:0.85;}.doc{display:block;width:100%;max-height:255mm;object-fit:contain;}.pdf{display:block;width:100%;height:255mm;border:none;}</style></head><body>${body}</body></html>`);
  w.document.close();
  const doPrint=()=>{try{w.focus();w.print();}catch(e){}};
  const imgs=w.document.images;
  if(imgs.length===0){setTimeout(doPrint,900);return;}
  let loaded=0,done=false;
  const check=()=>{loaded++;if(loaded>=imgs.length&&!done){done=true;setTimeout(doPrint,300);}};
  for(const img of imgs){if(img.complete)check();else{img.onload=check;img.onerror=check;}}
  setTimeout(()=>{if(!done){done=true;doPrint();}},4000);
};

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
  caka_potrditev:{label:"Čaka potrditev",color:"#ea580c",bg:"#fff7ed",icon:"📥"},
  nov:{label:"Nov",color:"#64748b",bg:"#f8fafc",icon:"🔘"},
  poslan:{label:"Poslan vozniku",color:"#2563eb",bg:"#eff6ff",icon:"📤"},
  sprejet:{label:"Sprejeto",color:"#d97706",bg:"#fffbeb",icon:"✅"},
  zakljucen:{label:"Zaključeno",color:"#16a34a",bg:"#f0fdf4",icon:"✔️"},
  za_fakturo:{label:"Za fakturo",color:"#9333ea",bg:"#faf5ff",icon:"💶"},
  fakturirano:{label:"Fakturirano",color:"#15803d",bg:"#dcfce7",icon:"🧾"},
};
const SRed=["nov","poslan","sprejet","zakljucen","za_fakturo","fakturirano"];

// POPRAVEK: pravilno ime bucket-a (s pomišljajem, kot je v Supabase)
const CMR_BUCKET = "cmr-dokumenti";

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
async function uploadOriginalPdf(file){
  try{
    const uuid=crypto.randomUUID();
    const fileName=`${uuid}/${Date.now()}-${file.name}`;
    const{data,error}=await supabase.storage.from("originalni-nalogi").upload(fileName,file,{cacheControl:"3600",upsert:false});
    if(error)throw error;
    const{data:urlData}=supabase.storage.from("originalni-nalogi").getPublicUrl(fileName);
    return urlData?.publicUrl||null;
  }catch(err){
    console.error("Upload PDF napaka:",err);
    return null;
  }
}

// ===== OBREZOVANJE CMR (Cropper.js) =====
const loadCropper=()=>new Promise((resolve,reject)=>{
  if(window.Cropper)return resolve(window.Cropper);
  if(!document.getElementById("cropperjs-css")){
    const link=document.createElement("link");
    link.id="cropperjs-css";link.rel="stylesheet";
    link.href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css";
    document.head.appendChild(link);
  }
  const sc=document.createElement("script");
  sc.src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js";
  sc.onload=()=>resolve(window.Cropper);
  sc.onerror=()=>reject(new Error("Cropper se ni naložil"));
  document.head.appendChild(sc);
});

function CropCMRModal({cmr,nalStevilka,onClose,onSaved,showToast}){
  const imgRef=useRef(null);
  const cropperRef=useRef(null);
  const [objUrl,setObjUrl]=useState(null);
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    let revoked=false,created=null;
    fetch(cmr.url).then(r=>r.blob()).then(b=>{created=URL.createObjectURL(b);if(!revoked)setObjUrl(created);}).catch(()=>{if(!revoked)setObjUrl(cmr.url);});
    return ()=>{revoked=true;if(created)URL.revokeObjectURL(created);if(cropperRef.current){cropperRef.current.destroy();cropperRef.current=null;}};
  },[]);

  const onImgLoad=async()=>{
    try{
      const Cropper=await loadCropper();
      if(!imgRef.current)return;
      if(cropperRef.current)cropperRef.current.destroy();
      cropperRef.current=new Cropper(imgRef.current,{viewMode:1,autoCropArea:0.9,background:false,responsive:true});
      setReady(true);
    }catch(e){showToast&&showToast("❌ Orodje se ni naložilo",true);}
  };

  const zavrti=(deg)=>{if(cropperRef.current)cropperRef.current.rotate(deg);};

  const shrani=async()=>{
    if(!cropperRef.current)return;
    setSaving(true);
    try{
      const canvas=cropperRef.current.getCroppedCanvas({maxWidth:2000,maxHeight:2800,imageSmoothingQuality:"high"});
      const blob=await new Promise(res=>canvas.toBlob(res,"image/jpeg",0.92));
      if(!blob)throw new Error("Ni slike");
      const stara=cmr.pot;
      const mapa=stara&&stara.includes("/")?stara.slice(0,stara.lastIndexOf("/")):(cmr.id||"cmr");
      const novaPot=`${mapa}/${Date.now()}-obrezano.jpg`;
      const {error:upErr}=await supabase.storage.from(CMR_BUCKET).upload(novaPot,blob,{contentType:"image/jpeg",upsert:false});
      if(upErr)throw upErr;
      const {error:updErr}=await supabase.from("cmr_dokumenti").update({storage_pot:novaPot,ime_datoteke:((cmr.ime||"cmr").replace(/\.[^.]+$/,""))+"-obrezano.jpg"}).eq("id",cmr.id);
      if(updErr)throw updErr;
      if(stara){await supabase.storage.from(CMR_BUCKET).remove([stara]);}
      onSaved&&onSaved();
    }catch(err){
      console.error(err);
      showToast&&showToast("❌ Napaka pri shranjevanju!",true);
      setSaving(false);
    }
  };

  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:560,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0f2744",color:"#fff",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:700,fontSize:15}}>✂️ Obreži CMR{nalStevilka?` — ${nalStevilka}`:""}</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:"50%",width:28,height:28,fontSize:13,cursor:"pointer"}}>✕</button>
      </div>
      <div style={{padding:16,background:"#f1f5f9",overflow:"auto",flex:1}}>
        <div style={{maxHeight:"55vh"}}>
          <img ref={imgRef} src={objUrl||undefined} onLoad={onImgLoad} alt="CMR" style={{maxWidth:"100%",display:"block"}}/>
        </div>
        <div style={{textAlign:"center",fontSize:12,color:"#64748b",marginTop:10}}>Povleci robove okvirja, da izrežeš dokument</div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",padding:"10px 16px"}}>
        <button onClick={()=>zavrti(-90)} disabled={!ready} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",color:"#475569",fontWeight:600}}>↺ Zavrti levo</button>
        <button onClick={()=>zavrti(90)} disabled={!ready} style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",color:"#475569",fontWeight:600}}>↻ Zavrti desno</button>
      </div>
      <div style={{display:"flex",gap:8,padding:"12px 16px 18px",borderTop:"1px solid #e2e8f0"}}>
        <button onClick={onClose} disabled={saving} style={{flex:1,background:"#f1f5f9",color:"#475569",border:"none",borderRadius:10,padding:12,fontSize:14,fontWeight:700,cursor:"pointer"}}>Prekliči</button>
        <button onClick={shrani} disabled={!ready||saving} style={{flex:2,background:"linear-gradient(135deg,#065f46,#16a34a)",color:"#fff",border:"none",borderRadius:10,padding:12,fontSize:14,fontWeight:700,cursor:"pointer",opacity:(!ready||saving)?0.6:1}}>{saving?"⏳ Shranjujem...":"✅ Shrani obrezano"}</button>
      </div>
    </div>
  </div>);
}

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
  const [cropCmr,setCropCmr]=useState(null); const scrollPos=useRef(0); useLayoutEffect(()=>{ if(!selNalog){ window.scrollTo(0,scrollPos.current); } },[selNalog]);

  useEffect(()=>{ naložiPodatke(); },[]);

  // ===== REALTIME SYNC =====
  useEffect(() => {
    const channel = supabase.channel(`dispatcher-${Math.random().toString(36).slice(2,10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "nalogi" }, (payload) => {
        console.log("🔄 Realtime: nalogi", payload.eventType, payload.new?.stevilka_naloga || payload.old?.stevilka_naloga);
        naložiPodatke();
        if (payload.eventType === "UPDATE" && payload.new) {
          const stari = payload.old?.status;
          const nov = payload.new?.status;
          if (stari !== nov) {
            const stevilka = payload.new.stevilka_naloga || "Nalog";
            const statusLabel = SC[nov]?.label || nov;
            showToast(`🔄 ${stevilka}: ${statusLabel}`);
          }
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cmr_dokumenti" }, (payload) => {
        console.log("📄 Realtime: nov CMR", payload.new);
        naložiPodatke();
        showToast("📄 Voznik je naložil CMR!");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "prosti_cmr" }, (payload) => {
        console.log("📸 Realtime: prosti CMR", payload.new);
        naložiPodatke();
        const stev = payload.new?.stevilka_naloga || "";
        showToast(`📸 Nov prosti CMR${stev ? ` (${stev})` : ""}!`);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tedenski_obracuni" }, (payload) => {
        console.log("💶 Realtime: obracun", payload.eventType);
        if (payload.eventType === "INSERT" || (payload.eventType === "UPDATE" && payload.new?.status === "poslan" && payload.old?.status !== "poslan")) {
          showToast("💶 Nov tedenski obračun!");
        }
      })
      .subscribe((status) => {
        console.log("📡 Realtime status:", status);
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  

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

  // POPRAVEK: naložiCMR z boljšim debug logom in pravim bucketom
  const naložiCMR = async (nalogId) => {
    try {
      const { data, error } = await supabase
        .from('cmr_dokumenti')
        .select('*')
        .eq('nalog_id', nalogId)
        .order('created_at');
      if (error) {
        console.error('❌ CMR fetch napaka:', error);
        return [];
      }
      console.log(`📄 CMR za ${nalogId}: najdenih ${data?.length || 0} dokumentov`, data);
      if (!data || data.length === 0) return [];
      return data.map(d => {
        const { data: urlData } = supabase.storage
          .from(CMR_BUCKET)
          .getPublicUrl(d.storage_pot);
        return {
          url: urlData?.publicUrl,
          ime: d.ime_datoteke,
          pot: d.storage_pot,
          id: d.id,
        };
      });
    } catch(err) {
      console.error('❌ naložiCMR napaka:', err);
      return [];
    }
  };

  // POPRAVEK: odpriNalog vedno naloži CMR slike iz Supabase
  const odpriNalog = async (n) => {
    scrollPos.current = window.scrollY || document.documentElement.scrollTop || 0; setSelNalog({...n, cmrSlike: [], _loading: true});
    const cmr = await naložiCMR(n.id);
    setSelNalog({...n, cmrSlike: cmr, _loading: false});
  };

  // Izbriši CMR dokument (iz baze + storage)
  const izbrisiCMR = async (cmr) => {
    if (!cmr?.id) return;
    if (!window.confirm("Izbrišem ta CMR dokument? Tega ni mogoče razveljaviti.")) return;
    try {
      if (cmr.pot) { await supabase.storage.from(CMR_BUCKET).remove([cmr.pot]); }
      const { error } = await supabase.from('cmr_dokumenti').delete().eq('id', cmr.id);
      if (error) throw error;
      await osveziCMR();
      showToast("🗑️ CMR izbrisan.");
    } catch (err) { showToast("❌ Napaka pri brisanju CMR!", true); console.error(err); }
  };

  // Funkcija za reload CMR-jev v odprtem nalogu
  const osveziCMR = async () => {
    if (!selNalog) return;
    const cmr = await naložiCMR(selNalog.id);
    setSelNalog(prev => prev ? {...prev, cmrSlike: cmr} : prev);
  };

  // Pošlji nalog vozniku preko Viberja
  const posljiViber = (n) => {
    const v = voz(n.voznikId);
    if (!v) return showToast("❌ Nalog nima dodeljenega voznika!", true);
    if (!v.tel) return showToast(`❌ Voznik ${v.ime} nima telefonske številke!`, true);

    // Sestavi celotno sporočilo z vsemi podatki naloga
    const sc = SC[n.status] || {};
    const lines = [
      `🚛 NALOG ${n.stevilkaNaloga || n.id}`,
      `Status: ${sc.label || n.status}`,
      `Stranka: ${n.stranka || "–"}`,
      ``,
      `📦 BLAGO`,
      `${n.blago || "–"}${n.kolicina ? ` · ${n.kolicina}` : ""}${n.teza ? ` · ${n.teza}` : ""}`,
      ``,
      `📍 NAKLAD`,
      n.nakFirma || "",
      `${n.nakKraj || ""}${n.nakNaslov ? `, ${n.nakNaslov}` : ""}`,
      n.nakDatum ? `📅 ${fmt(n.nakDatum)}${n.nakCas ? ` ob ${n.nakCas}` : ""}` : "",
      n.nakReferenca ? `Ref: ${n.nakReferenca}` : "",
      ``,
      `🏁 RAZKLAD`,
      n.razFirma || "",
      `${n.razKraj || ""}${n.razNaslov ? `, ${n.razNaslov}` : ""}`,
      n.razDatum ? `📅 ${fmt(n.razDatum)}${n.razCas ? ` ob ${n.razCas}` : ""}` : "",
      n.razReferenca ? `Ref: ${n.razReferenca}` : "",
    ];
    if (n.navodila) {
      lines.push(``, `⚠️ NAVODILA`, n.navodila);
    }
    if (n.stevilka_narocnika || n.stevilkaNarocnika) {
      lines.push(``, `📋 Št. naročnika: ${n.stevilka_narocnika || n.stevilkaNarocnika}`);
    }

    // Odstrani prazne vrstice na koncu in znotraj sosedov
    const sporocilo = lines.filter((l, i, arr) => !(l === "" && arr[i-1] === "")).join("\n");

    // Viber deeplink: številka brez "+" znaka
    const tel = v.tel.replace(/^\+/, "");
    const url = `viber://chat?number=${tel}&text=${encodeURIComponent(sporocilo)}`;

    window.location.href = url;
    showToast(`📤 Odpiram Viber za ${v.ime}...`);
  };
















  const [aiParsing,setAiParsing]=useState(false);
  const [duplikatOpozorilo,setDuplikatOpozorilo]=useState(null);

  // Preveri podvajanje naloga (po številki naročnika ali referenci naklada)
  useEffect(()=>{
    if(modal!=="nalog"){setDuplikatOpozorilo(null);return;}
    const stNarocnika=(form.stevilkaNarocnika||"").trim();
    const refNaklada=(form.nakReferenca||"").trim();
    if(!stNarocnika && !refNaklada){setDuplikatOpozorilo(null);return;}
    const editId=form.editId;
    const najden=st.nalogi.find(n=>{
      if(editId && n.id===editId)return false;
      const nStNar=(n.stevilka_narocnika||n.stevilkaNarocnika||"").trim();
      const nRef=(n.nak_referenca||n.nakReferenca||"").trim();
      if(stNarocnika && nStNar && nStNar.toLowerCase()===stNarocnika.toLowerCase())return true;
      if(refNaklada && nRef && nRef.toLowerCase()===refNaklada.toLowerCase())return true;
      return false;
    });
    setDuplikatOpozorilo(najden||null);
  },[form.stevilkaNarocnika,form.nakReferenca,modal,st.nalogi]);

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
        stevilka_narocnika: form.stevilkaNarocnika||null,
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
        original_pdf_url: form.originalPdfUrl||null,
znesek_original: form.znesek||null,
je_slovenska_ddv: form.jeSlovenskaDdv!==undefined?form.jeSlovenskaDdv:null,
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
      // Posodobi tudi selNalog (da ostanemo v detail view in da se prikaže Viber gumb)
      setSelNalog(prev => prev ? {...prev, voznikId, status:"poslan", poslanCas:new Date().toISOString()} : prev);
      showToast(`✅ Nalog dodeljen vozniku ${voz(voznikId)?.ime}!`);
    } catch(err) {
      showToast("❌ Napaka!",true);
      console.error(err);
    }
  };

  // Dodeli voznika + takoj odpri Viber s celotnim sporočilom
  const dodelijInPosljiViber=async(nalogId,voznikId)=>{
    const v = voz(voznikId);
    if (!v?.tel) return showToast(`❌ Voznik ${v?.ime||""} nima telefonske številke!`, true);
    try {
      const { error } = await supabase.from('nalogi').update({ voznik_id:voznikId, status:'poslan', poslan_cas:new Date().toISOString() }).eq('id',nalogId);
      if(error) throw error;
      // Posodobi state in pripravi nalog za Viber sporočilo
      const updatedNalog = {...st.nalogi.find(n=>n.id===nalogId), voznikId, status:"poslan"};
      upd(s=>({...s,nalogi:s.nalogi.map(n=>n.id===nalogId?{...n,voznikId,status:"poslan",poslanCas:new Date().toISOString()}:n)}));
      // Odpri Viber
      posljiViber(updatedNalog);
      setSelNalog(null);
    } catch(err) {
      showToast("❌ Napaka pri dodelitvi!",true);
      console.error(err);
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

  const urediNalog=async(id)=>{
    const n=st.nalogi.find(x=>x.id===id);if(!n)return;
    setForm({editId:id,voznikId:n.voznikId||"",stranka:n.stranka||"",blago:n.blago||"",kolicina:n.kolicina||"",teza:n.teza||"",nakFirma:n.nakFirma||"",nakKraj:n.nakKraj||"",nakNaslov:n.nakNaslov||"",nakReferenca:n.nakReferenca||"",nakDatum:n.nakDatum||"",nakCas:n.nakCas||"",razFirma:n.razFirma||"",razKraj:n.razKraj||"",razNaslov:n.razNaslov||"",razReferenca:n.razReferenca||"",razDatum:n.razDatum||"",razCas:n.razCas||"",navodila:n.navodila||"",kontaktEmail:n.kontaktEmail||"",znesek:n.znesek_original||n.znesekOriginal||"",stevilkaNarocnika:n.stevilka_narocnika||n.stevilkaNarocnika||""});
    setModal("nalog");setSelNalog(null);
  };
  const submitEdit=async()=>{
    if(!form.stranka||!form.nakKraj||!form.razKraj)return showToast("Izpolni obvezna polja!",true);
    try{
      const{error}=await supabase.from('nalogi').update({
        stranka:form.stranka,blago:form.blago,kolicina:form.kolicina,teza:form.teza,
        nak_firma:form.nakFirma,nak_kraj:form.nakKraj,nak_naslov:form.nakNaslov,nak_referenca:form.nakReferenca,
        nak_datum:form.nakDatum||null,nak_cas:form.nakCas?form.nakCas.slice(0,5):null,
        raz_firma:form.razFirma,raz_kraj:form.razKraj,raz_naslov:form.razNaslov,raz_referenca:form.razReferenca,
        raz_datum:form.razDatum||null,raz_cas:form.razCas?form.razCas.slice(0,5):null,
        navodila:form.navodila,voznik_id:form.voznikId||null,
        znesek_original:form.znesek||null,stevilka_narocnika:form.stevilkaNarocnika||null,
      }).eq('id',form.editId);
      if(error)throw error;
      await naložiPodatke();closeModal();showToast("✅ Nalog posodobljen!");
    }catch(err){showToast("❌ Napaka!",true);console.error(err);}
  };
const nastaviSmer=async(nalogId,smer)=>{
    try{
      const{error}=await supabase.from('nalogi').update({smer_rocno:smer}).eq('id',nalogId);
      if(error)throw error;
      await naložiPodatke();
      setSelNalog(prev=>prev?{...prev,smer_rocno:smer}:prev);
      showToast(smer?`✅ Smer ročno: ${SMER[smer]?.label}`:"✅ Smer: samodejno");
    }catch(err){showToast("❌ Napaka pri shranjevanju smeri!",true);console.error(err);}
  };
 const zamenjajPotrditev=async(prejeti,obstojeci)=>{
    if(!window.confirm(`Zamenjam obstojeci nalog ${obstojeci.stevilkaNaloga} s podatki tega prejetega naloga? Prejeti nalog bo izbrisan.`))return;
    try{
      const{error}=await supabase.from('nalogi').update({
        stranka:prejeti.stranka,blago:prejeti.blago,kolicina:prejeti.kolicina,teza:prejeti.teza,
        nak_firma:prejeti.nakFirma,nak_kraj:prejeti.nakKraj,nak_naslov:prejeti.nakNaslov,nak_referenca:prejeti.nakReferenca,
        nak_datum:prejeti.nakDatum||null,nak_cas:prejeti.nakCas?prejeti.nakCas.slice(0,5):null,
        raz_firma:prejeti.razFirma,raz_kraj:prejeti.razKraj,raz_naslov:prejeti.razNaslov,raz_referenca:prejeti.razReferenca,
        raz_datum:prejeti.razDatum||null,raz_cas:prejeti.razCas?prejeti.razCas.slice(0,5):null,
        navodila:prejeti.navodila,stevilka_narocnika:prejeti.stevilka_narocnika||prejeti.stevilkaNarocnika||null,
        znesek_original:prejeti.znesek_original||prejeti.znesekOriginal||null,
        original_pdf_url:prejeti.original_pdf_url||prejeti.originalPdfUrl||obstojeci.original_pdf_url||obstojeci.originalPdfUrl||null,
      }).eq('id',obstojeci.id);
      if(error)throw error;
      await supabase.from('nalogi').delete().eq('id',prejeti.id);
      await naložiPodatke();
      setSelNalog(null);
      showToast(`✅ Nalog ${obstojeci.stevilkaNaloga} zamenjan z novimi podatki!`);
    }catch(err){showToast("❌ Napaka pri zamenjavi!",true);console.error(err);}
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
    let pdfUrl=null;
    if(file.type==="application/pdf"){
      pdfUrl=await uploadOriginalPdf(file);
    }
    try{
      let txt="";
      let slikaB64=null;
      if(file.type==="application/pdf"){
        try{
          const lib=await new Promise(res=>{if(window.pdfjsLib)return res(window.pdfjsLib);const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res(window.pdfjsLib);};document.head.appendChild(s);});
          const ab=await file.arrayBuffer();
          const pdf=await lib.getDocument({data:ab}).promise;
          for(let i=1;i<=Math.min(pdf.numPages,4);i++){const p=await pdf.getPage(i);const tc=await p.getTextContent();txt+=tc.items.map(x=>x.str).join(" ")+"\n";}
          // Če je scan (brez teksta), prerendiraj prvo stran v sliko
          if(!txt.trim()||txt.trim().length<30){
            showToast("📷 PDF je scan — pretvarjam v sliko za AI...");
            const page=await pdf.getPage(1);
            const viewport=page.getViewport({scale:2.0});
            const canvas=document.createElement("canvas");
            canvas.width=viewport.width;canvas.height=viewport.height;
            const ctx=canvas.getContext("2d");
            await page.render({canvasContext:ctx,viewport}).promise;
            slikaB64=canvas.toDataURL("image/jpeg",0.85).split(",")[1];
            txt="";
          }
        }catch(e){txt="";}
      }else if(file.type.startsWith("image/")){
        slikaB64=await new Promise((res)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.readAsDataURL(file);});
      }
      if(!txt&&!slikaB64)txt=await file.text().catch(()=>file.name);
      const promptTekst=`Iz tega transportnega naloga izvleci podatke. POZOR za polje "stranka": stranka je ŠPEDICIJA ali LOGISTIČNO PODJETJE ki je poslalo ta nalog (npr. Cargo Partner, DHL, Rooskens, ROCS Trading, Fersped ipd.) — torej tisti ki naroča prevoz. NI nakladna firma, NI razkladna firma, NI prevoznik (JURJEVEC). Poišči logo, glavo dokumenta ali polje "ordered by/Auftraggeber/naročnik" da najdeš pravo stranko. Poišči tudi ceno prevoza (price/rate/freight/Preis/Fracht) in jo vpiši v polje znesek kot število. Vrni SAMO JSON:\n{"stranka":"","stevilkaNarocnika":"","blago":"","kolicina":"","teza":"","nakFirma":"","nakKraj":"","nakNaslov":"","nakReferenca":"","nakDatum":"","nakCas":"","razFirma":"","razKraj":"","razNaslov":"","razReferenca":"","razDatum":"","razCas":"","navodila":"","kontaktEmail":"","znesek":"","jeSlovenskaDdv":true}\n\nPolja:\n- znesek: cena prevoza v EUR (samo število, npr "850.00"). Poišči v dokumentu besede kot price, rate, freight, Preis, cena.\n- jeSlovenskaDdv: true če je naročnik iz Slovenije, false če je tuj (glede na državo naročnika).\n- kontaktEmail: email za pošiljanje računa (poišči besede invoice, Rechnung, račun, faktura).\n- kolicina: nakladalni metri (LDM) ce so navedeni (npr "13,6 LDM"), sicer stevilo palet in dimenzije palet (npr "24 EUR palet 120x80 cm").\n- teza: skupna teza tovora v kg (npr "18.500 kg").\n- navodila: vse posebne zahteve in navodila iz dokumenta.\nDatumi: YYYY-MM-DD, casi: HH:MM.`;
      const userContent=slikaB64
        ?[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:slikaB64}},{type:"text",text:promptTekst}]
        :promptTekst+"\n\nDokument:\n"+txt;
      const res=await fetch("/api/parse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1500,messages:[{role:"user",content:userContent}]})});
      const data=await res.json();
      const rawTxt=(data.content?.map(i=>i.text||"").join("")||"").replace(/```json|```/g,"").trim();
      const m=rawTxt.match(/\{[\s\S]*\}/);
      const parsed=JSON.parse(m?m[0]:rawTxt);
      setForm(f=>({...f,...parsed,originalPdfUrl:pdfUrl||""}));setModal("nalog");showToast("✅ AI izpolnil nalog!");
    }catch(err){setForm({originalPdfUrl:pdfUrl||""});setModal("nalog");showToast("⚠️ AI ni mogel prebrati – izpolni ročno.",true);}
    setAiParsing(false);
  };

  const stats={skupaj:st.nalogi.length,novi:st.nalogi.filter(n=>n.status==="nov").length,aktivni:st.nalogi.filter(n=>["poslan","sprejet"].includes(n.status)).length,zaFakturo:st.nalogi.filter(n=>n.status==="za_fakturo").length};

  const [izVoz,setIzVoz]=useState("");

  // Nalog detail
  if(selNalog){
    const n=st.nalogi.find(x=>x.id===selNalog.id)||selNalog;
    // POPRAVEK: Uporabi cmrSlike iz selNalog (ki jih je naložil odpriNalog)
    const cmrSlike = selNalog.cmrSlike || [];
    const cmrLoading = selNalog._loading;
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
        {n.status==="caka_potrditev"&&(()=>{
            const sm=smerNaloga(n);
            const dvojnik=st.nalogi.find(x=>{
              if(x.id===n.id)return false;
              if(x.status==="caka_potrditev")return false;
              const aNar=(n.stevilka_narocnika||n.stevilkaNarocnika||"").trim().toLowerCase();
              const bNar=(x.stevilka_narocnika||x.stevilkaNarocnika||"").trim().toLowerCase();
              const aRef=(n.nakReferenca||"").trim().toLowerCase();
              const bRef=(x.nakReferenca||"").trim().toLowerCase();
              if(aNar&&bNar&&aNar===bNar)return true;
              if(aRef&&bRef&&aRef===bRef)return true;
              return false;
            });
            return(<div style={{background:"#fff7ed",border:"1.5px solid #fed7aa",borderRadius:14,padding:16,marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:15,color:"#9a3412",marginBottom:10}}>📥 Nalog čaka potrditev</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                <span style={{fontSize:11,color:"#9a3412",fontWeight:600,alignSelf:"center"}}>Smer:</span>
                {sm&&sm.kod!=="?"
                  ?<span style={{padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:700,background:sm.bg,color:sm.color}}>{sm.icon} {sm.label}</span>
                  :<span style={{padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:600,background:"#f1f5f9",color:"#64748b"}}>❓ Ni zaznano (preveri kraje)</span>}
              </div>
              {dvojnik&&<div style={{background:"#fff",border:"1.5px solid #fecaca",borderRadius:10,padding:12,marginBottom:12}}>
                <div style={{fontWeight:700,color:"#dc2626",fontSize:13,marginBottom:4}}>⚠️ Možen dvojnik!</div>
                <div style={{fontSize:12,color:"#0f2744",fontWeight:700}}>{dvojnik.stevilkaNaloga} · {dvojnik.stranka}</div>
                <div style={{fontSize:12,color:"#64748b"}}>{dvojnik.nakKraj} → {dvojnik.razKraj}</div>
              </div>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button style={{flex:"1 1 140px",background:"linear-gradient(135deg,#065f46,#16a34a)",color:"#fff",border:"none",borderRadius:10,padding:"11px 14px",fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={()=>spremenStatus(n.id,"nov")}>✅ Potrdi nalog</button>
                {dvojnik&&<button style={{flex:"1 1 140px",background:"#0284c7",color:"#fff",border:"none",borderRadius:10,padding:"11px 14px",fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={()=>zamenjajPotrditev(n,dvojnik)}>🔄 Zamenjaj obstoječega</button>}
                <button style={{flex:"1 1 100px",background:"#fff",border:"1.5px solid #fca5a5",color:"#dc2626",borderRadius:10,padding:"11px 14px",fontSize:14,fontWeight:700,cursor:"pointer"}} onClick={()=>{if(window.confirm("Zavrnem in zbrišem ta prejeti nalog?"))izbrisiNalog(n.id);}}>🗑️ Zavrni</button>
              </div>
              <div style={{fontSize:11,color:"#9a3412",marginTop:10}}>💡 Če je smer napačna ali podatki niso točni, klikni spodaj "✏️ Uredi nalog", popravi in shrani — nato potrdi.</div>
            </div>);
          })()}
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
         <Sec title="🧭 Smer (izvoz/uvoz)">
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <span style={{fontSize:12,color:"#64748b"}}>Trenutno:</span>
              {(()=>{const sm=smerNaloga(n);return sm&&sm.kod!=="?"
                ?<span style={{padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:700,background:sm.bg,color:sm.color}}>{sm.icon} {sm.label}{(n.smer_rocno||n.smerRocno)?" (ročno)":" (samodejno)"}</span>
                :<span style={{padding:"4px 12px",borderRadius:20,fontSize:13,fontWeight:600,background:"#f1f5f9",color:"#64748b"}}>❓ Ni zaznano</span>;})()}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["izvoz","🟢 Izvoz"],["uvoz","🔵 Uvoz"],["domaci","🏠 Domači"]].map(([k,l])=>(
                <button key={k} onClick={()=>nastaviSmer(n.id,k)} style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid",borderColor:(n.smer_rocno||n.smerRocno)===k?"#0f2744":"#e2e8f0",background:(n.smer_rocno||n.smerRocno)===k?"#0f2744":"#fff",color:(n.smer_rocno||n.smerRocno)===k?"#fff":"#475569",fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>
              ))}
              <button onClick={()=>nastaviSmer(n.id,null)} style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,fontWeight:600,cursor:"pointer"}}>↺ Samodejno</button>
            </div>
          </Sec>
          <Sec title="📦 Blago"><R label="Blago" val={n.blago}/><R label="Količina" val={n.kolicina}/><R label="Teža" val={n.teza}/></Sec>
          <Sec title="📍 Naklad"><R label="Firma" val={n.nakFirma} bold/><R label="Kraj" val={n.nakKraj}/><R label="Naslov" val={n.nakNaslov}/><R label="Referenca" val={n.nakReferenca} mono/><R label="Datum" val={n.nakDatum?(n.nakCas?`${fmt(n.nakDatum)} ob ${n.nakCas}`:fmt(n.nakDatum)):"–"}/></Sec>
          <Sec title="🏁 Razklad"><R label="Firma" val={n.razFirma} bold/><R label="Kraj" val={n.razKraj}/><R label="Naslov" val={n.razNaslov}/><R label="Referenca" val={n.razReferenca} mono/><R label="Datum" val={n.razDatum?(n.razCas?`${fmt(n.razDatum)} ob ${n.razCas}`:fmt(n.razDatum)):"–"}/></Sec>
          {n.navodila&&<Sec title="⚠️ Navodila"><div style={{fontSize:13,background:"#fffbeb",borderRadius:8,padding:"10px 12px",border:"1px solid #fde68a"}}>{n.navodila}</div></Sec>}
          {(n.stevilka_narocnika||n.stevilkaNarocnika)&&<Sec title="📋 Št. naloga naročnika"><div style={{fontFamily:"monospace",fontSize:16,fontWeight:800,color:"#2563eb"}}>{n.stevilka_narocnika||n.stevilkaNarocnika}</div></Sec>}
          {n.kontaktEmail&&<Sec title="💶 Kontakt za račun"><R label="Email" val={n.kontaktEmail} mono/></Sec>}
          {/* Original PDF */}
          <Sec title="📄 Original nalog od naročnika">{(n.original_pdf_url||n.originalPdfUrl)?(()=>{const origUrl=n.original_pdf_url||n.originalPdfUrl;const jePdf=/\.pdf(\?|$)/i.test(origUrl);const jeSlika=/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(origUrl);return <div>{jePdf?<iframe src={origUrl} style={{width:"100%",height:500,border:"none",borderRadius:8}} title="Original nalog"/>:jeSlika?<img src={origUrl} alt="Original nalog" style={{width:"100%",borderRadius:8,border:"1px solid #e2e8f0",display:"block"}}/>:<div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:24,textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📄</div><div style={{fontSize:13,color:"#64748b"}}>Word/dokument – klikni "Odpri ↗" spodaj za ogled.</div></div>}<div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginTop:8}}><button onClick={()=>natisniVse(n,cmrSlike)} style={{background:"#0f2744",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨️ Natisni vse (nalog + CMR)</button><button onClick={()=>natisniVse(n,[])} style={{background:"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨️ Samo nalog</button><a href={origUrl} target="_blank" rel="noopener noreferrer" style={{padding:"9px 16px",fontSize:13,color:"#2563eb",fontWeight:600,textDecoration:"none",border:"1.5px solid #bfdbfe",borderRadius:8}}>Odpri ↗</a></div><div style={{marginTop:8,textAlign:"center"}}><input type="file" id={`reorig-${n.id}`} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp" style={{display:"none"}} onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;showToast("⏳ Nalagam nov original...");const url=await uploadOriginalPdf(file);if(url){const staraPot=origPotIzUrl(n.original_pdf_url||n.originalPdfUrl);await supabase.from('nalogi').update({original_pdf_url:url}).eq('id',n.id);if(staraPot){await supabase.storage.from("originalni-nalogi").remove([staraPot]);}await naložiPodatke();odpriNalog({...n,original_pdf_url:url});showToast("✅ Original posodobljen!");}else{showToast("❌ Napaka pri nalaganju!",true);}e.target.value="";}}/><label htmlFor={`reorig-${n.id}`} style={{background:"#fff",color:"#2563eb",border:"1.5px solid #bfdbfe",padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 Zamenjaj original (PDF/slika/Word)</label></div></div>;})():<div><div style={{fontSize:13,color:"#94a3b8",marginBottom:8}}>Ni naložen.</div><input type="file" id={`pdf-${n.id}`} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp" style={{display:"none"}} onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;showToast("⏳ Nalagam PDF...");const url=await uploadOriginalPdf(file);if(url){await supabase.from('nalogi').update({original_pdf_url:url}).eq('id',n.id);await naložiPodatke();odpriNalog({...n,original_pdf_url:url});showToast("✅ PDF naložen!");}else{showToast("❌ Napaka pri uploadu!",true);}}}/><label htmlFor={`pdf-${n.id}`} style={{background:"#2563eb",color:"#fff",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>📂 Naloži original (PDF/slika/Word)</label></div>}</Sec>
          {/* Kopiraj za tabelo */}
          <div style={{background:"#f0f9ff",border:"1.5px solid #bae6fd",borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0369a1"}}>📊 Podatki za Google tabelo</div>
              <button onClick={()=>{navigator.clipboard.writeText(tabVrstica(n)).then(()=>showToast("📋 Kopirano! Prilepi v Google tabelo (Ctrl+V)")).catch(()=>showToast("❌ Kopiranje ni uspelo",true));}} style={{background:"#0284c7",color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>📋 Kopiraj za tabelo</button>
            </div>
            <div style={{background:"#fff",borderRadius:8,border:"1px solid #e0f2fe",overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:11,whiteSpace:"nowrap"}}>
                <thead><tr>{["NAROČNIK","BLAGO","KRAJ NAKLADA","DATUM NAKLADA","KRAJ RAZKLADA","DATUM RAZKLADA"].map(h=><th key={h} style={{background:"#f1f5f9",color:"#475569",fontWeight:700,textAlign:"left",padding:"8px 10px",border:"1px solid #e2e8f0",fontSize:10}}>{h}</th>)}</tr></thead>
                <tbody><tr>{[n.stranka||"–",tabBlago(n)||"–",tabKraj(n.nakKraj,n.nakNaslov)||"–",tabDatum(n.nakDatum,n.nakCas)||"–",tabKraj(n.razKraj,n.razNaslov)||"–",tabDatum(n.razDatum,n.razCas)||"–"].map((c,i)=><td key={i} style={{padding:"8px 10px",border:"1px solid #e2e8f0",color:"#0f2744"}}>{c}</td>)}</tr></tbody>
              </table>
            </div>
          </div>
          {/* CMR sekcija — VEDNO vidna, popravljen prikaz */}
          <Sec title={`📄 CMR dokumenti${cmrSlike.length>0?` (${cmrSlike.length})`:""}`}>
            {cmrLoading ? (
              <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:13}}>⏳ Nalagam CMR slike...</div>
            ) : cmrSlike.length > 0 ? (
              <div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                  {cmrSlike.map((sl,i)=>(
                    <a key={sl.id||i} href={sl.url} target="_blank" rel="noopener noreferrer" style={{display:"block",position:"relative"}}>
                      <img
                        src={sl.url}
                        alt={sl.ime||`CMR ${i+1}`}
                        style={{width:100,height:134,objectFit:"cover",borderRadius:8,border:"1px solid #e2e8f0",cursor:"pointer",display:"block"}}
                        onError={e=>{e.target.style.background="#fef2f2";e.target.style.padding="20px";e.target.alt="❌ "+sl.ime;}}
                      />
                      <div style={{position:"absolute",bottom:4,right:4,background:"rgba(0,0,0,0.7)",color:"#fff",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{i+1}</div>
                      {sl.id&&<button onClick={(e)=>{e.preventDefault();e.stopPropagation();setCropCmr(sl);}} style={{position:"absolute",top:4,right:4,background:"#d97706",color:"#fff",border:"none",borderRadius:6,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✂️</button>}
                      {sl.id&&<button onClick={(e)=>{e.preventDefault();e.stopPropagation();izbrisiCMR(sl);}} style={{position:"absolute",top:4,left:4,background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑️</button>}
                    </a>
                  ))}
                </div>
                <button
                  onClick={osveziCMR}
                  style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",color:"#64748b"}}
                >🔄 Osveži</button>
              </div>
            ) : (
              <div>
                <div style={{fontSize:13,color:"#94a3b8",marginBottom:8}}>
                  {n.status==="zakljucen" ? "Voznik še ni naložil CMR dokumentov za ta nalog." : "CMR bo prikazan ko voznik fotografira in zaključi nalog."}
                </div>
                <button
                  onClick={osveziCMR}
                  style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",color:"#64748b"}}
                >🔄 Osveži</button>
              </div>
            )}
          </Sec>
          {n.status==="nov"&&<div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:14,padding:16,marginTop:8}}>
            <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:10}}>📤 Dodeli voznika</div>
            <select style={s.sel} value={izVoz} onChange={e=>setIzVoz(e.target.value)}><option value="">– Izberi voznika –</option>{vozniki.map(v=><option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}</select>
            <button style={{...s.btnP,marginTop:10,opacity:izVoz?1:0.45}} onClick={()=>izVoz&&dodelijNalog(n.id,izVoz)}>📤 Pošlji vozniku</button>
            <button
              style={{
                ...s.btnP,
                background: izVoz && voz(izVoz)?.tel ? "#7360f2" : "#cbd5e1",
                marginTop: 8,
                opacity: izVoz && voz(izVoz)?.tel ? 1 : 0.45,
                cursor: izVoz && voz(izVoz)?.tel ? "pointer" : "not-allowed"
              }}
              onClick={()=>izVoz && voz(izVoz)?.tel && dodelijInPosljiViber(n.id,izVoz)}
              disabled={!izVoz || !voz(izVoz)?.tel}
              title={izVoz ? (voz(izVoz)?.tel ? `Pošlji ${voz(izVoz)?.ime} v Viber` : "Voznik nima telefonske številke") : "Najprej izberi voznika"}
            >
              📤 Pošlji vozniku v Viber {izVoz && !voz(izVoz)?.tel && "(ni številke)"}
            </button>
          </div>}
          {(n.status==="za_fakturo"||n.status==="fakturirano")&&<button style={{...s.btnP,background:"#f59e0b",marginTop:8}} onClick={()=>{if(window.confirm("Vrniti nalog med aktivne? Status bo spet 'sprejet'."))spremenStatus(n.id,"sprejet");}}>Vrni med aktivne</button>}<button style={{...s.btnP,background:"#2563eb",marginTop:8}} onClick={()=>urediNalog(n.id)}>✏️ Uredi nalog</button>
          {n.voznikId && (
            <button
              style={{...s.btnP, background: voz(n.voznikId)?.tel ? "#7360f2" : "#cbd5e1", marginTop:8, cursor: voz(n.voznikId)?.tel ? "pointer" : "not-allowed"}}
              onClick={()=>voz(n.voznikId)?.tel && posljiViber(n)}
              disabled={!voz(n.voznikId)?.tel}
              title={voz(n.voznikId)?.tel ? `Pošlji ${voz(n.voznikId)?.ime} na Viber` : "Voznik nima telefonske številke"}
            >
              📤 Pošlji v Viber {!voz(n.voznikId)?.tel && "(ni številke)"}
            </button>
          )}
          {(n.status==="nov"||n.status==="poslan")&&<button style={s.btnD} onClick={()=>izbrisiNalog(n.id)}>🗑️ Izbriši nalog</button>}
          {cropCmr&&<CropCMRModal cmr={cropCmr} nalStevilka={n.stevilkaNaloga||n.stevilka_naloga} onClose={()=>setCropCmr(null)} onSaved={async()=>{setCropCmr(null);await osveziCMR();showToast("✅ CMR obrezan!");}} showToast={showToast}/>}
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
       {(()=>{const zap=st.nalogi.filter(n=>n.status==="zakljucen"&&n.razDatum&&Math.floor((Date.now()-new Date(n.razDatum+"T00:00:00"))/86400000)>10);return zap.length>0?(<div onClick={()=>setTab("pregled")} style={{background:"linear-gradient(135deg,#dc2626,#ef4444)",borderRadius:14,padding:"14px 16px",marginBottom:14,color:"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 2px 8px rgba(220,38,38,0.3)"}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>!</span><div><div style={{fontWeight:800,fontSize:15}}>{zap.length} zakljucenih nalogov ceka na fakturo vec kot 10 dni</div><div style={{fontSize:12,opacity:0.9}}>Klikni za pregled</div></div></div><span style={{fontSize:20}}>{">"}</span></div>):null;})()}{st.nalogi.filter(n=>n.status==="caka_potrditev").length>0&&(
          <div onClick={()=>setTab("nalogi")} style={{background:"linear-gradient(135deg,#ea580c,#f97316)",borderRadius:14,padding:"14px 16px",marginBottom:14,color:"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 2px 8px rgba(234,88,12,0.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:24}}>📥</span>
              <div>
                <div style={{fontWeight:800,fontSize:15}}>{st.nalogi.filter(n=>n.status==="caka_potrditev").length} nalogov čaka potrditev</div>
                <div style={{fontSize:12,opacity:0.9}}>Prejeti z iPhona — klikni za pregled</div>
              </div>
            </div>
            <span style={{fontSize:20}}>→</span>
          </div>
        )}
        {/* Tabs */}
        <div style={s.tabs}>
          {[["pregled","📊 Pregled"],["nalogi","📋 Nalogi"],["poti","Poti"],["tedenski","📅 Tedenski"],["ai","🤖 AI"],["email","📧 Email → Nalog"],["vozniki","👥 Vozniki"],["obracuni","💶 Obračuni"],["finance","🧾 Finance"],["komunikacija","📨 Komunikacija"],["dopusti","🌴 Dopusti"],["prosticmr",`📸 CMR${(st.prostiCMR||[]).filter(c=>!c.povezan).length>0?` (${(st.prostiCMR||[]).filter(c=>!c.povezan).length})`:""}`]].map(([id,label])=>(
            <button key={id} style={{...s.tab,...(tab===id?s.tabOn:{})}} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
        {tab==="pregled"&&<PregledTab stats={stats} nalogi={st.nalogi} obracuni={st.obracuni} vozniki={vozniki} onSelNalog={odpriNalog} onSelOb={setSelObracun}/>}
        {tab==="nalogi"&&<NalogiTab nalogi={st.nalogi} vozniki={vozniki} onSelect={odpriNalog} openNovNalog={openNovNalog} onEdit={urediNalog} onDelete={izbrisiNalog}/>}
        {tab==="ai"&&<AiIskalnikTab nalogi={st.nalogi} vozniki={vozniki} onSelect={odpriNalog} showToast={showToast}/>}
        {tab==="tedenski"&&<TedenskiPregledTab nalogi={st.nalogi} vozniki={vozniki} onSelect={odpriNalog} showToast={showToast}/>}{tab==="poti"&&<PotiTab showToast={showToast}/>}
        {tab==="vozniki"&&<VoznikiTab nalogi={st.nalogi} vozniki={vozniki} onSelect={odpriNalog}/>}
        {tab==="obracuni"&&<ObracuniTab obracuni={st.obracuni} onSelect={setSelObracun}/>}
        {tab==="finance"&&<FinanceTab st={st} upd={upd} showToast={showToast} supabase={supabase} setActiveTab={setTab}/>}
        {tab==="prosticmr"&&<ProstiCMRTab st={st} upd={upd} showToast={showToast}/>}
        {tab==="email"&&<EmailNalogTab upd={upd} showToast={showToast} naložiPodatke={naložiPodatke} vozniki={vozniki}/>}
        {tab==="komunikacija"&&<KomunikacijaTab showToast={showToast}/>}
        {tab==="dopusti"&&<DopustiTab vozniki={vozniki} showToast={showToast}/>}
      </div>
      {/* Nov nalog modal */}
      {modal==="nalog"&&(
        <div style={s.overlay}>
          <div style={{...s.mbox,maxWidth:680}}>
            <div style={s.mhead}><span style={s.mtitle}>Nov nalog</span><button style={s.mcls} onClick={closeModal}>✕</button></div>
            <div style={s.mbody}>
              {duplikatOpozorilo && <div style={{background:"#fef3c7",border:"1.5px solid #fde68a",borderRadius:10,padding:"12px 14px",marginBottom:12,fontSize:13}}>
                <div style={{fontWeight:700,color:"#92400e",marginBottom:4}}>⚠️ Možno podvajanje naloga!</div>
                <div style={{color:"#78350f",fontSize:12,marginBottom:6}}>Najden obstoječi nalog z isto številko naročnika ali referenco naklada:</div>
                <div style={{background:"#fff",borderRadius:8,padding:10,fontSize:12,border:"1px solid #fde68a"}}>
                  <div style={{fontWeight:700,color:"#0f2744"}}>{duplikatOpozorilo.stevilkaNaloga} · {duplikatOpozorilo.stranka}</div>
                  <div style={{color:"#64748b",marginTop:2}}>{duplikatOpozorilo.nakKraj} → {duplikatOpozorilo.razKraj}</div>
                  {(duplikatOpozorilo.stevilka_narocnika||duplikatOpozorilo.stevilkaNarocnika) && <div style={{color:"#64748b",fontSize:11,marginTop:3}}>📋 Št. naročnika: <b>{duplikatOpozorilo.stevilka_narocnika||duplikatOpozorilo.stevilkaNarocnika}</b></div>}
                  {duplikatOpozorilo.nakReferenca && <div style={{color:"#64748b",fontSize:11}}>🏷️ Ref. naklada: <b>{duplikatOpozorilo.nakReferenca}</b></div>}
                </div>
                <div style={{color:"#78350f",fontSize:11,marginTop:8,fontStyle:"italic"}}>💡 Lahko vseeno nadaljuješ — to je samo opozorilo.</div>
              </div>}
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
                <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>Navodila</label><textarea style={{...s.inp,resize:"vertical"}} rows={2} value={form.navodila||""} onChange={e=>setForm(f=>({...f,navodila:e.target.value}))}/></div><I label="Cena (EUR)" val={form.znesek} set={v=>setForm(f=>({...f,znesek:v}))}/>
                <div style={{gridColumn:"1/-1"}}><I label="💶 Email kontakta za račun" val={form.kontaktEmail} set={v=>setForm(f=>({...f,kontaktEmail:v}))} ph="finance@stranka.com"/></div>
              </div>
              <button style={s.btnP} onClick={form.editId?submitEdit:submitNalog}>📤 {form.editId?"Posodobi nalog":"Ustvari nalog"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PregledTab({stats,nalogi,obracuni,vozniki,onSelNalog,onSelOb}){
  const novi=nalogi.filter(n=>n.status==="nov");
  const aktivni=nalogi.filter(n=>["poslan","sprejet"].includes(n.status));
  const zaFakturo=nalogi.filter(n=>n.status==="za_fakturo"); const zakljuceni=nalogi.filter(n=>n.status==="zakljucen");
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
    {novi.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:10}}>🔘 Novi nalogi</div>{novi.map(n=><NC key={n.id} n={n} vozniki={vozniki} onClick={()=>onSelNalog(n)}/>)}</>}
    {aktivni.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:10,marginTop:12}}>🚛 Aktivni nalogi</div>{aktivni.map(n=><NC key={n.id} n={n} vozniki={vozniki} onClick={()=>onSelNalog(n)}/>)}</>}{zakljuceni.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#d97706",marginBottom:10,marginTop:12}}>Zakljuceni - ni za fakturo ({zakljuceni.length})</div>{zakljuceni.slice().sort((a,b)=>(a.razDatum||"").localeCompare(b.razDatum||"")).map(n=>{const dni=n.razDatum?Math.floor((Date.now()-new Date(n.razDatum+"T00:00:00"))/86400000):null;const staro=dni!==null&&dni>10;return(<div key={n.id}>{dni!==null&&<div style={{fontSize:11,fontWeight:700,marginBottom:4,marginLeft:2,color:staro?"#dc2626":"#94a3b8"}}>{staro?dni+" dni - za fakturo!":dni+" dni"}</div>}<NC n={n} vozniki={vozniki} onClick={()=>onSelNalog(n)}/></div>);})}</>}
    {zaFakturo.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#9333ea",marginBottom:10,marginTop:12}}>💶 Za fakturo</div>{zaFakturo.map(n=><NC key={n.id} n={n} vozniki={vozniki} onClick={()=>onSelNalog(n)}/>)}</>}
    {noviOb.length>0&&<><div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:10,marginTop:12}}>💶 Obračuni voznikov</div>{noviOb.map(o=><OC key={o.id} o={o} onClick={()=>onSelOb(o)}/>)}</>}
  </div>);
}

function NalogiTab({nalogi,vozniki,onSelect,openNovNalog,onEdit,onDelete}){
  const [f,setF]=useState("vsi");
  const [smerF,setSmerF]=useState("vse");
  const [q,setQ]=useState("");
  const [grupiranje,setGrupiranje]=useState("seznam");
  const [odprte,setOdprte]=useState({});
  const [datumOd,setDatumOd]=useState("");
  const [datumDo,setDatumDo]=useState("");
  const [obdobje,setObdobje]=useState("vse");
  const list=nalogi.filter(n=>f==="vsi"||n.status===f).filter(n=>smerF==="vse"||smerNaloga(n).kod===smerF).filter(n=>{
    if(datumOd&&!(n.nakDatum&&n.nakDatum>=datumOd))return false;
    if(datumDo&&!(n.nakDatum&&n.nakDatum<=datumDo))return false;
    return true;
  }).filter(n=>{
    if(!q)return true;
    const qq=q.toLowerCase().trim();
    const v=(vozniki||[]).find(x=>x.id===n.voznikId);
    const polja=[
      n.stevilkaNaloga,n.stevilka_narocnika,n.stranka,n.blago,n.kolicina,n.teza,
      n.nakFirma,n.nakKraj,n.nakNaslov,n.nakReferenca,n.nakDatum,
      n.razFirma,n.razKraj,n.razNaslov,n.razReferenca,n.razDatum,
      n.navodila,n.kontaktEmail,v?.ime,v?.vozilo,
    ];
    return polja.some(p=>String(p||"").toLowerCase().includes(qq));
  });

  const tedenInfo=(dateStr)=>{
    const d=dateStr?new Date(dateStr):null;
    if(!d||isNaN(d))return{key:"brez",label:"Brez datuma",sub:"",week:"?",sort:"0000-W00"};
    const tmp=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    const day=tmp.getUTCDay()||7;
    tmp.setUTCDate(tmp.getUTCDate()+4-day);
    const yearStart=new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
    const week=Math.ceil((((tmp-yearStart)/86400000)+1)/7);
    const mon=new Date(d);const wd=mon.getDay()||7;mon.setDate(mon.getDate()-wd+1);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);
    const ff=(x)=>`${String(x.getDate()).padStart(2,"0")}.${String(x.getMonth()+1).padStart(2,"0")}`;
    const key=`${tmp.getUTCFullYear()}-W${String(week).padStart(2,"0")}`;
    return{key,label:`Teden ${week} · ${tmp.getUTCFullYear()}`,sub:`${ff(mon)} – ${ff(sun)}`,week,sort:key};
  };
  let skupine=[];
  if(grupiranje==="tedni"){
    const map={};
    list.forEach(n=>{const t=tedenInfo(n.poslan);if(!map[t.key])map[t.key]={...t,nalogi:[]};map[t.key].nalogi.push(n);});
    skupine=Object.values(map).sort((a,b)=>b.sort.localeCompare(a.sort));
  } else if(grupiranje==="vozniki"){
    const map={};
    list.forEach(n=>{const v=(vozniki||[]).find(x=>x.id===n.voznikId);const key=v?v.id:"_nedodeljeni";if(!map[key])map[key]={key,label:v?v.ime:"– Nedodeljeni",sub:v?v.vozilo:"",nalogi:[]};map[key].nalogi.push(n);});
    skupine=Object.values(map).sort((a,b)=>a.label.localeCompare(b.label));
  }
  const toggleSkupina=(k)=>setOdprte(p=>({...p,[k]:!p[k]}));

  return(<div>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <input style={{...s.inp,flex:1,margin:0}} placeholder="🔍 Išči..." value={q} onChange={e=>setQ(e.target.value)}/>
      <button style={s.btnSm} onClick={openNovNalog}>+ Nov</button>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
      {[["seznam","📋 Seznam"],["tedni","📅 Po tednih"],["vozniki","🚛 Po voznikih"]].map(([v,l])=>(
        <button key={v} style={{...s.fBtn,...(grupiranje===v?s.fOn:{})}} onClick={()=>setGrupiranje(v)}>{l}</button>
      ))}
    </div>
    <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
      {[["vsi","Vsi"],["caka_potrditev","📥 Za potrditev"],["nov","Novi"],["poslan","Poslani"],["sprejet","Sprejeto"],["zakljucen","Zaključeni"],["za_fakturo","Za fakturo"]].map(([v,l])=>(
        <button key={v} style={{...s.fBtn,...(f===v?s.fOn:{})}} onClick={()=>setF(v)}>{l}</button>
      ))}
    </div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[["vse","🔀 Vse smeri"],["izvoz","🟢 Izvoz"],["uvoz","🔵 Uvoz"],["domaci","🏠 Domači"]].map(([v,l])=>(
        <button key={v} style={{...s.fBtn,...(smerF===v?s.fOn:{})}} onClick={()=>setSmerF(v)}>{l}</button>
      ))}
    </div>
    <div style={{background:"#fff",borderRadius:12,padding:12,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>📅 Obdobje (datum naklada)</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {[["danes","Danes"],["teden","Ta teden"],["mesec","Ta mesec"],["vse","Vse"]].map(([v,l])=>(
          <button key={v} style={{...s.fBtn,...(obdobje===v?s.fOn:{})}} onClick={()=>{setObdobje(v);const[od,doo]=obdobjeRange(v);setDatumOd(od);setDatumDo(doo);}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
        <div style={{flex:"1 1 120px"}}><label style={{...s.lbl,fontSize:11}}>Od</label><input type="date" style={{...s.inp,margin:0}} value={datumOd} onChange={e=>{setDatumOd(e.target.value);setObdobje("");}}/></div>
        <div style={{flex:"1 1 120px"}}><label style={{...s.lbl,fontSize:11}}>Do</label><input type="date" style={{...s.inp,margin:0}} value={datumDo} onChange={e=>{setDatumDo(e.target.value);setObdobje("");}}/></div>
        {(datumOd||datumDo)&&<button style={{...s.fBtn}} onClick={()=>{setDatumOd("");setDatumDo("");setObdobje("vse");}}>Počisti</button>}
      </div>
    </div>
    {list.length===0&&<div style={s.empty}>Ni nalogov.</div>}
    {grupiranje==="seznam"&&list.map(n=><NC key={n.id} n={n} vozniki={vozniki} onClick={()=>onSelect(n)} onEdit={onEdit} onDelete={onDelete}/>)}
    {grupiranje!=="seznam"&&skupine.map(g=>{
      const odprt=odprte[g.key];
      const jeVoznik=grupiranje==="vozniki";
      const init=jeVoznik?(g.label==="– Nedodeljeni"?"?":g.label.charAt(0)):null;
      return(<div key={g.key} style={{background:"#fff",borderRadius:12,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden"}}>
        <button onClick={()=>toggleSkupina(g.key)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            {jeVoznik
              ?<div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{init}</div>
              :<div style={{width:42,height:42,borderRadius:10,background:"#eff6ff",color:"#1d4ed8",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:9,fontWeight:700,opacity:0.7}}>TEDEN</span><span style={{fontSize:16,fontWeight:800,lineHeight:1}}>{g.week}</span></div>}
            <div>
              <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{g.label}</div>
              {g.sub&&<div style={{fontSize:12,color:"#64748b",marginTop:2}}>{g.sub}</div>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{background:"#f1f5f9",color:"#0f2744",fontSize:13,fontWeight:800,padding:"4px 12px",borderRadius:20}}>{g.nalogi.length}</span>
            <span style={{fontSize:14,color:"#94a3b8",transform:odprt?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
          </div>
        </button>
        {odprt&&<div style={{borderTop:"1px solid #f1f5f9",padding:"10px 12px 4px"}}>
          {g.nalogi.map(n=><NC key={n.id} n={n} vozniki={vozniki} onClick={()=>onSelect(n)} onEdit={onEdit} onDelete={onDelete}/>)}
        </div>}
      </div>);
    })}
  </div>);
}

function VoznikiTab({nalogi,vozniki,onSelect}){
  const [selVoznik,setSelVoznik]=useState(null);
  const [naDopustu,setNaDopustu]=useState(new Set());
  useEffect(()=>{
    const danes=new Date().toISOString().slice(0,10);
    supabase.from("dopusti").select("voznik_id").lte("datum_od",danes).gte("datum_do",danes).then(({data})=>{
      if(data)setNaDopustu(new Set(data.map(d=>d.voznik_id)));
    });
  },[]);
  if(selVoznik){
    const vn=nalogi.filter(n=>n.voznikId===selVoznik.id).sort((a,b)=>new Date(b.poslan)-new Date(a.poslan));
    return(<div>
      <button style={{...s.fBtn,marginBottom:12}} onClick={()=>setSelVoznik(null)}>← Nazaj na voznike</button>
      <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:16,color:"#fff",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,0.2)",fontSize:18,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{selVoznik.ime.charAt(0)}</div>
        <div><div style={{fontSize:17,fontWeight:800}}>{selVoznik.ime}</div><div style={{fontSize:12,opacity:0.7}}>{selVoznik.vozilo} · {vn.length} nalogov</div></div>
      </div>
      {vn.length===0&&<div style={s.empty}>Ni nalogov za tega voznika.</div>}
      {vn.map(n=><NC key={n.id} n={n} onClick={()=>onSelect(n)}/>)}
    </div>);
  }
  return(<div>
    <div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:12}}>Vozniki ({vozniki.length})</div>
    {vozniki.map(v=>{
      const vn=nalogi.filter(n=>n.voznikId===v.id);
      const ak=vn.filter(n=>["poslan","sprejet"].includes(n.status));
      return(<div key={v.id} onClick={()=>setSelVoznik(v)} style={{background:"#fff",borderRadius:14,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",transition:"all 0.15s",border:"1px solid transparent"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.1)";e.currentTarget.style.borderColor="#cbd5e1";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.borderColor="transparent";}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{v.ime.charAt(0)}</div>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{v.ime}</div><div style={{fontSize:12,color:"#64748b"}}>{v.vozilo}</div></div>
          <div style={{padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:700,background:naDopustu.has(v.id)?"#dcfce7":ak.length>0?"#fffbeb":"#f0fdf4",color:naDopustu.has(v.id)?"#15803d":ak.length>0?"#d97706":"#16a34a"}}>{naDopustu.has(v.id)?"🌴 Na dopustu":ak.length>0?`🟡 ${ak.length} aktiven`:"✅ Prost"}</div>
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
  const [tedenskiOb,setTedenskiOb]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selOb,setSelOb]=useState(null);
  const [iskanje,setIskanje]=useState("");
  const [statusF,setStatusF]=useState("vsi");
  const [odprtiVozniki,setOdprtiVozniki]=useState({});
  const [mesec,setMesec]=useState(()=>new Date().toISOString().slice(0,7));

  useEffect(()=>{
    supabase.from("tedenski_obracuni").select("*, vozniki(id,ime,priimek,vozilo)").order("datum_od",{ascending:false}).then(({data})=>{
      if(data)setTedenskiOb(data);
      setLoading(false);
    });
  },[]);

  const TARIFA_KM=0.185;const TARIFA_STR=20;const TARIFA_DOPUST=40;
  const MESECI_IMENA=["Januar","Februar","Marec","April","Maj","Junij","Julij","Avgust","September","Oktober","November","December"];
  const mesecLabel=(ym)=>{const[y,m]=ym.split("-");return`${MESECI_IMENA[parseInt(m,10)-1]} ${y}`;};
  const razpolozljiviMeseci=[...new Set(tedenskiOb.map(o=>(o.datum_od||"").slice(0,7)).filter(Boolean))].sort().reverse();
  const filtriraniVsi=tedenskiOb.filter(o=>{
    if(mesec!=="vsi" && (o.datum_od||"").slice(0,7)!==mesec) return false;
    if(statusF!=="vsi" && o.status!==statusF) return false;
    if(iskanje.trim()){
      const v=o.vozniki; const ime=v?`${v.ime} ${v.priimek}`.toLowerCase():"";
      const q=iskanje.toLowerCase().trim();
      if(!ime.includes(q) && !(v?.vozilo||"").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const skupajKm=filtriraniVsi.reduce((a,o)=>a+(o.km_prevozeni||0),0);
  const skupajZnesek=filtriraniVsi.reduce((a,o)=>a+(o.sestevek||0),0);

  if(selOb){
    const o=selOb;const v=o.vozniki;const prevozi=o.prevozi||[];const tankanja=o.tankanja||[];const stroski=o.drugi_stroski||[];
    const zaslKm=(o.km_prevozeni||0)*TARIFA_KM;const zaslStr=(o.stevilo_strank||0)*TARIFA_STR;const zaslDop=(o.dopust_dni||0)*TARIFA_DOPUST;
    const zaslStr2=stroski.reduce((a,x)=>a+(parseFloat(x.znesek)||0),0);
    const natisniObracun=()=>{window.print();};
    return(<div>
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } html,body { margin:0; padding:0; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; } body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 190mm; max-width: 190mm; box-sizing: border-box; padding: 0; margin: 0; -webkit-print-color-adjust:exact; print-color-adjust:exact; } .print-area * { box-sizing: border-box !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print { display: none !important; } }`}</style>
      <div className="no-print" style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
        <button style={s.fBtn} onClick={()=>setSelOb(null)}>← Nazaj</button>
        <button style={{...s.btnSm,marginLeft:"auto",background:"#16a34a"}} onClick={natisniObracun}>🖨️ Natisni / Shrani PDF</button>
      </div>
      <div className="print-area">
      <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
        <div style={{fontSize:18,fontWeight:800}}>{v?`${v.ime} ${v.priimek}`:"Voznik"}</div>
        <div style={{fontSize:12,opacity:0.7,marginTop:2}}>{v?.vozilo||""} · {fmt(o.datum_od+"T00:00:00")} – {fmt(o.datum_do+"T00:00:00")}</div>
        <div style={{fontSize:10,marginTop:6,padding:"3px 10px",borderRadius:20,display:"inline-block",background:o.status==="poslan"?"rgba(22,163,74,0.3)":"rgba(255,255,255,0.15)",color:o.status==="poslan"?"#86efac":"#fff"}}>{o.status==="poslan"?"✅ Poslan":"⏳ Osnutek"}</div>
      </div>
      <Sec title="🛣️ Kilometri"><R label="Začetni km" val={o.km_zacetek?.toLocaleString()||"–"}/><R label="Končni km" val={o.km_konec?.toLocaleString()||"–"}/><R label="Prevoženi km" val={`${(o.km_prevozeni||0).toLocaleString()} km`} bold/><R label={`× ${TARIFA_KM} €`} val={`${zaslKm.toFixed(2)} €`} bold/></Sec>
      <Sec title="👥 Stranke"><R label="Število strank" val={o.stevilo_strank||0}/><R label={`× ${TARIFA_STR} €`} val={`${zaslStr.toFixed(2)} €`} bold/></Sec>
      {prevozi.length>0&&<Sec title="🚛 Prevozi">{prevozi.map((p,i)=><R key={i} label={`#${p.st||i+1}`} val={`${p.nakKraj} → ${p.razKraj}`}/>)}</Sec>}
      {tankanja.length>0&&<Sec title="⛽ Tankanja">{tankanja.map((t,i)=><R key={i} label={t.dan?fmt(t.dan+"T00:00:00"):`#${i+1}`} val={`${t.kolicina||"?"} L · ${t.lokacija||"?"}`}/>)}</Sec>}
      {(o.dopust_dni>0||o.bolniska_dni>0||o.cakanje_opis)&&<Sec title="📋 Ostalo">
        {o.dopust_dni>0&&<R label="Dopust" val={`${o.dopust_dni} dni × ${TARIFA_DOPUST} € = ${zaslDop.toFixed(2)} €`}/>}
        {o.bolniska_dni>0&&<R label="Bolniška" val={`${o.bolniska_dni} dni`}/>}
        {o.cakanje_opis&&<R label="Čakanje" val={o.cakanje_opis}/>}
      </Sec>}
      {stroski.length>0&&<Sec title="🧾 Drugi stroški">{stroski.map((x,i)=><R key={i} label={x.opis||"Strošek"} val={`${parseFloat(x.znesek).toFixed(2)} €`}/>)}</Sec>}
      <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginTop:8}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}><span>Km ({(o.km_prevozeni||0).toLocaleString()} × {TARIFA_KM} €)</span><span>{zaslKm.toFixed(2)} €</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}><span>Stranke ({o.stevilo_strank||0} × {TARIFA_STR} €)</span><span>{zaslStr.toFixed(2)} €</span></div>
        {zaslDop>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}><span>Dopust</span><span>{zaslDop.toFixed(2)} €</span></div>}
        {zaslStr2>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,opacity:0.85,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.1)"}}><span>Drugi stroški</span><span>+ {zaslStr2.toFixed(2)} €</span></div>}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:22,paddingTop:12}}><span>SEŠTEVEK</span><span>{(o.sestevek||0).toFixed(2)} €</span></div>
      </div>
      </div>
    </div>);
  }

  return(<div>
    <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:"16px 20px",marginBottom:14,color:"#fff",display:"flex",justifyContent:"space-around"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800}}>{filtriraniVsi.length}</div><div style={{fontSize:11,opacity:0.7}}>Obračunov</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800}}>{skupajKm.toLocaleString()} km</div><div style={{fontSize:11,opacity:0.7}}>Skupaj km</div></div>
      <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#86efac"}}>{skupajZnesek.toFixed(0)} €</div><div style={{fontSize:11,opacity:0.7}}>Za izplačilo</div></div>
    </div>
    <div style={{position:"relative",marginBottom:10}}>
      <input style={{...s.inp,paddingLeft:34}} placeholder="🔍 Išči voznika..." value={iskanje} onChange={e=>setIskanje(e.target.value)}/>
      <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8",pointerEvents:"none"}}>🔍</span>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",overflowX:"auto"}}>
      <button style={{...s.fBtn,...(mesec==="vsi"?s.fOn:{})}} onClick={()=>setMesec("vsi")}>📅 Vsi meseci</button>
      {razpolozljiviMeseci.map(ym=>(
        <button key={ym} style={{...s.fBtn,...(mesec===ym?s.fOn:{}),whiteSpace:"nowrap"}} onClick={()=>setMesec(ym)}>{mesecLabel(ym)}</button>
      ))}
    </div>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[["vsi","Vsi"],["poslan","✅ Poslani"],["osnutek","⏳ Osnutki"]].map(([val,lab])=>(
        <button key={val} style={{...s.fBtn,...(statusF===val?s.fOn:{})}} onClick={()=>setStatusF(val)}>{lab}</button>
      ))}
    </div>
    {loading&&<div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>⏳ Nalagam...</div>}
    {!loading&&tedenskiOb.length===0&&<div style={s.empty}>Ni tedenskih obračunov.</div>}
    {!loading&&tedenskiOb.length>0&&(()=>{
      const filtrirani=filtriraniVsi;
      const skupine={};
      filtrirani.forEach(o=>{
        const vid=o.voznik_id||o.vozniki?.id||"neznan";
        if(!skupine[vid]) skupine[vid]={voznik:o.vozniki,obracuni:[]};
        skupine[vid].obracuni.push(o);
      });
      const seznam=Object.entries(skupine).map(([vid,g])=>({
        vid, voznik:g.voznik,
        obracuni:g.obracuni.sort((a,b)=>b.datum_od.localeCompare(a.datum_od)),
        skupajZnesek:g.obracuni.reduce((a,o)=>a+(o.sestevek||0),0),
        skupajKm:g.obracuni.reduce((a,o)=>a+(o.km_prevozeni||0),0),
      })).sort((a,b)=>{
        const an=a.voznik?`${a.voznik.ime} ${a.voznik.priimek}`:""; const bn=b.voznik?`${b.voznik.ime} ${b.voznik.priimek}`:"";
        return an.localeCompare(bn);
      });
      if(seznam.length===0) return <div style={s.empty}>Ni rezultatov za iskanje/filter.</div>;
      return seznam.map(g=>{
        const odprt=odprtiVozniki[g.vid];
        const v=g.voznik;
        return(<div key={g.vid} style={{background:"#fff",borderRadius:12,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",overflow:"hidden"}}>
          <button onClick={()=>setOdprtiVozniki(p=>({...p,[g.vid]:!p[g.vid]}))} style={{width:"100%",background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{v?v.ime.charAt(0):"?"}</div>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{v?`${v.ime} ${v.priimek}`:"Voznik"} <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>· {v?.vozilo||""}</span></div>
                <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{g.obracuni.length} {g.obracuni.length===1?"obračun":g.obracuni.length<5?"obračuni":"obračunov"} · {g.skupajKm.toLocaleString()} km</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontWeight:800,fontSize:17,color:"#16a34a"}}>{g.skupajZnesek.toFixed(2)} €</div>
              <span style={{fontSize:16,color:"#94a3b8",transform:odprt?"rotate(180deg)":"none",transition:"transform 0.15s"}}>▼</span>
            </div>
          </button>
          {odprt&&<div style={{borderTop:"1px solid #f1f5f9"}}>
            {g.obracuni.map(o=>(
              <button key={o.id} onClick={()=>setSelOb(o)} style={{width:"100%",background:"#f8fafc",border:"none",borderBottom:"1px solid #f1f5f9",cursor:"pointer",textAlign:"left",padding:"11px 16px 11px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`4px solid ${o.status==="poslan"?"#16a34a":"#d97706"}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#0f2744"}}>{fmt(o.datum_od+"T00:00:00")} – {fmt(o.datum_do+"T00:00:00")}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{(o.km_prevozeni||0).toLocaleString()} km · {o.stevilo_strank||0} strank · {o.status==="poslan"?"✅ Poslan":"⏳ Osnutek"}</div>
                </div>
                <div style={{fontWeight:700,fontSize:15,color:"#16a34a"}}>{(o.sestevek||0).toFixed(2)} €</div>
              </button>
            ))}
          </div>}
        </div>);
      });
    })()}
  </div>);
}

// ===== HELPER FUNKCIJE =====
function izvleciEmail(text){
  if(!text) return "";
  const match = text.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : "";
}

function parseZnesek(str){
  if(!str) return 0;
  if(typeof str === "number") return str;
  const cleaned = String(str).replace(/[^\d,.\s]/g, " ").trim();
  let num = cleaned.replace(/\s/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",",".");
  const parsed = parseFloat(num);
  return isNaN(parsed) ? 0 : parsed;
}

function getStorageUrl(supabaseClient, bucket, path){
  if(!path || !supabaseClient) return null;
  if(path.startsWith("http")) return path;
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}


// ===== FINANCE TAB =====
function FinanceTab({st,upd,showToast,supabase:supabaseProp,setActiveTab}){
  // POPRAVEK: če supabase ni v props, uporabi importan supabase iz top
  const sb = supabaseProp || supabase;
  const [f,setF]=useState("vsi");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [detail,setDetail]=useState(null);
  const [editMode,setEditMode]=useState(false);
  const [confirmDel,setConfirmDel]=useState(false);
  const [cmrList,setCmrList]=useState([]);
  const [cmrLoading,setCmrLoading]=useState(false);
  const [imgPreview,setImgPreview]=useState(null);
  const [search,setSearch]=useState("");

  const racuni=st.racuni||[];
  const zaF=st.nalogi.filter(n=>n.status==="za_fakturo");
  const list=racuni.filter(r=>{
    const statusOk=f==="vsi"||r.status===f;
    if(!statusOk)return false;
    if(!search.trim())return true;
    const q=search.toLowerCase().trim();
    return(r.id||"").toLowerCase().includes(q)||(r.stranka||"").toLowerCase().includes(q)||(r.kontaktEmail||"").toLowerCase().includes(q)||(r.opombe||"").toLowerCase().includes(q)||String(r.znesek||"").includes(q);
  });
  const rSC={osnutek:{label:"Osnutek",color:"#64748b",bg:"#f8fafc"},poslan:{label:"Poslan",color:"#2563eb",bg:"#eff6ff"},placano:{label:"Plačano",color:"#16a34a",bg:"#f0fdf4"},zapadlo:{label:"Zapadlo",color:"#dc2626",bg:"#fef2f2"}};

  const povezanNalog=detail?.nalogId?st.nalogi.find(n=>n.id===detail.nalogId):null;

  const getZnesekOriginal=(n)=>n?.znesek_original||n?.znesekOriginal||null;
  const getRef=(n)=>n?.nak_referenca||n?.nakReferenca||null;
  const getOriginalUrl=(n)=>n?.original_pdf_url||n?.originalPdfUrl||null;
  const getKontaktEmail=(n)=>n?.kontaktEmail||n?.kontakt_email||(n?.navodila?izvleciEmail(n.navodila):"")||(n?.navodila_text?izvleciEmail(n.navodila_text):"");

  useEffect(()=>{
    if(!povezanNalog?.id||!sb){setCmrList([]);return;}
    setCmrLoading(true);
    sb.from("cmr_dokumenti").select("*").eq("nalog_id",povezanNalog.id).order("created_at",{ascending:false}).then(({data,error})=>{
      if(error){console.error("❌ CMR fetch napaka v Finance:",error);}
      if(!error && data) setCmrList(data);
      setCmrLoading(false);
    });
  },[povezanNalog?.id,sb]);

  const novRacun=(n)=>{
    const kontaktEmail=getKontaktEmail(n);
    const znesekRaw=getZnesekOriginal(n);
    const reverseCharge=n?.je_slovenska_ddv===false;
    const osnovaCena=znesekRaw?parseZnesek(znesekRaw):0;
    const znesek=znesekRaw?(reverseCharge?osnovaCena:(osnovaCena*1.22)).toFixed(2):"";
    const ref=getRef(n);
    setForm({
      nalogId:n?.id||"",
      stranka:n?.stranka||"",
      znesek,
      datum:new Date().toISOString().slice(0,10),
      rok:new Date(Date.now()+30*86400000).toISOString().slice(0,10),
      kontaktEmail,
      opombe:ref?`Ref: ${ref}`:"",
      reverseCharge,
      originalPdfUrl:getOriginalUrl(n)||"",
      navodila:n?.navodila||"",
      nakKraj:n?.nak_kraj||n?.nakKraj||"",
      razKraj:n?.raz_kraj||n?.razKraj||"",
      nakFirma:n?.nak_firma||n?.nakFirma||"",
      razFirma:n?.raz_firma||n?.razFirma||"",
    });
    setModal("racun");
  };

  const submitRacun=()=>{
    if(!form.stranka||!form.znesek)return showToast("Izpolni stranko in znesek!",true);
    const id="RAC-"+new Date().getFullYear()+"-"+String((racuni.length+1)).padStart(3,"0");
    upd(s=>({...s,racuni:[...(s.racuni||[]),{...form,id,znesek:parseFloat(form.znesek),status:"osnutek"}],nalogi:form.nalogId?s.nalogi.map(n=>n.id===form.nalogId?{...n,status:"fakturirano"}:n):s.nalogi}));
    setModal(null);setForm({});showToast(`✅ Račun ${id} ustvarjen!`);
  };

  const sprSt=(id,status)=>{
    upd(s=>({...s,racuni:(s.racuni||[]).map(r=>r.id===id?{...r,status,...(status==="placano"?{datumPlacila:new Date().toISOString().slice(0,10)}:{})}:r)}));
    showToast("✅ Status posodobljen.");
    if(detail&&detail.id===id)setDetail(d=>({...d,status,...(status==="placano"?{datumPlacila:new Date().toISOString().slice(0,10)}:{})}));
  };
  const shraniEdit=(updated)=>{upd(s=>({...s,racuni:(s.racuni||[]).map(r=>r.id===updated.id?updated:r)}));setDetail(updated);setEditMode(false);showToast("✅ Račun posodobljen.");};
  const izbrisiRacun=(id)=>{upd(s=>({...s,racuni:(s.racuni||[]).filter(r=>r.id!==id)}));setDetail(null);setConfirmDel(false);showToast("🗑️ Račun izbrisan.");};

  const odpriNalog=(nalogId)=>{
    setDetail(null);
    if(setActiveTab){setActiveTab("nalogi");}
    window.dispatchEvent(new CustomEvent("openNalog",{detail:nalogId}));
    showToast("📋 Odpiram nalog "+nalogId);
  };

  const dniDoRoka=(rok,status)=>{if(!rok||status==="placano")return null;return Math.ceil((new Date(rok+"T00:00:00")-new Date())/86400000);};
  const ddvIzracun=(znesek,reverseCharge)=>{const osnova=reverseCharge?znesek:znesek/1.22;const ddv=reverseCharge?0:znesek-osnova;return{osnova,ddv,skupaj:znesek};};

  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
      {[["💶","Skupaj",racuni.reduce((a,r)=>a+r.znesek,0).toFixed(0)+" €","#0891b2"],["⏳","Odprto",racuni.filter(r=>r.status==="poslan").reduce((a,r)=>a+r.znesek,0).toFixed(0)+" €","#d97706"],["✅","Prejeto",racuni.filter(r=>r.status==="placano").reduce((a,r)=>a+r.znesek,0).toFixed(0)+" €","#16a34a"]].map(([ic,lb,vl,cl])=>(
        <div key={lb} style={{background:"#fff",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:18}}>{ic}</div><div style={{fontSize:18,fontWeight:800,color:cl}}>{vl}</div><div style={{fontSize:11,color:"#94a3b8"}}>{lb}</div></div>
      ))}
    </div>
    {zaF.length>0&&<div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:14,color:"#92400e",marginBottom:10}}>💶 Za fakturo ({zaF.length})</div>
      {zaF.map(n=>{const zOrig=getZnesekOriginal(n);const ref=getRef(n);const kEmail=getKontaktEmail(n);const jeSloDdv=n?.je_slovenska_ddv!==false;const osnovaCena=zOrig?parseZnesek(zOrig):0;const skupajCena=jeSloDdv?osnovaCena*1.22:osnovaCena;return(
        <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #fef3c7"}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14}}>{n.stranka}</div>
            <div style={{fontSize:12,color:"#64748b"}}>{n.stevilkaNaloga||n.stevilka_naloga} · {n.nakKraj||n.nak_kraj} → {n.razKraj||n.raz_kraj}</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:3}}>
              {zOrig&&<div style={{fontSize:12,color:"#16a34a",fontWeight:700}}>💶 {skupajCena.toFixed(2)} € {jeSloDdv?"(z DDV 22%)":"(reverse charge)"}</div>}
              {ref&&<div style={{fontSize:11,color:"#64748b"}}>📋 Ref: <span style={{fontFamily:"monospace",fontWeight:600,color:"#2563eb"}}>{ref}</span></div>}
              {kEmail&&<div style={{fontSize:11,color:"#64748b"}}>✉️ {kEmail}</div>}
            </div>
          </div>
          <button style={s.btnSm} onClick={()=>novRacun(n)}>Ustvari račun</button>
        </div>);
      })}
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>Računi</div>
      <button style={s.btnSm} onClick={()=>novRacun(null)}>+ Nov</button>
    </div>
    <div style={{position:"relative",marginBottom:10}}>
      <input style={{...s.inp,paddingLeft:34,paddingRight:search?34:12}} placeholder="Išči po stranki, številki, emailu, znesku..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8",pointerEvents:"none"}}>🔍</span>
      {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"#e2e8f0",border:"none",borderRadius:"50%",width:22,height:22,fontSize:12,cursor:"pointer",color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
      {search&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>{list.length} {list.length===1?"rezultat":"rezultatov"} za "{search}"</div>}
    </div>
    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
      {[["vsi","Vsi"],["osnutek","Osnutki"],["poslan","Poslani"],["placano","Plačani"],["zapadlo","Zapadli"]].map(([v,l])=>(
        <button key={v} style={{...s.fBtn,...(f===v?s.fOn:{})}} onClick={()=>setF(v)}>{l}</button>
      ))}
    </div>
    {list.length===0&&<div style={s.empty}>Ni računov.</div>}
    {list.map(r=>{const sc=rSC[r.status]||rSC.osnutek;const zap=r.status==="poslan"&&new Date(r.rok)<new Date();return(
      <div key={r.id} onClick={()=>setDetail(r)} style={{background:"#fff",borderRadius:12,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",transition:"all 0.15s",border:"1px solid transparent"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.1)";e.currentTarget.style.borderColor="#cbd5e1";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.06)";e.currentTarget.style.borderColor="transparent";}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <div><div style={{display:"flex",gap:8,marginBottom:3}}><span style={{fontSize:12,fontFamily:"monospace",fontWeight:700,color:"#2563eb"}}>{r.id}</span><span style={{...s.fBtn,padding:"2px 8px",background:zap?"#fef2f2":sc.bg,color:zap?"#dc2626":sc.color,border:"none",cursor:"default"}}>{zap?"⚠️ Zapadlo":sc.label}</span></div>
          <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{r.stranka}</div>
          {r.kontaktEmail&&<div style={{fontSize:12,color:"#64748b"}}>✉️ {r.kontaktEmail}</div>}
          <div style={{fontSize:12,color:"#64748b"}}>Rok: {fmt(r.rok+"T00:00:00")}</div></div>
          <div style={{fontWeight:800,fontSize:20,color:"#0f2744"}}>{r.znesek.toFixed(2)} €</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}} onClick={e=>e.stopPropagation()}>
          {r.status==="osnutek"&&<button style={s.rBtn} onClick={()=>sprSt(r.id,"poslan")}>📤 Poslan</button>}
          {r.status==="poslan"&&<button style={s.rBtn} onClick={()=>sprSt(r.id,"placano")}>✅ Plačan</button>}
          {(r.status==="poslan"||zap)&&<button style={{...s.rBtn,color:"#dc2626"}} onClick={()=>sprSt(r.id,"zapadlo")}>⚠️ Zapadlo</button>}
          <button style={{...s.rBtn,marginLeft:"auto",color:"#2563eb"}} onClick={()=>setDetail(r)}>👁️ Podrobnosti</button>
        </div>
      </div>
    );})}

    {/* MODAL: Nov račun */}
    {modal==="racun"&&<div style={s.overlay}><div style={{...s.mbox,maxWidth:900,maxHeight:"95vh",overflowY:"auto"}}><div style={s.mhead}><span style={s.mtitle}>Nov račun</span><button style={s.mcls} onClick={()=>{setModal(null);setForm({});}}>✕</button></div>
      <div style={s.mbody}>
        {form.nalogId&&<div style={{background:"#eff6ff",borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:13,color:"#1d4ed8"}}>
          <div style={{fontWeight:700,marginBottom:3}}>📋 {form.nalogId}</div>
          <div style={{fontSize:11,color:"#3b82f6"}}>Podatki so avtomatsko preneseni iz naloga</div>
        </div>}

        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 300px",minWidth:280}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:12}}>
              <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>Stranka *</label><input style={s.inp} value={form.stranka||""} onChange={e=>setForm(f=>({...f,stranka:e.target.value}))}/></div>
              <div><label style={s.lbl}>Znesek (€) *</label><input style={s.inp} type="number" step="0.01" value={form.znesek||""} onChange={e=>setForm(f=>({...f,znesek:e.target.value}))}/></div>
              <div><label style={s.lbl}>Datum</label><input style={s.inp} type="date" value={form.datum||""} onChange={e=>setForm(f=>({...f,datum:e.target.value}))}/></div>
              <div><label style={s.lbl}>Plačilni rok</label><input style={s.inp} type="date" value={form.rok||""} onChange={e=>setForm(f=>({...f,rok:e.target.value}))}/></div>
              <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>✉️ Email za pošiljanje računa</label><input style={s.inp} value={form.kontaktEmail||""} onChange={e=>setForm(f=>({...f,kontaktEmail:e.target.value}))} placeholder="finance@podjetje.com"/></div>
              <div style={{gridColumn:"1/-1"}}><label style={s.lbl}>📝 Opombe</label><input style={s.inp} value={form.opombe||""} onChange={e=>setForm(f=>({...f,opombe:e.target.value}))} placeholder="Ref. št., posebnosti..."/></div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={{...s.lbl,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <input type="checkbox" checked={!!form.reverseCharge} onChange={e=>setForm(f=>({...f,reverseCharge:e.target.checked}))}/>
                  Reverse charge (tuje podjetje, brez 22% DDV)
                </label>
              </div>
            </div>

            {(form.nakKraj||form.razKraj)&&<div style={{background:"#f8fafc",borderRadius:8,padding:10,marginBottom:12,fontSize:12,color:"#64748b"}}>
              <div style={{fontWeight:700,color:"#0f2744",marginBottom:4}}>🚚 Ruta</div>
              {form.nakFirma&&<div>{form.nakFirma}</div>}
              <div>📍 {form.nakKraj} → {form.razKraj}</div>
              {form.razFirma&&<div>{form.razFirma}</div>}
            </div>}

            {form.navodila&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:10,marginBottom:12}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#92400e",marginBottom:4,fontWeight:700}}>⚠️ Navodila iz naloga</div>
              <div style={{fontSize:12,color:"#78350f",whiteSpace:"pre-wrap",lineHeight:1.4}}>{form.navodila}</div>
            </div>}

            <button style={s.btnP} onClick={submitRacun}>Ustvari račun</button>
          </div>

          {form.originalPdfUrl&&<div style={{flex:"1 1 320px",minWidth:300}}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700}}>📄 Original nalog</div>
            <div style={{border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
              <iframe src={form.originalPdfUrl} style={{width:"100%",height:500,border:"none"}} title="Original nalog PDF"/>
              <a href={form.originalPdfUrl} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"8px 12px",fontSize:11,color:"#2563eb",textAlign:"center",borderTop:"1px solid #e2e8f0",textDecoration:"none",background:"#fff"}}>
                Odpri v novem zavihku ↗
              </a>
            </div>
          </div>}
        </div>
      </div></div></div>}

    {/* MODAL: Detajl računa */}
    {detail&&(()=>{
      const sc=rSC[detail.status]||rSC.osnutek;
      const zap=detail.status==="poslan"&&new Date(detail.rok)<new Date();
      const dni=dniDoRoka(detail.rok,detail.status);
      const {osnova,ddv,skupaj}=ddvIzracun(detail.znesek,detail.reverseCharge);
      const originalUrl=povezanNalog?getOriginalUrl(povezanNalog):null;
      const refPosiljatelja=povezanNalog?getRef(povezanNalog):null;
      return(<div style={s.overlay} onClick={()=>{if(!editMode&&!confirmDel&&!imgPreview){setDetail(null);}}}>
        <div style={{...s.mbox,maxWidth:680,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
          <div style={{...s.mhead,background:"linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%)",color:"#fff",padding:"18px 20px",position:"sticky",top:0,zIndex:2}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:2}}>Račun</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace"}}>{detail.id}</span>
                <button style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer"}} onClick={()=>{navigator.clipboard.writeText(detail.id);showToast("📋 Kopirano");}}>📋</button>
              </div>
              {refPosiljatelja&&<div style={{marginTop:6,fontSize:11,color:"#94a3b8"}}>📋 Ref. pošiljatelja: <span style={{color:"#fbbf24",fontWeight:700,fontFamily:"monospace"}}>{refPosiljatelja}</span></div>}
              <div style={{marginTop:6}}>
                <span style={{...s.fBtn,padding:"3px 10px",background:zap?"#fef2f2":sc.bg,color:zap?"#dc2626":sc.color,border:"none",cursor:"default",fontSize:11}}>{zap?"⚠️ Zapadlo":sc.label}</span>
              </div>
            </div>
            <button style={{...s.mcls,color:"#fff"}} onClick={()=>setDetail(null)}>✕</button>
          </div>

          <div style={{...s.mbody,padding:"18px 20px"}}>
            <div style={{background:"linear-gradient(135deg, #f8fafc 0%, #fff 100%)",border:"1px solid #e2e8f0",borderRadius:12,padding:16,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
              <div>
                <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:4}}>Za plačilo</div>
                <div style={{fontSize:28,fontWeight:800,color:"#0f2744"}}>{detail.znesek.toFixed(2)} €</div>
              </div>
              {detail.rok&&<div style={{textAlign:"right"}}>
                <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:4}}>Rok plačila</div>
                <div style={{fontSize:13,fontWeight:700,color:zap?"#dc2626":"#0f2744"}}>{fmt(detail.rok+"T00:00:00")}</div>
                {dni!==null&&<div style={{fontSize:11,marginTop:2,color:zap?"#dc2626":dni<=7?"#d97706":"#64748b",fontWeight:zap?700:500}}>
                  {zap?`Zapadel pred ${Math.abs(dni)} dni`:dni===0?"Zapade danes":dni<0?`Zapadel pred ${Math.abs(dni)} dni`:`Še ${dni} dni`}
                </div>}
              </div>}
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700}}>🏢 Stranka</div>
              {editMode?<input style={s.inp} value={detail.stranka||""} onChange={e=>setDetail(d=>({...d,stranka:e.target.value}))}/>:
                <div style={{background:"#f8fafc",borderRadius:8,padding:12}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>{detail.stranka}</div>
                  {detail.kontaktEmail&&<div style={{fontSize:12,color:"#64748b",marginTop:3}}>✉️ {detail.kontaktEmail}</div>}
                  {detail.reverseCharge&&<div style={{display:"inline-block",marginTop:6,fontSize:10,background:"#fef3c7",color:"#92400e",padding:"2px 8px",borderRadius:4,fontWeight:600}}>Reverse charge</div>}
                </div>}
            </div>

            {povezanNalog&&<div style={{marginBottom:16}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700}}>🚚 Povezan nalog</div>
              <div onClick={()=>odpriNalog(povezanNalog.id)} style={{background:"#f8fafc",borderRadius:8,padding:12,cursor:"pointer",transition:"all 0.15s",border:"1px solid transparent"}} onMouseEnter={e=>{e.currentTarget.style.background="#eff6ff";e.currentTarget.style.borderColor="#bfdbfe";}} onMouseLeave={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.borderColor="transparent";}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:"#2563eb"}}>{povezanNalog.stevilka_naloga||povezanNalog.stevilkaNaloga||povezanNalog.id}</div>
                    {(povezanNalog.nak_kraj||povezanNalog.nakKraj)&&<div style={{fontSize:12,color:"#64748b",marginTop:3}}>📍 {povezanNalog.nak_kraj||povezanNalog.nakKraj} → {povezanNalog.raz_kraj||povezanNalog.razKraj}</div>}
                    {povezanNalog.voznik_id&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Voznik: {st.vozniki?.find(v=>v.id===povezanNalog.voznik_id)?.ime||povezanNalog.voznik_id}</div>}
                  </div>
                  <span style={{color:"#94a3b8",fontSize:14}}>↗ Odpri</span>
                </div>
              </div>
            </div>}

            {/* CMR — POPRAVEK: pravi bucket + sb prop */}
            {povezanNalog&&<div style={{marginBottom:16}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>📎 CMR dokumenti {cmrList.length>0&&`(${cmrList.length})`}</span>
              </div>
              {cmrLoading?<div style={{background:"#f8fafc",borderRadius:8,padding:20,textAlign:"center",fontSize:12,color:"#94a3b8"}}>Nalagam CMR...</div>:
                cmrList.length===0?<div style={{background:"#fefce8",border:"1px dashed #fde68a",borderRadius:8,padding:12,fontSize:12,color:"#a16207",textAlign:"center"}}>
                  ⚠️ Za ta nalog ni naloženih CMR dokumentov
                </div>:
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8}}>
                  {cmrList.map(cmr=>{
                    const url=getStorageUrl(sb,CMR_BUCKET,cmr.storage_pot);
                    const isImage=/\.(jpg|jpeg|png|webp|gif)$/i.test(cmr.ime_datoteke||"");
                    return(<div key={cmr.id} onClick={()=>{if(isImage&&url){setImgPreview(url);}else if(url){window.open(url,"_blank");}}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:6,cursor:"pointer",transition:"all 0.15s",textAlign:"center"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="#2563eb";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.transform="translateY(0)";}}>
                      {isImage&&url?
                        <img src={url} alt={cmr.ime_datoteke} style={{width:"100%",height:80,objectFit:"cover",borderRadius:4,display:"block"}} onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="flex";}}/>:null}
                      <div style={{display:isImage&&url?"none":"flex",width:"100%",height:80,borderRadius:4,background:"#e2e8f0",alignItems:"center",justifyContent:"center",fontSize:24}}>📄</div>
                      <div style={{fontSize:10,color:"#64748b",marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={cmr.ime_datoteke}>{cmr.ime_datoteke}</div>
                    </div>);
                  })}
                </div>}
            </div>}

            {originalUrl&&<div style={{marginBottom:16}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700}}>📄 Original nalog (od stranke)</div>
              <a href={originalUrl} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:12,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:12,textDecoration:"none",color:"inherit",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.background="#eff6ff";e.currentTarget.style.borderColor="#bfdbfe";}} onMouseLeave={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.borderColor="#e2e8f0";}}>
                <div style={{width:40,height:40,borderRadius:6,background:"#fef2f2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📄</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:"#0f2744"}}>{decodeURIComponent(originalUrl.split("/").pop()||"Originalni nalog.pdf")}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Odpri v novem zavihku ↗</div>
                </div>
                {getZnesekOriginal(povezanNalog)&&<div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"#94a3b8"}}>Znesek iz naloga</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#16a34a"}}>{parseZnesek(getZnesekOriginal(povezanNalog)).toFixed(2)} €</div>
                </div>}
              </a>
            </div>}

            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700}}>💶 Razčlenitev</div>
              <div style={{border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
                <div style={{padding:"10px 12px",background:"#f8fafc",fontSize:13,display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:"#475569"}}>Prevoz blaga{povezanNalog?` (${povezanNalog.nak_kraj||povezanNalog.nakKraj} → ${povezanNalog.raz_kraj||povezanNalog.razKraj})`:""}{refPosiljatelja?` · Ref: ${refPosiljatelja}`:""}</span>
                  <span style={{fontWeight:600,color:"#0f2744"}}>{osnova.toFixed(2)} €</span>
                </div>
                <div style={{padding:"8px 12px",fontSize:12,display:"flex",justifyContent:"space-between",borderTop:"1px solid #e2e8f0"}}>
                  <span style={{color:"#64748b"}}>Osnova:</span>
                  <span style={{fontWeight:600,color:"#0f2744"}}>{osnova.toFixed(2)} €</span>
                </div>
                <div style={{padding:"8px 12px",fontSize:12,display:"flex",justifyContent:"space-between",borderTop:"1px solid #e2e8f0"}}>
                  <span style={{color:"#64748b"}}>DDV {detail.reverseCharge?"(reverse charge)":"(22%)"}:</span>
                  <span style={{fontWeight:600,color:"#0f2744"}}>{ddv.toFixed(2)} €</span>
                </div>
                <div style={{padding:"10px 12px",fontSize:14,display:"flex",justifyContent:"space-between",borderTop:"2px solid #cbd5e1",background:"#f8fafc"}}>
                  <span style={{fontWeight:700,color:"#0f2744"}}>Skupaj:</span>
                  <span style={{fontWeight:800,color:"#0f2744"}}>{skupaj.toFixed(2)} €</span>
                </div>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,fontSize:12,color:"#64748b",cursor:editMode?"pointer":"default"}}>
                <input type="checkbox" checked={!!detail.reverseCharge} onChange={e=>{if(editMode)setDetail(d=>({...d,reverseCharge:e.target.checked}));}} disabled={!editMode}/>
                Reverse charge (za tuje stranke)
              </label>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:"#f8fafc",borderRadius:8,padding:10}}>
                <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:3}}>📅 Izdan</div>
                <div style={{fontSize:13,fontWeight:600,color:"#0f2744"}}>{detail.datum?fmt(detail.datum+"T00:00:00"):"—"}</div>
              </div>
              {detail.datumPlacila?<div style={{background:"#f0fdf4",borderRadius:8,padding:10}}>
                <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#16a34a",marginBottom:3}}>✅ Plačano</div>
                <div style={{fontSize:13,fontWeight:600,color:"#166534"}}>{fmt(detail.datumPlacila+"T00:00:00")}</div>
              </div>:<div style={{background:"#f8fafc",borderRadius:8,padding:10}}>
                <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:3}}>⏳ Status plačila</div>
                <div style={{fontSize:13,fontWeight:600,color:"#64748b"}}>Neplačano</div>
              </div>}
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#94a3b8",marginBottom:6,fontWeight:700}}>📝 Opombe</div>
              {editMode?<textarea style={{...s.inp,minHeight:60,resize:"vertical"}} value={detail.opombe||""} onChange={e=>setDetail(d=>({...d,opombe:e.target.value}))}/>:
                <div style={{background:"#f8fafc",borderRadius:8,padding:10,fontSize:13,color:detail.opombe?"#0f2744":"#94a3b8",fontStyle:detail.opombe?"normal":"italic"}}>
                  {detail.opombe||"Brez opomb"}
                </div>}
            </div>

            {confirmDel?<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:600,color:"#991b1b"}}>Res želiš izbrisati?</span>
              <div style={{display:"flex",gap:6}}>
                <button style={{...s.rBtn,background:"#fff"}} onClick={()=>setConfirmDel(false)}>Prekliči</button>
                <button style={{...s.rBtn,background:"#dc2626",color:"#fff",border:"none"}} onClick={()=>izbrisiRacun(detail.id)}>Da, izbriši</button>
              </div>
            </div>:editMode?<div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
              <button style={s.rBtn} onClick={()=>{setDetail(racuni.find(r=>r.id===detail.id));setEditMode(false);}}>Prekliči</button>
              <button style={{...s.btnP,padding:"8px 16px",fontSize:13}} onClick={()=>shraniEdit(detail)}>💾 Shrani</button>
            </div>:<div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"space-between"}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {detail.status==="osnutek"&&<button style={{...s.rBtn,background:"#2563eb",color:"#fff",border:"none"}} onClick={()=>sprSt(detail.id,"poslan")}>📤 Označi poslan</button>}
                {detail.status!=="placano"&&<button style={{...s.rBtn,background:"#16a34a",color:"#fff",border:"none"}} onClick={()=>sprSt(detail.id,"placano")}>✅ Plačano</button>}
                {detail.status==="placano"&&<button style={s.rBtn} onClick={()=>sprSt(detail.id,"poslan")}>↩️ Razveljavi plačilo</button>}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button style={s.rBtn} onClick={()=>window.print()}>📄 PDF</button>
                <button style={s.rBtn} onClick={()=>{const subj=`Račun ${detail.id}`;const body=`Spoštovani,\n\nV priponki pošiljamo račun ${detail.id} v znesku ${detail.znesek.toFixed(2)} € z rokom plačila ${fmt(detail.rok+"T00:00:00")}.\n\nLep pozdrav,\nMATJAŽ JURJEVEC, s.p.\nSI76353362`;window.location.href=`mailto:${detail.kontaktEmail||""}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;}}>✉️ Pošlji</button>
                <button style={s.rBtn} onClick={()=>setEditMode(true)}>✏️ Uredi</button>
                {detail.status==="osnutek"&&<button style={{...s.rBtn,color:"#dc2626"}} onClick={()=>setConfirmDel(true)}>🗑️ Izbriši</button>}
              </div>
            </div>}
          </div>
        </div>
      </div>);
    })()}

    {imgPreview&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"pointer"}} onClick={()=>setImgPreview(null)}>
      <img src={imgPreview} alt="CMR preview" style={{maxWidth:"95%",maxHeight:"95vh",objectFit:"contain",borderRadius:8,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}/>
      <button style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",width:40,height:40,borderRadius:20,fontSize:20,cursor:"pointer"}} onClick={()=>setImgPreview(null)}>✕</button>
    </div>}
  </div>);
}


// ===== DOPUSTI TAB (DISPEČER) =====
function DopustiTab({ vozniki, showToast }) {
  const [dopusti, setDopusti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ voznik_id: "", datum_od: "", datum_do: "", opomba: "" });
  const [saving, setSaving] = useState(false);
  const [showPretekli, setShowPretekli] = useState(false);

  const naložiDopuste = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("dopusti").select("*").order("datum_od", { ascending: false });
    if (data) setDopusti(data);
    if (error) console.error("Dopusti napaka:", error);
    setLoading(false);
  };

  useEffect(() => { naložiDopuste(); }, []);

  const odpriNovi = () => {
    const danes = new Date().toISOString().slice(0, 10);
    setForm({ voznik_id: "", datum_od: danes, datum_do: danes, opomba: "" });
    setModal("novi");
  };

  const odpriUredi = (d) => {
    setForm({ voznik_id: d.voznik_id, datum_od: d.datum_od, datum_do: d.datum_do, opomba: d.opomba || "" });
    setModal(d.id);
  };

  const shrani = async () => {
    if (!form.voznik_id) return showToast("Izberi voznika!", true);
    if (!form.datum_od || !form.datum_do) return showToast("Izberi datume!", true);
    if (form.datum_do < form.datum_od) return showToast("Datum 'do' mora biti za datumom 'od'!", true);
    setSaving(true);
    try {
      if (modal === "novi") {
        const { error } = await supabase.from("dopusti").insert([{
          voznik_id: form.voznik_id,
          datum_od: form.datum_od,
          datum_do: form.datum_do,
          opomba: form.opomba || null,
        }]);
        if (error) throw error;
        showToast("✅ Dopust dodan!");
      } else {
        const { error } = await supabase.from("dopusti").update({
          voznik_id: form.voznik_id,
          datum_od: form.datum_od,
          datum_do: form.datum_do,
          opomba: form.opomba || null,
        }).eq("id", modal);
        if (error) throw error;
        showToast("✅ Dopust posodobljen!");
      }
      setModal(null);
      await naložiDopuste();
    } catch (err) {
      showToast("❌ Napaka: " + err.message, true);
    }
    setSaving(false);
  };

  const izbrisi = async (id, ime) => {
    if (!window.confirm(`Izbrišem dopust ${ime ? "za " + ime : ""}?`)) return;
    try {
      const { error } = await supabase.from("dopusti").delete().eq("id", id);
      if (error) throw error;
      showToast("🗑️ Dopust izbrisan.");
      await naložiDopuste();
    } catch (err) {
      showToast("❌ Napaka!", true);
    }
  };

  const steviloDni = (od, do_) => Math.floor((new Date(do_) - new Date(od)) / 86400000) + 1;
  const dniLabel = (n) => n === 1 ? "dan" : n === 2 ? "dneva" : n < 5 ? "dni" : "dni";
  const voznikIme = (id) => vozniki.find(v => v.id === id)?.ime || "Neznan voznik";
  const voznikVozilo = (id) => vozniki.find(v => v.id === id)?.vozilo || "";

  const danes = new Date().toISOString().slice(0, 10);
  const trenutni = dopusti.filter(d => d.datum_od <= danes && d.datum_do >= danes);
  const prihodnji = dopusti.filter(d => d.datum_od > danes);
  const pretekli = dopusti.filter(d => d.datum_do < danes);

  if (loading) return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>⏳ Nalagam dopuste...</div>;

  const renderRow = (d, theme) => {
    const dniSkupaj = steviloDni(d.datum_od, d.datum_do);
    const ime = voznikIme(d.voznik_id);
    return (
      <div key={d.id} style={{background:theme.bg,borderRadius:10,padding:12,marginBottom:8,borderLeft:`4px solid ${theme.color}`,opacity:theme.opacity||1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>🚛 {ime}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{voznikVozilo(d.voznik_id)}</div>
            <div style={{fontWeight:600,fontSize:13,color:theme.color,marginTop:6}}>{fmt(d.datum_od+"T00:00:00")} – {fmt(d.datum_do+"T00:00:00")} <span style={{fontWeight:500,color:"#64748b"}}>({dniSkupaj} {dniLabel(dniSkupaj)})</span></div>
            {d.opomba && <div style={{fontSize:12,color:"#64748b",marginTop:4}}>📝 {d.opomba}</div>}
          </div>
          <div style={{display:"flex",gap:4}}>
            <button style={{background:"none",border:"none",color:"#2563eb",cursor:"pointer",fontSize:16,padding:4}} onClick={()=>odpriUredi(d)}>✏️</button>
            <button style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:16,padding:4}} onClick={()=>izbrisi(d.id, ime)}>🗑️</button>
          </div>
        </div>
      </div>
    );
  };

  return (<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:16,color:"#0f2744"}}>🌴 Dopusti voznikov</div>
      <button style={s.btnSm} onClick={odpriNovi}>+ Dodaj dopust</button>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
      <div style={{background:"#fff",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:20}}>🔴</div><div style={{fontSize:22,fontWeight:800,color:"#dc2626"}}>{trenutni.length}</div><div style={{fontSize:11,color:"#94a3b8"}}>Danes</div></div>
      <div style={{background:"#fff",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:20}}>📅</div><div style={{fontSize:22,fontWeight:800,color:"#16a34a"}}>{prihodnji.length}</div><div style={{fontSize:11,color:"#94a3b8"}}>Prihodnji</div></div>
      <div style={{background:"#fff",borderRadius:12,padding:"12px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:20}}>📋</div><div style={{fontSize:22,fontWeight:800,color:"#94a3b8"}}>{pretekli.length}</div><div style={{fontSize:11,color:"#94a3b8"}}>Pretekli</div></div>
    </div>

    {dopusti.length === 0 && <div style={s.empty}>Ni vpisanih dopustov. Klikni "+ Dodaj dopust".</div>}

    {trenutni.length > 0 && <>
      <div style={{fontSize:11,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>🔴 Trenutno na dopustu ({trenutni.length})</div>
      {trenutni.map(d => renderRow(d, {bg:"#fef2f2",color:"#dc2626"}))}
    </>}

    {prihodnji.length > 0 && <>
      <div style={{fontSize:11,fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8,marginTop:14}}>📅 Prihodnji dopusti ({prihodnji.length})</div>
      {prihodnji.sort((a,b)=>a.datum_od.localeCompare(b.datum_od)).map(d => renderRow(d, {bg:"#f0fdf4",color:"#16a34a"}))}
    </>}

    {pretekli.length > 0 && <>
      <button style={{...s.fBtn,marginTop:14,marginBottom:8,width:"100%"}} onClick={()=>setShowPretekli(!showPretekli)}>{showPretekli?"▲ Skrij":"▼ Prikaži"} pretekle dopuste ({pretekli.length})</button>
      {showPretekli && pretekli.map(d => renderRow(d, {bg:"#f8fafc",color:"#94a3b8",opacity:0.85}))}
    </>}

    {modal && <div style={s.overlay} onClick={()=>setModal(null)}>
      <div style={{...s.mbox,maxWidth:500}} onClick={e=>e.stopPropagation()}>
        <div style={s.mhead}>
          <span style={s.mtitle}>{modal==="novi" ? "🌴 Nov dopust" : "✏️ Uredi dopust"}</span>
          <button style={s.mcls} onClick={()=>setModal(null)}>✕</button>
        </div>
        <div style={s.mbody}>
          <div style={{marginBottom:14}}>
            <label style={s.lbl}>🚛 Voznik *</label>
            <select style={s.sel} value={form.voznik_id} onChange={e=>setForm(f=>({...f,voznik_id:e.target.value}))}>
              <option value="">– Izberi voznika –</option>
              {vozniki.map(v => <option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <label style={s.lbl}>📅 Datum od *</label>
              <input style={s.inp} type="date" value={form.datum_od} onChange={e=>setForm(f=>({...f,datum_od:e.target.value}))}/>
            </div>
            <div>
              <label style={s.lbl}>📅 Datum do *</label>
              <input style={s.inp} type="date" value={form.datum_do} onChange={e=>setForm(f=>({...f,datum_do:e.target.value}))}/>
            </div>
          </div>
          {form.datum_od && form.datum_do && form.datum_do >= form.datum_od && (
            <div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,fontWeight:700,color:"#16a34a",textAlign:"center"}}>
              ⏱️ {steviloDni(form.datum_od, form.datum_do)} {dniLabel(steviloDni(form.datum_od, form.datum_do))}
            </div>
          )}
          <div style={{marginBottom:14}}>
            <label style={s.lbl}>📝 Opomba (opcijsko)</label>
            <input style={s.inp} placeholder="npr. družinski dogodek" value={form.opomba} onChange={e=>setForm(f=>({...f,opomba:e.target.value}))}/>
          </div>
          <button style={{...s.btnP,opacity:saving?0.5:1}} onClick={shrani} disabled={saving}>
            {saving ? "⏳ Shranjevanje..." : (modal==="novi" ? "💾 Dodaj dopust" : "💾 Shrani spremembe")}
          </button>
        </div>
      </div>
    </div>}
  </div>);
}

function ProstiCMRTab({st,upd,showToast}){
  const [prostiCmr,setProstiCmr]=useState([]);
  const [loading,setLoading]=useState(true);
  const [vn,setVn]=useState("");
  const [sel,setSel]=useState(null);

  useEffect(()=>{
    supabase.from("prosti_cmr").select("*, vozniki(ime,priimek,vozilo)").order("created_at",{ascending:false}).then(({data})=>{
      if(data)setProstiCmr(data);
      setLoading(false);
    });
  },[]);

  const nepov=prostiCmr.filter(c=>!c.povezan);
  const pov=prostiCmr.filter(c=>c.povezan);

  const poveziCMR=async(cmr)=>{
    const n=st.nalogi.find(x=>x.stevilkaNaloga?.toUpperCase()===vn.toUpperCase());
    if(!n)return showToast("Nalog ne obstaja!",true);
    try{
      await supabase.from("prosti_cmr").update({povezan:true,nalog_id:n.id}).eq("id",cmr.id);
      for(const sl of (cmr.slike||[])){
        if(sl.pot){
          await supabase.from('cmr_dokumenti').insert([{nalog_id:n.id,ime_datoteke:sl.ime||'cmr.jpg',storage_pot:sl.pot}]);
        }
      }
      const{data}=await supabase.from("prosti_cmr").select("*, vozniki(ime,priimek,vozilo)").order("created_at",{ascending:false});
      if(data)setProstiCmr(data);
      showToast(`✅ CMR povezan z ${n.stevilkaNaloga}!`);
      setSel(null);setVn("");
    }catch(err){showToast("❌ Napaka: "+err.message,true);}
  };

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>⏳ Nalagam...</div>;

  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <div style={{background:"#fff",borderRadius:12,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:20}}>⏳</div><div style={{fontSize:22,fontWeight:800,color:"#d97706"}}>{nepov.length}</div><div style={{fontSize:11,color:"#94a3b8"}}>Čakajo</div></div>
      <div style={{background:"#fff",borderRadius:12,padding:"14px 10px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}><div style={{fontSize:20}}>✅</div><div style={{fontSize:22,fontWeight:800,color:"#16a34a"}}>{pov.length}</div><div style={{fontSize:11,color:"#94a3b8"}}>Povezani</div></div>
    </div>
    {nepov.length===0&&<div style={s.empty}>✅ Vsi prosti CMR so povezani.</div>}
    {nepov.map(cmr=>{const v=cmr.vozniki;return(
      <div key={cmr.id} style={{background:"#fff",borderRadius:12,padding:14,marginBottom:10,borderLeft:"4px solid #d97706",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <div><div style={{fontWeight:800,fontSize:16,fontFamily:"monospace",color:"#0f2744"}}>{cmr.stevilka_naloga}</div><div style={{fontSize:12,color:"#475569"}}>🚛 {v?`${v.ime} ${v.priimek} · ${v.vozilo}`:""}</div></div>
          <div style={{fontSize:12,color:"#94a3b8"}}>{fmt(cmr.created_at)}</div>
        </div>
        {cmr.opomba&&<div style={{fontSize:12,color:"#64748b",marginBottom:8}}>📝 {cmr.opomba}</div>}
        {cmr.slike?.length>0&&<div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>{cmr.slike.map((sl,i)=><a key={i} href={sl.url} target="_blank" rel="noopener noreferrer"><img src={sl.url} alt="" style={{width:60,height:80,objectFit:"cover",borderRadius:6,border:"1px solid #e2e8f0"}}/></a>)}</div>}
        {sel===cmr.id?(
          <div style={{background:"#eff6ff",borderRadius:10,padding:12}}>
            <div style={{fontSize:13,fontWeight:600,color:"#1d4ed8",marginBottom:8}}>Vnesi številko naloga:</div>
            <input style={{...s.inp,marginBottom:8,fontFamily:"monospace"}} placeholder="npr. NAL-2026-031" value={vn} onChange={e=>setVn(e.target.value)} autoFocus/>
            {vn&&<div style={{fontSize:12,marginBottom:8,color:st.nalogi.find(n=>n.stevilkaNaloga?.toUpperCase()===vn.toUpperCase())?"#16a34a":"#dc2626"}}>{st.nalogi.find(n=>n.stevilkaNaloga?.toUpperCase()===vn.toUpperCase())?`✅ ${st.nalogi.find(n=>n.stevilkaNaloga?.toUpperCase()===vn.toUpperCase()).stranka}`:"❌ Nalog ne obstaja"}</div>}
            <div style={{display:"flex",gap:8}}><button style={{...s.btnP,flex:1,padding:"10px"}} onClick={()=>poveziCMR(cmr)}>Poveži →</button><button style={s.btnSm} onClick={()=>{setSel(null);setVn("");}}>Prekliči</button></div>
          </div>
        ):<button style={s.btnSm} onClick={()=>setSel(cmr.id)}>🔗 Poveži z nalogom</button>}
      </div>
    );})}
    {pov.length>0&&<><div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:10,marginTop:8}}>✅ Povezani ({pov.length})</div>{pov.map(cmr=>{const v=cmr.vozniki;return(<div key={cmr.id} style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:8,borderLeft:"4px solid #16a34a",display:"flex",justifyContent:"space-between"}}><div><div style={{fontWeight:700,fontFamily:"monospace",color:"#0f2744"}}>{cmr.stevilka_naloga}</div><div style={{fontSize:12,color:"#16a34a"}}>✅ Povezan</div></div><div style={{fontSize:12,color:"#94a3b8"}}>{v?`${v.ime} ${v.priimek}`:""}</div></div>);})}</>}
  </div>);
}

// ===== EMAIL NALOG TAB - UNIVERZALEN SPREJEM (PDF, Word, Excel, Slike, Paste) =====
function EmailNalogTab({ upd, showToast, naložiPodatke, vozniki }) {
  const [korak, setKorak] = useState("vnos");
  const [vnosText, setVnosText] = useState("");
  const [priponka, setPriponka] = useState(null);
  const [priponkaFile, setPriponkaFile] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({});
  const [duplikatOpozorilo, setDuplikatOpozorilo] = useState(null);
  const [vsiNalogi, setVsiNalogi] = useState([]);
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const [kopiranoTabela,setKopiranoTabela]=useState(false);
  const tabelaMetri=()=>{
    const m=form.metri||form.ldm||form.metriNaklada||form.nakMetri||form.nak_metri||"";
    const str=String(m||"").trim();
    if(!str)return"";
    return /ldm|metr/i.test(str)?str:`${str} ldm`;
  };
  const tabelaBlago=()=>{
    const b=(form.blago||"").trim();
    const metri=tabelaMetri();
    const k=metri||(form.kolicina||"").trim();
    const t=(form.teza||"").trim();
    return [b,k,t].filter(Boolean).join(", ");
  };
  const tabelaDatum=(datum,cas)=>{
    if(!datum)return"";
    const d=fmt(datum+"T00:00:00");
    return cas?`${d} ${cas}`:d;
  };
  const tabelaPosta=(naslov)=>{
    if(!naslov)return"";
    const m=String(naslov).match(/\b(\d{4,5})\s+\p{L}/u);
    if(m)return m[1];
    const m2=String(naslov).match(/\b(\d{4,5})\b/);
    return m2?m2[1]:"";
  };
  const tabelaKraj=(kraj,naslov)=>{
    const k=(kraj||"").trim();
    const p=tabelaPosta(naslov);
    if(k&&p&&!k.startsWith(p))return`${p} ${k}`;
    return k||p;
  };
  const kopirajZaTabelo=()=>{
    const vrstica=[
      form.stranka||"",
      tabelaBlago(),
      tabelaKraj(form.nakKraj,form.nakNaslov),
      tabelaDatum(form.nakDatum,form.nakCas),
      tabelaKraj(form.razKraj,form.razNaslov),
      tabelaDatum(form.razDatum,form.razCas),
    ].join("\t");
    navigator.clipboard.writeText(vrstica).then(()=>{
      setKopiranoTabela(true);
      showToast("📋 Kopirano! Prilepi v Google tabelo (Ctrl+V)");
      setTimeout(()=>setKopiranoTabela(false),2500);
    }).catch(()=>showToast("❌ Kopiranje ni uspelo",true));
  };

  // Naloži obstoječe naloge za preverjanje podvajanja
  useEffect(() => {
    supabase.from("nalogi")
      .select("id,stevilka_naloga,stranka,nak_kraj,raz_kraj,stevilka_narocnika,nak_referenca,created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => { if (data) setVsiNalogi(data); });
  }, []);

  // Preveri podvajanje (po številki naročnika ali referenci naklada)
  useEffect(() => {
    if (korak !== "forma") { setDuplikatOpozorilo(null); return; }
    const stNarocnika = (form.stevilkaNarocnika || "").trim();
    const refNaklada = (form.nakReferenca || "").trim();
    if (!stNarocnika && !refNaklada) { setDuplikatOpozorilo(null); return; }
    const najden = vsiNalogi.find(n => {
      const nStNar = (n.stevilka_narocnika || "").trim();
      const nRef = (n.nak_referenca || "").trim();
      if (stNarocnika && nStNar && nStNar.toLowerCase() === stNarocnika.toLowerCase()) return true;
      if (refNaklada && nRef && nRef.toLowerCase() === refNaklada.toLowerCase()) return true;
      return false;
    });
    setDuplikatOpozorilo(najden || null);
  }, [form.stevilkaNarocnika, form.nakReferenca, korak, vsiNalogi]);
 
  // Outlook integracija
  const [outlookAccount, setOutlookAccount] = useState(getActiveAccount());
  const [outlookEmails, setOutlookEmails] = useState([]);
  const [outlookLoading, setOutlookLoading] = useState(false);
  const [outlookFilter, setOutlookFilter] = useState("vsi");
 
  useEffect(() => {
    setOutlookAccount(getActiveAccount());
  }, []);
 
  // Globalni paste listener za slike iz clipboarda (Ctrl+V z PrintScreena)
  useEffect(() => {
    const handlePaste = async (e) => {
      if (korak !== "vnos") return; // samo na vnosni strani
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            // Pretvori v File z imenom
            const ext = item.type.split("/")[1] || "png";
            const file = new File([blob], `screenshot-${Date.now()}.${ext}`, { type: item.type });
            await obdelajDatoteko(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [korak]);
 
  const outlookPrijava = async () => {
    try {
      const acc = await loginToOutlook();
      setOutlookAccount(acc);
      showToast(`✅ Povezan z Outlookom: ${acc.username}`);
      naložiOutlookEmaile();
    } catch (err) {
      console.error(err);
      showToast("❌ Prijava v Outlook ni uspela.", true);
    }
  };
 
  const outlookOdjava = async () => {
    try {
      await logoutFromOutlook();
      setOutlookAccount(null);
      setOutlookEmails([]);
      showToast("Odjavljen iz Outlooka.");
    } catch (err) {
      console.error(err);
    }
  };
 
  const naložiOutlookEmaile = async () => {
    setOutlookLoading(true);
    try {
      const emails = await getRecentEmails(50);
      setOutlookEmails(emails);
    } catch (err) {
      console.error(err);
      showToast("❌ Napaka pri branju emailov.", true);
    }
    setOutlookLoading(false);
  };
 
  // ===== DINAMIČNO NALAGANJE LIBRARY-jev =====
  const loadPdfJs = () => new Promise(res => {
    if (window.pdfjsLib) return res(window.pdfjsLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(window.pdfjsLib); };
    document.head.appendChild(s);
  });
 
  const loadMammoth = () => new Promise(res => {
    if (window.mammoth) return res(window.mammoth);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    s.onload = () => res(window.mammoth);
    document.head.appendChild(s);
  });
 
  const loadXlsx = () => new Promise(res => {
    if (window.XLSX) return res(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => res(window.XLSX);
    document.head.appendChild(s);
  });
 
  // ===== UPLOAD ORIGINAL DATOTEKE V SUPABASE STORAGE =====
  const uploadOriginalDatoteke = async (file) => {
    try {
      const uuid = crypto.randomUUID();
      const fileName = `${uuid}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from("originalni-nalogi").upload(fileName, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("originalni-nalogi").getPublicUrl(fileName);
      return urlData?.publicUrl || null;
    } catch (err) {
      console.error("Upload napaka:", err);
      return null;
    }
  };
 
  // ===== PRETVORI File V BASE64 =====
  const fileToBase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // odstrani "data:image/jpeg;base64," prefix
      const base64 = result.split(",")[1];
      res(base64);
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
 
  // ===== GLAVNA FUNKCIJA: OBDELAJ DATOTEKO (KAKRŠEN KOLI TIP) =====
  const obdelajDatoteko = async (file) => {
    if (!file) return;
    setAiLoading(true);
    showToast(`⏳ Berem: ${file.name}...`);
 
    try {
      const fileName = file.name.toLowerCase();
      const mimeType = file.type || "";
      let tekst = "";
      let jeSlika = false;
      let slikaBase64 = null;
      let mediaType = "image/jpeg";
 
      // ===== PDF =====
      if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
        const ab = await file.arrayBuffer();
        const lib = await loadPdfJs();
        const pdf = await lib.getDocument({ data: ab }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
          const p = await pdf.getPage(i);
          const tc = await p.getTextContent();
          tekst += tc.items.map(x => x.str).join(" ") + "\n";
        }
        tekst = tekst.trim();
        // Če PDF nima teksta (scan/slika), prerendiramo prvo stran kot sliko
        if (!tekst || tekst.length < 30) {
          showToast("📷 PDF je scan — pretvarjam v sliko za AI...");
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          slikaBase64 = dataUrl.split(",")[1];
          mediaType = "image/jpeg";
          jeSlika = true;
          tekst = "";
        }
      }
      // ===== WORD .docx =====
      else if (fileName.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
        const ab = await file.arrayBuffer();
        const mammoth = await loadMammoth();
        const result = await mammoth.extractRawText({ arrayBuffer: ab });
        tekst = result.value.trim();
      }
      // ===== EXCEL .xlsx ali .xls =====
      else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || mimeType.includes("spreadsheetml") || mimeType.includes("excel")) {
        const ab = await file.arrayBuffer();
        const XLSX = await loadXlsx();
        const workbook = XLSX.read(ab, { type: "array" });
        // Združi vse sheete v en tekst
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          tekst += `--- ${sheetName} ---\n${csv}\n\n`;
        });
        tekst = tekst.trim();
      }
      // ===== SLIKE =====
      else if (mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) {
        jeSlika = true;
        slikaBase64 = await fileToBase64(file);
        mediaType = mimeType || "image/jpeg";
      }
      // ===== TXT in ostalo (fallback) =====
      else {
        tekst = await file.text();
      }
 
      // Preverimo, ali imamo karkoli za obdelati
      if (!jeSlika && !tekst.trim()) {
        showToast("❌ Datoteka je prazna ali ne moremo prebrati vsebine.", true);
        setAiLoading(false);
        return;
      }
 
      // Shrani priponko v state in datoteko za upload
      setPriponkaFile(file);
      const prikazVsebine = jeSlika ? "📷 Slika (PrintScreen ali fotografija)" : tekst.slice(0, 200);
      setPriponka({ ime: file.name, vsebina: prikazVsebine, tip: jeSlika ? "image" : "text" });
      showToast(`✅ Datoteka naložena: ${file.name}. Pošljemo v AI razčlenitev...`);
 
      // ===== POŠLJI V AI =====
      const body = jeSlika
        ? { tip: "image", slikaBase64, mediaType }
        : { tip: "tekst", tekst };
 
      const { data, error } = await supabase.functions.invoke("ai-razcleni", { body });
      if (error) throw error;
 
      const txt = data.content?.map(i => i.text || "").join("").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(txt);
      setForm({ ...parsed, voznikId: "" });
      setKorak("forma");
      showToast("✅ AI je razčlenil! Preveri in potrdi.");
    } catch (err) {
      console.error(err);
      showToast("❌ AI napaka — izpolni ročno.", true);
      setForm({ stranka: "", nakKraj: "", razKraj: "", voznikId: "" });
      setKorak("forma");
    }
    setAiLoading(false);
  };
 
  // Uvozi izbran email iz Outlooka — pridobi priponke (PDF) in pošlje v AI parser
  const uvoziOutlookEmail = async (msgId, subject) => {
    setAiLoading(true);
    showToast(`⏳ Uvažam: ${subject}...`);
    try {
      const { email, attachments } = await getEmailWithAttachments(msgId);
      
      // Najprej poskusi PDF priponko
      const pdfAttachment = attachments.find(a => 
        a.contentType === "application/pdf" || 
        (a.name && a.name.toLowerCase().endsWith(".pdf"))
      );
      
      let vir = "";
      let pdfFile = null;
      
      if (pdfAttachment && pdfAttachment.contentBytes) {
        // Pretvori base64 v File objekt
        const byteString = atob(pdfAttachment.contentBytes);
        const arr = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
        pdfFile = new File([arr], pdfAttachment.name, { type: "application/pdf" });
        
        // Preberi PDF besedilo
        const lib = await loadPdfJs();
        const pdf = await lib.getDocument({ data: arr.buffer }).promise;
        let txt = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
          const p = await pdf.getPage(i);
          const tc = await p.getTextContent();
          txt += tc.items.map(x => x.str).join(" ") + "\n";
        }
        vir = txt.trim();
        setPriponkaFile(pdfFile);
        setPriponka({ ime: pdfAttachment.name, vsebina: vir, tip: "pdf" });
      } else {
        // Brez priponke — uporabi telo emaila
        vir = (email.body?.content || email.bodyPreview || "").replace(/<[^>]*>/g, " ");
        setPriponka(null);
      }
      
      if (!vir.trim()) {
        showToast("❌ Email je prazen ali nima besedila.", true);
        setAiLoading(false);
        return;
      }
      
      // Pošlji AI v razčlenitev
      showToast("⏳ AI razčlenjuje...");
      const { data, error } = await supabase.functions.invoke("ai-razcleni", {
        body: { tip: "tekst", tekst: vir }
      });
      if (error) throw error;
      const txt = data.content?.map(i => i.text || "").join("").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(txt);
      setForm({ ...parsed, voznikId: "", _outlookMsgId: msgId });
      setKorak("forma");
      showToast("✅ AI je razčlenil! Preveri in potrdi.");
    } catch (err) {
      console.error(err);
      showToast("❌ Napaka pri uvozu emaila.", true);
    }
    setAiLoading(false);
  };
 
  // Drag & drop ali izbira datoteke - kliče glavno funkcijo
  const naložiPriponko = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    await obdelajDatoteko(file);
    if (e.target) e.target.value = "";
  };
 
  // Razčleni samo tekst iz textarea (brez priponke)
  const razcleni = async () => {
    if (priponka && !vnosText.trim()) {
      // Če je priponka že obdelana, samo pojdi naprej - obdelajDatoteko je že shranil v form
      return;
    }
    if (!vnosText.trim()) return showToast("Vnesi besedilo emaila ali naloži priponko!", true);
    setAiLoading(true);
    showToast("⏳ AI razčlenjuje...");
    try {
      const { data, error } = await supabase.functions.invoke("ai-razcleni", {
        body: { tip: "tekst", tekst: vnosText }
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
      let pdfUrl=null;
      if(priponkaFile){
        showToast("⏳ Nalagam original...");
        pdfUrl=await uploadOriginalDatoteke(priponkaFile);
      }
      const statusNaloga = form.voznikId ? 'poslan' : 'nov';
      const { data, error } = await supabase.from('nalogi').insert([{
        stevilka_naloga: '',
        status: statusNaloga,
        poslan_cas: form.voznikId ? new Date().toISOString() : null,
        stranka: form.stranka,
        blago: form.blago||"",
        kolicina: form.kolicina||"",
        teza: form.teza||"",
        nak_firma: form.nakFirma||"",
        nak_kraj: form.nakKraj,
        nak_naslov: form.nakNaslov||"",
        nak_referenca: form.nakReferenca||"",
        stevilka_narocnika: form.stevilkaNarocnika||null,
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
        original_pdf_url: pdfUrl||form.originalPdfUrl||null,
        postanki: form.postanki||null,
        postanki: form.postanki||null,
        znesek_original: form.znesek||null,
        je_slovenska_ddv: form.jeSlovenskaDdv!==undefined?form.jeSlovenskaDdv:null,
      }]).select().single();
      if (error) throw error;
 
      // Če je email iz Outlooka — označi kot prebran
      if (form._outlookMsgId) {
        try {
          await markEmailAsRead(form._outlookMsgId);
        } catch (e) {
          console.warn("Mark as read failed:", e);
        }
      }
 
      await naložiPodatke();
      showToast(form.voznikId ? `✅ Nalog ${data.stevilka_naloga} ustvarjen in poslan vozniku!` : `✅ Nalog ${data.stevilka_naloga} ustvarjen!`);
      setKorak("vnos");
      setVnosText("");
      setPriponka(null);
      setPriponkaFile(null);
      setForm({});
    } catch(err) {
      showToast("❌ Napaka pri shranjevanju!", true);
      console.error(err);
    }
  };
 
  // Posodobi obstoječi (podvojeni) nalog z novimi podatki — namesto ustvarjanja novega
  const posodobiObstojeci = async () => {
    if (!duplikatOpozorilo?.id) return;
    if (!form.stranka||!form.nakKraj||!form.razKraj) return showToast("Izpolni obvezna polja!", true);
    if (!window.confirm(`Posodobim obstoječi nalog ${duplikatOpozorilo.stevilka_naloga} z novimi podatki iz tega dokumenta?`)) return;
    try {
      let pdfUrl=null;
      if(priponkaFile){
        showToast("⏳ Nalagam original...");
        pdfUrl=await uploadOriginalDatoteke(priponkaFile);
      }
      const updateData = {
        stranka: form.stranka,
        blago: form.blago||"",
        kolicina: form.kolicina||"",
        teza: form.teza||"",
        nak_firma: form.nakFirma||"",
        nak_kraj: form.nakKraj,
        nak_naslov: form.nakNaslov||"",
        nak_referenca: form.nakReferenca||"",
        stevilka_narocnika: form.stevilkaNarocnika||null,
        nak_datum: form.nakDatum||null,
        nak_cas: form.nakCas ? form.nakCas.slice(0,5) : null,
        raz_firma: form.razFirma||"",
        raz_kraj: form.razKraj,
        raz_naslov: form.razNaslov||"",
        raz_referenca: form.razReferenca||"",
        raz_datum: form.razDatum||null,
        raz_cas: form.razCas ? form.razCas.slice(0,5) : null,
        navodila: form.navodila||"",
        znesek_original: form.znesek||null,
        je_slovenska_ddv: form.jeSlovenskaDdv!==undefined?form.jeSlovenskaDdv:null,
      };
      updateData.postanki = form.postanki||null;
      if (pdfUrl) updateData.original_pdf_url = pdfUrl;
      if (form.voznikId) updateData.voznik_id = form.voznikId;
      const { error } = await supabase.from('nalogi').update(updateData).eq('id', duplikatOpozorilo.id);
      if (error) throw error;
      if (form._outlookMsgId) { try { await markEmailAsRead(form._outlookMsgId); } catch(e){} }
      await naložiPodatke();
      showToast(`✅ Nalog ${duplikatOpozorilo.stevilka_naloga} posodobljen z novimi podatki!`);
      setKorak("vnos"); setVnosText(""); setPriponka(null); setPriponkaFile(null); setForm({});
    } catch(err) {
      showToast("❌ Napaka pri posodabljanju!", true);
      console.error(err);
    }
  };
 
  // Filter za Outlook emaile
  const filtriraniEmaili = outlookEmails.filter(em => {
    if (outlookFilter === "priponke") return em.hasAttachments;
    if (outlookFilter === "neprebrani") return !em.isRead;
    return true;
  });
 
  if (korak==="vnos") return (
    <div>
      <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>🤖 Email → Nalog</div>
        <div style={{fontSize:13,opacity:0.85}}>Poveži Outlook, naloži PDF/Word/Excel/sliko ali pritisni <strong>Ctrl+V</strong> za prilepiti PrintScreen — AI bo avtomatsko izpolnil nalog.</div>
      </div>
 
      {/* OUTLOOK SEKCIJA */}
      <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",border:outlookAccount?"2px solid #16a34a":"2px solid #e2e8f0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:outlookAccount?12:0}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>📨 Outlook povezava</div>
          {outlookAccount ? (
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✅ {outlookAccount.username}</span>
              <button style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:600}} onClick={outlookOdjava}>Odjava</button>
            </div>
          ) : (
            <button style={{background:"#0078d4",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={outlookPrijava}>
              🔐 Poveži Outlook
            </button>
          )}
        </div>
 
        {outlookAccount && (
          <>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              <button style={{...s.fBtn,...(outlookFilter==="vsi"?s.fOn:{})}} onClick={()=>setOutlookFilter("vsi")}>Vsi</button>
              <button style={{...s.fBtn,...(outlookFilter==="priponke"?s.fOn:{})}} onClick={()=>setOutlookFilter("priponke")}>📎 S priponko</button>
              <button style={{...s.fBtn,...(outlookFilter==="neprebrani"?s.fOn:{})}} onClick={()=>setOutlookFilter("neprebrani")}>📬 Neprebrani</button>
              <button style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",color:"#64748b"}} onClick={naložiOutlookEmaile} disabled={outlookLoading}>
                {outlookLoading?"⏳":"🔄"} Osveži
              </button>
            </div>
 
            {outlookLoading && outlookEmails.length===0 ? (
              <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:13}}>⏳ Nalagam emaile...</div>
            ) : filtriraniEmaili.length===0 ? (
              <div style={{textAlign:"center",padding:20,color:"#94a3b8",fontSize:13}}>
                {outlookEmails.length===0?"Klikni Osveži za pridobitev emailov.":"Ni emailov za izbrani filter."}
              </div>
            ) : (
              <div style={{maxHeight:400,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:8}}>
                {filtriraniEmaili.map(em=>(
                  <div key={em.id} style={{padding:"10px 12px",borderBottom:"1px solid #f1f5f9",cursor:aiLoading?"not-allowed":"pointer",background:em.isRead?"#fff":"#eff6ff",opacity:aiLoading?0.5:1}} onClick={()=>!aiLoading&&uvoziOutlookEmail(em.id, em.subject||"(brez naslova)")}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <div style={{fontSize:12,fontWeight:em.isRead?500:700,color:"#0f2744",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {em.hasAttachments&&"📎 "}{em.subject||"(brez naslova)"}
                      </div>
                      <div style={{fontSize:10,color:"#94a3b8",marginLeft:8,whiteSpace:"nowrap"}}>{fmt(em.receivedDateTime)}</div>
                    </div>
                    <div style={{fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {em.from?.emailAddress?.address || "(neznan)"} · {em.bodyPreview?.slice(0,80) || ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
 
      <div style={{textAlign:"center",fontSize:11,color:"#94a3b8",margin:"8px 0"}}>— ALI ROČNO —</div>
 
      {/* UNIVERZALNA DROPZONE */}
      <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:8}}>📎 Naloži dokument (PDF · Word · Excel · Slika)</div>
        {priponka ? (
          <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:700,fontSize:13,color:"#16a34a"}}>{priponka.tip==="image"?"🖼️":"📄"} {priponka.ime}</div><div style={{fontSize:11,color:"#64748b"}}>{priponka.vsebina.slice(0,80)}...</div></div>
            <button style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18}} onClick={()=>{setPriponka(null);setPriponkaFile(null);}}>✕</button>
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
                await obdelajDatoteko(file);
              }
            }}
            style={{border:"2px dashed #cbd5e1",borderRadius:10,padding:"24px 16px",cursor:"pointer",textAlign:"center",background:"#f8fafc",transition:"all 0.2s"}}
          >
            <div style={{fontSize:32,marginBottom:8}}>📂</div>
            <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:4}}>Povleci dokument sem</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>PDF · Word (.docx) · Excel (.xlsx) · Slika (.jpg, .png)</div>
            <div style={{fontSize:11,color:"#1d4ed8",marginBottom:12,fontWeight:600}}>💡 ALI pritisni <kbd style={{background:"#e2e8f0",padding:"2px 6px",borderRadius:4,fontSize:10,fontFamily:"monospace"}}>Ctrl+V</kbd> za prilepiti PrintScreen</div>
            <input type="file" id="email-pdf" accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp" style={{display:"none"}} onChange={naložiPriponko}/>
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
      {duplikatOpozorilo && <div style={{background:"#fef3c7",border:"1.5px solid #fde68a",borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:13}}>
        <div style={{fontWeight:700,color:"#92400e",marginBottom:4}}>⚠️ Možno podvajanje naloga!</div>
        <div style={{color:"#78350f",fontSize:12,marginBottom:6}}>Najden obstoječi nalog z isto številko naročnika ali referenco naklada:</div>
        <div style={{background:"#fff",borderRadius:8,padding:10,fontSize:12,border:"1px solid #fde68a"}}>
          <div style={{fontWeight:700,color:"#0f2744"}}>{duplikatOpozorilo.stevilka_naloga} · {duplikatOpozorilo.stranka}</div>
          <div style={{color:"#64748b",marginTop:2}}>{duplikatOpozorilo.nak_kraj} → {duplikatOpozorilo.raz_kraj}</div>
          {duplikatOpozorilo.stevilka_narocnika && <div style={{color:"#64748b",fontSize:11,marginTop:3}}>📋 Št. naročnika: <b>{duplikatOpozorilo.stevilka_narocnika}</b></div>}
          {duplikatOpozorilo.nak_referenca && <div style={{color:"#64748b",fontSize:11}}>🏷️ Ref. naklada: <b>{duplikatOpozorilo.nak_referenca}</b></div>}
        </div>
        <div style={{color:"#78350f",fontSize:11,marginTop:8,fontStyle:"italic"}}>💡 Lahko vseeno nadaljuješ kot nov nalog — to je samo opozorilo.</div>
        <button onClick={posodobiObstojeci} style={{marginTop:10,width:"100%",background:"#0284c7",color:"#fff",border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>🔄 Posodobi obstoječi nalog {duplikatOpozorilo.stevilka_naloga} (namesto novega)</button>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px",marginBottom:14}}>
        <div style={{gridColumn:"1/-1"}}>
          <label style={s2.lbl}>Voznik</label>
          <select style={s2.sel} value={form.voznikId||""} onChange={e=>sf("voznikId",e.target.value)}>
            <option value="">– Dodeli pozneje –</option>
            {vozniki.map(v=><option key={v.id} value={v.id}>{v.ime} · {v.vozilo}</option>)}
          </select>
        </div>
        <div style={{gridColumn:"1/-1"}}><Fi2 l="Stranka *" v={form.stranka} s={v=>sf("stranka",v)}/></div>
        <Fi2 l="Blago" v={form.blago} s={v=>sf("blago",v)}/><Fi2 l="Cena (EUR)" v={form.znesek} s={v=>sf("znesek",v)}/>
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
      <div style={{background:"#f0f9ff",border:"1.5px solid #bae6fd",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0369a1"}}>📊 Podatki za Google tabelo</div>
          <button onClick={kopirajZaTabelo} style={{background:kopiranoTabela?"#16a34a":"#0284c7",color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{kopiranoTabela?"✅ Kopirano!":"📋 Kopiraj za tabelo"}</button>
        </div>
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #e0f2fe",overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:11,whiteSpace:"nowrap"}}>
            <thead>
              <tr>
                {["NAROČNIK","BLAGO","KRAJ NAKLADA","DATUM NAKLADA","KRAJ RAZKLADA","DATUM RAZKLADA"].map(h=>(
                  <th key={h} style={{background:"#f1f5f9",color:"#475569",fontWeight:700,textAlign:"left",padding:"8px 10px",border:"1px solid #e2e8f0",fontSize:10}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {[form.stranka||"–",tabelaBlago()||"–",tabelaKraj(form.nakKraj,form.nakNaslov)||"–",tabelaDatum(form.nakDatum,form.nakCas)||"–",tabelaKraj(form.razKraj,form.razNaslov)||"–",tabelaDatum(form.razDatum,form.razCas)||"–"].map((c,i)=>(
                  <td key={i} style={{padding:"8px 10px",border:"1px solid #e2e8f0",color:"#0f2744"}}>{c}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{fontSize:11,color:"#0369a1",marginTop:8}}>💡 Klikni gumb → v Google tabeli pritisni <b>Ctrl+V</b>, podatki se razporedijo v 6 stolpcev.</div>
      </div>
      <button style={{width:"100%",background:"linear-gradient(135deg,#065f46,#16a34a)",color:"#fff",border:"none",borderRadius:12,padding:14,fontSize:15,fontWeight:700,cursor:"pointer"}} onClick={ustvariNalog}>
        📋 Ustvari nalog v sistemu →
      </button>
    </div>
  );
 
  return null;
}
 
// ===== TEDENSKI PREGLED PO VOZNIKIH =====
function TedenskiPregledTab({nalogi,vozniki,onSelect,showToast}){
  const obdRange=(v)=>{
    if(v==="teden"||v==="mesec"||v==="danes")return obdobjeRange(v);
    const t=new Date();t.setHours(0,0,0,0);
    const day=(t.getDay()+6)%7;
    const mon=new Date(t); mon.setDate(t.getDate()-day);
    if(v==="prejsnji"){ const p=new Date(mon); p.setDate(mon.getDate()-7); const n=new Date(p); n.setDate(p.getDate()+6); return [isoDan(p),isoDan(n)]; }
    if(v==="naslednji"){ const p=new Date(mon); p.setDate(mon.getDate()+7); const n=new Date(p); n.setDate(p.getDate()+6); return [isoDan(p),isoDan(n)]; }
    return ["",""];
  };
  const [obdobje,setObdobje]=useState("teden");
  const init=obdRange("teden");
  const [od,setOd]=useState(init[0]);
  const [doo,setDoo]=useState(init[1]);
  const [kat,setKat]=useState({razklad:true,oba:true,naklad:true,naPoti:true});
  const toggleKat=(k)=>setKat(p=>({...p,[k]:!p[k]}));

  const vObd=(d)=>d&&(!od||d>=od)&&(!doo||d<=doo);
  const prekriva=(n)=>{
    const nak=n.nakDatum||""; const raz=n.razDatum||"";
    const z=nak||raz; const k=raz||nak;
    if(!z&&!k)return false;
    if(doo&&z>doo)return false;
    if(od&&k<od)return false;
    return true;
  };
  const katNaloga=(n)=>{
    const nakIn=vObd(n.nakDatum), razIn=vObd(n.razDatum);
    if(nakIn&&razIn)return"oba";
    if(!nakIn&&razIn)return"razklad";
    if(nakIn&&!razIn)return"naklad";
    return"naPoti";
  };
  const list=nalogi.filter(prekriva).filter(n=>kat[katNaloga(n)]);

  const skupine={};
  list.forEach(n=>{
    const v=(vozniki||[]).find(x=>x.id===n.voznikId);
    const key=v?v.id:"_ned";
    if(!skupine[key])skupine[key]={key,ime:v?v.ime:"– Nedodeljeni",vozilo:v?v.vozilo:"",nalogi:[]};
    skupine[key].nalogi.push(n);
  });
  const seznam=Object.values(skupine).sort((a,b)=>{
    if(a.key==="_ned")return 1; if(b.key==="_ned")return -1;
    return a.ime.localeCompare(b.ime);
  });

  const kratD=(d)=>d?fmt(d+"T00:00:00"):"";
  const katChips=[["razklad","🏁 Razklad v obdobju"],["oba","📦🏁 Oboje v obdobju"],["naklad","📦 Naklad v obdobju"],["naPoti","🚚 Vmes na poti"]];

  const kopirajVse=()=>{
    if(list.length===0)return showToast("Ni transportov za kopiranje",true);
    const vrstice=list.map(n=>tabVrstica(n)).join("\n");
    navigator.clipboard.writeText(vrstice).then(()=>showToast(`📋 Kopiranih ${list.length} vrstic! Prilepi v Google tabelo (Ctrl+V)`)).catch(()=>showToast("❌ Kopiranje ni uspelo",true));
  };

  return(<div>
    <style>{`@media print{@page{size:A4 portrait;margin:10mm;}body *{visibility:hidden;}.tp-print,.tp-print *{visibility:visible;}.tp-print{position:absolute;left:0;top:0;width:100%;}.no-print{display:none !important;}}`}</style>

    <div className="no-print" style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>📅 Tedenski pregled po voznikih</div>
      <div style={{fontSize:13,opacity:0.85}}>Vsi transporti, ki se v izbranem obdobju nakladajo ali razkladajo (tudi naloženi prej in razloženi v tem obdobju).</div>
    </div>

    <div className="no-print" style={{background:"#fff",borderRadius:12,padding:12,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>📅 Obdobje</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {[["prejsnji","Prejšnji teden"],["teden","Ta teden"],["naslednji","Naslednji teden"],["mesec","Ta mesec"]].map(([v,l])=>(
          <button key={v} style={{...s.fBtn,...(obdobje===v?s.fOn:{})}} onClick={()=>{setObdobje(v);const[a,b]=obdRange(v);setOd(a);setDoo(b);}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap",marginBottom:10}}>
        <div style={{flex:"1 1 120px"}}><label style={{...s.lbl,fontSize:11}}>Od</label><input type="date" style={{...s.inp,margin:0}} value={od} onChange={e=>{setOd(e.target.value);setObdobje("");}}/></div>
        <div style={{flex:"1 1 120px"}}><label style={{...s.lbl,fontSize:11}}>Do</label><input type="date" style={{...s.inp,margin:0}} value={doo} onChange={e=>{setDoo(e.target.value);setObdobje("");}}/></div>
      </div>
      <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>Kateri transporti</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {katChips.map(([k,l])=>(
          <button key={k} style={{...s.fBtn,...(kat[k]?s.fOn:{})}} onClick={()=>toggleKat(k)}>{l}{kat[k]?" ✓":""}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={kopirajVse} style={{flex:1,minWidth:160,background:"#0284c7",color:"#fff",border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>📋 Kopiraj vse za tabelo ({list.length})</button>
        <button onClick={()=>window.print()} style={{flex:1,minWidth:120,background:"#0f2744",color:"#fff",border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨️ Natisni</button>
      </div>
    </div>

    <div className="tp-print">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{kratD(od)} – {kratD(doo)}</div>
        <div style={{fontSize:12,color:"#64748b"}}>{seznam.length} voznikov · {list.length} transportov</div>
      </div>

      {list.length===0&&<div style={s.empty}>V izbranem obdobju ni transportov za izbrane kategorije.</div>}

      {seznam.map(g=>(
        <div key={g.key} style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",marginBottom:10,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",fontWeight:800,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{g.ime==="– Nedodeljeni"?"?":g.ime.charAt(0)}</div>
            <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>{g.ime}</div>
            <div style={{fontSize:12,color:"#94a3b8"}}>{g.vozilo}</div>
            <div style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:"#0f2744",background:"#f1f5f9",borderRadius:20,padding:"2px 10px"}}>{g.nalogi.length}</div>
          </div>
          {g.nalogi.map(n=>{
            const nakIn=vObd(n.nakDatum), razIn=vObd(n.razDatum);
            return(
              <div key={n.id} onClick={()=>onSelect(n)} style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 10px",padding:"9px 14px",borderTop:"1px solid #f8fafc",cursor:"pointer"}}>
                <span style={{fontSize:13,color:"#0f2744",fontWeight:600,flex:1,minWidth:160}}>{krajZPosto(n.nakKraj,n.nakNaslov)} → {krajZPosto(n.razKraj,n.razNaslov)}</span>
                {tabBlago(n)&&<span style={{fontSize:12,color:"#64748b"}}>{tabBlago(n)}</span>}
                {nakIn&&<span style={{fontSize:11,fontWeight:700,color:"#0f6e56",background:"#e1f5ee",borderRadius:20,padding:"2px 8px"}}>📦 naklad {kratD(n.nakDatum)}</span>}
                {razIn&&<span style={{fontSize:11,fontWeight:700,color:"#0c447c",background:"#e6f1fb",borderRadius:20,padding:"2px 8px"}}>🏁 razklad {kratD(n.razDatum)}</span>}
                {!nakIn&&!razIn&&<span style={{fontSize:11,fontWeight:600,color:"#854f0b",background:"#faeeda",borderRadius:20,padding:"2px 8px"}}>na poti</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </div>);
}

// ===== AI ISKALNIK TAB =====
const AI_PREDLOGE_LS="ai_predloge_v1";
const AI_PRIVZETE_PREDLOGE=["Kateri nalogi so še nefakturirani?","Koliko nalogov je šlo ta mesec?","Kdo vozi v Nemčijo?","Najdražji nalog ta teden","Po voznikih: kdo vozi kaj ta teden?","Kateri nalogi nimajo dodeljenega voznika?","Koliko nalogov je za fakturo?","Skupni znesek nalogov ta mesec"];

function AiIskalnikTab({nalogi,vozniki,onSelect,showToast}){
  const [q,setQ]=useState("");
  const [conv,setConv]=useState([]);
  const [loading,setLoading]=useState(false);
  const [mojePredloge,setMojePredloge]=useState(()=>{try{return JSON.parse(localStorage.getItem(AI_PREDLOGE_LS))||[];}catch{return[];}});
  const [prikaziPredloge,setPrikaziPredloge]=useState(false);
  const endRef=useRef(null);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth",block:"end"});},[conv,loading]);

  const shraniPredloge=(arr)=>{setMojePredloge(arr);try{localStorage.setItem(AI_PREDLOGE_LS,JSON.stringify(arr));}catch{}};
  const dodajPredlogo=()=>{
    const t=q.trim();
    if(!t)return showToast&&showToast("Najprej vpiši vprašanje",true);
    if(mojePredloge.includes(t)||AI_PRIVZETE_PREDLOGE.includes(t))return showToast&&showToast("Ta predloga že obstaja");
    shraniPredloge([t,...mojePredloge]);
    showToast&&showToast("✅ Predloga shranjena");
  };
  const izbrisiPredlogo=(t)=>{shraniPredloge(mojePredloge.filter(x=>x!==t));};

  const primeri=AI_PRIVZETE_PREDLOGE;

  const vprasaj=async(vpr)=>{
    const vprasanje=(vpr??q).trim();
    if(!vprasanje||loading)return;
    setQ("");
    setLoading(true);
    const kompakt=nalogi.slice(0,200).map(n=>{
      const v=(vozniki||[]).find(x=>x.id===n.voznikId);
      return {
        st:n.stevilkaNaloga,
        stranka:n.stranka||"",
        nakKraj:n.nakKraj||"",
        razKraj:n.razKraj||"",
        blago:n.blago||"",
        status:n.status||"",
        nakDatum:n.nakDatum||"",
        razDatum:n.razDatum||"",
        voznik:v?.ime||"",
        znesek:n.znesek_original||n.znesekOriginal||"",
        slovenskaDdv:n.je_slovenska_ddv,
      };
    });
    try{
      const {data,error}=await supabase.functions.invoke("ai-nalogi-iskalnik",{body:{vprasanje,nalogi:kompakt}});
      if(error)throw error;
      if(!data?.success)throw new Error(data?.error||"AI napaka");
      const stevilke=data.stevilke||[];
      const najdeni=stevilke.map(s=>nalogi.find(n=>(n.stevilkaNaloga||"").toUpperCase()===String(s).toUpperCase())).filter(Boolean);
      setConv(c=>[...c,{q:vprasanje,odgovor:data.odgovor||"",stats:data.stats||[],najdeni}]);
    }catch(err){
      console.error(err);
      setConv(c=>[...c,{q:vprasanje,odgovor:"❌ Prišlo je do napake pri iskanju. Poskusi znova.",stats:[],najdeni:[]}]);
      showToast&&showToast("❌ AI iskanje ni uspelo",true);
    }
    setLoading(false);
  };

  return(<div>
    <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>🤖 Vprašaj o nalogih</div>
      <div style={{fontSize:13,opacity:0.85,lineHeight:1.5}}>Vprašaj v naravnem jeziku — AI poišče po tvojih nalogih in odgovori. Klikni na najden nalog, da ga odpreš.</div>
    </div>
    <div style={{background:"#fff",borderRadius:12,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",marginBottom:12}}>
      <div style={{display:"flex",gap:8}}>
        <input style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:10,padding:"12px 14px",fontSize:14,outline:"none",background:"#f8fafc",fontFamily:"inherit"}} placeholder="Vprašaj o svojih nalogih…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")vprasaj();}}/>
        <button style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",color:"#fff",border:"none",borderRadius:10,padding:"0 20px",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer",opacity:loading?0.5:1}} onClick={()=>vprasaj()} disabled={loading}>Vprašaj</button>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
        <button onClick={()=>setPrikaziPredloge(p=>!p)} style={{background:prikaziPredloge?"#0f2744":"#f1f5f9",color:prikaziPredloge?"#fff":"#475569",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📋 Predloge {prikaziPredloge?"▲":"▼"}</button>
        <button onClick={dodajPredlogo} style={{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>💾 Shrani vprašanje</button>
      </div>
      {(prikaziPredloge||conv.length===0)&&<div style={{marginTop:10}}>
        {mojePredloge.length>0&&<>
          <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>⭐ Moje predloge</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {mojePredloge.map((p,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,background:"#fef9c3",border:"1px solid #fde68a",color:"#854d0e",borderRadius:20,padding:"4px 6px 4px 12px",fontSize:12,fontWeight:500}}><span onClick={()=>vprasaj(p)} style={{cursor:"pointer"}}>{p}</span><button onClick={()=>izbrisiPredlogo(p)} style={{background:"none",border:"none",color:"#a16207",cursor:"pointer",fontSize:13,lineHeight:1,padding:"0 2px"}} title="Izbriši predlogo">✕</button></span>)}
          </div>
        </>}
        <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>💡 Primeri vprašanj</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {primeri.map((p,i)=><button key={i} onClick={()=>vprasaj(p)} style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",borderRadius:20,padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:500}}>{p}</button>)}
        </div>
      </div>}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {conv.map((m,i)=>(
        <div key={i} style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{alignSelf:"flex-end",maxWidth:"85%",background:"#0f2744",color:"#fff",borderRadius:"14px 14px 4px 14px",padding:"10px 14px",fontSize:14}}>{m.q}</div>
          <div style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,color:"#7c3aed",textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>🤖 AI odgovor</div>
            <div style={{fontSize:14,lineHeight:1.6,color:"#0f2744",whiteSpace:"pre-wrap"}}>{m.odgovor}</div>
            {m.stats&&m.stats.length>0&&<div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"12px 0 4px"}}>
              {m.stats.map((stt,j)=><div key={j} style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",textAlign:"center",flex:1,minWidth:90}}><div style={{fontSize:20,fontWeight:800,color:"#0f2744"}}>{stt[0]}</div><div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{stt[1]}</div></div>)}
            </div>}
            {m.najdeni&&m.najdeni.length>0&&<>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:0.5,margin:"14px 0 8px"}}>📋 Najdeni nalogi ({m.najdeni.length})</div>
              {m.najdeni.map(n=><NC key={n.id} n={n} vozniki={vozniki} onClick={()=>onSelect(n)}/>)}
            </>}
          </div>
        </div>
      ))}
      {loading&&<div style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",color:"#64748b",fontSize:13}}>🤖 AI razmišlja in išče po nalogih…</div>}
      <div ref={endRef}/>
    </div>
  </div>);
}

// ===== KOMUNIKACIJA TAB =====
function KomunikacijaTab({ showToast }) {
  const [korak, setKorak] = useState("vnos"); // vnos | rezultat
  const [aiLoading, setAiLoading] = useState(false);
  const [stranke, setStranke] = useState([]);
  const [skupno, setSkupno] = useState(null);
  const [filter, setFilter] = useState("vsi"); // vsi | SI | DE | AT | HR | ostale
  const [stopnjaFilter, setStopnjaFilter] = useState("vsi"); // vsi | vljuden | drugi | resen | zadnji | izvrsba
  const [search, setSearch] = useState("");
  const [selStranka, setSelStranka] = useState(null);

  const loadPdfJs = () => new Promise(res => {
    if (window.pdfjsLib) return res(window.pdfjsLib);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(window.pdfjsLib); };
    document.head.appendChild(s);
  });

  const obdelajPdf = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      showToast("❌ Naloži samo PDF datoteko!", true);
      return;
    }
    setAiLoading(true);
    showToast(`⏳ Berem PDF: ${file.name}...`);
    try {
      // Preberi PDF besedilo s pdf.js
      const ab = await file.arrayBuffer();
      const lib = await loadPdfJs();
      const pdf = await lib.getDocument({ data: ab }).promise;
      let txt = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i);
        const tc = await p.getTextContent();
        txt += tc.items.map(x => x.str).join(" ") + "\n";
      }

      if (!txt.trim()) {
        showToast("❌ PDF je prazen ali nečitljiv.", true);
        setAiLoading(false);
        return;
      }

      showToast("⏳ AI razčlenjuje seznam strank... (lahko traja 30-60 sek)");

      // Pošlji v Edge Function ai-zapadle-obveznosti
      const { data, error } = await supabase.functions.invoke("ai-zapadle-obveznosti", {
        body: { tekst: txt }
      });

      if (error) throw error;
      if (!data?.success) {
        showToast("❌ AI ni uspel razčleniti.", true);
        console.error("AI napaka:", data);
        setAiLoading(false);
        return;
      }

      setStranke(data.stranke || []);
      setSkupno(data.skupno || null);
      setKorak("rezultat");
      showToast(`✅ Razčlenjenih ${data.stranke?.length || 0} strank!`);
    } catch (err) {
      console.error("Napaka pri obdelavi PDF:", err);
      showToast("❌ Napaka pri branju PDF.", true);
    }
    setAiLoading(false);
  };

  // Filtri
  const filtriraneStranke = stranke.filter(s => {
    // Filter po državi
    if (filter !== "vsi") {
      if (filter === "ostale") {
        if (["SI","DE","AT","HR","IT","NL"].includes(s.drzavaCode)) return false;
      } else {
        if (s.drzavaCode !== filter) return false;
      }
    }
    // Filter po stopnji
    if (stopnjaFilter !== "vsi" && s.stopnja !== stopnjaFilter) return false;
    // Iskanje
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      if (!s.naziv?.toLowerCase().includes(q) && !s.vat?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Statistika
  const skupajZnesek = filtriraneStranke.reduce((a, s) => a + (s.skupajOstanek || 0), 0);
  const top10 = [...stranke].sort((a, b) => (b.skupajOstanek || 0) - (a.skupajOstanek || 0)).slice(0, 10);
  
  // Skupinje po državah
  const poDrzavah = stranke.reduce((acc, s) => {
    const code = s.drzavaCode || "??";
    if (!acc[code]) acc[code] = { code, flag: s.flag, count: 0, znesek: 0 };
    acc[code].count++;
    acc[code].znesek += s.skupajOstanek || 0;
    return acc;
  }, {});

  const stopnjaInfo = {
    vljuden: { label: "Vljuden opomin", color: "#16a34a", bg: "#f0fdf4", icon: "🟢" },
    drugi: { label: "Drugi opomin", color: "#d97706", bg: "#fffbeb", icon: "🟡" },
    resen: { label: "Resen opomin", color: "#ea580c", bg: "#fff7ed", icon: "🟠" },
    zadnji: { label: "Zadnji opomin", color: "#dc2626", bg: "#fef2f2", icon: "🔴" },
    izvrsba: { label: "Predaja izterjavi", color: "#7f1d1d", bg: "#fef2f2", icon: "⚫" }
  };

  // ===== STRANKA DETAIL =====
  if (selStranka) {
    const stop = stopnjaInfo[selStranka.stopnja] || stopnjaInfo.vljuden;
    return (
      <div>
        <button style={{...s.fBtn, marginBottom:12}} onClick={()=>setSelStranka(null)}>← Nazaj na seznam</button>
        
        <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
          <div style={{fontSize:11,opacity:0.7,marginBottom:4}}>{selStranka.flag} {selStranka.drzava}</div>
          <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>{selStranka.naziv}</div>
          <div style={{fontSize:12,opacity:0.7,fontFamily:"monospace"}}>{selStranka.vat}</div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.15)"}}>
            <div>
              <div style={{fontSize:11,opacity:0.7}}>Skupaj zapadlo</div>
              <div style={{fontSize:24,fontWeight:800}}>{(selStranka.skupajOstanek||0).toFixed(2)} €</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,opacity:0.7}}>Stopnja</div>
              <div style={{fontSize:14,fontWeight:700,padding:"4px 10px",borderRadius:20,background:"rgba(255,255,255,0.15)",display:"inline-block",marginTop:2}}>
                {stop.icon} {stop.label}
              </div>
            </div>
          </div>
        </div>

        <Sec title={`📋 Računi (${selStranka.racuni?.length||0})`}>
          {(selStranka.racuni||[]).map((r,i)=>{
            const rstop = stopnjaInfo[r.stopnja] || stopnjaInfo.vljuden;
            return (
              <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:12,marginBottom:8,borderLeft:`4px solid ${rstop.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <div style={{fontFamily:"monospace",fontWeight:700,fontSize:13,color:"#2563eb"}}>{r.stevilka}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>Izdano: {r.datum} · Rok: {r.rokPlacila}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,fontSize:16,color:"#0f2744"}}>{(r.ostanek||0).toFixed(2)} €</div>
                    {r.placano>0 && <div style={{fontSize:10,color:"#16a34a"}}>(plačano {r.placano.toFixed(2)} €)</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,fontSize:11,flexWrap:"wrap"}}>
                  <span style={{padding:"2px 8px",borderRadius:20,background:rstop.bg,color:rstop.color,fontWeight:600}}>{rstop.icon} {rstop.label}</span>
                  <span style={{padding:"2px 8px",borderRadius:20,background:r.dniZamude>30?"#fef2f2":"#fffbeb",color:r.dniZamude>30?"#dc2626":"#92400e",fontWeight:600}}>
                    📅 {r.dniZamude} dni zamude
                  </span>
                </div>
              </div>
            );
          })}
        </Sec>

        <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:14,marginTop:10}}>
          <div style={{fontWeight:700,fontSize:14,color:"#92400e",marginBottom:6}}>⏳ Naslednji korak</div>
          <div style={{fontSize:12,color:"#78350f",lineHeight:1.5}}>
            Generiranje opomina v jeziku <strong>{selStranka.jezik?.toUpperCase()}</strong> in pošiljanje preko Outlook bo na voljo, ko bo Outlook povezava aktivirana (admin consent).
          </div>
        </div>
      </div>
    );
  }

  // ===== KORAK: VNOS PDF =====
  if (korak === "vnos") {
    return (
      <div>
        <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>📨 Komunikacija — Opomini</div>
          <div style={{fontSize:13,opacity:0.85}}>
            Naloži PDF z zapadlimi obveznostmi (iz SQ Trans). AI bo razčlenil seznam strank, prepoznal države iz VAT številk in pripravil predogled za pošiljanje opominov.
          </div>
        </div>

        <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f2744",marginBottom:12}}>📂 Naloži PDF poročilo</div>

          {aiLoading ? (
            <div style={{textAlign:"center",padding:40,color:"#64748b"}}>
              <div style={{fontSize:32,marginBottom:8}}>⏳</div>
              <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>AI razčlenjuje PDF...</div>
              <div style={{fontSize:12,marginTop:4}}>To lahko traja 30-60 sekund pri velikih datotekah</div>
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
                if (file) await obdelajPdf(file);
              }}
              style={{border:"2px dashed #cbd5e1",borderRadius:12,padding:"40px 16px",cursor:"pointer",textAlign:"center",background:"#f8fafc",transition:"all 0.2s"}}
            >
              <div style={{fontSize:48,marginBottom:12}}>📋</div>
              <div style={{fontWeight:700,fontSize:16,color:"#0f2744",marginBottom:6}}>Povleci PDF poročilo sem</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Izpis zapadlih obveznosti iz SQ Trans (ali podobno)</div>
              <input type="file" id="zapadle-pdf" accept=".pdf" style={{display:"none"}} onChange={async e=>{
                const f=e.target.files?.[0]; if(f) await obdelajPdf(f); e.target.value="";
              }}/>
              <label htmlFor="zapadle-pdf" style={{background:"#0f2744",color:"#fff",padding:"10px 24px",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer"}}>
                📂 Ali izberi datoteko
              </label>
            </div>
          )}
        </div>

        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:14,fontSize:12,color:"#1d4ed8"}}>
          <div style={{fontWeight:700,marginBottom:6}}>💡 Kaj bo naredil AI:</div>
          <ul style={{margin:0,paddingLeft:18,lineHeight:1.7}}>
            <li>Razčlenil seznam strank in vse zapadle račune</li>
            <li>Prepoznal državo iz VAT številke (DE, SI, AT, HR, IT, NL...)</li>
            <li>Določil jezik za opomin (slovenski, nemški, italijanski...)</li>
            <li>Izračunal dni zamude za vsak račun</li>
            <li>Razvrstil v stopnje (vljuden / drugi / resen / zadnji / izterjava)</li>
          </ul>
        </div>
      </div>
    );
  }

  // ===== KORAK: REZULTAT =====
  return (
    <div>
      {/* Header z gumbi */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8}}>
        <button style={{...s.fBtn}} onClick={()=>{setKorak("vnos");setStranke([]);setSkupno(null);setSelStranka(null);setSearch("");setFilter("vsi");setStopnjaFilter("vsi");}}>← Nov PDF</button>
        <div style={{fontSize:12,color:"#64748b"}}>{filtriraneStranke.length} od {stranke.length} strank · <strong style={{color:"#dc2626"}}>{skupajZnesek.toFixed(2)} €</strong></div>
      </div>

      {/* Glavna statistika */}
      {skupno && (
        <div style={{background:"linear-gradient(135deg,#0f2744,#1d4ed8)",borderRadius:14,padding:18,color:"#fff",marginBottom:14}}>
          <div style={{fontSize:11,opacity:0.7,marginBottom:4}}>📊 Skupaj zapadlih obveznosti</div>
          <div style={{fontSize:32,fontWeight:800,marginBottom:8}}>{(skupno.skupajZapadlo||0).toFixed(2)} €</div>
          <div style={{display:"flex",gap:16,fontSize:12,opacity:0.85,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.15)"}}>
            <span>👥 {skupno.stevilkaStrank||stranke.length} strank</span>
            <span>📋 {stranke.reduce((a,s)=>a+(s.steviloRacunov||0),0)} računov</span>
            <span>📅 {skupno.datumPorocila||"–"}</span>
          </div>
        </div>
      )}

      {/* Po državah */}
      {Object.keys(poDrzavah).length>0 && (
        <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:10,textTransform:"uppercase"}}>🌍 Po državah</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
            {Object.values(poDrzavah).sort((a,b)=>b.znesek-a.znesek).map(d=>(
              <button key={d.code} onClick={()=>setFilter(filter===d.code?"vsi":d.code)} style={{background:filter===d.code?"#eff6ff":"#f8fafc",border:filter===d.code?"2px solid #2563eb":"1px solid #e2e8f0",borderRadius:8,padding:10,textAlign:"center",cursor:"pointer"}}>
                <div style={{fontSize:18,marginBottom:2}}>{d.flag}</div>
                <div style={{fontSize:10,color:"#64748b",fontWeight:600}}>{d.code}</div>
                <div style={{fontSize:13,fontWeight:800,color:"#0f2744",marginTop:2}}>{d.znesek.toFixed(0)} €</div>
                <div style={{fontSize:10,color:"#94a3b8"}}>{d.count} {d.count===1?"stranka":"strank"}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TOP 10 dolžnikov */}
      {top10.length>0 && (
        <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:10,textTransform:"uppercase"}}>🏆 Top 10 največjih dolžnikov</div>
          {top10.map((s,i)=>(
            <div key={s.vat||i} onClick={()=>setSelStranka(s)} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<9?"1px solid #f1f5f9":"none",cursor:"pointer"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:i<3?"#fef3c7":"#f1f5f9",color:i<3?"#92400e":"#64748b",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
              <div style={{fontSize:14}}>{s.flag}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0f2744",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.naziv}</div>
                <div style={{fontSize:10,color:"#94a3b8"}}>{s.steviloRacunov} {s.steviloRacunov===1?"račun":"računov"} · {s.maxDniZamude} dni</div>
              </div>
              <div style={{fontSize:14,fontWeight:800,color:"#dc2626"}}>{(s.skupajOstanek||0).toFixed(0)} €</div>
            </div>
          ))}
        </div>
      )}

      {/* Iskalnik */}
      <div style={{position:"relative",marginBottom:10}}>
        <input style={{...s.inp,paddingLeft:34,paddingRight:search?34:12}} placeholder="🔍 Išči po nazivu ali VAT številki..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8",pointerEvents:"none"}}>🔍</span>
        {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"#e2e8f0",border:"none",borderRadius:"50%",width:22,height:22,fontSize:12,cursor:"pointer"}}>✕</button>}
      </div>

      {/* Filtri po stopnji */}
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <button style={{...s.fBtn,...(stopnjaFilter==="vsi"?s.fOn:{})}} onClick={()=>setStopnjaFilter("vsi")}>Vse stopnje</button>
        {Object.entries(stopnjaInfo).map(([key,info])=>(
          <button key={key} style={{...s.fBtn,...(stopnjaFilter===key?s.fOn:{})}} onClick={()=>setStopnjaFilter(key)}>
            {info.icon} {info.label}
          </button>
        ))}
      </div>

      {/* Filtri po državi */}
      {filter!=="vsi" && (
        <div style={{background:"#eff6ff",borderRadius:8,padding:"6px 12px",marginBottom:10,fontSize:12,color:"#1d4ed8",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Prikazujem samo: <strong>{filter}</strong> ({poDrzavah[filter]?.flag})</span>
          <button onClick={()=>setFilter("vsi")} style={{background:"none",border:"none",color:"#1d4ed8",cursor:"pointer",fontWeight:700}}>✕ Počisti</button>
        </div>
      )}

      {/* Seznam strank */}
      {filtriraneStranke.length===0 ? (
        <div style={s.empty}>Ni strank po izbranih kriterijih.</div>
      ) : (
        <div>
          {filtriraneStranke.sort((a,b)=>(b.skupajOstanek||0)-(a.skupajOstanek||0)).map((str,i)=>{
            const stop = stopnjaInfo[str.stopnja] || stopnjaInfo.vljuden;
            return (
              <div key={str.vat||i} onClick={()=>setSelStranka(str)} style={{background:"#fff",borderRadius:12,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",borderLeft:`4px solid ${stop.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                      <span style={{fontSize:14}}>{str.flag}</span>
                      <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>{str.vat}</span>
                    </div>
                    <div style={{fontWeight:700,fontSize:14,color:"#0f2744"}}>{str.naziv}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,fontSize:18,color:"#dc2626"}}>{(str.skupajOstanek||0).toFixed(2)} €</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11}}>
                  <span style={{padding:"2px 8px",borderRadius:20,background:stop.bg,color:stop.color,fontWeight:600}}>{stop.icon} {stop.label}</span>
                  <span style={{padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:"#64748b",fontWeight:600}}>📋 {str.steviloRacunov} {str.steviloRacunov===1?"račun":"računov"}</span>
                  <span style={{padding:"2px 8px",borderRadius:20,background:"#f1f5f9",color:"#64748b",fontWeight:600}}>📅 {str.maxDniZamude} dni</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s2={lbl:{display:"block",fontSize:12,fontWeight:600,color:"#475569",marginBottom:4},inp:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box",background:"#f8fafc"},sel:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",background:"#f8fafc",boxSizing:"border-box"}};
const Fi2=({l,v,s,ph,t="text"})=><div><label style={s2.lbl}>{l}</label><input style={s2.inp} type={t} value={v||""} onChange={e=>s(e.target.value)} placeholder={ph||""}/></div>;

function origPotIzUrl(url){
  if(!url)return null;
  const m=String(url).match(/\/originalni-nalogi\/(.+?)(\?|$)/);
  return m?decodeURIComponent(m[1]):null;
}
function tabPosta(naslov){
  if(!naslov)return"";
  const m=String(naslov).match(/\b(\d{4,5})\s+\p{L}/u);
  if(m)return m[1];
  const m2=String(naslov).match(/\b(\d{4,5})\b/);
  return m2?m2[1]:"";
}
function tabKraj(kraj,naslov){
  const k=(kraj||"").trim();
  const p=tabPosta(naslov);
  if(k&&p&&!k.startsWith(p))return`${p} ${k}`;
  return k||p;
}
function tabDatum(datum,cas){
  if(!datum)return"";
  const d=fmt(datum+"T00:00:00");
  return cas?`${d} ${cas}`:d;
}
function tabBlago(n){
  const b=(n.blago||"").trim();
  const m=n.metri||n.ldm||"";
  const metri=m?(/ldm|metr/i.test(String(m))?String(m):`${m} LDM`):"";
  const k=metri||(n.kolicina||"").trim();
  const t=(n.teza||"").trim();
  return [b,k,t].filter(Boolean).join(", ");
}
function tabVrstica(n){
  return [n.stranka||"",tabBlago(n),tabKraj(n.nakKraj,n.nakNaslov),tabDatum(n.nakDatum,n.nakCas),tabKraj(n.razKraj,n.razNaslov),tabDatum(n.razDatum,n.razCas)].join("\t");
}
function drzavaIzNaslova(kraj, naslov){
  const s = `${kraj||""} ${naslov||""}`;
  if(!s.trim()) return "";
  const low = s.toLowerCase();
  const imena = [
    [/sloveni|slowenien|slovenija/, "SI"],
    [/hrva|croat|kroat|hrvatska/, "HR"],
    [/nem[čc]ij|german|deutschl|njema[čc]/, "DE"],
    [/avstrij|austria|österr|oesterr/, "AT"],
    [/italij|ital(y|ia|ien)/, "IT"],
    [/nizozem|netherl|niederl|holland/, "NL"],
    [/belgij|belg(ium|ien|ie)/, "BE"],
    [/dansk|denmark|dänemark|daenemark/, "DK"],
    [/madžar|mađar|hungar|ungarn/, "HU"],
    [/[šs]vic|switz|schweiz/, "CH"],
    [/[čc]e[šs]k|czech|tschech/, "CZ"],
    [/slova[šs]k|slovak|slowak/, "SK"],
    [/poljsk|poland|polen|poljska/, "PL"],
    [/francij|france|frankreich|francuska/, "FR"],
    [/luksembur|luxembour/, "LU"],
    [/[šs]panij|spain|spanien/, "ES"],
    [/portugal/, "PT"],
    [/[šs]vedsk|sweden|schwed/, "SE"],
    [/norve[šs]k|norway|norweg/, "NO"],
    [/finsk|finland|finnl/, "FI"],
  ];
  for(const [re,code] of imena){ if(re.test(low)) return code; }
  const CODE={A:"AT",D:"DE",I:"IT",F:"FR",E:"ES",P:"PT",B:"BE",L:"LU",H:"HU",N:"NO",S:"SE",SLO:"SI",SI:"SI",HR:"HR",AT:"AT",DE:"DE",IT:"IT",NL:"NL",BE:"BE",LU:"LU",FR:"FR",ES:"ES",PT:"PT",HU:"HU",CH:"CH",CZ:"CZ",SK:"SK",PL:"PL",DK:"DK",SE:"SE",NO:"NO",FI:"FI",FIN:"FI"};
  const m = s.match(/\b([A-Z]{1,3})[-\s]?\d{4,5}\b/);
  if(m && CODE[m[1]]) return CODE[m[1]];
  const m2 = s.match(/\b(SLO|FIN|SI|HR|AT|DE|IT|NL|BE|LU|FR|ES|PT|HU|CH|CZ|SK|PL|DK|SE|NO)\b/);
  if(m2 && CODE[m2[1]]) return CODE[m2[1]];
  return "";
}
const SMER={
  izvoz:{kod:"izvoz",label:"Izvoz",color:"#16a34a",bg:"#f0fdf4",icon:"🟢"},
  uvoz:{kod:"uvoz",label:"Uvoz",color:"#2563eb",bg:"#eff6ff",icon:"🔵"},
  domaci:{kod:"domaci",label:"Domači",color:"#64748b",bg:"#f1f5f9",icon:"🏠"},
  "?":{kod:"?",label:"?",color:"#94a3b8",bg:"#f8fafc",icon:"❓"},
};
const DRZAVA_RANK={HR:1,IT:1,RS:1,BA:1,ME:1,MK:1,BG:1,GR:1,RO:2,SI:2,HU:2,AT:3,CH:3,SK:3,LI:3,CZ:4,FR:4,DE:5,PL:5,LU:5,GB:6,BE:6,NL:6,IE:6,DK:7,EE:7,LV:7,LT:6,SE:8,NO:8,FI:8};
function smerNaloga(n){
  const rocno=n.smer_rocno||n.smerRocno;
  if(rocno&&SMER[rocno])return SMER[rocno];
  const dn=drzavaIzNaslova(n.nakKraj,n.nakNaslov);
  const dr=drzavaIzNaslova(n.razKraj,n.razNaslov);
  if(!dn||!dr)return SMER["?"];
  const rn=DRZAVA_RANK[dn], rr=DRZAVA_RANK[dr];
  if(rn==null||rr==null)return SMER["?"];
  if(rr>rn)return SMER.izvoz;
  if(rr<rn)return SMER.uvoz;
  return SMER.domaci;
}
function krajZPosto(kraj,naslov){
  const k=(kraj||"").trim();
  if(!naslov)return k;
  const s=String(naslov);
  const ISO={A:"AT",D:"DE",I:"IT",F:"FR",E:"ES",P:"PT",B:"BE",L:"LU",H:"HU",SLO:"SI",CZ:"CZ",SK:"SK",PL:"PL",CH:"CH",NL:"NL",HR:"HR",SI:"SI"};
  let drzava="",posta="";
  const m=s.match(/\b([A-Z]{1,3})[-\s]?(\d{4,5})(?=\s+\p{L})/u);
  if(m){drzava=ISO[m[1]]||m[1];posta=m[2];}
  else{
    const m2=s.match(/\b(\d{4,5})(?=\s+\p{L})/u)||s.match(/\b(\d{4,5})\b/);
    if(m2)posta=m2[1];
  }
  if(!posta)return k;
  const pref=[drzava,posta].filter(Boolean).join(" ");
  return k?`${pref} ${k}`:pref;
}
const NC=({n,onClick,vozniki:vl,onEdit,onDelete})=>{const sc=SC[n.status]||{};const v=(vl||VOZNIKI).find(x=>x.id===n.voznikId);const sm=smerNaloga(n);return(<div style={{width:"100%",background:n.status==="za_fakturo"?"#faf5ff":"#fff",borderRadius:12,padding:"13px 14px",marginBottom:9,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",border:n.status==="za_fakturo"?"1.5px solid #9333ea":"none",textAlign:"left",position:"relative"}}><div onClick={onClick} style={{cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}><span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:sc.bg,color:sc.color}}>{sc.label}</span>{sm&&sm.kod!=="?"&&<span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:sm.bg,color:sm.color}}>{sm.icon} {sm.label}</span>}<span style={{fontSize:11,fontFamily:"monospace",color:"#2563eb",fontWeight:700}}>{n.stevilkaNaloga}</span>{v&&<span style={{fontSize:11,fontWeight:700,color:"#7c3aed",background:"#f5f3ff",padding:"2px 8px",borderRadius:20}}>🚛 {v.ime}</span>}{!v&&n.status!=="nov"&&<span style={{fontSize:11,fontWeight:600,color:"#94a3b8",background:"#f1f5f9",padding:"2px 8px",borderRadius:20}}>– ni voznika</span>}<span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{fmt(n.poslan)} ob {fmtT(n.poslan)}</span></div><div style={{fontSize:16,fontWeight:800,color:"#0f2744",marginBottom:3}}>{n.stranka||"—"}</div><div style={{fontSize:14,fontWeight:700,color:"#334155",marginBottom:2}}>{krajZPosto(n.nakKraj,n.nakNaslov)} → {krajZPosto(n.razKraj,n.razNaslov)}</div>{n.blago&&<div style={{fontSize:13,color:"#64748b"}}>📦 {n.blago}</div>}{(n.nakDatum||n.razDatum)&&<div style={{fontSize:12,color:"#94a3b8",marginTop:3,display:"flex",gap:12,flexWrap:"wrap"}}>{n.nakDatum&&<span>📅 Nakl: {fmt(n.nakDatum+"T00:00:00")}{n.nakCas?` ${n.nakCas}`:""}</span>}{n.razDatum&&<span>🏁 Razkl: {fmt(n.razDatum+"T00:00:00")}{n.razCas?` ${n.razCas}`:""}</span>}</div>}</div>{(onEdit||onDelete)&&<div style={{display:"flex",gap:6,marginTop:10,paddingTop:10,borderTop:"1px solid #f1f5f9"}}>{onEdit&&<button style={{background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={(e)=>{e.stopPropagation();onEdit(n.id);}}>✏️ Uredi</button>}{onDelete&&<button style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={(e)=>{e.stopPropagation();if(window.confirm(`Ali res želiš izbrisati nalog ${n.stevilkaNaloga}?\n\n${n.nakKraj} → ${n.razKraj}\n${n.stranka}\n\nTo dejanje je nepovratno.`)){onDelete(n.id);}}}>🗑️ Izbriši</button>}</div>}</div>);};
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
