'use client';

import { Knop } from '@/components/Knop';
import type { OpenFlag } from '@/lib/hooks/useKlantContext';
import { relatieveTijd } from '@/lib/tijd';

/*
 * Clay = coach-aandacht. Dit is het enige blok in de zijbalk dat mág opvallen: een
 * open flag betekent dat een klant expliciet om Laura vroeg en op een mens wacht.
 */
export function FlagKaart({
  flag,
  nu,
  bezig,
  opAfronden,
}: {
  flag: OpenFlag;
  /** Peilmoment voor de relatieve tijd — één tik voor de hele pagina. */
  nu: Date;
  bezig: boolean;
  opAfronden: (flagId: string) => void;
}) {
  const tekst = flag.tekst?.trim();

  return (
    <article className="rounded-card border border-clay-border bg-clay-soft p-4">
      <p className="text-sm leading-relaxed text-clay-ink">
        {tekst || <span className="italic">Zonder toelichting</span>}
      </p>

      {flag.redenen.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {flag.redenen.map((reden) => (
            <li
              key={reden}
              className="rounded-full border border-clay-border bg-surface px-2.5 py-0.5 text-xs text-clay-ink"
            >
              {reden}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <time
          dateTime={flag.created_at}
          title={volledigeTijd(flag.created_at)}
          className="text-xs text-clay-ink"
        >
          {relatieveTijd(flag.created_at, nu)}
        </time>
        <Knop variant="secundair" onClick={() => opAfronden(flag.id)} disabled={bezig}>
          {bezig ? 'Bezig…' : 'Afronden'}
        </Knop>
      </div>
    </article>
  );
}

/** Het exacte tijdstip als tooltip — de relatieve tijd blijft kort (zie ChatBubbel). */
function volledigeTijd(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
}
