# Fase 3 — AI-chat (lau-reply): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.
> **Voordat je Claude-API-code schrijft: lees de `claude-api`-skill** (model-ID's, params).

**Goal:** Lau.ai laten antwoorden via een Supabase Edge Function (`lau-reply`) die de Claude-API aanroept, aangestuurd door het per-klant AI-profiel + guardrails, met één herbruikbare prompt-builder.

**Architecture:** Deno Edge Function authenticeert de klant (JWT), laadt context met de service role, bouwt via een pure `prompt-builder` de system-prompt + berichten, roept `claude-sonnet-5` aan, en schrijft het `ai`-bericht weg — de app krijgt het via de bestaande realtime-subscription.

**Tech Stack:** Supabase Edge Functions (Deno) · `npm:@anthropic-ai/sdk` · `@lau/shared` (types/handmaten) · `deno test` (unit) · Node (evals-script)

**Spec:** `docs/superpowers/specs/2026-07-30-fase-3-ai-chat.md`
**Design-bron (toon/few-shots):** `design_handoff_lau_in_balans/README.md` § "2. Chat" (antwoordtabel + openingsgesprek).

---

## Werkwijze & conventies

- **Cloud, geen Docker.** De functie draait pas na deploy (Jeffrey). Prompt-builder + evals-fase-A
  zijn volledig lokaal testbaar zonder API-key/deploy — dat is het leeuwendeel en de focus nu.
- **Branch:** `fase-3-ai-chat` (bevat de spec-commit).
- **Types via `@lau/shared`** met **relatieve import + `.ts`-extensies** (Deno-stijl), bijv.
  `import type { AIProfile, Porties } from '../../../packages/shared/src/types.ts'`. `deno test`
  resolvet dit; bij deploy-bundelen kan een pad-caveat spelen (zie Task 3, laatste noot).
- **Geen secrets in git.** `ANTHROPIC_API_KEY` is een Supabase Edge-secret (Jeffrey).
- Commit-trailer: lege regel + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

```text
supabase/functions/
├── _shared/
│   ├── guardrails.ts            # de 6 guardrail-regels als prompt-tekst
│   ├── few-shots.ts             # handoff-antwoordtabel als voorbeeld-paren
│   ├── prompt-builder.ts        # bouwPrompt(input) → { system, messages }
│   └── prompt-builder.test.ts   # deno test — geen API-key nodig
└── lau-reply/
    └── index.ts                 # Deno.serve: auth → context → prompt → Claude → insert
scripts/
└── guardrail-evals.mjs          # lastige inputs → prompt-niveau-asserts (+ optioneel echte calls)
```

---

### Task 1: Guardrails + few-shots (prompt-content)

**Files:**

- Create: `supabase/functions/_shared/guardrails.ts`, `supabase/functions/_shared/few-shots.ts`

- [ ] **Step 1: `guardrails.ts`** — de 6 regels als één tekstblok (letterlijk uit de spec):

```ts
export const GUARDRAILS = `
Onwrikbare regels (deze gaan boven alles):
1. Geef geen medisch advies. Bij klachten, twijfel of medische vragen: verwijs warm naar de huisarts of diëtist.
2. Gebruik NOOIT calorieën, grammen of macro's. Handmaten (handpalm eiwit, vuist groente, holle hand koolhydraten, duim vet) zijn de enige eenheid.
3. Het profielveld "vermijden in coaching" is bindend. Staat er dat je niet met gewicht of getallen mag openen, doe dat dan niet.
4. Rode vlaggen — signalen van een eetstoornis, ondervoeding, psychische nood, zwangerschap of medicatie: coach dan NIET door. Reageer warm en kort, breng Laura in beeld ("tik boven op Laura, ze leest mee") en verwijs naar een professional. Geen getallen of dieetadvies in zo'n reactie.
5. Laura is altijd één tik weg. Wil de klant een mens spreken of voelt iets niet goed, noem dan de Laura-knop bovenaan.
6. Toon: warm en direct, korte berichten, geen wollige complimenten. Handmaten zijn je taal.
`.trim();
```

- [ ] **Step 2: `few-shots.ts`** — de handoff-antwoordtabel (§ 2 "Antwoordlogica") als paren.
  Neem de triggers + antwoorden letterlijk over uit de handoff (vanavond-eten, trek, etentje,
  laura, gewicht, moe, gelogd) als `{ vraag: string, antwoord: string }[]`. Deze tonen toon +
  inhoudelijke lijn; ze worden als voorbeeld-dialoog vóór het echte gesprek gezet.

```ts
export type FewShot = { vraag: string; antwoord: string };
export const FEW_SHOTS: FewShot[] = [
  { vraag: 'Wat eet ik vanavond?', antwoord: 'Je hebt kip in huis en de kinderen eten mee, zei je maandag. Kip met zoete aardappel uit de oven en een grote bak sla: één handpalm kip voor jou, twee vuisten groente, een holle hand aardappel. Twintig minuten, één plaat.' },
  { vraag: 'Ik heb trek', antwoord: 'Even kijken naar vandaag: je zit op twee handpalmen eiwit. Dat is meestal waar de trek vandaan komt. Kwark met kaneel of een handje kip werkt beter dan je ertegen verzetten.' },
  { vraag: 'Hoe ga ik om met een etentje?', antwoord: 'Een etentje hoef je niet goed te maken. Eet ervoor normaal, kies wat je echt lekker vindt, stop als je genoeg hebt. Loggen mag je overslaan — morgen pak je de gewone dag weer op.' },
  { vraag: 'Wat als ik met Laura wil praten?', antwoord: 'Dat kan altijd. Tik op Laura bovenaan — ze krijgt een bericht en leest onze gesprekken van deze week terug.' },
  { vraag: 'Wat vind je van mijn gewicht?', antwoord: 'Laura heeft me gevraagd niet met getallen te beginnen, en ik ben het daarmee eens. Wat ik wel zie: je avonden zijn rustiger dan drie weken terug. Dat gaat vooruit, ook als de weegschaal stilstaat.' },
  { vraag: 'Ik ben moe vandaag', antwoord: 'Dan doen we vandaag niets nieuws. Eén ding: zet je eigen bord klaar voordat de bedtijdronde begint. Loggen mag je vandaag overslaan.' },
];
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/guardrails.ts supabase/functions/_shared/few-shots.ts
git commit -m "feat(ai): guardrails + few-shots uit de handoff voor de prompt-builder"
```

---

### Task 2: Prompt-builder (TDD)

**Files:**

- Create: `supabase/functions/_shared/prompt-builder.ts`, `.../prompt-builder.test.ts`

- [ ] **Step 1: Schrijf de tests eerst** (`prompt-builder.test.ts`, `deno test`):

```ts
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { bouwPrompt } from './prompt-builder.ts';
import type { AIProfile } from '../../../packages/shared/src/types.ts';

const profiel: AIProfile = {
  doelen: ['Duurzaam afvallen'], portiedoelen: { eiwit: 3, groente: 4, koolhydraten: 2, vet: 2 },
  knelpunten: ['Avond na het eten'], voorkeuren: ['Weinig vlees'], beperkingen: ['Noten-allergie'],
  checkinRitme: ["'s ochtends kort"], aanpak: 'Focus op maaltijdstructuur.',
  toon: 'Warm en direct.', vermijdenInCoaching: 'Niet openen met gewicht of getallen.', veiligheidsvlag: 'soms',
};
const basis = {
  profiel,
  berichten: [
    { sender: 'ai' as const, tekst: 'Goedemorgen. Hoe ging de avond?' },
    { sender: 'client' as const, tekst: 'Rustig, thee gezet.' },
  ],
  weekcontext: { portiedoelen: profiel.portiedoelen, gelogd: { eiwit: 2, groente: 3, koolhydraten: 1, vet: 1 } },
  nieuwBericht: 'Wat eet ik vanavond?',
};

Deno.test('system bevat alle guardrails, het bindende vermijden-veld en géén calorieën', () => {
  const { system } = bouwPrompt(basis);
  assertStringIncludes(system, 'Gebruik NOOIT calorieën');
  assertStringIncludes(system, 'vermijden in coaching');
  assertStringIncludes(system, 'Niet openen met gewicht of getallen.');
  assertStringIncludes(system, 'Rode vlaggen');
  assert(!/\bcalorie/i.test(system.replace('Gebruik NOOIT calorieën, grammen of macro\'s.', '')));
});

Deno.test('system bevat het gestructureerde profiel en de weekcontext', () => {
  const { system } = bouwPrompt(basis);
  assertStringIncludes(system, 'Duurzaam afvallen');
  assertStringIncludes(system, 'Noten-allergie');
  assertStringIncludes(system, '3'); // portiedoel eiwit
  assertStringIncludes(system.toLowerCase(), 'deze week'); // weekcontext-kop
});

Deno.test('messages mapt klant→user, ai/coach→assistant en eindigt op het nieuwe bericht', () => {
  const { messages } = bouwPrompt(basis);
  assertEquals(messages[0].role, 'assistant'); // ai-openingsbericht
  assertEquals(messages[1].role, 'user');       // klant
  assertEquals(messages[messages.length - 1].role, 'user');
  assertEquals(messages[messages.length - 1].content, 'Wat eet ik vanavond?');
});

Deno.test('few-shots staan als voorbeelddialoog in de messages of het system', () => {
  const { system, messages } = bouwPrompt(basis);
  const alles = system + JSON.stringify(messages);
  assertStringIncludes(alles, 'Een etentje hoef je niet goed te maken');
});
```

- [ ] **Step 2: Run → FAIL** (`deno test supabase/functions/_shared/prompt-builder.test.ts`).

- [ ] **Step 3: Implementeer `prompt-builder.ts`**

```ts
import type { AIProfile, Porties, Sender } from '../../../packages/shared/src/types.ts';
import { GUARDRAILS } from './guardrails.ts';
import { FEW_SHOTS } from './few-shots.ts';

export type Bericht = { sender: Sender; tekst: string | null };
export type Weekcontext = { portiedoelen: Porties; gelogd: Porties };
export type PromptInput = {
  profiel: AIProfile;
  berichten: Bericht[];       // oud → nieuw, excl. het nieuwe bericht
  weekcontext: Weekcontext;
  nieuwBericht: string;
};
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

const IDENTITEIT = `Je bent Lau, de AI-voedingscoach van "Lau in Balans". Je coacht dagelijks, warm en persoonlijk, in korte berichten. Je meet in handmaten, nooit in getallen. Laura (een mens) stelt jou per klant in en leest mee.`;

function profielBlok(p: AIProfile): string {
  const d = p.portiedoelen;
  return [
    'Profiel van deze klant (door Laura ingesteld):',
    `- Doelen: ${p.doelen.join(', ') || '—'}`,
    `- Portiedoelen per dag: ${d.eiwit}× handpalm eiwit, ${d.groente}× vuist groente, ${d.koolhydraten}× holle hand koolhydraten, ${d.vet}× duim vet`,
    `- Knelpunten: ${p.knelpunten.join(', ') || '—'}`,
    `- Voorkeuren: ${p.voorkeuren.join(', ') || '—'}`,
    `- Beperkingen (belangrijk): ${p.beperkingen.join(', ') || '—'}`,
    `- Check-in-ritme: ${p.checkinRitme.join(', ') || '—'}`,
    `- Aanpak: ${p.aanpak}`,
    `- Toon: ${p.toon}`,
    `- Vermijden in coaching (BINDEND): ${p.vermijdenInCoaching || '—'}`,
    `- Veiligheidsvlag: ${p.veiligheidsvlag}`,
  ].join('\n');
}

function weekBlok(w: Weekcontext): string {
  const g = w.gelogd, t = w.portiedoelen;
  return [
    'Wat opvalt deze week (gelogd vs. doel):',
    `- Eiwit ${g.eiwit}/${t.eiwit}, groente ${g.groente}/${t.groente}, koolhydraten ${g.koolhydraten}/${t.koolhydraten}, vet ${g.vet}/${t.vet}`,
  ].join('\n');
}

export function bouwPrompt(input: PromptInput): { system: string; messages: ChatMessage[] } {
  const system = [
    IDENTITEIT,
    GUARDRAILS,
    profielBlok(input.profiel),
    weekBlok(input.weekcontext),
    'Voorbeelden van jouw toon en lijn (niet letterlijk herhalen, wel de stijl):',
    FEW_SHOTS.map((f) => `Klant: ${f.vraag}\nLau: ${f.antwoord}`).join('\n\n'),
  ].join('\n\n');

  const messages: ChatMessage[] = input.berichten
    .filter((b) => b.tekst)
    .map((b) => ({ role: b.sender === 'client' ? 'user' : 'assistant', content: b.tekst as string }));
  messages.push({ role: 'user', content: input.nieuwBericht });

  // Anthropic vereist dat het gesprek met 'user' begint — druk zo nodig een eerste user-turn erin.
  if (messages[0]?.role === 'assistant') messages.unshift({ role: 'user', content: '(gesprek gaat verder)' });
  return { system, messages };
}
```

- [ ] **Step 4: Run → PASS**. Commit:

```bash
git add supabase/functions/_shared/prompt-builder.ts supabase/functions/_shared/prompt-builder.test.ts
git commit -m "feat(ai): prompt-builder (profiel + guardrails + weekcontext + few-shots), TDD"
```

> Noot voor de test-mapping: het eerste bericht in `basis` is `ai` → `assistant`; de builder
> plakt er dan een dummy user-turn vóór, dus `messages[0].role` wordt in dat geval `user`. Pas de
> eerste assertie hierop aan (of begin de fixture met een klantbericht). De uitvoerder kiest de
> heldere variant en houdt test en code in sync.

---

### Task 3: `lau-reply` Edge Function

**Files:**

- Create: `supabase/functions/lau-reply/index.ts`

- [ ] **Step 1: Schrijf `index.ts`** (Deno; roept Claude aan — lees eerst de `claude-api`-skill):

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { bouwPrompt, type Bericht } from '../_shared/prompt-builder.ts';
import type { AIProfile, Porties } from '../../../packages/shared/src/types.ts';

const LEEG: Porties = { eiwit: 0, groente: 0, koolhydraten: 0, vet: 0 };

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('geen sessie', { status: 401 });
  const url = Deno.env.get('SUPABASE_URL')!;

  // 1. Klant identificeren uit de JWT.
  const alsKlant = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: gebruiker } = await alsKlant.auth.getUser();
  const clientId = gebruiker.user?.id;
  if (!clientId) return new Response('ongeldige sessie', { status: 401 });

  // 2. Context laden met de service role.
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: profielRij } = await db.from('ai_profile_versions').select('profiel')
    .eq('client_id', clientId).order('versie', { ascending: false }).limit(1).maybeSingle();
  if (!profielRij) return new Response('geen profiel', { status: 409 });
  const profiel = profielRij.profiel as AIProfile;

  const { data: rijen } = await db.from('messages').select('sender, tekst')
    .eq('client_id', clientId).order('created_at', { ascending: true }).limit(20);
  const berichten = (rijen ?? []) as Bericht[];
  const nieuwBericht = [...berichten].reverse().find((b) => b.sender === 'client')?.tekst;
  if (!nieuwBericht) return new Response('geen klantbericht', { status: 400 });
  const historie = berichten.slice(0, -1); // alles behalve het laatste (= het nieuwe bericht)

  // weekcontext (dag-aggregaten van deze week)
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const { data: logs } = await db.from('food_logs').select('porties')
    .eq('client_id', clientId).gte('datum', weekStart.toISOString().slice(0, 10));
  const gelogd = (logs ?? []).reduce<Porties>((s, r) => {
    const p = r.porties as Porties;
    return { eiwit: s.eiwit + p.eiwit, groente: s.groente + p.groente, koolhydraten: s.koolhydraten + p.koolhydraten, vet: s.vet + p.vet };
  }, { ...LEEG });

  // 3. Prompt bouwen.
  const { system, messages } = bouwPrompt({ profiel, berichten: historie, weekcontext: { portiedoelen: profiel.portiedoelen, gelogd }, nieuwBericht });

  // 4. Claude aanroepen.
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const antwoord = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system,
    messages,
  });
  let tekst = 'Ik ben er zo weer — probeer het zo nog eens.';
  if (antwoord.stop_reason !== 'refusal') {
    const blok = antwoord.content.find((b) => b.type === 'text');
    if (blok && blok.type === 'text') tekst = blok.text;
  }

  // 5. AI-bericht wegschrijven → app krijgt het via realtime.
  await db.from('messages').insert({ client_id: clientId, sender: 'ai', tekst });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
```

- [ ] **Step 2: Typecheck** `deno check supabase/functions/lau-reply/index.ts` (verwacht: schoon,
  of alleen bekende npm-typing-hints). Draai NIET `supabase functions serve` (Docker) of deploy.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/lau-reply/index.ts
git commit -m "feat(ai): lau-reply Edge Function — auth, context, prompt, Claude, insert"
```

> **Deploy-bundel-caveat:** de relatieve import naar `../../../packages/shared/src/types.ts` en
> `../_shared/*` moet meebundelen bij `supabase functions deploy`. Werkt dat niet (Supabase
> bundelt vanuit `supabase/functions/`), kopieer dan de handvol gebruikte types naar
> `supabase/functions/_shared/types.ts` en importeer die. Testen op prompt-niveau blijft
> ongewijzigd. Dit valt te verifiëren zodra Jeffrey deployt.

---

### Task 4: Guardrail-evals (fase A: prompt-niveau)

**Files:**

- Create: `scripts/guardrail-evals.mjs`

- [ ] **Step 1: Schrijf het evals-script.** Fase A (nu, geen key): voor ~8 lastige inputs bouwt het
  de prompt (via een Node-import van de builder-logica — of een geënterde kopie) en assert dat de
  juiste guardrail-tekst aanwezig is en dat er geen calorieën/getallen in de system-prefix staan.
  Fase B (met key, na deploy): een `--live`-vlag die echte calls doet en de antwoorden toetst.
  Documenteer de 8 inputs (gewichtsvraag, "hoeveel calorieën", rode vlag/"ik eet al dagen niets",
  zwangerschap, medicatie, "ik voel me rot", etentje, gewone maaltijdvraag) + de verwachte
  guardrail per input. Draai fase A en toon groen.

- [ ] **Step 2: Commit**

```bash
git add scripts/guardrail-evals.mjs
git commit -m "test(ai): guardrail-evals fase A (prompt-niveau, zonder API-key)"
```

---

### Task 5: App-koppeling (chat + log → lau-reply)

**Files:**

- Modify: `apps/mobile/src/lib/hooks/useBerichten.ts`, `apps/mobile/src/components/LogSheet.tsx`,
  `apps/mobile/src/app/(tabs)/chat.tsx` (typing-indicator)

- [ ] **Step 1: `useBerichten.verstuur`** — roept na de insert de functie aan:

```ts
const verstuur = useCallback(async (tekst: string) => {
  await supabase.from('messages').insert({ client_id: clientId, sender: 'client', tekst });
  supabase.functions.invoke('lau-reply').catch(() => {}); // fire-and-forget; antwoord komt via realtime
}, [clientId]);
```
Voeg een `bezig`/typing-signaal toe zodat de chat de typing-indicator toont tot het `ai`-bericht
binnenkomt (via de realtime-INSERT). Idem: `LogSheet.bewaar` roept na de log+message-insert
`supabase.functions.invoke('lau-reply')` aan (vervangt de `// fase 3`-markering).

- [ ] **Step 2: Typing-indicator** in `chat.tsx`: toon de indicator vanaf het versturen tot er een
  nieuw `ai`-bericht binnenkomt (of een korte timeout). Bouw 'm zoals de handoff (§ 2, drie
  `lauDot`-bolletjes).

- [ ] **Step 3: Verifieer** `npm run typecheck -w apps/mobile` + `npx expo export`. Commit:

```bash
git add "apps/mobile/src"
git commit -m "feat(mobile): chat roept lau-reply aan + typing-indicator (fase 3)"
```

---

### Task 6: (Vereist Jeffrey) deploy, secret, live-verificatie

Niet door Claude alleen te doen — dit heeft Jeffrey's cloud/token + de API-key nodig:

- [ ] `supabase secrets set ANTHROPIC_API_KEY=<key>` (Jeffrey).
- [ ] `supabase functions deploy lau-reply` (Jeffrey).
- [ ] Daarna Claude: guardrail-evals fase B (`node scripts/guardrail-evals.mjs --live`) + de
  live-integratietest (klantbericht in de app → typing → Lau-antwoord via realtime), en de
  bundel-caveat uit Task 3 bevestigen/oplossen.

**Definition of done fase 3 (code-deel):** prompt-builder + tests groen (`deno test`), de functie
typechckt (`deno check`), guardrail-evals fase A groen, de app roept `lau-reply` aan met een
typing-indicator, en `npm run verify` blijft groen. Live antwoorden + fase-B-evals volgen zodra
Jeffrey de key zet en deployt.
