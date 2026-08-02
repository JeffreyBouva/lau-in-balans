'use client';

import { useState, type FormEvent } from 'react';
import { naarISODatum } from '@lau/shared';
import type { Notitie } from '@/lib/hooks/useKlantContext';

/*
 * Laura's eigen aantekeningen bij een klant — coach-only (RLS), de klant ziet ze nooit.
 * Vorm uit §8 (kolom 3): elke notitie een eigen witte kaart met alleen een datum en de
 * tekst, nieuwste boven. Bewust sober: dit is een kladblok naast het gesprek, geen
 * tweede chat.
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
    <section aria-labelledby="notities-kop" className="flex flex-col gap-3.5">
      <h2 id="notities-kop" className="sr-only">
        Notities
      </h2>

      {notities.length === 0 ? (
        <p className="text-[12.5px] text-muted">Nog geen notities.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {notities.map((notitie) => (
            <li
              key={notitie.id}
              className="flex flex-col gap-[7px] rounded-input border border-hairline-soft bg-surface px-4 py-3.5"
            >
              {/* contrast-opvolgpunt: #A3A59A op wit ≈ 2,5:1 bij 11px — ontwerpwaarde. */}
              <time dateTime={notitie.datum} className="text-[11px] text-muted-softer">
                {korteDatum(notitie.datum, nu)}
              </time>
              <p className="text-[13.5px] leading-[1.6] whitespace-pre-wrap text-body">
                {notitie.tekst}
              </p>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={opslaan} className="flex flex-col gap-2.5">
        <label htmlFor="notitie" className="sr-only">
          Nieuwe notitie
        </label>
        <textarea
          id="notitie"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Notitie toevoegen…"
          className="min-h-[70px] w-full resize-y rounded-input border border-hairline-soft bg-surface px-3.5 py-3 text-[13.5px] leading-[1.55] text-ink placeholder:text-muted focus:border-sage focus:outline-2 focus:outline-offset-0 focus:outline-sage/40"
        />
        <button
          type="submit"
          disabled={concept.trim() === '' || bezig}
          className="rounded-full border border-hairline bg-surface px-4 py-3 text-[13px] text-body transition-colors duration-150 hover:border-sage hover:text-sage-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-hairline disabled:hover:text-body"
        >
          {bezig ? 'Bewaren…' : 'Bewaren'}
        </button>
        {fout && (
          <p role="alert" className="text-[12.5px] text-clay-ink">
            {fout}
          </p>
        )}
      </form>
    </section>
  );
}

/** "12 jul", met jaar zodra het afwijkt — anders ruis op elke kaart (zie tijd.ts). */
function korteDatum(isoDatum: string, nu: Date): string {
  // Lokale middernacht: `new Date('2026-08-02')` zou UTC pakken en een dag verspringen.
  const d = new Date(`${isoDatum}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDatum;
  const label = d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === nu.getFullYear() ? {} : { year: 'numeric' }),
  });
  // §8 zet er "· vandaag" achter bij een verse notitie — dat is precies het moment
  // waarop Laura wil zien dát haar tekst geland is.
  return isoDatum === naarISODatum(nu) ? `${label} · vandaag` : label;
}
