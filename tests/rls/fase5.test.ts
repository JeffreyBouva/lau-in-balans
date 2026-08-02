import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Fase 5: de coach-policies op invite_codes (lezen + ongebruikte intrekken) en de RPC
// maak_eigen_invite_code.
//
// LET OP: vereist de fase5-migratie (nog niet gepusht op moment van schrijven — zie
// plan Task 6). Zolang `supabase db push` niet is gedraaid falen de tests hieronder op
// de ontbrekende functie (PGRST202) en op de ontbrekende select-policy (0 rijen); dat
// is verwacht en géén testfout.
//
// Draait tegen het GEHOSTE Supabase-project (geen lokaal Docker), net als rls.test.ts
// en fase4.test.ts: vereist een gevulde `.env`.
//
// Net als fase 4 hangt deze suite aan EIGEN wegwerp-coaches in plaats van aan Laura uit
// de seed: de testklant wordt hier `coached`, en die zou anders meetellen in "Laura ziet
// alle zes klanten" van rls.test.ts wanneer de bestanden parallel draaien.

const WACHTWOORD = 'fase5-test-2026';
const TEST_DOMEIN = 'test.lauinbalans.nl';
/** Hetzelfde alfabet als maak_invite_code: geen O/0/I/1 (fase4-migratie). */
const ALFABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

let url: string;
let anonKey: string;
let service: SupabaseClient;

let coachAId: string;
let coachBId: string;
let coachA: SupabaseClient;
let coachB: SupabaseClient;

let klantId: string;
let klant: SupabaseClient;

// Opruim-administratie: alles wat we aanmaken komt hier in, zodat afterAll ook opruimt
// wanneer een test halverwege knalt. FK-veilige volgorde bij het wissen:
// codes → klanten → coaches (invite_codes.coach_id en clients.coach_id cascaderen niet).
const gemaakteCodes: string[] = [];
const gemaakteUsers: string[] = [];
const gemaakteCoaches: string[] = [];

function testEmail(): string {
  // Zelfde random-suffix als elke andere testgebruiker: twee runs binnen dezelfde
  // milliseconde (of een run naast een achtergebleven user) botsen anders op de
  // unieke e-mail in auth.users.
  return `fase5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${TEST_DOMEIN}`;
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

/**
 * Vaste fixture-code via de service-only RPC uit fase 4. Bewust NIET via
 * maak_eigen_invite_code: de policy-tests moeten falen op de policy die ze toetsen,
 * niet op een RPC die nog niet bestaat.
 */
async function nieuweCode(coachId: string): Promise<string> {
  const { data, error } = await service.rpc('maak_invite_code', { p_coach: coachId });
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

/** Aantal codes van een coach, gelezen met de service role (RLS-onafhankelijk). */
async function aantalCodes(coachId: string): Promise<number> {
  const { count, error } = await service
    .from('invite_codes')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId);
  if (error) throw error;
  return count ?? 0;
}

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  const a = await nieuweCoach('Fase Vijf Coach A');
  const b = await nieuweCoach('Fase Vijf Coach B');
  coachAId = a.id;
  coachBId = b.id;

  // Verse gebruiker → de registratie-trigger maakt een free clients-rij.
  const u = await nieuweUser({ user_metadata: { naam: 'Fase Vijf Klant' } });
  klantId = u.id;

  [coachA, coachB, klant] = await Promise.all([
    ingelogd(a.email),
    ingelogd(b.email),
    ingelogd(u.email),
  ]);
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

  for (const c of gemaakteCodes) {
    await stil(() => service.from('invite_codes').delete().eq('code', c));
  }
  // clients.id → auth.users on delete cascade doet dit normaal vanzelf; expliciet
  // wissen houdt de opruiming ook heel als de auth-delete faalt. Klanten éérst: een
  // verzilverde klant wijst met coach_id naar de coach hieronder.
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

describe('maak_eigen_invite_code', () => {
  it('coach maakt een code voor zichzelf: 6 tekens uit het juiste alfabet', async () => {
    const { data, error } = await coachA.rpc('maak_eigen_invite_code');
    expect(error).toBeNull();
    expect(typeof data).toBe('string');
    gemaakteCodes.push(data as string);
    expect(data as string).toMatch(ALFABET);

    // De rij hangt aan coach A zelf (de JWT bepaalt de eigenaar) en is nog vrij.
    const { data: rij } = await service
      .from('invite_codes')
      .select('coach_id, used_by, used_at')
      .eq('code', data as string)
      .single();
    expect(rij).toEqual({ coach_id: coachAId, used_by: null, used_at: null });
  });

  it('klant kan de RPC niet aanroepen en er komt nergens een code bij', async () => {
    const voorA = await aantalCodes(coachAId);
    const voorB = await aantalCodes(coachBId);

    const { error } = await klant.rpc('maak_eigen_invite_code');
    expect(error).not.toBeNull(); // raise: alleen coaches kunnen codes aanmaken

    // Eindstaat: een error alleen bewijst niets — de functie is security definer en zou
    // vóór het falen kunnen inserten. Ook op naam van de klant zelf mag er niets staan.
    expect(await aantalCodes(coachAId)).toBe(voorA);
    expect(await aantalCodes(coachBId)).toBe(voorB);
    expect(await aantalCodes(klantId)).toBe(0);
  });

  it('anon kan de RPC niet aanroepen', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await anon.rpc('maak_eigen_invite_code');
    expect(error).not.toBeNull(); // revoke execute ... from public, anon
  });
});

describe('coach leest eigen codes', () => {
  it('coach A ziet de eigen code, coach B niet (en andersom)', async () => {
    const codeA = await nieuweCode(coachAId);
    const codeB = await nieuweCode(coachBId);

    const [vanA, vanB] = await Promise.all([
      coachA.from('invite_codes').select('code, coach_id'),
      coachB.from('invite_codes').select('code, coach_id'),
    ]);
    expect(vanA.error).toBeNull();
    expect(vanB.error).toBeNull();

    const codesA = (vanA.data ?? []).map((r) => r.code);
    const codesB = (vanB.data ?? []).map((r) => r.code);
    expect(codesA).toContain(codeA);
    expect(codesA).not.toContain(codeB);
    expect(codesB).toContain(codeB);
    expect(codesB).not.toContain(codeA);

    // Geen enkele rij van een andere coach lekt mee.
    expect((vanA.data ?? []).every((r) => r.coach_id === coachAId)).toBe(true);
    expect((vanB.data ?? []).every((r) => r.coach_id === coachBId)).toBe(true);

    // Ook gericht opgevraagd blijft de code van de ander onzichtbaar (zonder deze
    // controle zou de test ook slagen op een lege tabel).
    const { data: gericht } = await coachB.from('invite_codes').select('code').eq('code', codeA);
    expect(gericht ?? []).toHaveLength(0);
  });

  it('klant en anon zien niets', async () => {
    const code = await nieuweCode(coachAId);

    const { data: viaKlant } = await klant.from('invite_codes').select('code').eq('code', code);
    expect(viaKlant ?? []).toHaveLength(0);

    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: viaAnon } = await anon.from('invite_codes').select('code').eq('code', code);
    expect(viaAnon ?? []).toHaveLength(0);

    // Positieve controle: de code bestaat wél.
    const { data: viaService } = await service.from('invite_codes').select('code').eq('code', code);
    expect(viaService).toHaveLength(1);
  });
});

describe('coach trekt codes in', () => {
  it('eigen ongebruikte code verdwijnt', async () => {
    const code = await nieuweCode(coachAId);

    const { data, error } = await coachA
      .from('invite_codes')
      .delete()
      .eq('code', code)
      .select('code');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    const { data: rij } = await service
      .from('invite_codes')
      .select('code')
      .eq('code', code)
      .maybeSingle();
    expect(rij).toBeNull();
  });

  it('code van een andere coach blijft staan', async () => {
    const code = await nieuweCode(coachBId);

    // Geen error maar 0 rijen: RLS filtert de rij weg vóór de delete (zelfde stille
    // no-op als bij een geweigerde update).
    const { data } = await coachA.from('invite_codes').delete().eq('code', code).select('code');
    expect(data ?? []).toHaveLength(0);

    const { data: rij } = await service
      .from('invite_codes')
      .select('code')
      .eq('code', code)
      .maybeSingle();
    expect(rij!.code).toBe(code);
  });

  it('gebruikte code is niet in te trekken', async () => {
    const code = await nieuweCode(coachAId);

    // De klant verzilvert 'm eerst: daarna is de code het spoor van de koppeling.
    const { data: verzilverd } = await klant.rpc('verzilver_code', { p_code: code });
    expect(verzilverd).toBe(true);

    const { data } = await coachA.from('invite_codes').delete().eq('code', code).select('code');
    expect(data ?? []).toHaveLength(0);

    const { data: rij } = await service
      .from('invite_codes')
      .select('code, used_by, used_at')
      .eq('code', code)
      .single();
    expect(rij!.used_by).toBe(klantId);
    expect(rij!.used_at).not.toBeNull();
  });
});
