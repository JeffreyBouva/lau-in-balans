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

Deno.test('messages mapt klant→user, ai/coach→assistant, begint op user (Anthropic) en eindigt op het nieuwe bericht', () => {
  const { messages } = bouwPrompt(basis);
  // Anthropic vereist dat het gesprek met 'user' begint. De eerste bericht is een ai-opener,
  // dus de builder plakt er een dummy user-turn vóór. Deze asserties toetsen zowel de mapping
  // (ai→assistant, client→user) als die dummy-turn-garantie.
  assertEquals(messages[0].role, 'user');       // dummy user-turn (Anthropic-vereiste)
  assertEquals(messages[1].role, 'assistant');  // ai-openingsbericht → assistant
  assertEquals(messages[2].role, 'user');       // klant → user
  assertEquals(messages[messages.length - 1].role, 'user');
  assertEquals(messages[messages.length - 1].content, 'Wat eet ik vanavond?');
});

Deno.test('few-shots staan als voorbeelddialoog in de messages of het system', () => {
  const { system, messages } = bouwPrompt(basis);
  const alles = system + JSON.stringify(messages);
  assertStringIncludes(alles, 'Een etentje hoef je niet goed te maken');
});
