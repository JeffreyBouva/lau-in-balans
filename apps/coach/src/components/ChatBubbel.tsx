'use client';

import type { Sender } from '@lau/shared';
import type { ChatBericht } from '@/lib/hooks/useKlantChat';
import { relatieveTijd } from '@/lib/tijd';

/*
 * Kleurregel in de chat: de klant staat rechts in sage, alles van de coachkant links.
 * Lau (ai) is wit-met-rand, Laura (coach) clay — Laura's eigen antwoorden zijn zo in
 * één oogopslag te onderscheiden van die van Lau, precies zoals de klant ze in de app
 * ziet (apps/mobile/src/components/Bericht.tsx).
 */
const varianten: Record<Sender, { uitlijning: string; bubbel: string }> = {
  client: {
    uitlijning: 'items-end',
    bubbel: 'rounded-card rounded-br-md bg-sage-soft text-sage-ink',
  },
  ai: {
    uitlijning: 'items-start',
    bubbel: 'rounded-card rounded-bl-md border border-hairline-soft bg-surface text-ink',
  },
  coach: {
    uitlijning: 'items-start',
    bubbel: 'rounded-card rounded-bl-md border border-clay-border bg-laura-bubble text-laura-bubble-ink',
  },
};

export function ChatBubbel({ bericht, nu }: { bericht: ChatBericht; nu: Date }) {
  const variant = varianten[bericht.sender];
  // Voedingslogs hebben geen tekst (check-constraint op messages): geen bubbel maar een
  // pill — Laura ziet dát er gelogd is; de cijfers staan in de voedingsweek (taak 4).
  const isLog = bericht.food_log_id !== null && !bericht.tekst?.trim();

  return (
    <div className={`flex flex-col gap-1 ${variant.uitlijning}`}>
      {bericht.sender === 'coach' && (
        <span className="px-1 text-xs font-medium text-clay-ink">Laura</span>
      )}

      {isLog ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-soft bg-neutral-soft px-3 py-1 text-xs text-body">
          <span aria-hidden="true">📋</span> voedingslog
        </span>
      ) : (
        <p
          className={`max-w-[85%] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${variant.bubbel}`}
        >
          {bericht.tekst}
        </p>
      )}

      <time
        dateTime={bericht.created_at}
        title={volledigeTijd(bericht.created_at)}
        className="px-1 text-xs text-body"
      >
        {relatieveTijd(bericht.created_at, nu)}
      </time>
    </div>
  );
}

/** Het exacte tijdstip als tooltip — de relatieve tijd eronder blijft kort. */
function volledigeTijd(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
}
