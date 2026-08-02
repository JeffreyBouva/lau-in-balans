'use client';

import { HANDMATEN, type Porties } from '@lau/shared';
import type { ChatBericht } from '@/lib/hooks/useKlantChat';
import type { LogDetail } from '@/lib/hooks/useLogPorties';

/*
 * De compacte transcript-bubbels van het coach-dashboard (handoff §8, kolom 1) —
 * kleinere maten dan de klant-app, want Laura leest hier een hele week in één kolom.
 *
 * Uitlijning wijkt bewust af van de klant-app: daar staat Laura links (zij is "de
 * andere kant"), hier staat ze RECHTS bij de klant-bubbels — het transcript leest als
 * "wat er vanuit ons naar deze klant ging". De kleuren blijven gelijk aan de app
 * (guardrail 6: een bericht van Laura is altijd #FBEFE8, nooit te verwarren met Lau).
 */
const varianten = {
  ai: {
    rij: 'justify-start',
    bubbel:
      'max-w-[88%] rounded-[14px_14px_14px_4px] border border-table-head bg-surface text-body',
  },
  client: {
    rij: 'justify-end',
    bubbel: 'max-w-[84%] rounded-[14px_14px_4px_14px] bg-sage-soft text-sage-ink',
  },
  coach: {
    rij: 'justify-end',
    bubbel:
      'max-w-[88%] rounded-[14px_14px_4px_14px] border border-clay-border bg-laura-bubble text-laura-bubble-ink',
  },
} as const;

export function ChatBubbel({
  bericht,
  log,
  klantNaam,
  coachNaam,
}: {
  bericht: ChatBericht;
  /** Porties bij een log-bericht; ontbreekt zolang de losse fetch nog loopt. */
  log?: LogDetail;
  /** Alleen voor de onzichtbare sprekerlabels — het ontwerp leunt op kleur en kant. */
  klantNaam: string;
  coachNaam: string;
}) {
  // Voedingslogs hebben geen tekst (check-constraint op messages): een eigen bubbel met
  // het moment als eyebrow en de porties als één regel.
  const isLog = bericht.food_log_id !== null && !bericht.tekst?.trim();

  if (isLog) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[88%] flex-col gap-[7px] rounded-[14px_14px_4px_14px] bg-sage-soft px-3.5 py-3">
          <span className="text-[10.5px] tracking-[0.1em] text-sage-mid uppercase">
            {log?.moment ?? 'Voedingslog'}
          </span>
          <p className="text-[12.5px] leading-[1.5] text-sage-ink">
            <span className="sr-only">{klantNaam} logde: </span>
            {log ? portieRegel(log.porties) : 'Voedingslog toegevoegd.'}
          </p>
        </div>
      </div>
    );
  }

  const variant = varianten[bericht.sender];
  const spreker = bericht.sender === 'ai' ? 'Lau' : bericht.sender === 'coach' ? coachNaam : klantNaam;

  return (
    <div className={`flex ${variant.rij}`}>
      <p
        className={`px-3.5 py-[11px] text-[13px] leading-[1.55] whitespace-pre-wrap ${variant.bubbel}`}
      >
        {/* Kleur en kant vertellen wie er spreekt; voor wie dat niet ziet staat het er. */}
        <span className="sr-only">{spreker}, {volledigeTijd(bericht.created_at)}: </span>
        {bericht.tekst}
      </p>
    </div>
  );
}

/** "1 × handpalm eiwit · 2 × vuist groente" — alleen wat er echt gelogd is (§8). */
function portieRegel(porties: Porties): string {
  const delen = HANDMATEN.flatMap((h) => {
    // `porties` komt uit jsonb: het type zegt niets over wat er echt staat.
    const n = Number(porties?.[h.key]);
    if (!Number.isFinite(n) || n <= 0) return [];
    return [`${n} × ${h.hand.toLowerCase()} ${h.naam.toLowerCase()}`];
  });
  return delen.length > 0 ? delen.join(' · ') : 'Geen porties ingevuld.';
}

/** Het exacte tijdstip staat in het sprekerlabel — het ontwerp toont geen tijden. */
function volledigeTijd(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
}
