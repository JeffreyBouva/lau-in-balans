import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Fase 4: registratie-trigger, tiers, invite-codes, verzilver_code, app_config.
// Draait tegen het GEHOSTE Supabase-project (geen lokaal Docker), net als rls.test.ts:
// vereist een gevulde `.env` en een verse `npm run seed`.
//
// Deze suite hangt bewust aan een EIGEN wegwerp-coach in plaats van aan Laura uit
// de seed: verzilveren maakt de testklant `coached`, en die zou anders meetellen in
// "Laura ziet alle zes klanten" van rls.test.ts wanneer beide bestanden parallel
// draaien. Een eigen coach is voor de rest van de suite onzichtbaar (coaches-RLS:
// alleen zichzelf + de eigen klanten).
//
// De tests binnen dit bestand lopen van boven naar beneden en bouwen op elkaar voort:
// de gebruiker start `free`, wordt in de verzilver-test `coached`, en `mijn_tier`
// leunt op die eindstaat.

const WACHTWOORD = 'fase4-test-2026';
const TEST_DOMEIN = 'test.lauinbalans.nl';
const TEST_EMAIL = `fase4-${Date.now()}@${TEST_DOMEIN}`;

let url: string;
let anonKey: string;
let service: SupabaseClient;
let testCoachId: string;
let testUserId: string;
let testUser: SupabaseClient;
let code: string;

// Opruim-administratie: alles wat we aanmaken komt hier in, zodat afterAll ook
// opruimt wanneer een test halverwege knalt. FK-veilige volgorde bij het wissen:
// codes → klanten → coach (invite_codes.coach_id en clients.coach_id cascaderen niet).
const gemaakteCodes: string[] = [];
const gemaakteUsers: string[] = [];
const gemaakteCoaches: string[] = [];

function testEmail(): string {
  return `fase4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${TEST_DOMEIN}`;
}

/**
 * Maakt een auth-user via de admin-API en registreert 'm voor de opruiming.
 * `registreer` bepaalt in welke lijst — en dus in welke volgorde — hij wordt gewist.
 */
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

/** Vraagt een verse invite-code (service-only RPC) en registreert 'm voor de opruiming. */
async function nieuweCode(): Promise<string> {
  const { data, error } = await service.rpc('maak_invite_code', { p_coach: testCoachId });
  if (error) throw error;
  gemaakteCodes.push(data as string);
  return data as string;
}

async function ingelogd(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: WACHTWOORD });
  if (error) throw error;
  return client;
}

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  // Wegwerp-coach. Net als de seed wissen we de clients-rij die de trigger tóch
  // aanmaakt ondanks app_metadata.rol — zie het "bekend gedrag"-testje hieronder.
  const coachUser = await nieuweUser(
    { app_metadata: { rol: 'coach' }, user_metadata: { naam: 'Fase Vier Coach' } },
    gemaakteCoaches, // coach ruimen we ná de klanten op
  );
  await service.from('clients').delete().eq('id', coachUser.id);
  const { error: coachErr } = await service
    .from('coaches')
    .insert({ id: coachUser.id, naam: 'Fase Vier Coach' });
  if (coachErr) throw coachErr;
  testCoachId = coachUser.id;

  // Verse gebruiker → de trigger hoort een free clients-rij te maken.
  const u = await nieuweUser({ email: TEST_EMAIL, user_metadata: { naam: 'Fase Vier' } });
  testUserId = u.id;

  code = await nieuweCode();
  testUser = await ingelogd(TEST_EMAIL);
});

afterAll(async () => {
  // Best effort: een halverwege gefaalde test mag de opruiming niet laten knallen,
  // en rijen die al weg zijn (of nooit zijn aangemaakt) zijn geen fout.
  // PostgREST-builders zijn thenables, geen echte Promises → PromiseLike.
  const stil = async (fn: () => PromiseLike<unknown>) => {
    try {
      await fn();
    } catch {
      /* al weg */
    }
  };

  for (const c of gemaakteCodes) {
    await stil(() => service.from('invite_codes').delete().eq('code', c));
  }
  // clients.id → auth.users on delete cascade doet dit normaal vanzelf; expliciet
  // wissen houdt de opruiming ook heel als de auth-delete faalt.
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

describe('registratie-trigger', () => {
  it('maakt automatisch een free clients-rij met naam uit metadata', async () => {
    const { data } = await service
      .from('clients')
      .select('naam, tier, coach_id')
      .eq('id', testUserId)
      .single();
    expect(data).toEqual({ naam: 'Fase Vier', tier: 'free', coach_id: null });
  });

  it('bekend gedrag: app_metadata-rol stopt de trigger NIET via de admin-API (aanmaker ruimt op)', async () => {
    // GoTrue schrijft app_metadata pas in een UPDATE ná de INSERT op auth.users,
    // dus handle_new_user ziet rol='coach' niet en maakt tóch een free clients-rij.
    // De seed (en de beforeAll hierboven) rekenen hierop en wissen die rij zelf.
    // Deze test legt het gedrag vast, zodat een toekomstige GoTrue-wijziging —
    // waarbij de trigger de vlag wél ziet — hier opvalt in plaats van stil de
    // opruimlogica overbodig te maken.
    const nep = await nieuweUser({
      app_metadata: { rol: 'coach' },
      user_metadata: { naam: 'Nep Coach' },
    });
    try {
      const { data: user } = await service.auth.admin.getUserById(nep.id);
      expect(user!.user!.app_metadata.rol).toBe('coach'); // de vlag staat er wél op

      const { data } = await service
        .from('clients')
        .select('naam, tier')
        .eq('id', nep.id)
        .maybeSingle();
      expect(data).toEqual({ naam: 'Nep Coach', tier: 'free' });
    } finally {
      await service.from('clients').delete().eq('id', nep.id);
      await service.auth.admin.deleteUser(nep.id);
    }
  });
});

describe('verzilver_code', () => {
  it('onzin-code → false', async () => {
    const { data, error } = await testUser.rpc('verzilver_code', { p_code: 'XXXXXX' });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('geldige code → true, tier coached, gekoppeld aan de coach van de code (hoofdletterongevoelig)', async () => {
    const { data, error } = await testUser.rpc('verzilver_code', { p_code: code.toLowerCase() });
    expect(error).toBeNull();
    expect(data).toBe(true);

    const { data: c } = await service
      .from('clients')
      .select('tier, coach_id')
      .eq('id', testUserId)
      .single();
    expect(c).toEqual({ tier: 'coached', coach_id: testCoachId });

    const { data: rij } = await service
      .from('invite_codes')
      .select('used_by, used_at')
      .eq('code', code)
      .single();
    expect(rij!.used_by).toBe(testUserId);
    expect(rij!.used_at).not.toBeNull();
  });

  it('al-coached → false, ook met een verse geldige code', async () => {
    const extra = await nieuweCode();
    const { data } = await testUser.rpc('verzilver_code', { p_code: extra });
    expect(data).toBe(false);

    // De verse code is NIET verbruikt: een al-gekoppelde klant mag geen codes verbranden.
    const { data: rij } = await service
      .from('invite_codes')
      .select('used_by, used_at')
      .eq('code', extra)
      .single();
    expect(rij!.used_by).toBeNull();
    expect(rij!.used_at).toBeNull();
  });

  it('gebruikte code door een ander → false', async () => {
    // Deze user krijgt via de trigger een eigen free clients-rij; die cascadeert weg
    // bij het verwijderen van de auth-user (clients.id → auth.users on delete cascade).
    const ander = await nieuweUser();
    const anderClient = await ingelogd(ander.email);

    const { data } = await anderClient.rpc('verzilver_code', { p_code: code });
    expect(data).toBe(false);

    // Blijft free: een verbrande code koppelt niemand anders.
    const { data: rij } = await service
      .from('clients')
      .select('tier, coach_id')
      .eq('id', ander.id)
      .single();
    expect(rij).toEqual({ tier: 'free', coach_id: null });
  });
});

describe('afscherming', () => {
  it('klant ziet invite_codes niet', async () => {
    const { data } = await testUser.from('invite_codes').select('code');
    expect((data ?? []).length).toBe(0);
  });

  it('klant kan maak_invite_code niet aanroepen', async () => {
    const { error } = await testUser.rpc('maak_invite_code', { p_coach: testCoachId });
    expect(error).not.toBeNull(); // execute alleen voor service_role
  });

  it('anon leest app_config (sloten_actief bestaat)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon
      .from('app_config')
      .select('key, value')
      .eq('key', 'sloten_actief')
      .single();
    expect(data!.value).toBe(true);
  });

  it('klant kan app_config niet schrijven', async () => {
    // Geen update-policy → RLS geeft een error óf een stille 0-rijen-no-op.
    // Wat telt is de eindstaat: de waarde mag niet zijn veranderd.
    await testUser.from('app_config').update({ value: false }).eq('key', 'sloten_actief');
    const { data } = await service
      .from('app_config')
      .select('value')
      .eq('key', 'sloten_actief')
      .single();
    expect(data!.value).toBe(true);
  });

  it('mijn_tier geeft de eigen tier', async () => {
    const { data } = await testUser.rpc('mijn_tier');
    expect(data).toBe('coached'); // na de verzilver-test hierboven
  });
});
