import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from './supabase-env.mjs';

const { url, serviceKey } = supabaseEnv();
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const WACHTWOORD = 'demo-demo-2026';
const DOMEIN = 'demo.lauinbalans.nl';

/** Lokale kalenderdag als YYYY-MM-DD — géén toISOString().slice: die geeft de UTC-dag. */
const isoDatum = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dagenGeleden = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const urenGeleden = (n) => new Date(Date.now() - n * 3_600_000).toISOString();

async function wisDemoData() {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const demo = data.users.filter((u) => u.email?.endsWith(`@${DOMEIN}`));
  const ids = demo.map((u) => u.id);
  if (ids.length) {
    // FK-veilige volgorde: clients verwijzen naar coaches, dus clients eerst.
    // (Zou je een coach-auth-user eerst verwijderen terwijl haar clients nog
    // bestaan, dan blokkeert de FK clients.coach_id → coaches.id de cascade.)
    // Elke client-delete cascadeert naar messages/food_logs/flags/notes/sessies.
    const { error: cErr } = await db.from('clients').delete().in('id', ids);
    if (cErr) throw new Error(`clients opruimen: ${cErr.message}`);
    const { error: coErr } = await db.from('coaches').delete().in('id', ids);
    if (coErr) throw new Error(`coaches opruimen: ${coErr.message}`);
  }
  for (const user of demo) {
    const { error: dErr } = await db.auth.admin.deleteUser(user.id);
    if (dErr) throw new Error(`auth-user ${user.email} verwijderen: ${dErr.message}`);
  }
}

async function maakUser(email, naam) {
  const { data, error } = await db.auth.admin.createUser({
    email: `${email}@${DOMEIN}`,
    password: WACHTWOORD,
    email_confirm: true,
    user_metadata: { naam },
  });
  if (error) throw error;
  return data.user.id;
}

async function invoeg(tabel, rows) {
  const { data, error } = await db.from(tabel).insert(rows).select();
  if (error) throw new Error(`${tabel}: ${error.message}`);
  return data;
}

await wisDemoData();

// ── Coaches ──
const lauraId = await maakUser('laura', 'Laura');
const beaId = await maakUser('bea', 'Bea'); // tweede coach: alleen voor RLS-isolatie-tests
await invoeg('coaches', [
  { id: lauraId, naam: 'Laura' },
  { id: beaId, naam: 'Bea' },
]);

// ── Klanten (handoff-klantenlijst; week N → startdatum) ──
const klantSpecs = [
  { email: 'sanne', naam: 'Sanne Vermeer', leeftijd: 38, week: 3, status: 'actief' },
  { email: 'iris', naam: 'Iris de Wit', leeftijd: 41, week: 7, status: 'actief' },
  { email: 'fleur', naam: 'Fleur Bakker', leeftijd: 33, week: 2, status: 'actief' },
  { email: 'marieke', naam: 'Marieke Jansen', leeftijd: 44, week: 11, status: 'actief' },
  { email: 'noor', naam: 'Noor El Amrani', leeftijd: 29, week: 1, status: 'nieuw' },
  { email: 'esther', naam: 'Esther Kok', leeftijd: 36, week: 9, status: 'stil' },
];
const klanten = {};
for (const spec of klantSpecs) {
  const id = await maakUser(spec.email, spec.naam);
  klanten[spec.email] = id;
  await invoeg('clients', [{
    id,
    coach_id: lauraId,
    naam: spec.naam,
    leeftijd: spec.leeftijd,
    startdatum: isoDatum(dagenGeleden((spec.week - 1) * 7 + 1)),
    status: spec.status,
  }]);
}
const sanne = klanten.sanne;

// ── Sanne: AI-profiel v1 (demo-profiel uit de handoff) ──
await invoeg('ai_profile_versions', [{
  client_id: sanne,
  versie: 1,
  author: null,
  profiel: {
    doelen: ['Duurzaam afvallen', '± 6 kg in 6 maanden', 'Energie voor het gezin'],
    portiedoelen: { eiwit: 3, groente: 4, koolhydraten: 2, vet: 2 },
    knelpunten: ['Avond na het eten', 'Donderdag: partner werkt laat'],
    voorkeuren: ['3 maaltijden', 'Weinig vlees', 'Geen vis', 'Max 25 min'],
    beperkingen: ['Noten-allergie', 'Geen medicatie'],
    checkinRitme: ["'s ochtends kort", "'s avonds op eigen initiatief", 'Duwtje na 3 stille dagen'],
    aanpak: 'Geen calorieën tellen, geen weegmomenten in de chat. Focus op maaltijdstructuur, avondroutine en handmaten.',
    toon: 'Warm en direct. Korte berichten. Geen wollige complimenten — Sanne prikt daar doorheen.',
    vermijdenInCoaching: 'Niet openen met gewicht of getallen. Geen strakke weekschema’s. Voorzichtig met lichaamsbeeld.',
    veiligheidsvlag: 'soms',
  },
}]);

// ── Sanne: voedingslogs deze week (5 dagen gelogd, conform handoff) ──
for (const n of [6, 5, 4, 2, 1]) {
  await invoeg('food_logs', [{
    client_id: sanne,
    datum: isoDatum(dagenGeleden(n)),
    moment: 'Avondeten',
    porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 1 },
    bron: 'eten',
  }]);
}
const [lunchLog] = await invoeg('food_logs', [{
  client_id: sanne,
  datum: isoDatum(dagenGeleden(0)),
  moment: 'Lunch',
  porties: { eiwit: 1, groente: 2, koolhydraten: 1, vet: 0 },
  bron: 'chat',
}]);

// ── Sanne: transcript (handoff coach-meeleesscherm, 8 items) ──
const transcript = [
  ['ai', 'Goedemorgen Sanne. Gisteren zei je dat de avonden het moeilijkst zijn — hoe ging het na het eten?', 8],
  ['client', 'Verrassend rustig eigenlijk. Ik heb thee gezet in plaats van de koekjestrommel gepakt.', 7],
  ['ai', 'Dat is precies de ruil waar we het over hadden. Niet minder willen, maar iets anders klaar hebben staan. Wat maakte dat het gisteren lukte?', 6.5],
  ['log', null, 6],
  ['ai', 'Mooie lunch — handpalm eiwit en twee vuisten groente. Als je vanmiddag nog trek krijgt, is dat meestal het eiwit. Kwark of een handje kip erbij doet meer dan je denkt.', 6],
  ['client', 'Dank je. Donderdag wordt lastig, dan werkt Jeroen laat en eet ik met de kinderen mee.', 5],
  ['ai', 'Dat hoeft geen probleem te zijn. Zal ik woensdag een maaltijd voorstellen die de kinderen ook eten, zodat je donderdag geen apart plan nodig hebt?', 4],
  ['client', 'Graag. Ik wil trouwens even met een mens praten over het weekend.', 2],
];
for (const [sender, tekst, urenTerug] of transcript) {
  await invoeg('messages', [{
    client_id: sanne,
    sender: sender === 'log' ? 'client' : sender,
    tekst,
    food_log_id: sender === 'log' ? lunchLog.id : null,
    created_at: urenGeleden(urenTerug),
  }]);
}

// ── Laatste berichten van de andere klanten (handoff-klantenlijst) ──
const laatste = [
  ['iris', 'client', 'Lau snapt niet dat ik nachtdiensten heb.'],
  ['fleur', 'ai', 'Mooi dat je de lunch hebt voorbereid.'],
  ['marieke', 'client', 'Heb je recepten voor het weekend?'],
  ['noor', 'ai', 'Welkom Noor — je intake is afgerond. Laura stelt je profiel deze week bij.'],
  ['esther', 'ai', 'Ik hoor al vier dagen niets — zal ik het morgen rustig aan doen met vragen?'],
];
for (const [email, sender, tekst] of laatste) {
  await invoeg('messages', [{ client_id: klanten[email], sender, tekst, created_at: urenGeleden(20) }]);
}

// ── Open flags: Sanne (2 uur geleden) en Iris ──
await invoeg('flags', [
  { client_id: sanne, tekst: 'Ik wil even met een mens praten over het weekend.', redenen: ['Het weekend'], created_at: urenGeleden(2) },
  { client_id: klanten.iris, tekst: 'Lau snapt niet dat ik nachtdiensten heb.', redenen: ['Ik twijfel aan het advies'], created_at: urenGeleden(20) },
]);

// ── Notities voor Sanne (handoff) ──
await invoeg('coach_notes', [
  { client_id: sanne, datum: isoDatum(dagenGeleden(7)), tekst: 'Wil rust rond eten, niet nóg een schema. Werkt drie dagen, kinderen van 4 en 7. Avonden zijn het knelpunt.', type: 'sessie' },
  { client_id: sanne, datum: isoDatum(dagenGeleden(14)), tekst: 'Twee keer eerder een dieet met jojo-effect. Noten-allergie. Geen rode vlaggen, lichaamsbeeld ligt gevoelig.', type: 'intake' },
]);

const tellingen = {};
for (const tabel of ['coaches', 'clients', 'ai_profile_versions', 'messages', 'food_logs', 'flags', 'coach_notes']) {
  const { count } = await db.from(tabel).select('*', { count: 'exact', head: true });
  tellingen[tabel] = count;
}
console.log('Seed klaar:', tellingen);
