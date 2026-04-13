// supabase.js - Supabase klient za TransApp
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yxaqnvxihfxhpebsgflc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_MK8IOnYCZKYC_gggJCZjFw_ypRV5wWm'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── VOZNIKI ────────────────────────────────────────────────────────────────
export const getVozniki = async () => {
  const { data, error } = await supabase
    .from('vozniki')
    .select('*')
    .eq('aktiven', true)
    .order('priimek')
  if (error) throw error
  return data
}

// ─── NALOGI ─────────────────────────────────────────────────────────────────
export const getNalogi = async () => {
  const { data, error } = await supabase
    .from('nalogi')
    .select('*, vozniki(id, ime, priimek, vozilo)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const getNalogiZaVoznika = async (voznikId) => {
  const { data, error } = await supabase
    .from('nalogi')
    .select('*')
    .eq('voznik_id', voznikId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const ustvariNalog = async (nalog) => {
  const { data, error } = await supabase
    .from('nalogi')
    .insert([{
      stevilka_naloga: '',
      status: 'nov',
      stranka: nalog.stranka,
      blago: nalog.blago,
      kolicina: nalog.kolicina,
      teza: nalog.teza,
      nak_firma: nalog.nakFirma,
      nak_kraj: nalog.nakKraj,
      nak_naslov: nalog.nakNaslov,
      nak_referenca: nalog.nakReferenca,
      nak_datum: nalog.nakDatum || null,
      nak_cas: nalog.nakCas || null,
      raz_firma: nalog.razFirma,
      raz_kraj: nalog.razKraj,
      raz_naslov: nalog.razNaslov,
      raz_referenca: nalog.razReferenca,
      raz_datum: nalog.razDatum || null,
      raz_cas: nalog.razCas || null,
      navodila: nalog.navodila,
      voznik_id: nalog.voznikId || null,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export const posodobiStatusNaloga = async (id, status) => {
  const updates = { status }
  if (status === 'poslan') updates.poslan_cas = new Date().toISOString()
  if (status === 'sprejet') updates.sprejet_cas = new Date().toISOString()
  if (status === 'zakljucen') updates.zakljucen_cas = new Date().toISOString()

  const { data, error } = await supabase
    .from('nalogi')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const dodeliVoznika = async (nalogId, voznikId) => {
  const { data, error } = await supabase
    .from('nalogi')
    .update({ voznik_id: voznikId, status: 'poslan', poslan_cas: new Date().toISOString() })
    .eq('id', nalogId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const izbrisiNalog = async (id) => {
  const { error } = await supabase.from('nalogi').delete().eq('id', id)
  if (error) throw error
}

// ─── CMR DOKUMENTI ──────────────────────────────────────────────────────────
export const naložiCMR = async (nalogId, file, base64Data) => {
  // Pretvori base64 v blob
  const response = await fetch(base64Data)
  const blob = await response.blob()
  const pot = `${nalogId}/${Date.now()}-${file.name || 'cmr.jpg'}`

  const { error: uploadError } = await supabase.storage
    .from('cmr-dokumenti')
    .upload(pot, blob, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('cmr_dokumenti')
    .insert([{ nalog_id: nalogId, ime_datoteke: file.name || 'cmr.jpg', storage_pot: pot }])
    .select()
    .single()
  if (error) throw error
  return data
}

export const getCMRZaNalog = async (nalogId) => {
  const { data, error } = await supabase
    .from('cmr_dokumenti')
    .select('*')
    .eq('nalog_id', nalogId)
    .order('created_at')
  if (error) throw error

  // Pridobi URL za vsako sliko
  const sLinkovi = await Promise.all(data.map(async (doc) => {
    const { data: urlData } = supabase.storage
      .from('cmr-dokumenti')
      .getPublicUrl(doc.storage_pot)
    return { ...doc, url: urlData.publicUrl }
  }))
  return sLinkovi
}

// ─── OBRAČUNI ───────────────────────────────────────────────────────────────
export const getObracuni = async () => {
  const { data, error } = await supabase
    .from('obracuni')
    .select('*, vozniki(id, ime, priimek, vozilo)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const ustvariObracun = async (obracun) => {
  const { data, error } = await supabase
    .from('obracuni')
    .insert([{
      voznik_id: obracun.voznikId,
      dat_zac: obracun.datZac,
      dat_kon: obracun.datKon,
      km: obracun.km,
      stranke: obracun.stranke,
      stroski: obracun.stroski || [],
      zakljucen: true,
      zakljucen_cas: new Date().toISOString(),
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── RAČUNI ─────────────────────────────────────────────────────────────────
export const getRacuni = async () => {
  const { data, error } = await supabase
    .from('racuni')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const ustvariRacun = async (racun) => {
  const { data, error } = await supabase
    .from('racuni')
    .insert([{
      stevilka_racuna: '',
      nalog_id: racun.nalogId || null,
      stranka: racun.stranka,
      znesek: racun.znesek,
      datum_izdaje: racun.datum,
      datum_rok: racun.rok,
      status: 'osnutek',
      opombe: racun.opombe || '',
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export const posodobiStatusRacuna = async (id, status) => {
  const { data, error } = await supabase
    .from('racuni')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── REAL-TIME SUBSCRIPTION ─────────────────────────────────────────────────
export const subscribeNalogi = (callback) => {
  return supabase
    .channel('nalogi-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nalogi' }, callback)
    .subscribe()
}

export const subscribeObracuni = (callback) => {
  return supabase
    .channel('obracuni-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'obracuni' }, callback)
    .subscribe()
}
