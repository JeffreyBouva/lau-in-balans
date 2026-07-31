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
