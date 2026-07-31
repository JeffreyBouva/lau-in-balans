import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { bouwPrompt, type Bericht } from '../_shared/prompt-builder.ts';
import { cors } from '../_shared/cors.ts';
import type { AIProfile, Porties } from '../../../packages/shared/src/types.ts';

const LEEG: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };

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

  // 2. Context laden met de service role.
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: profielRij } = await db
    .from('ai_profile_versions')
    .select('profiel')
    .eq('client_id', clientId)
    .order('versie', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!profielRij) return new Response('geen profiel', { status: 409, headers: cors });
  const profiel = profielRij.profiel as AIProfile;

  const { data: rijen } = await db
    .from('messages')
    .select('sender, tekst')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(20);
  const berichten = (rijen ?? []) as Bericht[];
  const nieuwBericht = [...berichten].reverse().find((b) => b.sender === 'client')?.tekst;
  if (!nieuwBericht) return new Response('geen klantbericht', { status: 400, headers: cors });
  const historie = berichten.slice(0, -1); // alles behalve het laatste (= het nieuwe bericht)

  // weekcontext (dag-aggregaten van deze week)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const { data: logs } = await db
    .from('food_logs')
    .select('porties')
    .eq('client_id', clientId)
    .gte('datum', weekStart.toISOString().slice(0, 10));
  const gelogd = (logs ?? []).reduce<Porties>((s, r) => {
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

  // 4. Claude aanroepen (claude-sonnet-5, adaptief denken, effort low, niet-streamend).
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const antwoord = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system,
    messages,
  });
  // Lees stop_reason vóór content: veiligheidsclassifiers kunnen weigeren (HTTP 200, stop_reason 'refusal').
  let tekst = 'Ik ben er zo weer — probeer het zo nog eens.';
  if (antwoord.stop_reason !== 'refusal') {
    const blok = antwoord.content.find((b) => b.type === 'text');
    if (blok && blok.type === 'text') tekst = blok.text;
  }

  // 5. AI-bericht wegschrijven → app krijgt het via de bestaande realtime-subscription.
  await db.from('messages').insert({ client_id: clientId, sender: 'ai', tekst });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
