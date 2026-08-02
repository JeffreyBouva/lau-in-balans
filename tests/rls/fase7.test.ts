import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Fase 7: de DB-kant van de AI-limieten — ai_usage (coach-only), de teller-RPC
// ai_gebruik_deze_maand, de per-klant limiet op clients, de proactief-vlag op messages,
// plus de twee meelifters: flaggen is coached-only (A12) en werk_mijn_profiel_bij krijgt
// no-op-detectie en caps (M5).
//
// LET OP: vereist de fase7-migratie (nog niet gepusht op moment van schrijven — de push
// is een Jeffrey-stap, net als bij fase 5 en 6). Zolang `supabase db push` niet is
// gedraaid falen de tests hieronder op de ontbrekende tabel/kolommen (PGRST205/42703/
// PGRST204) en de ontbrekende functie (PGRST202); dat is verwacht en géén testfout.
// De twee gedragstests op bestaande objecten falen dan op het gedrag zelf: de free klant
// kán nu nog flaggen (tier-check ontbreekt) en werk_mijn_profiel_bij maakt bij een
// identieke wijziging nog een extra versie. Ze zijn geschreven op het eindgedrag ná de
// push. De fase6-migratie (die werk_mijn_profiel_bij aanmaakt) stond bij het schrijven
// van deze suite wél al op het project.
//
// Draait tegen het GEHOSTE Supabase-project (geen lokaal Docker), net als rls.test.ts,
// fase4.test.ts, fase5.test.ts en fase6.test.ts: vereist een gevulde `.env`.
//
// Net als fase 5 hangt deze suite aan EIGEN wegwerp-coaches in plaats van aan Laura uit
// de seed: één testklant wordt hier `coached`, en die zou anders meetellen in "Laura ziet
// alle zes klanten" van rls.test.ts wanneer de bestanden parallel draaien.

const WACHTWOORD = 'fase7-test-2026';
const TEST_DOMEIN = 'test.lauinbalans.nl';

/** Versie 1 van de profiel-testklant; alleen de klant-velden zijn hier relevant. */
const PROFIEL_V1 = {
  doelen: ['Meer energie'],
  portiedoelen: { eiwit: 3, groente: 4, koolhydraten: 2, vet: 2 },
  knelpunten: ['Avond na het eten'],
  voorkeuren: ['3 maaltijden'],
  beperkingen: [],
  checkinRitme: ["'s ochtends kort"],
  aanpak: 'Geen calorieën tellen.',
} as const;

let url: string;
let anonKey: string;
let service: SupabaseClient;

let coachAId: string;
let coachBId: string;
let coachA: SupabaseClient;
let coachB: SupabaseClient;

/** Coached klant van coach A: de ai_usage-, RPC-, limiet- en flag-fixture. */
let coachedId: string;
let coached: SupabaseClient;

/** Free klant (nooit een code verzilverd): de tegenhanger voor de flags-tier-check. */
let freeId: string;
let free: SupabaseClient;

/** Free klant mét profielversie 1: de fixture voor no-op en caps. */
let profielId: string;
let profiel: SupabaseClient;

// Opruim-administratie: alles wat we aanmaken komt hier in, zodat afterAll ook opruimt
// wanneer een test halverwege knalt. FK-veilige volgorde bij het wissen: kindrijen
// (ai_usage, flags, messages, profielversies) → codes → klanten → coaches → auth-users.
const gemaakteCodes: string[] = [];
const gemaakteUsers: string[] = [];
const gemaakteCoaches: string[] = [];

function testEmail(): string {
  // Zelfde random-suffix als elke andere testgebruiker: twee runs binnen dezelfde
  // milliseconde (of een run naast een achtergebleven user) botsen anders op de
  // unieke e-mail in auth.users.
  return `fase7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${TEST_DOMEIN}`;
}

/** Maakt een auth-user via de admin-API en registreert 'm voor de opruiming. */
async function nieuweUser(
  opts: Record<string, unknown> = {},
  registreer: string[] = gemaakteUsers,
): Promise<{ id: string; email: string }> {
  const { data, error } = await service.auth.admin.createUser({
    email: testEmail(),
    password: WACHTWOORD,
    email_confirm: true,
    ...opts,
  });
  if (error) throw error;
  registreer.push(data.user!.id);
  return { id: data.user!.id, email: data.user!.email! };
}

/**
 * Wegwerp-coach: auth-user + coaches-rij. De clients-rij die de trigger tóch aanmaakt
 * (app_metadata komt via de admin-API te laat — gepind in fase4.test.ts) wissen we,
 * net als de seed dat doet.
 */
async function nieuweCoach(naam: string): Promise<{ id: string; email: string }> {
  const user = await nieuweUser(
    { app_metadata: { rol: 'coach' }, user_metadata: { naam } },
    gemaakteCoaches, // coaches ruimen we ná de klanten op
  );
  const { error: cErr } = await service.from('clients').delete().eq('id', user.id);
  if (cErr) throw cErr; // blijft die rij staan, dan klopt de staat niet
  const { error } = await service.from('coaches').insert({ id: user.id, naam });
  if (error) throw error;
  return user;
}

async function ingelogd(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: WACHTWOORD });
  if (error) throw error;
  return client;
}

/** Hoogste profielversie van een klant, gelezen met de service role (RLS-onafhankelijk). */
async function hoogsteVersie(
  clientId: string,
): Promise<{ versie: number; profiel: Record<string, unknown> } | null> {
  const { data, error } = await service
    .from('ai_profile_versions')
    .select('versie, profiel')
    .eq('client_id', clientId)
    .order('versie', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { versie: number; profiel: Record<string, unknown> }) ?? null;
}

/** Aantal profielversies van een klant — pint dat een no-op géén rij toevoegt. */
async function aantalVersies(clientId: string): Promise<number> {
  const { count, error } = await service
    .from('ai_profile_versions')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId);
  if (error) throw error;
  return count ?? 0;
}

/** Aantal flags van een klant, gelezen met de service role. */
async function aantalFlags(clientId: string): Promise<number> {
  const { count, error } = await service
    .from('flags')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId);
  if (error) throw error;
  return count ?? 0;
}

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  const a = await nieuweCoach('Fase Zeven Coach A');
  const b = await nieuweCoach('Fase Zeven Coach B');
  coachAId = a.id;
  coachBId = b.id;

  // Verse gebruikers → de registratie-trigger maakt telkens een free clients-rij.
  const c = await nieuweUser({ user_metadata: { naam: 'Fase Zeven Coached' } });
  coachedId = c.id;
  const f = await nieuweUser({ user_metadata: { naam: 'Fase Zeven Free' } });
  freeId = f.id;
  const p = await nieuweUser({ user_metadata: { naam: 'Fase Zeven Profiel' } });
  profielId = p.id;

  [coachA, coachB, coached, free, profiel] = await Promise.all([
    ingelogd(a.email),
    ingelogd(b.email),
    ingelogd(c.email),
    ingelogd(f.email),
    ingelogd(p.email),
  ]);

  // Coached maken via het live pad: service maakt een code van coach A, de klant
  // verzilvert 'm (verzilver_code bestaat sinds fase 4 en is gepusht).
  const { data: code, error: codeFout } = await service.rpc('maak_invite_code', {
    p_coach: coachAId,
  });
  if (codeFout) throw codeFout;
  gemaakteCodes.push(code as string);
  const { data: verzilverd, error: verzilverFout } = await coached.rpc('verzilver_code', {
    p_code: code as string,
  });
  if (verzilverFout) throw verzilverFout;
  if (verzilverd !== true) throw new Error('fixture: verzilver_code gaf geen true');

  // Profielversie 1 via de service role: de klant mag 'm zelf wel schrijven
  // (onboarding-policy) maar niet teruglezen.
  const { error: profielFout } = await service
    .from('ai_profile_versions')
    .insert({ client_id: profielId, versie: 1, author: null, profiel: PROFIEL_V1 });
  if (profielFout) throw profielFout;

  // Twee ai_usage-rijen in de lopende maand en één ruim daarvóór: die derde pint dat de
  // RPC op de maandgrens telt en niet gewoon alles. 45 dagen terug ligt altijd vóór de
  // eerste van deze maand (de langste maand is 31 dagen).
  const vorigeMaand = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const { error: usageFout } = await service.from('ai_usage').insert([
    { client_id: coachedId, model: 'claude-sonnet-5', input_tokens: 120, output_tokens: 45 },
    { client_id: coachedId, model: 'claude-sonnet-5', input_tokens: 200, output_tokens: 60 },
    {
      client_id: coachedId,
      model: 'claude-sonnet-5',
      input_tokens: 10,
      output_tokens: 5,
      created_at: vorigeMaand,
    },
  ]);
  // Ontbreekt de fase7-migratie nog, dan knalt dit — dat is de verwachte failure-modus
  // van deze suite (zie de header); we laten 'm doorlopen zodat elke test 'm apart meldt.
  if (usageFout) console.warn('fixture ai_usage faalde (migratie nog niet gepusht?):', usageFout.message);
});

afterAll(async () => {
  // Best effort: een halverwege gefaalde test mag de opruiming niet laten knallen, en
  // rijen die al weg zijn (of nooit zijn aangemaakt) zijn geen fout. PostgREST-builders
  // zijn thenables die met `{ error }` resolven i.p.v. te throwen — alleen try/catch zou
  // een mislukte opruiming dus geruisloos laten verdwijnen; daarom loggen we die.
  const stil = async (fn: () => PromiseLike<unknown>) => {
    try {
      const res = await fn();
      const e = (res as { error?: { message: string } | null })?.error;
      if (e) console.warn('opruimen faalde:', e.message);
    } catch (e) {
      console.warn('opruimen faalde:', (e as Error).message);
    }
  };

  // Kindrijen eerst: de cascades doen dit normaal vanzelf, maar expliciet blijft de
  // opruiming ook heel als een van de stappen faalt.
  for (const id of gemaakteUsers) {
    await stil(() => service.from('ai_usage').delete().eq('client_id', id));
    await stil(() => service.from('flags').delete().eq('client_id', id));
    await stil(() => service.from('messages').delete().eq('client_id', id));
    await stil(() => service.from('ai_profile_versions').delete().eq('client_id', id));
  }
  for (const c of gemaakteCodes) {
    await stil(() => service.from('invite_codes').delete().eq('code', c));
  }
  // Klanten éérst: de verzilverde klant wijst met coach_id naar de coach hieronder.
  for (const id of [...gemaakteUsers, ...gemaakteCoaches]) {
    await stil(() => service.from('clients').delete().eq('id', id));
  }
  for (const id of gemaakteUsers) {
    await stil(() => service.auth.admin.deleteUser(id));
  }
  for (const id of gemaakteCoaches) {
    await stil(() => service.from('coaches').delete().eq('id', id));
    await stil(() => service.auth.admin.deleteUser(id));
  }
});

describe('ai_usage', () => {
  it('coach A ziet de rijen van de eigen klant; coach B, de klant zelf en anon niet', async () => {
    const vanA = await coachA.from('ai_usage').select('id, model').eq('client_id', coachedId);
    expect(vanA.error).toBeNull();
    expect(vanA.data ?? []).toHaveLength(3);

    // Andere coach: geen error maar 0 rijen — RLS filtert stil weg.
    const vanB = await coachB.from('ai_usage').select('id').eq('client_id', coachedId);
    expect(vanB.data ?? []).toHaveLength(0);

    // De klant zelf leest z'n verbruik niet (D5/A17: geen saldo-teller in de app).
    const vanKlant = await coached.from('ai_usage').select('id').eq('client_id', coachedId);
    expect(vanKlant.data ?? []).toHaveLength(0);

    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const vanAnon = await anon.from('ai_usage').select('id').eq('client_id', coachedId);
    expect(vanAnon.data ?? []).toHaveLength(0);

    // Positieve controle: de rijen bestaan wél (zonder dit zou een lege tabel ook slagen).
    const { count } = await service
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', coachedId);
    expect(count).toBe(3);
  });

  it('niemand kan zelf een usage-rij schrijven (alleen de service role)', async () => {
    const voor = await service
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', coachedId);

    // Geen insert-policy: zowel de coach als de klant zelf botst op RLS.
    const viaCoach = await coachA
      .from('ai_usage')
      .insert({ client_id: coachedId, model: 'gratis', input_tokens: 0, output_tokens: 0 });
    expect(viaCoach.error).not.toBeNull();
    const viaKlant = await coached
      .from('ai_usage')
      .insert({ client_id: coachedId, model: 'gratis', input_tokens: 0, output_tokens: 0 });
    expect(viaKlant.error).not.toBeNull();

    const na = await service
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', coachedId);
    expect(na.count).toBe(voor.count);
  });
});

describe('ai_gebruik_deze_maand', () => {
  it('telt alleen de rijen van de lopende maand (Europe/Amsterdam)', async () => {
    const { data, error } = await coachA.rpc('ai_gebruik_deze_maand', { p_client: coachedId });
    expect(error).toBeNull();
    expect(data).toBe(2); // drie rijen, waarvan één van 45 dagen terug
  });

  it('een andere coach, de klant zelf en anon krijgen niets', async () => {
    const { error: fout } = await coachB.rpc('ai_gebruik_deze_maand', { p_client: coachedId });
    expect(fout).not.toBeNull(); // raise: geen toegang tot deze klant

    const { error: klantFout } = await coached.rpc('ai_gebruik_deze_maand', {
      p_client: coachedId,
    });
    expect(klantFout).not.toBeNull(); // is_coach_of is false voor de klant zelf

    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error: anonFout } = await anon.rpc('ai_gebruik_deze_maand', { p_client: coachedId });
    expect(anonFout).not.toBeNull(); // revoke execute ... from public, anon
  });
});

describe('flags — flaggen is een coached-recht (A12)', () => {
  it('een free klant kan geen flag maken', async () => {
    const voor = await aantalFlags(freeId);

    const { error } = await free.from('flags').insert({ client_id: freeId, tekst: 'Help' });
    expect(error).not.toBeNull(); // RLS: de tier-check in klant_maakt_flag

    // Eindstaat: een error alleen bewijst niets als de rij er tóch zou staan.
    expect(await aantalFlags(freeId)).toBe(voor);
  });

  it('een coached klant kan dat wel', async () => {
    const { data, error } = await coached
      .from('flags')
      .insert({ client_id: coachedId, tekst: 'Ik wil Laura spreken' })
      .select('id, status, resolved_by, resolved_at');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);

    // De bestaande hardening-voorwaarden (I4) staan er nog: open en zonder afhandeling.
    const rij = (data ?? [])[0] as Record<string, unknown> | undefined;
    expect(rij?.status).toBe('open');
    expect(rij?.resolved_by).toBeNull();
    expect(rij?.resolved_at).toBeNull();
  });
});

describe('werk_mijn_profiel_bij — no-op en caps (M5)', () => {
  it('een echte wijziging geeft versie 2; dezelfde wijziging nogmaals geeft weer 2', async () => {
    const wijziging = { doelen: ['Meer energie', 'Beter slapen'] };

    const eerste = await profiel.rpc('werk_mijn_profiel_bij', { p_wijziging: wijziging });
    expect(eerste.error).toBeNull();
    expect(eerste.data).toBe(2);
    expect(await aantalVersies(profielId)).toBe(2);

    // Identieke inhoud → geen nieuwe rij, wel het huidige versienummer terug.
    const tweede = await profiel.rpc('werk_mijn_profiel_bij', { p_wijziging: wijziging });
    expect(tweede.error).toBeNull();
    expect(tweede.data).toBe(2);
    expect(await aantalVersies(profielId)).toBe(2);

    // Ook een wijziging die alleen ongewijzigde velden herhaalt is een no-op.
    const derde = await profiel.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { ...wijziging, portiedoelen: PROFIEL_V1.portiedoelen, knelpunten: PROFIEL_V1.knelpunten },
    });
    expect(derde.error).toBeNull();
    expect(derde.data).toBe(2);
    expect(await aantalVersies(profielId)).toBe(2);
  });

  it('21 items in een lijst wordt geweigerd en schrijft niets', async () => {
    const voor = await hoogsteVersie(profielId);
    const teVeel = Array.from({ length: 21 }, (_, i) => `Doel ${i + 1}`);

    const { error } = await profiel.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { doelen: teVeel },
    });
    expect(error).not.toBeNull(); // raise: te veel of te lange items
    expect(error!.message).toContain('te veel of te lange items');

    // Eindstaat: de functie is security definer en zou vóór het falen kunnen inserten.
    const na = await hoogsteVersie(profielId);
    expect(na!.versie).toBe(voor!.versie);
    expect(na!.profiel.doelen).toEqual(voor!.profiel.doelen);

    // 20 items is nog wél toegestaan (de grens ligt op de goede plek).
    const netAan = Array.from({ length: 20 }, (_, i) => `Doel ${i + 1}`);
    const ok = await profiel.rpc('werk_mijn_profiel_bij', { p_wijziging: { doelen: netAan } });
    expect(ok.error).toBeNull();
    expect(ok.data).toBe(voor!.versie + 1);
  });

  it('een item van 300 tekens wordt geweigerd en schrijft niets', async () => {
    const voor = await hoogsteVersie(profielId);

    const { error } = await profiel.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { knelpunten: ['x'.repeat(300)] },
    });
    expect(error).not.toBeNull(); // raise: te veel of te lange items
    expect(error!.message).toContain('te veel of te lange items');

    const na = await hoogsteVersie(profielId);
    expect(na!.versie).toBe(voor!.versie);
    expect(na!.profiel.knelpunten).toEqual(voor!.profiel.knelpunten);

    // 200 tekens is nog wél toegestaan.
    const ok = await profiel.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { knelpunten: ['y'.repeat(200)] },
    });
    expect(ok.error).toBeNull();
    expect(ok.data).toBe(voor!.versie + 1);
  });
});

describe('clients.ai_limiet en messages.proactief', () => {
  it('de coach zet een eigen limiet; 0 wordt door de check geweigerd', async () => {
    const { data, error } = await coachA
      .from('clients')
      .update({ ai_limiet: 500 })
      .eq('id', coachedId)
      .select('ai_limiet');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1); // rijen-geraakt-check: RLS liet de update door
    expect((data ?? [])[0]?.ai_limiet).toBe(500);

    // 0 zou een klant stil dichtzetten — de check-constraint verbiedt het.
    const nul = await coachA.from('clients').update({ ai_limiet: 0 }).eq('id', coachedId);
    expect(nul.error).not.toBeNull();

    // null = terug naar de config-default, dat mag wel.
    const leeg = await coachA
      .from('clients')
      .update({ ai_limiet: null })
      .eq('id', coachedId)
      .select('ai_limiet');
    expect(leeg.error).toBeNull();
    expect((leeg.data ?? [])[0]?.ai_limiet).toBeNull();
  });

  it('een bericht is standaard niet proactief; de service-role zet de vlag', async () => {
    const gewoon = await service
      .from('messages')
      .insert({ client_id: coachedId, sender: 'ai', tekst: 'Antwoord op je vraag' })
      .select('id, proactief');
    expect(gewoon.error).toBeNull();
    expect((gewoon.data ?? [])[0]?.proactief).toBe(false);

    const ochtend = await service
      .from('messages')
      .insert({ client_id: coachedId, sender: 'ai', tekst: 'Goedemorgen ☀️', proactief: true })
      .select('id, proactief');
    expect(ochtend.error).toBeNull();
    expect((ochtend.data ?? [])[0]?.proactief).toBe(true);
  });

  it('de config-defaults staan klaar voor lau-reply en lau-ochtend', async () => {
    const { data, error } = await service
      .from('app_config')
      .select('key, value')
      .in('key', ['ai_maandlimiet', 'ochtendbericht_actief']);
    expect(error).toBeNull();

    const config = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    expect(config.ai_maandlimiet).toBe(300);
    expect(config.ochtendbericht_actief).toBe(true);
  });
});
