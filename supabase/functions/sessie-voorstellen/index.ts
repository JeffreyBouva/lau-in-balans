// Sessie-voorstellen (dashboard-v2 §9, stap 2): na het wekelijkse gesprek zet dit Laura's
// notitie + de aangevinkte signalen om in maximaal drie concrete profielwijzigingen.
//
// Het model beslist niets — het stelt voor. Laura kiest per kaart "Toepassen" of
// "Overslaan", en pas dán schrijft het dashboard een nieuwe profielversie. Daarom is de
// output hier een strak contract (veld/oud/nieuw/toelichting) en geen vrije tekst.
//
// De caller is een COACH met een gewone JWT. `verify_jwt = false` in config.toml (net als
// lau-reply): platform-verificatie blokkeert de CORS-preflight, want die OPTIONS-request
// draagt geen auth-header. De poort staat hieronder — getUser() op de JWT plus de check
// dat de klant van déze coach is (of dat de beller de admin is: die ziet elke klant).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { cors } from '../_shared/cors.ts';
import { GUARDRAILS } from '../_shared/guardrails.ts';
import { PORTIE_DOEL_DEFAULT } from '../../../packages/shared/src/handmaten.ts';
import type { AIProfile, Porties } from '../../../packages/shared/src/types.ts';

// Het betere model: dit is één keer per week per klant, en het is het enige moment waarop
// de AI iets over zijn eigen instellingen zegt. Zelfde env-naam als lau-reply, zodat één
// secrets-update beide meeneemt.
const MODEL = Deno.env.get('LAU_MODEL') ?? 'claude-sonnet-5';

const LEEG: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * De velden die een voorstel mag raken — exact de enum die `useGesprek` terugvertaalt.
 *
 * `portiedoelen` staat er bewust NIET bij: dat zijn getallen die elke dag in Lau's prompt
 * meegaan, en ze verschuiven is een besluit dat Laura in kolom 2 van het klantdossier
 * neemt (mét het weekgemiddelde ernaast), niet iets wat via een zin in een voorstel de
 * database in glijdt. Het dashboard heeft er dan ook geen "Toepassen"-knop voor.
 */
const VELDEN = [
  'doelen',
  'knelpunten',
  'voorkeuren',
  'beperkingen',
  'checkinRitme',
  'aanpak',
  'toon',
  'vermijdenInCoaching',
] as const;

const MAX_VOORSTELLEN = 3;
// Grenzen op wat er binnenkomt: de notitie is coach-invoer, maar een per ongeluk geplakt
// document (of een geplakte instructie aan het model) hoort niet ongelimiteerd de prompt in.
const MAX_NOTITIE = 4000;
const MAX_SIGNALEN = 10;
const MAX_SIGNAAL = 120;
// En grenzen op wat eruit komt: `nieuw` belandt via "Toepassen" ongefilterd in het profiel,
// en dat profiel gaat elke dag mee in Lau's systemprompt. Een uitgelopen antwoord laten we
// liever vallen dan half opslaan.
const MAX_NIEUW = 800;
const MAX_TOELICHTING = 300;
// Lijstvelden worden in het dashboard terug gesplitst op de scheidingstekens; de grens
// geldt daarom per item en niet per veld — exact de caps van het klant-pad
// (werk_mijn_profiel_bij, fase 7): hoogstens 20 items van elk 200 tekens. Eén uitgelopen
// item verdwijnt; de rest van het voorstel blijft gewoon bruikbaar.
const LIJSTVELDEN = ['doelen', 'knelpunten', 'voorkeuren', 'beperkingen', 'checkinRitme'];
const MAX_ITEMS = 20;
const MAX_ITEM = 200;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function tekst(waarde: unknown): string {
  return typeof waarde === 'string' ? waarde.trim() : '';
}

type Voorstel = { veld: string; oud: string; nieuw: string; toelichting: string };

/**
 * Een lijstveld-waarde opschonen: zelfde split als het dashboard (' · ' opgedragen, maar
 * een model maakt er ook wel eens een bullet of een regeleinde van), items boven de grens
 * eruit, en weer netjes samengevoegd. Leeg terug = er bleef niets bruikbaars over.
 */
function schoonLijst(nieuw: string): string {
  return nieuw
    .split(/[·•\n;]/)
    .map((deel) => deel.trim())
    .filter((deel) => deel !== '' && deel.length <= MAX_ITEM)
    .slice(0, MAX_ITEMS)
    .join(' · ');
}

/**
 * Het antwoord van het model → voorstellen. Defensief in elke stap: dit is LLM-output die
 * één klik later in de database staat. Alles wat niet exact klopt valt weg; blijft er niets
 * over, dan is dat een geldige uitkomst ("geen aanleiding gezien") en geen fout.
 */
function leesVoorstellen(txt: string): Voorstel[] {
  // Zelfde truc als genereerSuggesties in lau-reply: pak het JSON-blok uit de tekst, ook
  // als het model er een zin omheen zet.
  const start = txt.indexOf('[');
  const eind = txt.lastIndexOf(']');
  if (start === -1 || eind === -1 || eind < start) return [];
  let rauw: unknown;
  try {
    rauw = JSON.parse(txt.slice(start, eind + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(rauw)) return [];

  const uit: Voorstel[] = [];
  for (const item of rauw) {
    if (uit.length >= MAX_VOORSTELLEN) break;
    const v = (item ?? {}) as Record<string, unknown>;
    const veld = tekst(v.veld);
    const nieuw = tekst(v.nieuw);
    if (!(VELDEN as readonly string[]).includes(veld)) continue; // verzonnen veldnaam
    if (nieuw === '' || nieuw.length > MAX_NIEUW) continue; // niets te beslissen, of te lang
    if (uit.some((r) => r.veld === veld)) continue; // twee voorstellen voor één veld: het tweede overschrijft het eerste stilletjes
    // Lijstvelden per item begrenzen; blijft er niets over, dan is er niets voor te stellen.
    const waarde = LIJSTVELDEN.includes(veld) ? schoonLijst(nieuw) : nieuw;
    if (waarde === '') continue;
    uit.push({
      veld,
      // oud en toelichting zijn toonwerk: afkappen is hier onschadelijk.
      oud: tekst(v.oud).slice(0, MAX_NIEUW),
      nieuw: waarde,
      toelichting: tekst(v.toelichting).slice(0, MAX_TOELICHTING),
    });
  }
  return uit;
}

function weekregel(gelogd: Porties, doelen: Porties): string {
  return `- Gelogd de afgelopen 7 dagen vs. dagdoel: eiwit ${gelogd.eiwit}/${doelen.eiwit * 7}, groente ${gelogd.groente}/${doelen.groente * 7}, koolhydraten ${gelogd.koolhydraten}/${doelen.koolhydraten * 7}, vet ${gelogd.vet}/${doelen.vet * 7} (handmaten, weektotaal).`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('geen sessie', { status: 401, headers: cors });

  let body: { client_id?: unknown; notitie?: unknown; signalen?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('ongeldige body', { status: 400, headers: cors });
  }
  const clientId = tekst(body.client_id);
  if (!UUID.test(clientId)) return new Response('client_id ontbreekt', { status: 400, headers: cors });
  const notitie = tekst(body.notitie).slice(0, MAX_NOTITIE);
  if (notitie === '') return new Response('notitie ontbreekt', { status: 400, headers: cors });
  const signalen = (Array.isArray(body.signalen) ? body.signalen : [])
    .map((s) => tekst(s).slice(0, MAX_SIGNAAL))
    .filter((s) => s !== '')
    .slice(0, MAX_SIGNALEN);

  const url = Deno.env.get('SUPABASE_URL')!;

  // 1. Wie belt er? Uit de JWT, nooit uit de body.
  const alsCoach = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: gebruiker } = await alsCoach.auth.getUser();
  const coachId = gebruiker.user?.id;
  if (!coachId) return new Response('ongeldige sessie', { status: 401, headers: cors });

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // 2a. Is de beller überhaupt een coach, en zo ja: is ze de admin? Laura is de eigenaar
  //     van het product en ziet elke klant (coaches.is_admin, zie de admin-migratie);
  //     een gewone coach blijft bij haar eigen klanten. Geen coaches-rij = geen coach —
  //     een klant die hier belt strandt hier, ongeacht wat er in de body staat.
  const { data: coachRij, error: coachFout } = await db.from('coaches')
    .select('is_admin').eq('id', coachId).maybeSingle();
  if (coachFout) {
    console.error('sessie-voorstellen: coach laden mislukt:', coachFout.message);
    return new Response('tijdelijk niet beschikbaar', { status: 503, headers: cors });
  }
  if (!coachRij) return new Response('geen toegang', { status: 403, headers: cors });
  const isAdmin = (coachRij as { is_admin?: boolean | null }).is_admin === true;

  // 2b. Bestaat de klant, en — voor een gewone coach — is het háár klant? Geen rij = 403,
  //     ongeacht welke van de twee het was. De admin checkt alleen dát de klant bestaat.
  let klantQuery = db.from('clients').select('id').eq('id', clientId);
  if (!isAdmin) klantQuery = klantQuery.eq('coach_id', coachId);
  const { data: klant, error: klantFout } = await klantQuery.maybeSingle();
  if (klantFout) {
    console.error('sessie-voorstellen: klant laden mislukt:', klantFout.message);
    return new Response('tijdelijk niet beschikbaar', { status: 503, headers: cors });
  }
  if (!klant) return new Response('geen toegang', { status: 403, headers: cors });

  // 3. Context: het huidige profiel en de week eronder.
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const [profielRes, logsRes] = await Promise.all([
    db.from('ai_profile_versions').select('profiel').eq('client_id', clientId)
      .order('versie', { ascending: false }).limit(1).maybeSingle(),
    db.from('food_logs').select('porties').eq('client_id', clientId)
      .gte('datum', weekStart.toISOString().slice(0, 10)),
  ]);
  if (profielRes.error) {
    // Zonder het huidige profiel weet het model niet wat "oud" is en zou het bestaande
    // waarden kunnen wegvoorstellen. Dat is het één ronde niet waard.
    console.error('sessie-voorstellen: profiel laden mislukt:', profielRes.error.message);
    return new Response('tijdelijk niet beschikbaar', { status: 503, headers: cors });
  }
  if (logsRes.error) {
    console.warn('sessie-voorstellen: logs laden mislukt:', logsRes.error.message);
  }

  const profiel = (profielRes.data?.profiel ?? null) as AIProfile | null;
  const doelen: Porties = { ...PORTIE_DOEL_DEFAULT, ...(profiel?.portiedoelen ?? {}) };
  const gelogd = (logsRes.data ?? []).reduce<Porties>((s, r) => {
    const p = r.porties as Porties;
    return {
      eiwit: s.eiwit + p.eiwit,
      groente: s.groente + p.groente,
      koolhydraten: s.koolhydraten + p.koolhydraten,
      vet: s.vet + p.vet,
    };
  }, { ...LEEG });

  const system = [
    'Je helpt coach Laura het AI-profiel van haar klant bijstellen ná het wekelijkse gesprek. Je bent hier niet Lau en je schrijft niet aan de klant: je schrijft aan Laura, in het Nederlands.',
    // De guardrails gelden ook voor wat je vóórstelt: het profiel stuurt Lau elke dag aan,
    // dus een voorstel dat over grammen of medisch advies gaat zou de regels omzeilen via
    // de achterdeur.
    GUARDRAILS,
    profiel === null
      ? 'Deze klant heeft nog geen profiel; wat je voorstelt worden de eerste waarden. Laat "oud" dan leeg.'
      : `Het huidige profiel (JSON):\n${JSON.stringify(profiel, null, 2)}`,
    ['Wat de logs zeggen:', weekregel(gelogd, doelen)].join('\n'),
    [
      'Opdracht: bepaal welke velden bijgesteld moeten worden op grond van Laura\'s notitie en de aangevinkte signalen.',
      'Antwoord met UITSLUITEND een JSON-array, zonder tekst eromheen, met maximaal 3 objecten van de vorm:',
      '[{"veld": "...", "oud": "...", "nieuw": "...", "toelichting": "..."}]',
      `- "veld" is precies één van: ${VELDEN.join(', ')}.`,
      '- "oud" is de huidige waarde van dat veld en "nieuw" de VOLLEDIGE nieuwe waarde — niet alleen wat erbij komt, want "nieuw" vervangt het veld in zijn geheel.',
      '- Lijstvelden (doelen, knelpunten, voorkeuren, beperkingen, checkinRitme) schrijf je als één string met " · " tussen de items.',
      '- De portiedoelen (handmaten) staan niet in die lijst en stel je niet voor: die zet Laura zelf bij in het profiel. Wat de logs zeggen mag je wél gebruiken als reden voor een ander veld.',
      '- "toelichting" is één zin voor Laura: waarom deze bijstelling.',
      '- Stel alleen iets voor waar de notitie of de signalen aanleiding toe geven. Herhaal geen ongewijzigde waarden en verzin geen veldnamen.',
      '- Geen aanleiding gezien? Antwoord dan met [].',
    ].join('\n'),
  ].join('\n\n');

  const gebruikersbericht = [
    'Notitie van Laura na het gesprek:',
    notitie,
    '',
    `Signalen die Laura aanvinkte: ${signalen.length > 0 ? signalen.join(', ') : '(geen)'}`,
  ].join('\n');

  // 4. Eén call. Alles wat misgaat — API-hik, weigering, onparsebare tekst — geeft een lege
  //    lijst met 200: het dashboard heeft daar een lege-staat voor ("Lau zag geen
  //    aanleiding"), en vastleggen werkt sowieso zonder voorstellen.
  let voorstellen: Voorstel[] = [];
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const res = await anthropic.messages.create({
      model: MODEL,
      // Op sonnet-5 denkt het model standaard mee en telt dat denken mee in max_tokens.
      // 1000 (het plan) is dan krap: loopt het denken uit, dan komt de JSON afgekapt terug
      // en zou Laura "geen aanleiding" lezen terwijl er wel voorstellen wáren. max_tokens
      // is een plafond, geen uitgave — ruimte laten kost niets.
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      // Medium i.p.v. de 'low' van lau-reply: een notitie omzetten in profielwijzigingen is
      // meer werk dan een chatantwoord, en dit gebeurt één keer per week per klant.
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: gebruikersbericht }],
    });
    if (res.stop_reason === 'refusal') {
      console.warn('sessie-voorstellen: model weigerde', res.stop_details ?? '');
    } else {
      const blok = res.content.find((b) => b.type === 'text');
      voorstellen = leesVoorstellen(blok && blok.type === 'text' ? blok.text : '');
      if (voorstellen.length === 0) {
        // Kan "geen aanleiding" zijn, maar ook een afgekapt of onparsebaar antwoord — en
        // die twee zien er in het dashboard identiek uit. Vandaar deze regel in de logs.
        console.log('sessie-voorstellen: geen bruikbare voorstellen, stop_reason:', res.stop_reason);
      }
    }
  } catch (e) {
    console.error('sessie-voorstellen: Claude-call mislukt:', e);
  }

  return json({ voorstellen });
});
