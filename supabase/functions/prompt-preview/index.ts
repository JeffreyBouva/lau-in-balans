// Prompt-preview (dashboard-v2 §9, stap 3): geeft de coach de ÉCHTE systemprompt die Lau
// maandagochtend krijgt, plus één gesimuleerd openingsbericht.
//
// De handoff is hier expliciet over (§9): "genereer de preview via dezelfde prompt-pipeline
// als de productie-AI, niet met een string-concat". Daarom loopt dit door `bouwPrompt` uit
// _shared — dezelfde functie die lau-reply gebruikt. Verandert de identiteit, de guardrails
// of het profielblok, dan verandert deze preview mee, zonder dat iemand er hier aan denkt.
//
// De caller is een COACH met een gewone JWT (verify_jwt staat dus terecht aan, geen
// config.toml-blok nodig); de functie checkt daarbovenop dat de klant van déze coach is.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { bouwPrompt } from '../_shared/prompt-builder.ts';
import { cors } from '../_shared/cors.ts';
import { PORTIE_DOEL_DEFAULT } from '../../../packages/shared/src/handmaten.ts';
import type { AIProfile, Porties, Veiligheidsvlag } from '../../../packages/shared/src/types.ts';

// Zelfde env-naam als de suggestie-call in lau-reply en het ochtendbericht: dit is één
// kort berichtje, geen redeneerwerk.
const MODEL = Deno.env.get('LAU_SUGGESTIE_MODEL') ?? 'claude-haiku-4-5';

const LEEG: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };
const VEILIG: Veiligheidsvlag[] = ['geen', 'soms', 'voorzichtig', 'overgeslagen'];
// Alleen een echte uuid mag de query in: PostgREST maakt van 'abc' een 22P02-fout, en die
// zou hieronder als "tijdelijk niet beschikbaar" lezen terwijl de request gewoon fout is.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/**
 * De voornaam zoals die de prompt in mag — zelfde regel als in lau-ochtend (bewust
 * gedupliceerd: een gedeeld hulpbestand zou buiten deze commit vallen en de deploy breken).
 * clients.naam is door de klant zelf ingevuld; alles wat er niet als naam uitziet levert
 * een lege string op en dan simuleren we zonder naam. Liever geen naam dan een instructie
 * aan het model in de aanhef.
 */
function veiligeVoornaam(naam: string | null): string {
  const eerste = (naam ?? '').trim().split(/\s+/)[0] ?? '';
  return /^\p{L}[\p{L}'’-]{0,39}$/u.test(eerste) ? eerste : '';
}

function tekst(waarde: unknown): string {
  return typeof waarde === 'string' ? waarde.trim() : '';
}

function lijst(waarde: unknown): string[] {
  if (!Array.isArray(waarde)) return [];
  return waarde.filter((r): r is string => typeof r === 'string' && r.trim() !== '').map((r) => r.trim());
}

function porties(waarde: unknown): Porties {
  const bron = (waarde ?? {}) as Partial<Record<keyof Porties, unknown>>;
  const uit: Porties = { ...PORTIE_DOEL_DEFAULT };
  for (const key of ['eiwit', 'groente', 'koolhydraten', 'vet'] as const) {
    const n = Number(bron[key]);
    if (Number.isFinite(n)) uit[key] = n;
  }
  return uit;
}

/**
 * Het conceptprofiel komt uit de browser en het opgeslagen profiel uit jsonb: allebei
 * `unknown` wat deze functie betreft. `bouwPrompt` doet `p.doelen.join(...)`, dus één
 * ontbrekend veld zou hier een 500 opleveren in plaats van een preview. Normaliseren is
 * goedkoper dan die crash.
 */
function normaliseerProfiel(ruw: unknown): AIProfile {
  const p = (ruw ?? {}) as Partial<Record<keyof AIProfile, unknown>>;
  return {
    doelen: lijst(p.doelen),
    portiedoelen: porties(p.portiedoelen),
    knelpunten: lijst(p.knelpunten),
    voorkeuren: lijst(p.voorkeuren),
    beperkingen: lijst(p.beperkingen),
    checkinRitme: lijst(p.checkinRitme),
    aanpak: tekst(p.aanpak),
    toon: tekst(p.toon),
    vermijdenInCoaching: tekst(p.vermijdenInCoaching),
    veiligheidsvlag: VEILIG.includes(p.veiligheidsvlag as Veiligheidsvlag)
      ? (p.veiligheidsvlag as Veiligheidsvlag)
      : 'overgeslagen',
  };
}

Deno.serve(async (req) => {
  // CORS-preflight: het dashboard is een browser-app en stuurt eerst een OPTIONS zonder auth.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('geen sessie', { status: 401, headers: cors });

  let body: { client_id?: unknown; concept_profiel?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('ongeldige body', { status: 400, headers: cors });
  }
  const clientId = tekst(body.client_id);
  if (!UUID.test(clientId)) return new Response('client_id ontbreekt', { status: 400, headers: cors });
  const concept = body.concept_profiel;
  const heeftConcept = typeof concept === 'object' && concept !== null && !Array.isArray(concept);

  const url = Deno.env.get('SUPABASE_URL')!;

  // 1. Wie belt er? De JWT bepaalt dat, nooit iets uit de body.
  const alsCoach = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: gebruiker } = await alsCoach.auth.getUser();
  const coachId = gebruiker.user?.id;
  if (!coachId) return new Response('ongeldige sessie', { status: 401, headers: cors });

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // 2. Is dit een klant van déze coach? Eén query dekt beide vragen: een klant belt hier
  //    nooit (dan is er geen rij met coach_id = zijn eigen id), en de klant van een andere
  //    coach ook niet. Geen rij = 403, ongeacht welke van de twee het was.
  const { data: klantRij, error: klantFout } = await db.from('clients')
    .select('id, naam').eq('id', clientId).eq('coach_id', coachId).maybeSingle();
  if (klantFout) {
    console.error('prompt-preview: klant laden mislukt:', klantFout.message);
    return new Response('tijdelijk niet beschikbaar', { status: 503, headers: cors });
  }
  if (!klantRij) return new Response('geen toegang', { status: 403, headers: cors });
  const klant = klantRij as { id: string; naam: string | null };

  // 3. Dezelfde context als lau-reply: hoogste profielversie + de logs van 7 dagen.
  //    Berichtenhistorie blijft bewust leeg — dit is een maandagochtend-opening, daar gaat
  //    geen gesprek aan vooraf.
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const [profielRes, logsRes] = await Promise.all([
    db.from('ai_profile_versions').select('profiel').eq('client_id', clientId)
      .order('versie', { ascending: false }).limit(1).maybeSingle(),
    db.from('food_logs').select('porties').eq('client_id', clientId)
      .gte('datum', weekStart.toISOString().slice(0, 10)),
  ]);
  if (profielRes.error) {
    console.error('prompt-preview: profiel laden mislukt:', profielRes.error.message);
    // Zonder concept is er dan niets om te tonen; mét concept is de opgeslagen versie niet
    // eens nodig. Alleen in het eerste geval is dit fataal.
    if (!heeftConcept) return new Response('tijdelijk niet beschikbaar', { status: 503, headers: cors });
  }
  if (logsRes.error) {
    // Niet fataal: de prompt klopt dan op één regel na (weekcijfers op 0). Beter een preview
    // met een gat dan geen preview.
    console.warn('prompt-preview: logs laden mislukt:', logsRes.error.message);
  }

  // Het concept wint: dat is wat Laura nú op het scherm heeft staan, inclusief de
  // voorstellen die ze zojuist toepaste. Geen concept en geen versie (klant nog niet
  // onboarded) → een leeg profiel, en dan laat de preview eerlijk horen dat Lau nog
  // niets over deze klant weet.
  const profiel = normaliseerProfiel(heeftConcept ? concept : profielRes.data?.profiel ?? null);

  const gelogd = (logsRes.data ?? []).reduce<Porties>((s, r) => {
    const p = r.porties as Porties;
    return {
      eiwit: s.eiwit + p.eiwit,
      groente: s.groente + p.groente,
      koolhydraten: s.koolhydraten + p.koolhydraten,
      vet: s.vet + p.vet,
    };
  }, { ...LEEG });

  // 4. De echte pipeline. Wat hieruit komt IS de productieprompt — daarom gaat 'system'
  //    ongewijzigd terug naar het dashboard, zonder de simulatie-instructie hieronder.
  const { system, messages } = bouwPrompt({
    profiel,
    berichten: [],
    weekcontext: { portiedoelen: profiel.portiedoelen, gelogd },
    nieuwBericht: '(ochtend-opening — simulatie)',
  });

  // 5. Eén korte call voor de bubbel in de sage-kaart. Faalt of weigert die, dan is dat
  //    geen storing: de systemprompt is de kern van deze preview en die staat er al.
  //    `opening: null` laat het dashboard dat netjes zeggen.
  const voornaam = veiligeVoornaam(klant.naam);
  const aanhef = voornaam ? `aan ${voornaam}` : 'aan deze klant';
  let opening: string | null = null;
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: [
        system,
        `Dit is een simulatie voor de coach: schrijf het eerste ochtendbericht van maandag ${aanhef}, maximaal 2 zinnen. Antwoord met uitsluitend het bericht zelf, zonder aanhalingstekens of toelichting.`,
      ].join('\n\n'),
      messages,
    });
    // Weigering of een halve zin door de tokengrens: allebei ongeschikt om als "zo klinkt
    // Lau" te tonen — dan liever niets dan een misleidend voorbeeld.
    if (res.stop_reason !== 'refusal' && res.stop_reason !== 'max_tokens') {
      const blok = res.content.find((b) => b.type === 'text');
      if (blok && blok.type === 'text') opening = blok.text.trim() || null;
    }
  } catch (e) {
    console.warn('prompt-preview: Claude-call mislukt:', e);
  }

  // Deze call telt bewust niet mee in ai_usage: die tabel meet wat de KLANT aan Lau kwijt
  // is (maandlimiet), en dit is coach-gereedschap.
  return json({ systemPrompt: system, opening });
});
