import { useState, useEffect, useMemo } from "react";
import { supabase } from './supabase';

const pad=(n)=>String(n).padStart(2,"0");
const fmt=(iso)=>{if(!iso)return"–";const d=new Date(iso);return`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;};
const daysUntil=(iso)=>{if(!iso)return null;const d=new Date(iso);const now=new Date();now.setHours(0,0,0,0);d.setHours(0,0,0,0);return Math.ceil((d-now)/(1000*60*60*24));};

const TIP_LABELS={gume:"🛞 Gume",olje:"🛢️ Olje",akumulator:"🔋 Akumulator",popravilo:"🔧 Popravilo",pranje:"🚿 Pranje",servis:"🔍 Servis",napaka:"⚠️ Napaka",drugo:"📋 Drugo"};
const tipLabel=(t)=>TIP_LABELS[t]||t||"Servis";

export default function VzdrzevanjeApp(){
  const [vozniki,setVozniki]=useState([]);
  const [obracuni,setObracuni]=useState([]);
  const [vozVzdz,setVozVzdz]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState(null);
  const [editReg,setEditReg]=useState({});
  const [toast,setToast]=useState(null);
  const [tab,setTab]=useState("vozniki");
  const [vnosiFilter,setVnosiFilter]=useState("odprti");

  const showToast=(txt,err)=>{setToast({txt,err});setTimeout(()=>setToast(null),3500);};

  useEffect(()=>{
    Promise.all([
      supabase.from("vozniki").select("*").eq("aktiven",true).order("priimek"),
      supabase.from("tedenski_obracuni").select("*").order("datum_od",{ascending:false}).limit(100),
      supabase.from("vozilo_vzdrzevanje").select("*").order("datum",{ascending:false}).limit(200),
    ]).then(([{data:v},{data:o},{data:vvz}])=>{
      if(v)setVozniki(v);
      if(o)setObracuni(o);
      if(vvz)setVozVzdz(vvz);
      setLoading(false);
    });
  },[]);

  const opozorila=useMemo(()=>{
    const warn=[];
    vozniki.forEach(v=>{
      const d1=daysUntil(v.registracija_pretek);
      if(d1!==null&&d1<=30) warn.push({...v,tip:"vozilo",dni:d1,datum:v.registracija_pretek});
      const d2=daysUntil(v.registracija_prikolica_pretek);
      if(d2!==null&&d2<=30) warn.push({...v,tip:"prikolica",dni:d2,datum:v.registracija_prikolica_pretek});
    });
    return warn.sort((a,b)=>a.dni-b.dni);
  },[vozniki]);

  const voznikObracuni=(id)=>obracuni.filter(o=>o.voznik_id===id);
  const voznikInfo=(id)=>vozniki.find(v=>v.id===id);
  const voznikStoritve=(id)=>{
    const ob=voznikObracuni(id);
    const all=[];
    ob.forEach(o=>{(o.druge_storitve||[]).forEach(s=>{all.push({...s,datum_od:o.datum_od,datum_do:o.datum_do});});});
    return all;
  };
  const voznikOpombe=(id)=>{
    const ob=voznikObracuni(id);
    return ob.filter(o=>o.opombe).map(o=>({opomba:o.opombe,datum_od:o.datum_od,datum_do:o.datum_do}));
  };
  const voznikServis=(id)=>{
    return vozVzdz.filter(vz=>vz.voznik_id===id).sort((a,b)=>new Date(b.datum)-new Date(a.datum));
  };

  const podaljsajRegistracijo=async(w)=>{
    const novDatum=new Date();
    novDatum.setFullYear(novDatum.getFullYear()+1);
    const isoDatum=novDatum.toISOString().split("T")[0];
    const polje=w.tip==="vozilo"?"registracija_pretek":"registracija_prikolica_pretek";
    const {error}=await supabase.from("vozniki").update({[polje]:isoDatum}).eq("id",w.id);
    if(error){showToast("❌ Napaka pri shranjevanju!",true);return false;}
    setVozniki(x=>x.map(z=>z.id===w.id?{...z,[polje]:isoDatum}:z));
    showToast(`✅ Registracija ${w.tip==="vozilo"?"vozila":"prikolice"} podaljšana za 1 leto!`);
    return true;
  };

  const toggleServisStatus=async(id,novStatus)=>{
    await supabase.from("vozilo_vzdrzevanje").update({status:novStatus}).eq("id",id);
    setVozVzdz(x=>x.map(s=>s.id===id?{...s,status:novStatus}:s));
    showToast(novStatus==="opravljeno"?"✅ Servis označen kot opravljeno!":"🔄 Servis je odprt!");
  };

  const brisiServis=async(id)=>{
    if(!window.confirm("Ali si prepričan da želiš izbrisati ta servis?"))return;
    await supabase.from("vozilo_vzdrzevanje").delete().eq("id",id);
    setVozVzdz(x=>x.filter(s=>s.id!==id));
    showToast("🗑️ Servis izbrisan!");
  };

  if(loading)return(<div style={st.wrap}><div style={st.header}><div style={st.logo}>🔧 Vzdrževanje</div><div style={st.sub}>Jurjevec Transport</div></div><div style={{textAlign:"center",padding:60,color:"#94a3b8"}}>⏳ Nalagam...</div></div>);

  // DETAIL VOZNIKA
  if(sel){
    const v=sel;
    const regVozilo=daysUntil(v.registracija_pretek);
    const regPrik=daysUntil(v.registracija_prikolica_pretek);
    const str=voznikStoritve(v.id);
    const opm=voznikOpombe(v.id);
    const srv=voznikServis(v.id);

    return(<div style={st.wrap}>
      <div style={st.header}><button style={st.backBtn} onClick={()=>setSel(null)}>← Nazaj</button>
        <div style={{fontSize:18,fontWeight:800}}>{v.ime} {v.priimek}</div>
        <div style={{fontSize:12,opacity:0.7}}>{v.vozilo}</div></div>
      <div style={st.content}>

        {/* REGISTRACIJA VOZILA + PRIKOLICE */}
        <div style={st.card}>
          <div style={st.cardTitle}>📋 Registracija vozila</div>
          <div style={{fontSize:13,color:"#2563eb",fontWeight:700,marginBottom:8}}>🚛 {v.vozilo}</div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:"#64748b"}}>Preteče:</div>
              <div style={{fontSize:18,fontWeight:800,color:regVozilo===null?"#94a3b8":regVozilo<=0?"#dc2626":regVozilo<=30?"#d97706":"#16a34a"}}>{v.registracija_pretek?fmt(v.registracija_pretek+"T00:00:00"):"Ni nastavljeno"}</div>
              {regVozilo!==null&&<div style={{fontSize:12,color:regVozilo<=0?"#dc2626":regVozilo<=30?"#d97706":"#16a34a",fontWeight:600}}>{regVozilo<=0?`⚠️ Potekla pred ${Math.abs(regVozilo)} dnevi!`:regVozilo<=30?`⏳ Še ${regVozilo} dni`:`✅ Še ${regVozilo} dni`}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            <input style={st.input} type="date" value={editReg[v.id+"_vozilo"]||v.registracija_pretek||""} onChange={e=>setEditReg(r=>({...r,[v.id+"_vozilo"]:e.target.value}))}/>
            <button style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",flexShrink:0}} onClick={async()=>{const d=editReg[v.id+"_vozilo"];if(!d)return;await supabase.from("vozniki").update({registracija_pretek:d}).eq("id",v.id);setVozniki(x=>x.map(z=>z.id===v.id?{...z,registracija_pretek:d}:z));setSel(p=>({...p,registracija_pretek:d}));showToast("✅ Registracija vozila shranjena!");}}>💾</button>
          </div>

          <div style={{borderTop:"1px solid #e2e8f0",paddingTop:16}}>
            <div style={{fontSize:13,color:"#2563eb",fontWeight:700,marginBottom:8}}>🚛 Prikolica {v.prikolica?`(${v.prikolica})`:""}</div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"#64748b"}}>Preteče:</div>
                <div style={{fontSize:18,fontWeight:800,color:regPrik===null?"#94a3b8":regPrik<=0?"#dc2626":regPrik<=30?"#d97706":"#16a34a"}}>{v.registracija_prikolica_pretek?fmt(v.registracija_prikolica_pretek+"T00:00:00"):"Ni nastavljeno"}</div>
                {regPrik!==null&&<div style={{fontSize:12,color:regPrik<=0?"#dc2626":regPrik<=30?"#d97706":"#16a34a",fontWeight:600}}>{regPrik<=0?`⚠️ Potekla pred ${Math.abs(regPrik)} dnevi!`:regPrik<=30?`⏳ Še ${regPrik} dni`:`✅ Še ${regPrik} dni`}</div>}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <input style={st.input} type="date" value={editReg[v.id+"_prik"]||v.registracija_prikolica_pretek||""} onChange={e=>setEditReg(r=>({...r,[v.id+"_prik"]:e.target.value}))}/>
              <button style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",flexShrink:0}} onClick={async()=>{const d=editReg[v.id+"_prik"];if(!d)return;await supabase.from("vozniki").update({registracija_prikolica_pretek:d}).eq("id",v.id);setVozniki(x=>x.map(z=>z.id===v.id?{...z,registracija_prikolica_pretek:d}:z));setSel(p=>({...p,registracija_prikolica_pretek:d}));showToast("✅ Registracija prikolice shranjena!");}}>💾</button>
            </div>
          </div>
        </div>

        {/* SERVIS & NAPAKE */}
        <div style={st.card}>
          <div style={st.cardTitle}>🔧 Servis & napake ({srv.filter(s=>s.status!=="opravljeno").length})</div>
          {srv.filter(s=>s.status!=="opravljeno").length===0&&<div style={{fontSize:13,color:"#94a3b8",padding:8}}>Ni odprtih servisov.</div>}
          {srv.filter(s=>s.status!=="opravljeno").map((s,i)=><div key={i} style={{background:"#f9fafb",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e5e7eb",display:"flex",alignItems:"flex-start",gap:10}}>
            <input type="checkbox" checked={s.status==="opravljeno"} onChange={()=>toggleServisStatus(s.id,s.status==="opravljeno"?"odprto":"opravljeno")} style={{marginTop:4,cursor:"pointer",width:18,height:18}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,color:"#0f2744",fontWeight:600}}>{tipLabel(s.tip)}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{fmt(s.datum+"T00:00:00")}</div>
              {s.opis&&<div style={{fontSize:12,color:"#64748b",marginTop:4}}>{s.opis}</div>}
              {s.znesek&&<div style={{fontWeight:700,color:"#2563eb",marginTop:4}}>{parseFloat(s.znesek).toFixed(2)} €</div>}
            </div>
            <button onClick={()=>brisiServis(s.id)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:600,flexShrink:0}}>🗑️</button>
          </div>)}
          {srv.filter(s=>s.status==="opravljeno").length>0&&<div style={{marginTop:16,paddingTop:16,borderTop:"1px solid #e5e7eb"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:8}}>✅ Opravljeno ({srv.filter(s=>s.status==="opravljeno").length})</div>
            {srv.filter(s=>s.status==="opravljeno").map((s,i)=><div key={i} style={{background:"#f0fdf4",borderRadius:8,padding:"8px 10px",marginBottom:6,border:"1px solid #d1fae5",display:"flex",alignItems:"center",gap:10,opacity:0.7}}>
              <input type="checkbox" checked={true} onChange={()=>toggleServisStatus(s.id,"odprto")} style={{cursor:"pointer",width:16,height:16}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"#16a34a",fontWeight:600}}>{tipLabel(s.tip)}</div>
                <div style={{fontSize:10,color:"#86efac"}}>{fmt(s.datum+"T00:00:00")}</div>
              </div>
              <button onClick={()=>brisiServis(s.id)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer",fontWeight:600,flexShrink:0}}>🗑️</button>
            </div>)}
          </div>}
        </div>

        {/* STORITVE */}
        <div style={st.card}>
          <div style={st.cardTitle}>🏥 Druge storitve ({str.length})</div>
          {str.length===0&&<div style={{fontSize:13,color:"#94a3b8",padding:8}}>Ni storitev.</div>}
          {str.map((s,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
            <div><div style={{fontSize:13,color:"#0f2744",fontWeight:600}}>{s.opis||"Storitev"}</div><div style={{fontSize:11,color:"#94a3b8"}}>{fmt(s.datum_od+"T00:00:00")} – {fmt(s.datum_do+"T00:00:00")}</div></div>
            {s.znesek&&<div style={{fontWeight:700,color:"#16a34a"}}>{parseFloat(s.znesek).toFixed(2)} €</div>}
          </div>)}
        </div>

        {/* OPOMBE */}
        <div style={st.card}>
          <div style={st.cardTitle}>📝 Opombe ({opm.length})</div>
          {opm.length===0&&<div style={{fontSize:13,color:"#94a3b8",padding:8}}>Ni opomb.</div>}
          {opm.map((o,i)=><div key={i} style={{background:"#fffbeb",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #fde68a"}}>
            <div style={{fontSize:13,color:"#0f2744"}}>{o.opomba}</div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>{fmt(o.datum_od+"T00:00:00")} – {fmt(o.datum_do+"T00:00:00")}</div>
          </div>)}
        </div>

      </div>
      {toast&&<div style={{...st.toast,background:toast.err?"#dc2626":"#16a34a"}}>{toast.txt}</div>}
    </div>);
  }

  // ===== DERIVED ZA ZAVIHEK "NOVI VNOSI" =====
  const odprtiVnosi=vozVzdz.filter(s=>s.status!=="opravljeno");
  const vnosiPrikazani=(vnosiFilter==="odprti"?odprtiVnosi:vozVzdz).slice().sort((a,b)=>new Date(b.datum)-new Date(a.datum));
  const vnosiSkupniZnesek=vnosiPrikazani.reduce((a,s)=>a+(parseFloat(s.znesek)||0),0);

  // SEZNAM VOZNIKOV + NOVI VNOSI
  return(<div style={st.wrap}>
    <div style={st.header}><div style={st.logo}>🔧 Vzdrževanje</div><div style={st.sub}>Jurjevec Transport · {vozniki.length} voznikov</div></div>

    {/* ZAVIHKA */}
    <div style={{display:"flex",gap:8,padding:"14px 20px 0"}}>
      <button style={{flex:1,padding:"10px 0",borderRadius:10,border:`1.5px solid ${tab==="vozniki"?"#0f2744":"#e2e8f0"}`,background:tab==="vozniki"?"#0f2744":"#f8fafc",fontSize:13,fontWeight:tab==="vozniki"?700:500,color:tab==="vozniki"?"#fff":"#475569",cursor:"pointer"}} onClick={()=>setTab("vozniki")}>🚛 Vozniki</button>
      <button style={{flex:1,padding:"10px 0",borderRadius:10,border:`1.5px solid ${tab==="vnosi"?"#0f2744":"#e2e8f0"}`,background:tab==="vnosi"?"#0f2744":"#f8fafc",fontSize:13,fontWeight:tab==="vnosi"?700:500,color:tab==="vnosi"?"#fff":"#475569",cursor:"pointer"}} onClick={()=>setTab("vnosi")}>📋 Novi vnosi {odprtiVnosi.length>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:11,marginLeft:4}}>{odprtiVnosi.length}</span>}</button>
    </div>

    <div style={st.content}>

      {/* ===== ZAVIHEK: VOZNIKI ===== */}
      {tab==="vozniki"&&<>
        {opozorila.length>0&&<div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:14,padding:14,marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,color:"#dc2626",marginBottom:10}}>⚠️ Registracije — opozorila</div>
          <div style={{fontSize:11,color:"#94a3b8",marginBottom:8,fontStyle:"italic"}}>Obkljukaj, ko je registracija opravljena (podaljša se za 1 leto)</div>
          {opozorila.map((w,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #fee2e2"}}>
              <input type="checkbox" onChange={async(e)=>{
                if(!e.target.checked)return;
                const ok=await podaljsajRegistracijo(w);
                if(!ok)e.target.checked=false;
              }} style={{width:20,height:20,cursor:"pointer",flexShrink:0,accentColor:"#16a34a"}}/>
              <div style={{flex:1,cursor:"pointer"}} onClick={()=>setSel(vozniki.find(v=>v.id===w.id))}>
                <div style={{fontWeight:600,color:"#0f2744"}}>{w.ime} {w.priimek}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{w.vozilo} · {w.tip==="vozilo"?"Vozilo":"Prikolica"}</div>
              </div>
              <div style={{textAlign:"right",cursor:"pointer"}} onClick={()=>setSel(vozniki.find(v=>v.id===w.id))}>
                <div style={{fontWeight:700,color:w.dni<=0?"#dc2626":"#d97706"}}>{w.dni<=0?"Potekla!":`Še ${w.dni} dni`}</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{fmt(w.datum+"T00:00:00")}</div>
              </div>
            </div>))}
        </div>}

        <div style={{fontWeight:700,fontSize:15,color:"#0f2744",marginBottom:12}}>🚛 Vozniki ({vozniki.length})</div>
        {vozniki.map(v=>{
          const regV=daysUntil(v.registracija_pretek);
          const regP=daysUntil(v.registracija_prikolica_pretek);
          const minReg=Math.min(regV!==null?regV:999,regP!==null?regP:999);
          const str=voznikStoritve(v.id);
          const srv=voznikServis(v.id);
          return(<div key={v.id} onClick={()=>setSel(v)} style={{background:"#fff",borderRadius:14,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",cursor:"pointer",borderLeft:`4px solid ${minReg<=30?"#d97706":"#e2e8f0"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:700,fontSize:15,color:"#0f2744"}}>{v.ime} {v.priimek}</div><div style={{fontSize:12,color:"#64748b"}}>{v.vozilo}{v.prikolica?` · Prik: ${v.prikolica}`:""}</div></div>
              <div style={{textAlign:"right"}}>
                {v.registracija_pretek?<div style={{fontSize:11,fontWeight:600,color:regV<=0?"#dc2626":regV<=30?"#d97706":"#16a34a"}}>Vozilo: {fmt(v.registracija_pretek+"T00:00:00")}</div>:<div style={{fontSize:11,color:"#94a3b8"}}>Vozilo: –</div>}
                {v.registracija_prikolica_pretek?<div style={{fontSize:11,fontWeight:600,color:regP<=0?"#dc2626":regP<=30?"#d97706":"#16a34a"}}>Prikolica: {fmt(v.registracija_prikolica_pretek+"T00:00:00")}</div>:<div style={{fontSize:11,color:"#94a3b8"}}>Prikolica: –</div>}
                <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{srv.filter(s=>s.status!=="opravljeno").length} servisov · {str.length} storitev</div>
              </div>
            </div>
          </div>);
        })}
      </>}

      {/* ===== ZAVIHEK: NOVI VNOSI ===== */}
      {tab==="vnosi"&&<>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          <button style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${vnosiFilter==="odprti"?"#0f2744":"#e2e8f0"}`,background:vnosiFilter==="odprti"?"#0f2744":"#fff",color:vnosiFilter==="odprti"?"#fff":"#475569",fontSize:13,fontWeight:vnosiFilter==="odprti"?700:500,cursor:"pointer"}} onClick={()=>setVnosiFilter("odprti")}>Odprti ({odprtiVnosi.length})</button>
          <button style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${vnosiFilter==="vsi"?"#0f2744":"#e2e8f0"}`,background:vnosiFilter==="vsi"?"#0f2744":"#fff",color:vnosiFilter==="vsi"?"#fff":"#475569",fontSize:13,fontWeight:vnosiFilter==="vsi"?700:500,cursor:"pointer"}} onClick={()=>setVnosiFilter("vsi")}>Vsi ({vozVzdz.length})</button>
        </div>

        {vnosiPrikazani.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:"40px 20px",fontSize:14}}>{vnosiFilter==="odprti"?"🎉 Ni odprtih vnosov.":"Ni vnosov."}</div>}

        {vnosiPrikazani.map(s=>{
          const v=voznikInfo(s.voznik_id);
          const opravljeno=s.status==="opravljeno";
          const ime=v?`${v.ime} ${v.priimek}`:"Neznan voznik";
          const vozilo=s.vozilo||v?.vozilo||"";
          return(<div key={s.id} style={{background:opravljeno?"#f0fdf4":"#fff",borderRadius:12,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",borderLeft:`4px solid ${opravljeno?"#16a34a":"#d97706"}`,opacity:opravljeno?0.88:1}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0f2744"}}>{tipLabel(s.tip)}</div>
                <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{ime}{vozilo?` · ${vozilo}`:""}</div>
              </div>
              <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:opravljeno?"#dcfce7":"#fef3c7",color:opravljeno?"#15803d":"#92400e"}}>{opravljeno?"✅ Rešeno":"⏳ Odprto"}</span>
            </div>
            {s.opis&&<div style={{fontSize:13,color:"#1e293b",margin:"6px 0",lineHeight:1.4,whiteSpace:"pre-wrap"}}>{s.opis}</div>}
            <div style={{display:"flex",gap:10,alignItems:"center",marginTop:8}}>
              {s.slika_url&&<a href={s.slika_url} target="_blank" rel="noopener noreferrer"><img src={s.slika_url} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:6,border:"1px solid #e2e8f0"}}/></a>}
              <div style={{flex:1,fontSize:12,color:"#64748b"}}>📅 {fmt(s.datum+"T00:00:00")}{s.kilometrina?` · ${Number(s.kilometrina).toLocaleString()} km`:""}</div>
              {s.znesek&&<div style={{fontSize:13,fontWeight:700,color:"#16a34a"}}>{parseFloat(s.znesek).toFixed(2)} €</div>}
            </div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button style={{flex:1,background:opravljeno?"#f1f5f9":"#16a34a",color:opravljeno?"#475569":"#fff",border:"none",borderRadius:8,padding:9,fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={()=>toggleServisStatus(s.id,opravljeno?"odprto":"opravljeno")}>{opravljeno?"↩️ Ponastavi na odprto":"✅ Označi opravljeno"}</button>
              <button style={{background:"#f1f5f9",color:"#dc2626",border:"none",borderRadius:8,padding:"9px 14px",fontSize:14,cursor:"pointer"}} onClick={()=>brisiServis(s.id)}>🗑️</button>
            </div>
          </div>);
        })}

        {vnosiSkupniZnesek>0&&<div style={{marginTop:8,paddingTop:14,borderTop:"2px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#0f2744"}}>💰 Skupaj stroški ({vnosiFilter==="odprti"?"odprti":"vsi"})</div>
          <div style={{fontSize:18,fontWeight:800,color:"#16a34a"}}>{vnosiSkupniZnesek.toFixed(2)} €</div>
        </div>}
      </>}

    </div>
    {toast&&<div style={{...st.toast,background:toast.err?"#dc2626":"#16a34a"}}>{toast.txt}</div>}
  </div>);
}

const st={
  wrap:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:800,margin:"0 auto"},
  header:{background:"linear-gradient(135deg,#0f2744 0%,#1d4ed8 100%)",padding:"20px 24px",color:"#fff"},
  logo:{fontSize:22,fontWeight:800},
  sub:{fontSize:13,opacity:0.7,marginTop:4},
  backBtn:{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",padding:"6px 14px",borderRadius:20,fontSize:13,cursor:"pointer",marginBottom:10,display:"block"},
  content:{padding:20},
  card:{background:"#fff",borderRadius:16,padding:18,marginBottom:14,boxShadow:"0 1px 5px rgba(0,0,0,0.07)"},
  cardTitle:{fontWeight:700,fontSize:16,color:"#0f2744",marginBottom:14},
  input:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"11px 13px",fontSize:15,outline:"none",boxSizing:"border-box",background:"#f8fafc"},
  toast:{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",color:"#fff",padding:"12px 24px",borderRadius:30,fontWeight:700,fontSize:14,zIndex:400,boxShadow:"0 4px 20px rgba(0,0,0,0.25)"},
};
