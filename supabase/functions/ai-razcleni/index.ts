import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tekst } = await req.json();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Iz tega dokumenta izvleci podatke za transportni nalog. Vrni SAMO JSON brez razlage:
{"stranka":"","blago":"","kolicina":"","teza":"","nakFirma":"","nakKraj":"","nakNaslov":"","nakReferenca":"","nakDatum":"","nakCas":"","razFirma":"","razKraj":"","razNaslov":"","razReferenca":"","razDatum":"","razCas":"","navodila":"","kontaktEmail":"","kontaktIme":""}
Datumi: YYYY-MM-DD, casi: HH:MM.

Dokument:
${tekst}`
        }]
      })
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}); 
