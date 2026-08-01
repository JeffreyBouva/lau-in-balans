import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { bouwPrompt, type Bericht } from '../_shared/prompt-builder.ts';
import { cors } from '../_shared/cors.ts';
import type { AIProfile, Porties } from '../../../packages/shared/src/types.ts';

const LEEG: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };

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
      model: 'claude-haiku-4-5',
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
  const [profielRes, berichtenRes, logsRes] = await Promise.all([
    db.from('ai_profile_versions').select('profiel').eq('client_id', clientId)
      .order('versie', { ascending: false }).limit(1).maybeSingle(),
    db.from('messages').select('sender, tekst').eq('client_id', clientId)
      .order('created_at', { ascending: false }).limit(20), // nieuwste 20...
    db.from('food_logs').select('porties').eq('client_id', clientId)
      .gte('datum', weekStart.toISOString().slice(0, 10)),
  ]);

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

  // 4. Claude STREAMEND aanroepen: schrijf het Lau-bericht zodra de eerste tekst binnen is
  //    en werk het getembet bij (~elke 250ms). De app laat de tekst live groeien via
  //    realtime UPDATE-events, zodat het antwoord meteen begint te verschijnen.
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system,
    messages,
  });

  let tekst = '';
  let berichtId: string | null = null;
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
    } else if (nu - laatsteUpdate >= 250) {
      await db.from('messages').update({ tekst }).eq('id', berichtId);
      laatsteUpdate = nu;
    }
  }

  const finaal = await stream.finalMessage();
  // Veiligheidsclassifier kan weigeren (stop_reason 'refusal'): vervang door een warme fallback.
  if (finaal.stop_reason === 'refusal') tekst = 'Ik ben er zo weer — probeer het zo nog eens.';
  else if (!tekst) {
    const blok = finaal.content.find((b) => b.type === 'text');
    if (blok && blok.type === 'text') tekst = blok.text;
  }
  // Slotschrijf: de volledige (of fallback-)tekst — pakt ook de laatste tokens sinds de throttle.
  if (berichtId) await db.from('messages').update({ tekst }).eq('id', berichtId);
  else await db.from('messages').insert({ client_id: clientId, sender: 'ai', tekst });

  const suggesties = finaal.stop_reason === 'refusal' ? [] : await genereerSuggesties(anthropic, messages, tekst);
  return new Response(JSON.stringify({ ok: true, suggesties }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
