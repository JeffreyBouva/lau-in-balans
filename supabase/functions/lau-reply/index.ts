import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { bouwPrompt, type Bericht } from '../_shared/prompt-builder.ts';
import { cors } from '../_shared/cors.ts';
import { bepaalLimiet, maandStartAmsterdamUTC } from '../_shared/limiet.ts';
import type { AIProfile, Porties } from '../../../packages/shared/src/types.ts';

const LEEG: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };

// Modellen uit de env zodat een wissel een secrets-update is en geen code-deploy.
// De defaults zijn wat er tot nu toe hardcoded stond.
const MODEL = Deno.env.get('LAU_MODEL') ?? 'claude-sonnet-5';
const SUGGESTIE_MODEL = Deno.env.get('LAU_SUGGESTIE_MODEL') ?? 'claude-haiku-4-5';

// Best-effort vervolgsuggesties (tier 2): korte berichten die de KLANT zou kunnen tikken na
// Lau's antwoord. Losse, snelle Haiku-call — faalt 'ie, dan [] en valt de app terug op de
// regel-gebaseerde set. Raakt de veiligheids-kritische antwoord-flow niet.
async function genereerSuggesties(
  anthropic: Anthropic,
  gesprek: { role: 'user' | 'assistant'; content: string }[],
  antwoord: string,
): Promise<string[]> {
  try {
    const context = gesprek.slice(-6).map((m) => `${m.role === 'user' ? 'Klant' : 'Lau'}: ${m.content}`).join('\n');
    const res = await anthropic.messages.create({
      model: SUGGESTIE_MODEL,
      max_tokens: 200,
      system:
        "Je bedenkt korte vervolgberichten die de KLANT zou kunnen tikken na Lau's antwoord. " +
        'Nederlands, in de ik-vorm van de klant, elk max 6 woorden, natuurlijk en passend bij het gesprek. ' +
        'Nooit getallen, calorieën of grammen. Antwoord met UITSLUITEND een JSON-array van 3 strings.',
      messages: [
        { role: 'user', content: `${context}\nLau: ${antwoord}\n\nGeef 3 korte vervolgberichten voor de klant als JSON-array.` },
      ],
    });
    const blok = res.content.find((b) => b.type === 'text');
    const txt = blok && blok.type === 'text' ? blok.text : '[]';
    const start = txt.indexOf('['), eind = txt.lastIndexOf(']');
    if (start === -1 || eind === -1) return [];
    const arr = JSON.parse(txt.slice(start, eind + 1));
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()).slice(0, 4) : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  // CORS-preflight: browsers sturen eerst een OPTIONS zonder auth-header.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('geen sessie', { status: 401, headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;

  // 1. Klant identificeren uit de JWT — nooit een client_id uit de request-body vertrouwen.
  const alsKlant = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: gebruiker } = await alsKlant.auth.getUser();
  const clientId = gebruiker.user?.id;
  if (!clientId) return new Response('ongeldige sessie', { status: 401, headers: cors });

  // 2. Context PARALLEL laden met de service role — scheelt round-trips t.o.v. sequentieel.
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const maandStart = maandStartAmsterdamUTC();
  const [profielRes, berichtenRes, logsRes, klantRes, usageRes, configRes] = await Promise.all([
    db.from('ai_profile_versions').select('profiel').eq('client_id', clientId)
      .order('versie', { ascending: false }).limit(1).maybeSingle(),
    db.from('messages').select('sender, tekst').eq('client_id', clientId)
      .order('created_at', { ascending: false }).limit(20), // nieuwste 20...
    db.from('food_logs').select('porties').eq('client_id', clientId)
      .gte('datum', weekStart.toISOString().slice(0, 10)),
    db.from('clients').select('tier, ai_limiet').eq('id', clientId).maybeSingle(),
    // head: true haalt geen rijen op, alleen de telling — het gaat om het aantal
    // berichten deze maand, niet om de rijen zelf.
    db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('client_id', clientId)
      .gte('created_at', maandStart),
    db.from('app_config').select('value').eq('key', 'ai_maandlimiet').maybeSingle(),
  ]);

  // Server-side enforcement: de slot-UI is geen papieren slot. Een DB-fout is een
  // 503 (retryable), géén 403 — anders leest een storing als "moet upgraden".
  if (klantRes.error) return new Response('tijdelijk niet beschikbaar', { status: 503, headers: cors });
  const klant = klantRes.data as { tier: string; ai_limiet: number | null } | null;
  if (klant?.tier !== 'coached') return new Response('coached vereist', { status: 403, headers: cors });

  // Maandlimiet vóór al het Claude-werk: afkappen ná de call kost geld en levert een
  // antwoord op dat niemand mag zien. Eigen limiet wint van de config-default (300).
  // Een DB-FOUT op de telling is bewust FAIL-OPEN: metering is geen veiligheidsgrens
  // (dat is de tier-check hierboven, en die is fail-closed). Een hikje in ai_usage mag
  // een klant zijn gesprek niet kosten — we waarschuwen in de logs en gaan door.
  const limiet = bepaalLimiet(klant.ai_limiet, configRes.data?.value);
  if (usageRes.error) {
    console.warn('ai_usage-telling mislukt, limiet niet afgedwongen:', usageRes.error.message);
  } else if ((usageRes.count ?? 0) >= limiet) {
    return new Response('limiet bereikt', { status: 429, headers: cors });
  }

  const profielRij = profielRes.data;
  if (!profielRij) return new Response('geen profiel', { status: 409, headers: cors });
  const profiel = profielRij.profiel as AIProfile;

  const berichten = ((berichtenRes.data ?? []) as Bericht[]).reverse(); // ...chronologisch (oud → nieuw)
  const nieuwBericht = [...berichten].reverse().find((b) => b.sender === 'client')?.tekst;
  if (!nieuwBericht) return new Response('geen klantbericht', { status: 400, headers: cors });
  const historie = berichten.slice(0, -1); // alles behalve het laatste (= het nieuwe bericht)

  const gelogd = (logsRes.data ?? []).reduce<Porties>((s, r) => {
    const p = r.porties as Porties;
    return {
      eiwit: s.eiwit + p.eiwit,
      groente: s.groente + p.groente,
      koolhydraten: s.koolhydraten + p.koolhydraten,
      vet: s.vet + p.vet,
    };
  }, { ...LEEG });

  // 3. Prompt bouwen.
  const { system, messages } = bouwPrompt({
    profiel,
    berichten: historie,
    weekcontext: { portiedoelen: profiel.portiedoelen, gelogd },
    nieuwBericht,
  });

  // 4. Claude STREAMEND: schrijf het Lau-bericht bij de eerste tekst en werk het getembet
  //    bij (~elke 150ms). De app laat de tekst vloeiend groeien via realtime UPDATE-events.
  //    Alles staat in een try zodat een stream-/DB-hik de slotschrijf niet kan afbreken.
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const FALLBACK = 'Ik ben er zo weer — probeer het zo nog eens.';
  let tekst = '';
  let berichtId: string | null = null;
  let geweigerd = false;
  // Buiten de try, want de metering hieronder moet ook na een hik nog tellen (dan 0/0).
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system,
      messages,
    });
    let laatsteUpdate = 0;
    for await (const event of stream) {
      if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue; // denk-deltas overslaan
      tekst += event.delta.text;
      const nu = Date.now();
      if (!berichtId) {
        // Eerste tekst → insert (bubble verschijnt, typ-indicator uit); geen lege bubble.
        const { data } = await db.from('messages').insert({ client_id: clientId, sender: 'ai', tekst }).select('id').single();
        berichtId = (data as { id: string } | null)?.id ?? null;
        laatsteUpdate = nu;
      } else if (nu - laatsteUpdate >= 150) {
        await db.from('messages').update({ tekst }).eq('id', berichtId);
        laatsteUpdate = nu;
      }
    }
    const finaal = await stream.finalMessage();
    inputTokens = finaal.usage?.input_tokens ?? 0;
    outputTokens = finaal.usage?.output_tokens ?? 0;
    // Veiligheidsclassifier kan weigeren (stop_reason 'refusal') → warme fallback.
    geweigerd = finaal.stop_reason === 'refusal';
    if (geweigerd) tekst = FALLBACK;
    else if (!tekst) {
      const blok = finaal.content.find((b) => b.type === 'text');
      if (blok && blok.type === 'text') tekst = blok.text;
    }
  } catch (_e) {
    // Stream- of DB-hik: gebruik wat er al is; is er niks, dan de warme fallback.
    if (!tekst) tekst = FALLBACK;
  }

  // Slotschrijf gebeurt ALTIJD (ook na een hik) zodat het bericht volledig is.
  if (berichtId) {
    await db.from('messages').update({ tekst }).eq('id', berichtId);
  } else {
    const { data } = await db.from('messages').insert({ client_id: clientId, sender: 'ai', tekst }).select('id').single();
    berichtId = (data as { id: string } | null)?.id ?? null;
  }

  // Metering: één rij per beantwoord bericht — óók na een stream-hik, want de klant
  // heeft dan wél een antwoord gekregen (met 0/0 tokens). Best-effort: een fout hier
  // mag het antwoord nooit breken, dus loggen en doorgaan. De suggestie-call telt niet
  // apart mee; de limiet telt gesprekken, niet API-calls (D1/A13).
  try {
    const { error } = await db.from('ai_usage').insert({
      client_id: clientId,
      model: MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });
    if (error) console.warn('ai_usage-insert mislukt:', error.message);
  } catch (e) {
    console.warn('ai_usage-insert mislukt:', e);
  }

  const suggesties = geweigerd ? [] : await genereerSuggesties(anthropic, messages, tekst);
  // berichtId + tekst terug: de app garandeert zo het volledige antwoord, ook als een
  // streaming-UPDATE onderweg gemist is.
  return new Response(JSON.stringify({ ok: true, suggesties, berichtId, tekst }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
