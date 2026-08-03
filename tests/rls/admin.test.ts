import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Laura als super admin: de vlag coaches.is_admin, de helper is_admin(), de admin-tak in
// is_coach_of (en dus in alle zeventien coach-policies) en de vier policies die direct op
// coach_id matchen (clients ×2, invite_codes ×2).
//
// De belangrijkste test in dit bestand is niet dat de admin álles ziet, maar dat een
// gewone coach dat nog steeds NIET doet: is_coach_of is de spil van het hele RLS-model,
// en een te ruime admin-tak zou daar in één keer alles laten lekken. Vandaar de derde
// wegwerp-coach (`vreemd`) zonder eigen klanten en de negatieve asserts per tabel.
//
// LET OP: vereist de admin-migratie (20260803120000_admin.sql — nog niet gepusht op het
// moment van schrijven; de push is een Jeffrey-stap, net als bij fase 5, 6 en 7). Zolang
// `supabase db push` niet is gedraaid falen de tests hieronder op de ontbrekende kolom
// (PGRST204 bij het zetten van is_admin) en de ontbrekende functie (PGRST202 op de RPC
// is_admin), en op de admin-takken die er nog niet zijn (de admin ziet dan 0 rijen). Dat
// is verwacht en géén testfout. De isolatie-tests (de gewone coach ziet niets van een
// ander) slagen nu al — die pinnen het gedrag dat NIET mag veranderen.
//
// Draait tegen het GEHOSTE Supabase-project (geen lokaal Docker), net als rls.test.ts en
// de fase-suites: vereist een gevulde `.env`.
//
// Alle fixtures zijn wegwerp: eigen coaches, eigen klant. Ze hangen bewust niet aan Laura
// uit de seed — die telt mee in "Laura ziet alle zes klanten" van rls.test.ts wanneer de
// bestanden parallel draaien.

const WACHTWOORD = 'admin-test-2026';
const TEST_DOMEIN = 'test.lauinbalans.nl';

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

/** De producteigenaar: is_admin true, géén eigen klanten. */
let adminId: string;
let admin: SupabaseClient;

/** Gewone coach, eigenaar van de testklant. */
let coachId: string;
let coach: SupabaseClient;

/** Gewone coach zónder klanten: de isolatie-tegenhanger (mag niets van `coach` zien). */
let vreemdId: string;
let vreemd: SupabaseClient;

/** Klant van `coach` — nooit van de admin. */
let klantId: string;
let klant: SupabaseClient;

/** De code die de klant verzilverde: verbrand, en dus ook voor de admin niet intrekbaar. */
let verzilverdeCode: string;

// Opruim-administratie: alles wat we aanmaken komt hier in, zodat afterAll ook opruimt
// wanneer een test halverwege knalt. FK-veilige volgorde bij het wissen: kindrijen
// (ai_usage, flags, messages, food_logs, notities, profielversies) → codes → klanten →
// coaches → auth-users.
const gemaakteCodes: string[] = [];
const gemaakteUsers: string[] = [];
const gemaakteCoaches: string[] = [];

function testEmail(): string {
  // Zelfde random-suffix als elke andere testgebruiker: twee runs binnen dezelfde
  // milliseconde (of een run naast een achtergebleven user) botsen anders op de
  // unieke e-mail in auth.users.
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${TEST_DOMEIN}`;
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
 * De is_admin-vlag zetten we in een APARTE update, niet in de insert: zonder de migratie
 * kent PostgREST de kolom nog niet en zou de insert falen — dan zou beforeAll knallen en
 * elke test op de fixture stranden in plaats van op de assert die ze toetst.
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
    const { error: aErr } = await service.from('coaches').update({ is_admin: true }).eq('id', user.id);
    if (aErr) console.warn('fixture is_admin faalde (migratie nog niet gepusht?):', aErr.message);
  }
  return user;
}

async function ingelogd(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: WACHTWOORD });
  if (error) throw error;
  return client;
}

/** Vaste fixture-code via de service-only RPC uit fase 4. */
async function nieuweCode(voorCoach: string): Promise<string> {
  const { data, error } = await service.rpc('maak_invite_code', { p_coach: voorCoach });
  if (error) throw error;
  gemaakteCodes.push(data as string);
  return data as string;
}

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  const a = await nieuweCoach('Admin Laura Test', true);
  const c = await nieuweCoach('Gewone Coach Test');
  const v = await nieuweCoach('Vreemde Coach Test');
  adminId = a.id;
  coachId = c.id;
  vreemdId = v.id;

  // Verse gebruiker → de registratie-trigger maakt een free clients-rij.
  const k = await nieuweUser({ user_metadata: { naam: 'Admin Test Klant' } });
  klantId = k.id;

  [admin, coach, vreemd, klant] = await Promise.all([
    ingelogd(a.email),
    ingelogd(c.email),
    ingelogd(v.email),
    ingelogd(k.email),
  ]);

  // Coached maken via het live pad: service maakt een code van de GEWONE coach, de klant
  // verzilvert 'm. Daarmee is coach_id de gewone coach — nooit de admin.
  verzilverdeCode = await nieuweCode(coachId);
  const { data: verzilverd, error: verzilverFout } = await klant.rpc('verzilver_code', {
    p_code: verzilverdeCode,
  });
  if (verzilverFout) throw verzilverFout;
  if (verzilverd !== true) throw new Error('fixture: verzilver_code gaf geen true');

  // Data van die klant, met de service role (RLS-onafhankelijk): één rij per tabel die
  // via is_coach_of gaat, zodat elke policy iets te vinden heeft.
  const nu = new Date().toISOString();
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  const seeds: Array<[string, Record<string, unknown>]> = [
    ['messages', { client_id: klantId, sender: 'client', tekst: 'Bericht van de klant', created_at: nu }],
    ['food_logs', { client_id: klantId, datum: vandaag, moment: 'Lunch', porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 }, bron: 'eten' }],
    ['flags', { client_id: klantId, tekst: 'Ik wil een mens spreken', created_at: nu }],
    ['coach_notes', { client_id: klantId, datum: vandaag, tekst: 'Notitie van de gewone coach', type: 'los' }],
    ['ai_profile_versions', { client_id: klantId, versie: 1, author: null, profiel: PROFIEL_V1 }],
    ['ai_usage', { client_id: klantId, model: 'claude-sonnet-5', input_tokens: 120, output_tokens: 45, created_at: nu }],
  ];
  for (const [tabel, rij] of seeds) {
    const { error } = await service.from(tabel).insert(rij);
    if (error) throw new Error(`fixture ${tabel}: ${error.message}`);
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

  // Kindrijen eerst: de cascades doen dit normaal vanzelf, maar expliciet blijft de
  // opruiming ook heel als een van de stappen faalt.
  for (const id of gemaakteUsers) {
    await stil(() => service.from('ai_usage').delete().eq('client_id', id));
    await stil(() => service.from('flags').delete().eq('client_id', id));
    await stil(() => service.from('messages').delete().eq('client_id', id));
    await stil(() => service.from('food_logs').delete().eq('client_id', id));
    await stil(() => service.from('coach_notes').delete().eq('client_id', id));
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

describe('is_admin()', () => {
  it('is true voor de admin-coach en false voor een gewone coach', async () => {
    const vanAdmin = await admin.rpc('is_admin');
    expect(vanAdmin.error).toBeNull();
    expect(vanAdmin.data).toBe(true);

    const vanCoach = await coach.rpc('is_admin');
    expect(vanCoach.error).toBeNull();
    expect(vanCoach.data).toBe(false);
  });

  it('is false voor een klant en niet aanroepbaar voor anon', async () => {
    // Een klant heeft geen coaches-rij; admin worden kan dus per definitie niet.
    const vanKlant = await klant.rpc('is_admin');
    expect(vanKlant.error).toBeNull();
    expect(vanKlant.data).toBe(false);

    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.rpc('is_admin');
    expect(error).not.toBeNull(); // revoke execute ... from public, anon
  });

  it('niemand kan zichzelf tot admin promoveren — op coaches bestaat geen update-policy', async () => {
    // Dit is de sleutel onder de hele vlag: is_admin is alleen door de service role (of
    // via SQL) te zetten. Zou er ooit een update-policy op coaches bijkomen, dan valt
    // deze test om vóórdat het in productie een gat wordt.
    const viaCoach = await coach.from('coaches').update({ is_admin: true }).eq('id', coachId).select('id');
    expect(viaCoach.data ?? []).toHaveLength(0); // RLS: geen update-policy → 0 rijen geraakt

    const viaKlant = await klant.from('coaches').update({ is_admin: true }).eq('id', coachId).select('id');
    expect(viaKlant.data ?? []).toHaveLength(0);

    // Een klant kan zichzelf ook geen coaches-rij aanmeten (geen insert-policy).
    const insert = await klant.from('coaches').insert({ id: klantId, naam: 'Stiekem', is_admin: true });
    expect(insert.error).not.toBeNull();

    // Eindstaat: een error/0 rijen bewijst niets als de vlag tóch omging.
    const { data: rij } = await service.from('coaches').select('is_admin').eq('id', coachId).single();
    expect(rij!.is_admin).toBe(false);
    const { data: gewordenCoach } = await service.from('coaches').select('id').eq('id', klantId).maybeSingle();
    expect(gewordenCoach).toBeNull();

    // En de coach is ook ná de poging nog steeds geen admin volgens de helper zelf.
    const nogSteeds = await coach.rpc('is_admin');
    expect(nogSteeds.data).toBe(false);
  });
});

describe('admin ziet de klant van een andere coach', () => {
  it('clients: de admin leest de rij, de vreemde coach niet', async () => {
    const vanAdmin = await admin.from('clients').select('id, naam, coach_id').eq('id', klantId);
    expect(vanAdmin.error).toBeNull();
    expect(vanAdmin.data ?? []).toHaveLength(1);
    expect((vanAdmin.data ?? [])[0]?.coach_id).toBe(coachId); // niet van de admin zelf

    // De eigen coach ziet 'm uiteraard ook (de bestaande tak is niet gesloopt).
    const vanCoach = await coach.from('clients').select('id').eq('id', klantId);
    expect(vanCoach.data ?? []).toHaveLength(1);
  });

  it('alle is_coach_of-tabellen: de admin leest de data van die klant', async () => {
    const [berichten, logs, flags, notities, profielen, usage] = await Promise.all([
      admin.from('messages').select('id').eq('client_id', klantId),
      admin.from('food_logs').select('id').eq('client_id', klantId),
      admin.from('flags').select('id').eq('client_id', klantId),
      admin.from('coach_notes').select('id').eq('client_id', klantId),
      admin.from('ai_profile_versions').select('id, versie').eq('client_id', klantId),
      admin.from('ai_usage').select('id').eq('client_id', klantId),
    ]);
    expect(berichten.data ?? []).toHaveLength(1);
    expect(logs.data ?? []).toHaveLength(1);
    expect(flags.data ?? []).toHaveLength(1);
    expect(notities.data ?? []).toHaveLength(1);
    expect(profielen.data ?? []).toHaveLength(1);
    expect(usage.data ?? []).toHaveLength(1);
  });

  it('de admin mag als coach een bericht sturen bij die klant', async () => {
    const { data, error } = await admin
      .from('messages')
      .insert({ client_id: klantId, sender: 'coach', tekst: 'Laura kijkt even mee.' })
      .select('id, sender');
    expect(error).toBeNull(); // policy coach_stuurt_als_coach → is_coach_of
    expect(data ?? []).toHaveLength(1);
    expect((data ?? [])[0]?.sender).toBe('coach');
  });

  it('ai_gebruik_deze_maand werkt voor de admin op andermans klant', async () => {
    const { data, error } = await admin.rpc('ai_gebruik_deze_maand', { p_client: klantId });
    expect(error).toBeNull();
    expect(data).toBe(1); // één ai_usage-rij in de fixture, van deze maand
  });

  it('invite_codes: de admin ziet de codes van de andere coach en trekt een ongebruikte in', async () => {
    const teZien = await nieuweCode(coachId);
    const inTeTrekken = await nieuweCode(coachId);

    const { data: gezien, error } = await admin
      .from('invite_codes')
      .select('code, coach_id')
      .in('code', [teZien, inTeTrekken]);
    expect(error).toBeNull();
    expect((gezien ?? []).map((r) => r.code).sort()).toEqual([teZien, inTeTrekken].sort());

    const { data: weg } = await admin
      .from('invite_codes')
      .delete()
      .eq('code', inTeTrekken)
      .select('code');
    expect(weg ?? []).toHaveLength(1);

    const { data: rij } = await service
      .from('invite_codes')
      .select('code')
      .eq('code', inTeTrekken)
      .maybeSingle();
    expect(rij).toBeNull();

    // De verzilverde code van de fixture blijft ook voor de admin staan: used_at is gezet.
    const { data: verzilverdWeg } = await admin
      .from('invite_codes')
      .delete()
      .eq('code', verzilverdeCode)
      .select('code');
    expect(verzilverdWeg ?? []).toHaveLength(0);
  });
});

describe('isolatie blijft intact — een gewone coach is geen admin', () => {
  it('de vreemde coach ziet de klant van een andere coach nergens', async () => {
    // DE regressietest: is_coach_of is de spil van zeventien policies. Wordt de admin-tak
    // ooit te ruim (bijv. `or exists (select 1 from coaches where id = auth.uid())`), dan
    // ziet élke coach hier ineens alles.
    const [klanten, berichten, logs, flags, notities, profielen, usage] = await Promise.all([
      vreemd.from('clients').select('id').eq('id', klantId),
      vreemd.from('messages').select('id').eq('client_id', klantId),
      vreemd.from('food_logs').select('id').eq('client_id', klantId),
      vreemd.from('flags').select('id').eq('client_id', klantId),
      vreemd.from('coach_notes').select('id').eq('client_id', klantId),
      vreemd.from('ai_profile_versions').select('id').eq('client_id', klantId),
      vreemd.from('ai_usage').select('id').eq('client_id', klantId),
    ]);
    for (const res of [klanten, berichten, logs, flags, notities, profielen, usage]) {
      expect(res.error).toBeNull(); // RLS filtert stil weg, geen error
      expect(res.data ?? []).toHaveLength(0);
    }

    // Positieve controle: de rijen bestaan wél (zonder dit zou een lege DB ook slagen).
    const { count } = await service
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', klantId);
    expect(count).toBeGreaterThan(0);
  });

  it('de vreemde coach kan niet schrijven bij die klant en de RPC weigert', async () => {
    const bericht = await vreemd
      .from('messages')
      .insert({ client_id: klantId, sender: 'coach', tekst: 'Mag niet' });
    expect(bericht.error).not.toBeNull();

    const notitie = await vreemd
      .from('coach_notes')
      .insert({ client_id: klantId, tekst: 'Mag ook niet' });
    expect(notitie.error).not.toBeNull();

    // clients-update: geen error maar 0 rijen — RLS filtert de rij weg vóór de update.
    const wijzig = await vreemd
      .from('clients')
      .update({ status: 'gestopt' })
      .eq('id', klantId)
      .select('id');
    expect(wijzig.data ?? []).toHaveLength(0);

    const { error: rpcFout } = await vreemd.rpc('ai_gebruik_deze_maand', { p_client: klantId });
    expect(rpcFout).not.toBeNull(); // raise: geen toegang tot deze klant

    // Eindstaat: de status van de klant is niet gewijzigd.
    const { data: rij } = await service.from('clients').select('status').eq('id', klantId).single();
    expect(rij!.status).not.toBe('gestopt');
  });

  it('de vreemde coach ziet de invite-codes van de andere coach niet', async () => {
    const code = await nieuweCode(coachId);

    const { data: gezien } = await vreemd.from('invite_codes').select('code').eq('code', code);
    expect(gezien ?? []).toHaveLength(0);

    const { data: weg } = await vreemd.from('invite_codes').delete().eq('code', code).select('code');
    expect(weg ?? []).toHaveLength(0);

    const { data: rij } = await service.from('invite_codes').select('code').eq('code', code).single();
    expect(rij!.code).toBe(code);
  });
});

describe('de klantkant is ongemoeid gebleven', () => {
  it('de klant ziet nog steeds alleen zichzelf en niet de coach-only data', async () => {
    // clients: alleen de eigen rij (klant_leest_zichzelf) — de admin-tak op
    // coach_leest_klanten mag daar niets aan veranderd hebben.
    const { data: klanten, error } = await klant.from('clients').select('id');
    expect(error).toBeNull();
    expect((klanten ?? []).map((r) => r.id)).toEqual([klantId]);

    // Coach-only tabellen blijven dicht voor de klant zelf.
    const [notities, profielen, usage] = await Promise.all([
      klant.from('coach_notes').select('id').eq('client_id', klantId),
      klant.from('ai_profile_versions').select('id').eq('client_id', klantId),
      klant.from('ai_usage').select('id').eq('client_id', klantId),
    ]);
    expect(notities.data ?? []).toHaveLength(0);
    expect(profielen.data ?? []).toHaveLength(0);
    expect(usage.data ?? []).toHaveLength(0);

    // En de eigen data ziet ze uiteraard nog wél.
    const eigenBerichten = await klant.from('messages').select('id').eq('client_id', klantId);
    expect((eigenBerichten.data ?? []).length).toBeGreaterThan(0);
  });

  it('de klant ziet geen invite-codes, ook niet die van de eigen coach', async () => {
    const { data } = await klant.from('invite_codes').select('code').eq('coach_id', coachId);
    expect(data ?? []).toHaveLength(0);
  });
});
