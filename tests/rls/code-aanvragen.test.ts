import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Code-aanvragen (app-feedback 1, punt 3 · aanname F1): de klant in de slot-staat vraagt
// zelf om een coachingtraject, Laura ziet die aanvragen in het dashboard.
//
// Wat deze suite pint:
//   · de klant maakt een aanvraag voor zichzelf — en niet voor een ander;
//   · een tweede ópen aanvraag botst op de partial unique index (23505). Dat is bewust
//     géén policy-regel: "mag inserten mits er nog geen open aanvraag is" past niet in een
//     with check, en de app vertaalt 23505 naar "je aanvraag staat al klaar";
//   · de klant leest de eigen aanvraag (voor die stand in de app), een andere klant niet;
//   · de admin ziet de aanvraag van een klant ZÓNDER coach — een gewone coach niet. Dat is
//     de kern van F1: een free klant heeft geen coach_id, dus is_coach_of is voor iedereen
//     false en alleen Laura (admin) heeft die werkvoorraad;
//   · afhandelen kan alleen met exact de velden die de policy eist (status 'afgehandeld' +
//     afgehandeld_door = auth.uid() + afgehandeld_op gezet), en alleen vanuit 'open';
//   · anon kan niets.
//
// LET OP: vereist de migratie 20260803140000_code_aanvragen.sql — nog niet gepusht op het
// moment van schrijven; `supabase db push` is een Jeffrey-stap (net als bij fase 5, 6, 7
// en de admin-migratie). Zolang dat niet is gedraaid faalt élke test hieronder op de
// ontbrekende tabel (PGRST205), en de fixture-warning in beforeAll wijst daarop. Dat is
// verwacht en géén testfout. Deze suite leunt bovendien op de admin-migratie
// (coaches.is_admin + is_admin()): staat díe er niet, dan ziet de "admin" niets van een
// klant zonder coach en falen de admin-tests op dezelfde manier.
//
// Draait tegen het GEHOSTE Supabase-project (geen lokaal Docker), net als rls.test.ts en
// de fase-suites: vereist een gevulde `.env`.
//
// Alle fixtures zijn wegwerp: eigen coaches, eigen klanten. Ze hangen bewust niet aan
// Laura uit de seed — die telt mee in "Laura ziet alle zes klanten" van rls.test.ts
// wanneer de bestanden parallel draaien.

const WACHTWOORD = 'aanvragen-test-2026';
const TEST_DOMEIN = 'test.lauinbalans.nl';

let url: string;
let anonKey: string;
let service: SupabaseClient;

/** De producteigenaar: is_admin true, géén eigen klanten. */
let adminId: string;
let admin: SupabaseClient;

/** Gewone coach zonder klanten: de isolatie-tegenhanger. */
let vreemdId: string;
let vreemd: SupabaseClient;

/** Free klant zónder coach — de aanvrager uit de slot-staat. */
let klantId: string;
let klant: SupabaseClient;

/** Tweede free klant: de tegenhanger voor "ziet de aanvraag van een ander niet". */
let anderId: string;
let ander: SupabaseClient;

/** De aanvraag uit de eerste test; de latere tests bouwen erop voort. */
let aanvraagId: string;

// Opruim-administratie: alles wat we aanmaken komt hier in, zodat afterAll ook opruimt
// wanneer een test halverwege knalt. FK-veilige volgorde bij het wissen: kindrijen
// (code_aanvragen) → klanten → coaches → auth-users.
const gemaakteUsers: string[] = [];
const gemaakteCoaches: string[] = [];

function testEmail(): string {
  // Zelfde random-suffix als elke andere testgebruiker: twee runs binnen dezelfde
  // milliseconde (of een run naast een achtergebleven user) botsen anders op de
  // unieke e-mail in auth.users.
  return `aanvraag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${TEST_DOMEIN}`;
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
 *
 * De is_admin-vlag zetten we in een APARTE update (patroon uit admin.test.ts): zonder de
 * admin-migratie kent PostgREST de kolom nog niet en zou de insert falen — dan strandt
 * elke test op de fixture in plaats van op de assert die ze toetst.
 */
async function nieuweCoach(naam: string, isAdmin = false): Promise<{ id: string; email: string }> {
  const user = await nieuweUser(
    { app_metadata: { rol: 'coach' }, user_metadata: { naam } },
    gemaakteCoaches, // coaches ruimen we ná de klanten op
  );
  const { error: cErr } = await service.from('clients').delete().eq('id', user.id);
  if (cErr) throw cErr; // blijft die rij staan, dan klopt de staat niet
  const { error } = await service.from('coaches').insert({ id: user.id, naam });
  if (error) throw error;
  if (isAdmin) {
    const { error: aErr } = await service
      .from('coaches')
      .update({ is_admin: true })
      .eq('id', user.id);
    if (aErr) console.warn('fixture is_admin faalde (admin-migratie niet gepusht?):', aErr.message);
  }
  return user;
}

async function ingelogd(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: WACHTWOORD });
  if (error) throw error;
  return client;
}

/** De aanvragen van een klant, gelezen met de service role (RLS-onafhankelijk). */
async function aanvragenVan(clientId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await service
    .from('code_aanvragen')
    .select('id, client_id, bericht, status, afgehandeld_door, afgehandeld_op')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  const a = await nieuweCoach('Aanvraag Admin Laura', true);
  const v = await nieuweCoach('Aanvraag Vreemde Coach');
  adminId = a.id;
  vreemdId = v.id;

  // Verse gebruikers → de registratie-trigger maakt telkens een free clients-rij zónder
  // coach. Precies de situatie van de slot-staat: dit zijn de aanvragers.
  const k = await nieuweUser({ user_metadata: { naam: 'Aanvraag Klant' } });
  klantId = k.id;
  const o = await nieuweUser({ user_metadata: { naam: 'Aanvraag Andere Klant' } });
  anderId = o.id;

  [admin, vreemd, klant, ander] = await Promise.all([
    ingelogd(a.email),
    ingelogd(v.email),
    ingelogd(k.email),
    ingelogd(o.email),
  ]);

  // Controle op de fixture-aanname: de aanvrager heeft geen coach. Valt dat om, dan meet
  // deze suite iets anders dan ze denkt (de gewone coach zou de aanvraag dan wél zien).
  const { data: rij, error } = await service
    .from('clients')
    .select('coach_id, tier')
    .eq('id', klantId)
    .single();
  if (error) throw error;
  if (rij!.coach_id !== null) throw new Error('fixture: de testklant heeft onverwacht een coach');

  // Bestaat de tabel al? Zo niet: één duidelijke waarschuwing i.p.v. tien mistige asserts.
  const { error: tabelFout } = await service
    .from('code_aanvragen')
    .select('id', { count: 'exact', head: true });
  if (tabelFout) {
    console.warn('code_aanvragen ontbreekt (migratie nog niet gepusht?):', tabelFout.message);
  }
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

  // Kindrijen eerst: de cascade op clients doet dit normaal vanzelf, maar expliciet
  // blijft de opruiming ook heel als een van de stappen faalt.
  for (const id of gemaakteUsers) {
    await stil(() => service.from('code_aanvragen').delete().eq('client_id', id));
  }
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

describe('aanvraag maken', () => {
  it('de klant maakt een aanvraag voor zichzelf — open en zonder afhandel-velden', async () => {
    const { data, error } = await klant
      .from('code_aanvragen')
      .insert({ client_id: klantId, bericht: 'Ik wil graag een coachingtraject.' })
      .select('id, status, bericht, afgehandeld_door, afgehandeld_op');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);

    const rij = (data ?? [])[0] as Record<string, unknown>;
    expect(rij.status).toBe('open');
    expect(rij.bericht).toBe('Ik wil graag een coachingtraject.');
    expect(rij.afgehandeld_door).toBeNull();
    expect(rij.afgehandeld_op).toBeNull();
    aanvraagId = rij.id as string;
  });

  it('een aanvraag op naam van een andere klant wordt geweigerd', async () => {
    const { error } = await klant
      .from('code_aanvragen')
      .insert({ client_id: anderId, bericht: 'Namens iemand anders' });
    expect(error).not.toBeNull(); // with check: client_id = auth.uid()

    // Eindstaat: een error alleen bewijst niets als de rij er tóch zou staan.
    expect(await aanvragenVan(anderId)).toHaveLength(0);
  });

  it('een klant kan zichzelf niet meteen als afgehandeld wegschrijven', async () => {
    const { error } = await klant.from('code_aanvragen').insert({
      client_id: klantId,
      status: 'afgehandeld',
      afgehandeld_door: adminId,
      afgehandeld_op: new Date().toISOString(),
    });
    expect(error).not.toBeNull(); // with check: status 'open' en beide velden null

    const rijen = await aanvragenVan(klantId);
    expect(rijen).toHaveLength(1);
    expect(rijen[0]?.status).toBe('open');
  });

  it('een tweede ópen aanvraag botst op de unieke index (23505)', async () => {
    const { error } = await klant
      .from('code_aanvragen')
      .insert({ client_id: klantId, bericht: 'Nog een keer dan' });
    expect(error).not.toBeNull();
    // De code is de afspraak met de app: 23505 = "je aanvraag staat al klaar", geen storing.
    expect(error!.code).toBe('23505');

    expect(await aanvragenVan(klantId)).toHaveLength(1);
  });

  it('anon kan geen aanvraag maken', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await anon
      .from('code_aanvragen')
      .insert({ client_id: klantId, bericht: 'Van niemand' });
    expect(error).not.toBeNull(); // auth.uid() is null → geen enkele policy matcht

    expect(await aanvragenVan(klantId)).toHaveLength(1);
  });
});

describe('lezen', () => {
  it('de klant ziet de eigen aanvraag; een andere klant en anon zien niets', async () => {
    const eigen = await klant.from('code_aanvragen').select('id, status, bericht');
    expect(eigen.error).toBeNull();
    expect((eigen.data ?? []).map((r) => r.id)).toEqual([aanvraagId]);

    // Andere klant: geen error maar 0 rijen — RLS filtert stil weg.
    const vanAnder = await ander.from('code_aanvragen').select('id').eq('client_id', klantId);
    expect(vanAnder.data ?? []).toHaveLength(0);
    const alles = await ander.from('code_aanvragen').select('id');
    expect(alles.data ?? []).toHaveLength(0);

    // Anon: 0 rijen, of een permission-error op is_admin/is_coach_of (execute is voor anon
    // ingetrokken) — beide betekenen hetzelfde en beide zijn goed.
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const vanAnon = await anon.from('code_aanvragen').select('id');
    expect(vanAnon.data ?? []).toHaveLength(0);
  });

  it('de admin ziet de aanvraag van een klant zónder coach; een gewone coach niet', async () => {
    const vanAdmin = await admin
      .from('code_aanvragen')
      .select('id, client_id, bericht, status')
      .eq('status', 'open');
    expect(vanAdmin.error).toBeNull();
    expect((vanAdmin.data ?? []).map((r) => r.id)).toContain(aanvraagId);

    // DE regressietest van F1: zou coach_leest_aanvragen ooit ruimer worden (bijv. "elke
    // coach ziet aanvragen zonder coach"), dan valt dit om vóórdat het productie haalt.
    const vanVreemd = await vreemd.from('code_aanvragen').select('id').eq('id', aanvraagId);
    expect(vanVreemd.error).toBeNull();
    expect(vanVreemd.data ?? []).toHaveLength(0);
  });
});

describe('afhandelen', () => {
  it('de klant zelf en een vreemde coach kunnen niet afhandelen', async () => {
    const velden = {
      status: 'afgehandeld',
      afgehandeld_op: new Date().toISOString(),
    };

    // Geen update-policy voor de klant → RLS filtert de rij weg: geen error, 0 rijen.
    const viaKlant = await klant
      .from('code_aanvragen')
      .update({ ...velden, afgehandeld_door: null })
      .eq('id', aanvraagId)
      .select('id');
    expect(viaKlant.data ?? []).toHaveLength(0);

    const viaVreemd = await vreemd
      .from('code_aanvragen')
      .update({ ...velden, afgehandeld_door: vreemdId })
      .eq('id', aanvraagId)
      .select('id');
    expect(viaVreemd.data ?? []).toHaveLength(0);

    const rijen = await aanvragenVan(klantId);
    expect(rijen[0]?.status).toBe('open');
  });

  it('afhandelen zonder de exacte velden wordt geweigerd', async () => {
    // Alleen de status omzetten: afgehandeld_door/afgehandeld_op blijven leeg. Zowel de
    // with check als de check-constraint op de tabel weigert dit — twee sloten, één deur.
    const kaal = await admin
      .from('code_aanvragen')
      .update({ status: 'afgehandeld' })
      .eq('id', aanvraagId)
      .select('id');
    expect(kaal.error).not.toBeNull();

    // Op naam van een ándere coach afhandelen mag ook niet — dat zou "wie pakte dit op"
    // vervalsbaar maken.
    const opAndersNaam = await admin
      .from('code_aanvragen')
      .update({
        status: 'afgehandeld',
        afgehandeld_door: vreemdId,
        afgehandeld_op: new Date().toISOString(),
      })
      .eq('id', aanvraagId)
      .select('id');
    expect(opAndersNaam.error).not.toBeNull(); // with check: afgehandeld_door = auth.uid()

    // Eindstaat: twee geweigerde pogingen hebben niets veranderd.
    const rijen = await aanvragenVan(klantId);
    expect(rijen[0]?.status).toBe('open');
    expect(rijen[0]?.afgehandeld_door).toBeNull();
    expect(rijen[0]?.afgehandeld_op).toBeNull();
  });

  it('de admin handelt af met status, afhandelaar en moment', async () => {
    const moment = new Date().toISOString();
    const { data, error } = await admin
      .from('code_aanvragen')
      .update({ status: 'afgehandeld', afgehandeld_door: adminId, afgehandeld_op: moment })
      .eq('id', aanvraagId)
      .eq('status', 'open')
      .select('id, status, afgehandeld_door');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1); // rijen-geraakt-check: RLS liet de update door
    expect((data ?? [])[0]?.afgehandeld_door).toBe(adminId);

    const rijen = await aanvragenVan(klantId);
    expect(rijen[0]?.status).toBe('afgehandeld');
    expect(rijen[0]?.afgehandeld_door).toBe(adminId);
    expect(rijen[0]?.afgehandeld_op).not.toBeNull();
  });

  it('een afgehandelde aanvraag is niet opnieuw te wijzigen', async () => {
    // De USING-kant eist status 'open': afgehandeld is eindstand.
    const { data } = await admin
      .from('code_aanvragen')
      .update({ status: 'open' })
      .eq('id', aanvraagId)
      .select('id');
    expect(data ?? []).toHaveLength(0);

    const rijen = await aanvragenVan(klantId);
    expect(rijen[0]?.status).toBe('afgehandeld');
  });

  it('na afhandelen kan de klant opnieuw aanvragen (de sleutel is vrij)', async () => {
    // Zonder bericht: pint meteen de default '' — de app mag het veld weglaten.
    const { data, error } = await klant
      .from('code_aanvragen')
      .insert({ client_id: klantId })
      .select('id, status, bericht');
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    expect((data ?? [])[0]?.status).toBe('open');
    expect((data ?? [])[0]?.bericht).toBe('');

    // Eindstaat: twee rijen, waarvan precies één open — de afgehandelde blijft als historie.
    const rijen = await aanvragenVan(klantId);
    expect(rijen).toHaveLength(2);
    expect(rijen.filter((r) => r.status === 'open')).toHaveLength(1);
  });
});
