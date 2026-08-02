// Proactieve Lau (fase 7): één warm ochtendbericht per dag voor coached klanten die
// vandaag nog niets gelogd hebben. Wordt aangeroepen door een dagelijkse cron uit het
// Supabase-dashboard (±10:30 Europe/Amsterdam) met de header x-cron-secret; er komt
// geen JWT aan te pas, de functie draait volledig met de service role.
//
// Idempotent: draait 'ie twee keer op een dag, dan slaat de proactief-check van ronde
// twee alle klanten van ronde één over. Handmatig triggeren (curl met de secret) is
// dus veilig.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { GUARDRAILS } from '../_shared/guardrails.ts';
import {
  amsterdamseDatum,
  dagStartAmsterdamUTC,
  leesMaandlimiet,
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

  // 2. Killswitch (A14). Alles behalve exact `true` betekent stil blijven — ook een
  //    DB-fout of een ontbrekende rij. Fail-CLOSED is hier het juiste gedrag: een
  //    ochtend zonder bericht merkt niemand, zes ongewenste berichten wel.
  const { data: configRij } = await db.from('app_config').select('value')
    .eq('key', 'ochtendbericht_actief').maybeSingle();
  if ((configRij as { value: unknown } | null)?.value !== true) {
    return json({ status: 'uit' });
  }

  const { data: klantenData, error: klantenError } = await db.from('clients')
    .select('id, naam, ai_limiet').eq('tier', 'coached');
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
      // 3. Vier goedkope checks parallel; head+count haalt geen rijen op, we willen
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
      const limiet = await leesMaandlimiet(db, klant.ai_limiet);
      if ((usageRes.count ?? 0) >= limiet) { overgeslagen.limiet++; continue; }

      // clients.naam is not null, maar een lege naam mag geen "Goedemorgen  ☀️" geven.
      const voornaam = (klant.naam ?? '').trim().split(/\s+/)[0] ?? '';
      const aanhef = voornaam ? `Goedemorgen ${voornaam} ☀️` : 'Goedemorgen ☀️';
      const FALLBACK = `${aanhef} Nog niets gelogd vandaag — twee tikken en je dag staat. Hoe is je ochtend?`;

      // 4. Haiku schrijft het bericht; faalt dat, dan gaat de vaste tekst eruit. Een
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

      // 5. Het bericht is de opdracht — mislukt de insert, dan telt deze klant als
      //    fout en schrijven we géén usage-rij (er is niets verstuurd).
      const { error: insertFout } = await db.from('messages').insert({
        client_id: klant.id,
        sender: 'ai',
        tekst,
        proactief: true,
      });
      if (insertFout) throw new Error(insertFout.message);
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

  // 6. Aantallen terug: dit is wat Jeffrey in de cron-logs ziet staan.
  const uitkomst = { ok: true, kandidaten: klanten.length, verstuurd, overgeslagen, fouten };
  console.log('lau-ochtend:', JSON.stringify(uitkomst));
  return json(uitkomst);
});
