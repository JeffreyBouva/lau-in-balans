import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Fase 6: de twee profiel-RPC's van de klant — mijn_profiel (subset lezen) en
// werk_mijn_profiel_bij (merge-schrijven, nieuwe versie, author null).
//
// LET OP: vereist de fase6-migratie (nog niet gepusht op moment van schrijven — de push
// is een Jeffrey-stap, net als bij fase 5). Zolang `supabase db push` niet is gedraaid
// falen de tests hieronder op de ontbrekende functies (PGRST202); dat is verwacht en
// géén testfout. De anon-tests slagen mogelijk wél — die verwachten sowieso een error.
//
// Draait tegen het GEHOSTE Supabase-project (geen lokaal Docker), net als rls.test.ts,
// fase4.test.ts en fase5.test.ts: vereist een gevulde `.env`.
//
// Fixtures zijn wegwerp-klanten (geen coach nodig: sinds fase 4 is clients.coach_id
// nullable en maakt de registratie-trigger een free klant). Ze tellen daarmee niet mee
// in de "Laura ziet alle zes klanten"-tellingen van rls.test.ts.

const WACHTWOORD = 'fase6-test-2026';
const TEST_DOMEIN = 'test.lauinbalans.nl';

/**
 * Versie 1 van de testklant, mét gevulde coach-velden. Die vier velden zijn het punt van
 * deze suite: de klant mag ze niet lezen en niet overschrijven.
 */
const PROFIEL_V1 = {
  doelen: ['Meer energie', 'Duurzaam afvallen'],
  portiedoelen: { eiwit: 3, groente: 4, koolhydraten: 2, vet: 2 },
  knelpunten: ['Avond na het eten'],
  voorkeuren: ['3 maaltijden', 'Weinig vlees'],
  beperkingen: ['Noten-allergie'],
  checkinRitme: ["'s ochtends kort"],
  aanpak: 'Geen calorieën tellen. Focus op maaltijdstructuur.',
  toon: 'Warm en direct. Korte berichten.',
  vermijdenInCoaching: 'Niet openen met gewicht of getallen.',
  veiligheidsvlag: 'soms',
} as const;

/** De zes klant-velden plus `versie` — precies wat mijn_profiel mag teruggeven. */
const WHITELIST = [
  'beperkingen',
  'checkinRitme',
  'doelen',
  'knelpunten',
  'portiedoelen',
  'versie',
  'voorkeuren',
];
const COACHVELDEN = ['aanpak', 'toon', 'vermijdenInCoaching', 'veiligheidsvlag'];

let url: string;
let anonKey: string;
let service: SupabaseClient;

let klantId: string;
let klant: SupabaseClient;

/** Verse klant zónder profielversie: de onboarding-hoort-eerst-gevallen. */
let leegId: string;
let leeg: SupabaseClient;

// Opruim-administratie: alles wat we aanmaken komt hier in, zodat afterAll ook opruimt
// wanneer een test halverwege knalt. FK-veilige volgorde bij het wissen:
// profielversies → clients → auth-users (de cascades doen dit normaal vanzelf, maar
// expliciet blijft de opruiming ook heel als een van de stappen faalt).
const gemaakteUsers: string[] = [];

function testEmail(): string {
  // Zelfde random-suffix als elke andere testgebruiker: twee runs binnen dezelfde
  // milliseconde (of een run naast een achtergebleven user) botsen anders op de
  // unieke e-mail in auth.users.
  return `fase6-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${TEST_DOMEIN}`;
}

/** Maakt een auth-user via de admin-API en registreert 'm voor de opruiming. */
async function nieuweUser(naam: string): Promise<{ id: string; email: string }> {
  const { data, error } = await service.auth.admin.createUser({
    email: testEmail(),
    password: WACHTWOORD,
    email_confirm: true,
    user_metadata: { naam },
  });
  if (error) throw error;
  gemaakteUsers.push(data.user!.id);
  return { id: data.user!.id, email: data.user!.email! };
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
): Promise<{ versie: number; profiel: Record<string, unknown>; author: string | null } | null> {
  const { data, error } = await service
    .from('ai_profile_versions')
    .select('versie, profiel, author')
    .eq('client_id', clientId)
    .order('versie', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { versie: number; profiel: Record<string, unknown>; author: string | null }) ?? null;
}

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  // Verse gebruikers → de registratie-trigger maakt telkens een free clients-rij.
  const u = await nieuweUser('Fase Zes Klant');
  klantId = u.id;
  const l = await nieuweUser('Fase Zes Zonder Profiel');
  leegId = l.id;

  // Versie 1 via de service role: de klant mag 'm zelf wel schrijven (onboarding-policy)
  // maar niet teruglezen — hier zetten we 'm neer inclusief de coach-velden.
  const { error } = await service
    .from('ai_profile_versions')
    .insert({ client_id: klantId, versie: 1, author: null, profiel: PROFIEL_V1 });
  if (error) throw error;

  [klant, leeg] = await Promise.all([ingelogd(u.email), ingelogd(l.email)]);
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

  for (const id of gemaakteUsers) {
    await stil(() => service.from('ai_profile_versions').delete().eq('client_id', id));
    await stil(() => service.from('clients').delete().eq('id', id));
    await stil(() => service.auth.admin.deleteUser(id));
  }
});

describe('mijn_profiel', () => {
  it('geeft de klant-subset: zeven keys, geen enkel coach-veld', async () => {
    const { data, error } = await klant.rpc('mijn_profiel');
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const profiel = data as Record<string, unknown>;
    expect(Object.keys(profiel).sort()).toEqual(WHITELIST);
    for (const veld of COACHVELDEN) {
      expect(profiel).not.toHaveProperty(veld);
    }

    // De inhoud komt wél door (zonder deze controle zou een lege jsonb ook slagen).
    expect(profiel.versie).toBe(1);
    expect(profiel.doelen).toEqual(PROFIEL_V1.doelen);
    expect(profiel.portiedoelen).toEqual(PROFIEL_V1.portiedoelen);
    expect(profiel.checkinRitme).toEqual(PROFIEL_V1.checkinRitme);
  });

  it('de klant kan de tabel zelf nog steeds niet lezen (coach-only RLS)', async () => {
    // Positieve controle op de reden dat deze RPC bestaat.
    const { data } = await klant.from('ai_profile_versions').select('versie').eq('client_id', klantId);
    expect(data ?? []).toHaveLength(0);
  });
});

describe('werk_mijn_profiel_bij', () => {
  it('schrijft versie 2 met author null; coach-velden blijven exact staan', async () => {
    const wijziging = {
      doelen: ['Meer energie', 'Beter slapen'],
      portiedoelen: { eiwit: 4, groente: 5, koolhydraten: 2, vet: 3 },
    };
    const { data, error } = await klant.rpc('werk_mijn_profiel_bij', { p_wijziging: wijziging });
    expect(error).toBeNull();
    expect(data).toBe(2);

    const rij = await hoogsteVersie(klantId);
    expect(rij!.versie).toBe(2);
    expect(rij!.author).toBeNull(); // zelfde betekenis als onboarding: door de klant zelf
    expect(rij!.profiel.doelen).toEqual(wijziging.doelen);
    expect(rij!.profiel.portiedoelen).toEqual(wijziging.portiedoelen);

    // Niet-gestuurde klant-velden blijven ongewijzigd (merge, geen vervanging)...
    expect(rij!.profiel.knelpunten).toEqual(PROFIEL_V1.knelpunten);
    expect(rij!.profiel.voorkeuren).toEqual(PROFIEL_V1.voorkeuren);
    expect(rij!.profiel.beperkingen).toEqual(PROFIEL_V1.beperkingen);
    expect(rij!.profiel.checkinRitme).toEqual(PROFIEL_V1.checkinRitme);
    // ...en de coach-velden staan er nog byte-voor-byte hetzelfde in.
    expect(rij!.profiel.aanpak).toBe(PROFIEL_V1.aanpak);
    expect(rij!.profiel.toon).toBe(PROFIEL_V1.toon);
    expect(rij!.profiel.vermijdenInCoaching).toBe(PROFIEL_V1.vermijdenInCoaching);
    expect(rij!.profiel.veiligheidsvlag).toBe(PROFIEL_V1.veiligheidsvlag);
  });

  it('coach-velden in de input worden genegeerd', async () => {
    const voor = await hoogsteVersie(klantId);

    const { data, error } = await klant.rpc('werk_mijn_profiel_bij', {
      p_wijziging: {
        knelpunten: ['Weekenden'],
        veiligheidsvlag: 'geen',
        aanpak: 'Streng wegen, elke dag op de weegschaal',
        onbekendVeld: 'moet ook verdwijnen',
      },
    });
    expect(error).toBeNull();
    expect(data).toBe(voor!.versie + 1);

    const na = await hoogsteVersie(klantId);
    expect(na!.profiel.knelpunten).toEqual(['Weekenden']); // klant-veld: wél doorgevoerd
    expect(na!.profiel.veiligheidsvlag).toBe(PROFIEL_V1.veiligheidsvlag);
    expect(na!.profiel.aanpak).toBe(PROFIEL_V1.aanpak);
    expect(na!.profiel).not.toHaveProperty('onbekendVeld');
  });

  it('portiedoelen buiten 0..12 worden geweigerd en schrijven niets', async () => {
    const voor = await hoogsteVersie(klantId);

    const { error } = await klant.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { portiedoelen: { eiwit: 99, groente: 4, koolhydraten: 2, vet: 2 } },
    });
    expect(error).not.toBeNull(); // raise: ongeldige portiedoelen

    // Eindstaat: een error alleen bewijst niets — de functie is security definer en zou
    // vóór het falen kunnen inserten.
    const na = await hoogsteVersie(klantId);
    expect(na!.versie).toBe(voor!.versie);
    expect(na!.profiel.portiedoelen).toEqual(voor!.profiel.portiedoelen);
  });

  it('een niet-array voor doelen wordt geweigerd en schrijft niets', async () => {
    const voor = await hoogsteVersie(klantId);

    const { error } = await klant.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { doelen: 'Meer energie' },
    });
    expect(error).not.toBeNull(); // raise: ongeldige lijst: doelen

    const na = await hoogsteVersie(klantId);
    expect(na!.versie).toBe(voor!.versie);
    expect(na!.profiel.doelen).toEqual(voor!.profiel.doelen);
  });
});

describe('afgeschermd', () => {
  it('anon kan geen van beide RPC’s aanroepen', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });

    const lezen = await anon.rpc('mijn_profiel');
    expect(lezen.error).not.toBeNull(); // revoke execute ... from public, anon

    const schrijven = await anon.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { doelen: ['Stiekem'] },
    });
    expect(schrijven.error).not.toBeNull();

    // En er is niets bijgekomen bij de testklant.
    const rij = await hoogsteVersie(klantId);
    expect(rij!.profiel.doelen).not.toEqual(['Stiekem']);
  });

  it('klant zonder profiel: lezen geeft null, bijwerken geeft een error', async () => {
    const { data, error } = await leeg.rpc('mijn_profiel');
    expect(error).toBeNull();
    expect(data).toBeNull();

    const { error: schrijfFout } = await leeg.rpc('werk_mijn_profiel_bij', {
      p_wijziging: { doelen: ['Meer energie'] },
    });
    expect(schrijfFout).not.toBeNull(); // raise: geen profiel (onboarding hoort eerst)

    // Ook niet stiekem een versie 1 aangemaakt.
    expect(await hoogsteVersie(leegId)).toBeNull();
  });
});
