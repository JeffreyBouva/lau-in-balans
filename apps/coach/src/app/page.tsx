'use client';

import Link from 'next/link';
import type { Sender } from '@lau/shared';
import { vandaagISO, weekNummer } from '@lau/shared';
import { Knop } from '@/components/Knop';
import { StatusChip } from '@/components/StatusChip';
import { useCoach } from '@/lib/coach';
import { useKlanten, type KlantRij } from '@/lib/hooks/useKlanten';
import { relatieveTijd } from '@/lib/tijd';

export default function KlantenPagina() {
  const { coach } = useCoach();
  const { klanten, laden, fout, bezig, herlaad } = useKlanten();
  // Eén peilmoment voor de hele lijst: alle weken en tijden rekenen vanaf dezelfde tik.
  const vandaag = vandaagISO();
  const nu = new Date();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="font-serif text-3xl text-ink">Klanten</h1>
      {!laden && !fout && klanten.length > 0 && (
        <p className="mt-1 text-sm text-body">
          {klanten.length} {klanten.length === 1 ? 'klant' : 'klanten'}
        </p>
      )}

      {fout && (
        <div role="alert" className="mt-6 rounded-card border border-clay-border bg-clay-soft p-5">
          <p className="text-sm text-clay-ink">{fout}</p>
          <Knop variant="secundair" onClick={herlaad} disabled={bezig} className="mt-3">
            {bezig ? 'Bezig…' : 'Opnieuw proberen'}
          </Knop>
        </div>
      )}

      {laden && <Skelet />}

      {!laden && !fout && klanten.length === 0 && (
        <p className="mt-6 rounded-card border border-dashed border-hairline px-6 py-12 text-center text-sm text-body">
          Nog geen klanten.
        </p>
      )}

      {klanten.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {klanten.map((klant) => (
            <li key={klant.id}>
              <KlantRegel klant={klant} coachNaam={coach?.naam ?? 'Laura'} vandaag={vandaag} nu={nu} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function KlantRegel({
  klant,
  coachNaam,
  vandaag,
  nu,
}: {
  klant: KlantRij;
  coachNaam: string;
  vandaag: string;
  nu: Date;
}) {
  const bericht = klant.laatsteBericht;
  return (
    <Link
      href={`/klant/${klant.id}`}
      className="flex items-center gap-4 rounded-card border border-hairline bg-surface px-5 py-4 transition-colors hover:border-hairline-hover hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-serif text-lg leading-tight text-ink">{klant.naam}</span>
          <StatusChip status={klant.status} />
          <span className="text-xs text-body">Week {weekNummer(klant.startdatum, vandaag)}</span>
        </div>

        <p className="mt-1.5 flex items-baseline gap-1.5 text-sm">
          {bericht ? (
            <>
              <span className="shrink-0 text-body">
                {afzender(bericht.sender, klant.naam, coachNaam)}:
              </span>
              <span className="truncate text-body">{samenvatting(bericht)}</span>
              <span className="shrink-0 text-xs text-body">
                · {relatieveTijd(bericht.created_at, nu)}
              </span>
            </>
          ) : (
            <span className="text-body">Nog geen berichten</span>
          )}
        </p>
      </div>

      {klant.openFlags > 0 && (
        <span className="shrink-0 rounded-full bg-clay px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
          <span aria-hidden="true">{klant.openFlags}</span>
          <span className="sr-only">
            {klant.openFlags} open {klant.openFlags === 1 ? 'flag' : 'flags'}
          </span>
        </span>
      )}
    </Link>
  );
}

/** Wie stuurde het laatste bericht: Lau (AI), de coach zelf, of de klant (voornaam). */
function afzender(sender: Sender, klantnaam: string, coachNaam: string): string {
  if (sender === 'ai') return 'Lau';
  if (sender === 'coach') return coachNaam;
  return klantnaam.split(' ')[0];
}

/** Voedingslogs hebben geen tekst — toon waar het bericht over ging i.p.v. niets. */
function samenvatting(bericht: { tekst: string | null; food_log_id: string | null }): string {
  if (bericht.food_log_id && !bericht.tekst?.trim()) return '📋 voedingslog';
  return bericht.tekst?.trim() || '—';
}

function Skelet() {
  return (
    <div className="mt-6 flex flex-col gap-2.5" aria-busy="true">
      <span className="sr-only">Klanten laden…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-[78px] animate-pulse rounded-card border border-hairline bg-surface"
        />
      ))}
    </div>
  );
}
