'use client';

import { useState, type FormEvent } from 'react';
import { Knop } from '@/components/Knop';
import type { Notitie } from '@/lib/hooks/useKlantContext';

const veld =
  'w-full resize-y rounded-input border border-hairline bg-surface px-3 py-2 text-sm ' +
  'text-ink placeholder:text-muted focus:border-sage focus:outline-2 focus:outline-offset-0 ' +
  'focus:outline-sage/40';

/*
 * Laura's eigen aantekeningen bij een klant — coach-only (RLS), de klant ziet ze nooit.
 * Bewust sober: dit is een kladblok naast het gesprek, geen tweede chat.
 */
export function Notities({
  notities,
  opOpslaan,
  bezig,
  fout,
}: {
  notities: Notitie[];
  /** true = opgeslagen; alleen dán maakt het formulier de textarea leeg. */
  opOpslaan: (tekst: string) => Promise<boolean>;
  bezig: boolean;
  fout: string | null;
}) {
  const [concept, setConcept] = useState('');
  const nu = new Date();

  async function opslaan(e: FormEvent) {
    e.preventDefault();
    const tekst = concept.trim();
    if (!tekst || bezig) return;
    const gelukt = await opOpslaan(tekst);
    // Alleen leegmaken als de notitie echt staat — anders is Laura haar tekst kwijt.
    if (gelukt) setConcept('');
  }

  return (
    <section aria-labelledby="notities-kop" className="rounded-card border border-hairline bg-surface p-4">
      <h2 id="notities-kop" className="text-xs tracking-[0.12em] text-body uppercase">
        Notities
      </h2>

      {notities.length === 0 ? (
        <p className="mt-3 text-sm text-body">Nog geen notities.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {notities.map((notitie) => (
            <li key={notitie.id} className="flex flex-col gap-1">
              <time dateTime={notitie.datum} className="text-xs text-body">
                {korteDatum(notitie.datum, nu)}
              </time>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{notitie.tekst}</p>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={opslaan} className="mt-4 border-t border-hairline-soft pt-3">
        <label htmlFor="notitie" className="sr-only">
          Nieuwe notitie
        </label>
        <textarea
          id="notitie"
          rows={3}
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Notitie toevoegen…"
          className={veld}
        />
        <div className="mt-2 flex justify-end">
          <Knop type="submit" variant="secundair" disabled={concept.trim() === '' || bezig}>
            {bezig ? 'Opslaan…' : 'Notitie opslaan'}
          </Knop>
        </div>
        {fout && (
          <p role="alert" className="mt-2 text-sm text-clay-ink">
            {fout}
          </p>
        )}
      </form>
    </section>
  );
}

/** "12 jul", met jaar zodra het afwijkt — anders ruis op elke regel (zie tijd.ts). */
function korteDatum(isoDatum: string, nu: Date): string {
  // Lokale middernacht: `new Date('2026-08-02')` zou UTC pakken en een dag verspringen.
  const d = new Date(`${isoDatum}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDatum;
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === nu.getFullYear() ? {} : { year: 'numeric' }),
  });
}
