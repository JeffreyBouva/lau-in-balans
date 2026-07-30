import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM zonder types
import { supabaseEnv } from '../../scripts/supabase-env.mjs';

// Draait tegen het GEHOSTE Supabase-project (geen lokaal Docker). Vereist een
// gevulde `.env` (SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY) en een verse `npm run seed`.
// De C1 search_path-hijack zelf is niet via supabase-js te testen (geen DDL over
// PostgREST); die is geborgd doordat de hardening-migratie is toegepast én doordat
// anon 401 krijgt op tabellen waarvan de leespolicy is_coach_of() aanroept.

const WACHTWOORD = 'demo-demo-2026';
const DOMEIN = 'demo.lauinbalans.nl';

let url: string;
let anonKey: string;
let service: SupabaseClient;
let sanneId: string;
let irisId: string;
let lauraCoachId: string;
let beaCoachId: string;

async function ingelogd(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: `${email}@${DOMEIN}`,
    password: WACHTWOORD,
  });
  if (error) throw error;
  return client;
}

/** "Geen toegang" = geen rijen, ongeacht of RLS een lege 200 of een 401-error geeft. */
function geenRijen(res: { data: unknown[] | null }): void {
  expect((res.data ?? []).length).toBe(0);
}

beforeAll(async () => {
  const env = supabaseEnv();
  url = env.url;
  anonKey = env.anonKey;
  service = createClient(url, env.serviceKey, { auth: { persistSession: false } });

  const { data: klanten, error: kErr } = await service.from('clients').select('id, naam');
  if (kErr) throw kErr;
  sanneId = klanten!.find((c) => c.naam === 'Sanne Vermeer')!.id;
  irisId = klanten!.find((c) => c.naam === 'Iris de Wit')!.id;

  const { data: coaches, error: cErr } = await service.from('coaches').select('id, naam');
  if (cErr) throw cErr;
  lauraCoachId = coaches!.find((c) => c.naam === 'Laura')!.id;
  beaCoachId = coaches!.find((c) => c.naam === 'Bea')!.id;
});

describe('klant-isolatie (Sanne)', () => {
  it('ziet alleen zichzelf in clients', async () => {
    const sanne = await ingelogd('sanne');
    const { data } = await sanne.from('clients').select('naam');
    expect(data).toEqual([{ naam: 'Sanne Vermeer' }]);
  });

  it('ziet geen berichten van Iris', async () => {
    const sanne = await ingelogd('sanne');
    const res = await sanne.from('messages').select('id').eq('client_id', irisId);
    geenRijen(res);
  });

  it('kan geen bericht namens Iris sturen', async () => {
    const sanne = await ingelogd('sanne');
    const { error } = await sanne.from('messages').insert({ client_id: irisId, sender: 'client', tekst: 'hack' });
    expect(error).not.toBeNull();
  });

  it('kan zich niet als AI voordoen', async () => {
    const sanne = await ingelogd('sanne');
    const { error } = await sanne.from('messages').insert({ client_id: sanneId, sender: 'ai', tekst: 'nep' });
    expect(error).not.toBeNull();
  });

  it('kan het eigen AI-profiel niet lezen (coach-only)', async () => {
    const sanne = await ingelogd('sanne');
    const res = await sanne.from('ai_profile_versions').select('id');
    geenRijen(res);
  });
});

describe('klant leest de naam van de eigen coach', () => {
  it('geeft precies Laura terug', async () => {
    const sanne = await ingelogd('sanne');
    const { data } = await sanne.from('coaches').select('naam');
    expect(data).toEqual([{ naam: 'Laura' }]);
  });
});

describe('klant corrigeert eigen voedingslog', () => {
  it('mag een eigen log toevoegen, wijzigen en verwijderen', async () => {
    const sanne = await ingelogd('sanne');
    const { data: nieuw, error: insErr } = await sanne
      .from('food_logs')
      .insert({ client_id: sanneId, moment: 'Tussendoor', porties: { eiwit: 1, groente: 0, koolhydraten: 0, vet: 0 }, bron: 'eten' })
      .select()
      .single();
    expect(insErr).toBeNull();

    const { error: updErr } = await sanne
      .from('food_logs')
      .update({ porties: { eiwit: 2, groente: 1, koolhydraten: 0, vet: 0 } })
      .eq('id', nieuw!.id);
    expect(updErr).toBeNull();

    const { error: delErr } = await sanne.from('food_logs').delete().eq('id', nieuw!.id);
    expect(delErr).toBeNull();
  });
});

describe('coach-toegang (Laura)', () => {
  it('ziet alle zes klanten', async () => {
    const laura = await ingelogd('laura');
    const { data } = await laura.from('clients').select('id');
    expect(data).toHaveLength(6);
  });

  it('leest Sannes berichten en profiel', async () => {
    const laura = await ingelogd('laura');
    const { data: berichten } = await laura.from('messages').select('id').eq('client_id', sanneId);
    expect(berichten!.length).toBeGreaterThan(0);
    const { data: profielen } = await laura.from('ai_profile_versions').select('versie').eq('client_id', sanneId);
    expect(profielen).toEqual([{ versie: 1 }]);
  });

  it('kan een klant niet aan een andere coach toewijzen', async () => {
    const laura = await ingelogd('laura');
    await laura.from('clients').update({ coach_id: beaCoachId }).eq('id', sanneId);
    // Eindstaat via service: Sanne hoort nog steeds bij Laura.
    const { data } = await service.from('clients').select('coach_id').eq('id', sanneId).single();
    expect(data!.coach_id).toBe(lauraCoachId);
  });

  it('kan een flag niet als "resolved" markeren zonder afhandelaar (WITH CHECK)', async () => {
    const laura = await ingelogd('laura');
    const { data: flag } = await service.from('flags').select('id').eq('client_id', sanneId).eq('status', 'open').single();
    await laura.from('flags').update({ status: 'resolved' }).eq('id', flag!.id); // geen resolved_by/at
    const { data } = await service.from('flags').select('status, resolved_by').eq('id', flag!.id).single();
    expect(data!.status).toBe('open');
    expect(data!.resolved_by).toBeNull();
  });
});

describe('coach-isolatie (Bea, geen klanten)', () => {
  it('ziet geen klanten en geen berichten', async () => {
    const bea = await ingelogd('bea');
    const klanten = await bea.from('clients').select('id');
    geenRijen(klanten);
    const berichten = await bea.from('messages').select('id').eq('client_id', sanneId);
    geenRijen(berichten);
  });
});

describe('anoniem', () => {
  it('ziet niets (lege 200 óf 401)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    geenRijen(await anon.from('clients').select('id'));
    geenRijen(await anon.from('messages').select('id'));
    geenRijen(await anon.from('ai_profile_versions').select('id'));
  });
});

describe('push-token is uniek over klanten', () => {
  it('weigert hetzelfde token bij een tweede klant', async () => {
    const token = 'ExponentPushToken[RLS-TEST-DEVICE]';
    await service.from('push_tokens').delete().eq('expo_push_token', token); // schone start
    const { error: eersteErr } = await service.from('push_tokens').insert({ client_id: sanneId, expo_push_token: token, platform: 'ios' });
    expect(eersteErr).toBeNull();
    const { error: tweedeErr } = await service.from('push_tokens').insert({ client_id: irisId, expo_push_token: token, platform: 'android' });
    expect(tweedeErr).not.toBeNull(); // unique (expo_push_token)
    await service.from('push_tokens').delete().eq('expo_push_token', token); // opruimen
  });
});
