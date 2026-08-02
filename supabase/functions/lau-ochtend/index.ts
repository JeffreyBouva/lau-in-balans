// Proactieve Lau (fase 7): één warm ochtendbericht per dag voor coached klanten die
// vandaag nog niets gelogd hebben. Wordt aangeroepen door een dagelijkse cron uit het
// Supabase-dashboard (±10:30 Europe/Amsterdam) met de header x-cron-secret; er komt
// geen JWT aan te pas, de functie draait volledig met de service role.
//
// Idempotent, op twee niveaus: de proactief-check hieronder slaat klanten over die
// vandaag al een bericht kregen, en het unique index messages_proactief_dag_idx maakt
// er een DB-garantie van — check en insert zijn niet atomair, dus twee runs die elkaar
// overlappen zouden er anders allebei doorheen glippen. Handmatig triggeren (curl met
// de secret) is dus veilig, ook naast de lopende cron.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { GUARDRAILS } from '../_shared/guardrails.ts';
import {
  amsterdamseDatum,
  bepaalLimiet,
  dagStartAmsterdamUTC,
  maandStartAmsterdamUTC,
} from '../_shared/limiet.ts';

// Zelfde env als de suggestie-call in lau-reply: dit is een kort, goedkoop berichtje.
const MODEL = Deno.env.get('LAU_SUGGESTIE_MODEL') ?? 'claude-haiku-4-5';

const IDENTITEIT =
  'Je bent Lau, de warme AI-voedingscoach van "Lau in Balans". Je schrijft korte, persoonlijke berichten in het Nederlands. Je meet in handmaten, nooit in getallen. Laura (een mens) leest mee.';

type Klant = { id: string; naam: string | null; ai_limiet: number | null };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * De voornaam zoals die de prompt en het bericht in mag: eerste token, hooguit 40
 * tekens, en uitsluitend letters (unicode — José, Ayşe, Sørine), apostrof of
 * koppelteken. clients.naam is door de klant zelf ingevuld; alles wat daar niet als
 * naam uitziet (cijfers, leestekens, een zin, een instructie aan Lau) levert een lege
 * string op en dan groeten we zonder naam. Liever geen naam dan rommel in de aanhef —
 * of in de systemprompt.
 */
function veiligeVoornaam(naam: string | null): string {
  const eerste = (naam ?? '').trim().split(/\s+/)[0] ?? '';
  return /^\p{L}[\p{L}'’-]{0,39}$/u.test(eerste) ? eerste : '';
}

Deno.serve(async (req) => {
  // 1. De secret-header IS de poort (verify_jwt staat uit voor deze function). Een
  //    ontbrekende CRON_SECRET-env mag daarom nooit fail-open zijn: zonder deze
  //    expliciete check zou `undefined === undefined` iedere aanroep binnenlaten.
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('geen toegang', { status: 401 });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // 2. Killswitch (A14). Alle drie de uitkomsten zijn "niet versturen", maar ze zeggen
  //    iets anders in de cron-logs: een storing hoort niet als een bewuste uit-stand te
  //    lezen, en een ontbrekende rij betekent meestal "migratie nog niet gepusht".
  const { data: configRij, error: configFout } = await db.from('app_config').select('value')
    .eq('key', 'ochtendbericht_actief').maybeSingle();
  if (configFout) {
    console.error('lau-ochtend: killswitch lezen mislukt:', configFout.message);
    return json({ status: 'storing' }, 503);
  }
  if (configRij == null) return json({ status: 'geen-config' });
  if ((configRij as { value: unknown }).value !== true) return json({ status: 'uit' });

  // 3. De config-default één keer lezen (niet per klant). Faalt dit, dan breken we af:
  //    doorgaan met de ingebakken 300 zou de limiet van Laura stil kunnen negeren.
  const { data: limietConfig, error: limietConfigFout } = await db.from('app_config')
    .select('value').eq('key', 'ai_maandlimiet').maybeSingle();
  if (limietConfigFout) {
    console.error('lau-ochtend: ai_maandlimiet lezen mislukt:', limietConfigFout.message);
    return json({ status: 'storing' }, 503);
  }
  const configLimiet = (limietConfig as { value: unknown } | null)?.value;

  // Gestopte klanten krijgen geen ochtendbericht meer: het traject is afgelopen, ook al
  // staat de tier nog op coached (dat is wat de migratie-comment bij ai_limiet bedoelt
  // met "wie dat wil zet de klant op status 'gestopt'").
  const { data: klantenData, error: klantenError } = await db.from('clients')
    .select('id, naam, ai_limiet').eq('tier', 'coached').neq('status', 'gestopt');
  if (klantenError) {
    console.error('lau-ochtend: klanten laden mislukt:', klantenError.message);
    return new Response('tijdelijk niet beschikbaar', { status: 503 });
  }
  const klanten = (klantenData ?? []) as Klant[];

  // Alle grenzen één keer vaststellen: draait de function over middernacht heen, dan
  // moeten alle klanten dezelfde dag- en maandgrens krijgen.
  const vandaag = amsterdamseDatum();
  const dagStart = dagStartAmsterdamUTC();
  const maandStart = maandStartAmsterdamUTC();

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const overgeslagen = { gelogd: 0, alBericht: 0, limiet: 0, geenProfiel: 0 };
  let verstuurd = 0;
  let fouten = 0;

  // Sequentieel: het gaat om een handjevol klanten en een fout bij de één mag de
  // rest niet blokkeren (vandaar de try/catch binnen de lus).
  for (const klant of klanten) {
    try {
      // 4. Vier goedkope checks parallel; head+count haalt geen rijen op, we willen
      //    alleen weten óf ze bestaan.
      const [profielRes, logRes, proactiefRes, usageRes] = await Promise.all([
        db.from('ai_profile_versions').select('id', { count: 'exact', head: true })
          .eq('client_id', klant.id),
        db.from('food_logs').select('id', { count: 'exact', head: true })
          .eq('client_id', klant.id).eq('datum', vandaag),
        db.from('messages').select('id', { count: 'exact', head: true })
          .eq('client_id', klant.id).eq('proactief', true).gte('created_at', dagStart),
        db.from('ai_usage').select('id', { count: 'exact', head: true })
          .eq('client_id', klant.id).gte('created_at', maandStart),
      ]);
      // Anders dan in lau-reply is een DB-fout hier fail-CLOSED: we weten dan niet of
      // er al een bericht staat of hoeveel er deze maand op zit, en doorgaan zou
      // dubbele of over-de-limiet-berichten opleveren.
      const dbFout = profielRes.error ?? logRes.error ?? proactiefRes.error ?? usageRes.error;
      if (dbFout) throw new Error(dbFout.message);

      if ((profielRes.count ?? 0) === 0) { overgeslagen.geenProfiel++; continue; }
      if ((logRes.count ?? 0) > 0) { overgeslagen.gelogd++; continue; }
      if ((proactiefRes.count ?? 0) > 0) { overgeslagen.alBericht++; continue; }
      // D7: wie op de limiet zit krijgt geen ongevraagd bericht — anders is de klant
      // z'n laatste gesprek kwijt aan iets wat 'ie niet gevraagd heeft.
      const limiet = bepaalLimiet(klant.ai_limiet, configLimiet);
      if ((usageRes.count ?? 0) >= limiet) { overgeslagen.limiet++; continue; }

      const voornaam = veiligeVoornaam(klant.naam);
      const aanhef = voornaam ? `Goedemorgen ${voornaam} ☀️` : 'Goedemorgen ☀️';
      const FALLBACK = `${aanhef} Nog niets gelogd vandaag — twee tikken en je dag staat. Hoe is je ochtend?`;

      // 5. Haiku schrijft het bericht; faalt dat, dan gaat de vaste tekst eruit. Een
      //    ochtendbericht overslaan omdat de API hikt zou de klant niets opleveren.
      let tekst = '';
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        const res = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 200,
          system: [
            IDENTITEIT,
            GUARDRAILS,
            [
              'Opdracht: schrijf één kort warm ochtendbericht van maximaal 2 zinnen.',
              voornaam ? `Spreek de klant aan met "${voornaam}".` : 'Gebruik geen naam.',
              'Er is vandaag nog niets gelogd. Nodig zacht uit om iets te loggen of te vertellen hoe de ochtend gaat.',
              'Geen verwijt, geen getallen, geen opsomming, geen vragenlijst.',
              'Antwoord met uitsluitend het bericht zelf, zonder aanhalingstekens of toelichting.',
            ].join(' '),
          ].join('\n\n'),
          messages: [{ role: 'user', content: 'Schrijf het ochtendbericht.' }],
        });
        inputTokens = res.usage?.input_tokens ?? 0;
        outputTokens = res.usage?.output_tokens ?? 0;
        // Weigering (veiligheidsclassifier) of een halve zin door de token-grens:
        // allebei ongeschikt om ongevraagd de deur uit te sturen.
        if (res.stop_reason !== 'refusal' && res.stop_reason !== 'max_tokens') {
          const blok = res.content.find((b) => b.type === 'text');
          if (blok && blok.type === 'text') tekst = blok.text.trim();
        }
      } catch (e) {
        console.warn(`lau-ochtend: Claude-call mislukt voor ${klant.id}:`, e);
      }
      if (!tekst) tekst = FALLBACK;

      // 6. Het bericht is de opdracht — mislukt de insert, dan telt deze klant als
      //    fout en schrijven we géén usage-rij (er is niets verstuurd).
      const { error: insertFout } = await db.from('messages').insert({
        client_id: klant.id,
        sender: 'ai',
        tekst,
        proactief: true,
        proactief_datum: vandaag,
      });
      if (insertFout) {
        // 23505 = unique_violation op messages_proactief_dag_idx: een gelijktijdige run
        // was ons net voor tussen de check en deze insert. Geen fout — de klant heeft
        // z'n ochtendbericht, alleen niet van ons. Wel de Claude-call betaald, maar dat
        // is de goedkope kant van "nooit twee berichten".
        if (insertFout.code === '23505') { overgeslagen.alBericht++; continue; }
        throw new Error(insertFout.message);
      }
      verstuurd++;

      // Metering is best-effort: het bericht staat er al, een telfout mag dat niet
      // ongedaan maken. Bij een fallback zonder API-call zijn de tokens 0/0 — het
      // bericht telt wél mee voor de maandlimiet (D7).
      const { error: usageFout } = await db.from('ai_usage').insert({
        client_id: klant.id,
        model: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });
      if (usageFout) console.warn('lau-ochtend: ai_usage-insert mislukt:', usageFout.message);
    } catch (e) {
      fouten++;
      console.error(`lau-ochtend: klant ${klant.id} overgeslagen:`, e);
    }
  }

  // 7. Aantallen terug: dit is wat Jeffrey in de cron-logs ziet staan. `bekeken` is het
  //    aantal klanten dat we langsgingen — de echte kandidaten zijn wat er ná de skips
  //    overblijft, en die staan in `verstuurd`.
  const uitkomst = { ok: true, bekeken: klanten.length, verstuurd, overgeslagen, fouten };
  console.log('lau-ochtend:', JSON.stringify(uitkomst));
  return json(uitkomst);
});
