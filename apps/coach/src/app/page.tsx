'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Sender } from '@lau/shared';
import { vandaagISO, weekNummer } from '@lau/shared';
import { Knop } from '@/components/Knop';
import { useCoach } from '@/lib/coach';
import { useKlanten, type KlantRij } from '@/lib/hooks/useKlanten';
import { initialen } from '@/lib/naam';
import { korteDagDatum } from '@/lib/tijd';

const FILTERS = ['Wacht op jou', 'Alle', 'Loopt goed'] as const;
type Filter = (typeof FILTERS)[number];

/** Kop en rijen delen één raster (§7) — anders schuiven de kolommen uit elkaar. */
const RASTER = 'grid grid-cols-[2fr_1.1fr_2.2fr_1fr_1fr] items-center gap-[18px]';

const KOLOMMEN = ['Klant', 'Status', 'Laatste in de chat', 'Eten gelogd', 'Gesprek'];

/**
 * Filtergedrag komt uit §7: "Wacht op jou" toont ook de stille klanten (die vragen
 * niets, maar hebben Laura juist wél nodig), en "Loopt goed" toont alles behalve de
 * klanten met een open flag — een stille klant hoort dus in beide lijsten.
 */
function past(klant: KlantRij, filter: Filter): boolean {
  if (filter === 'Alle') return true;
  if (filter === 'Wacht op jou') return klant.wachtOpJou || klant.status === 'stil';
  return !klant.wachtOpJou;
}

export default function KlantenPagina() {
  const { coach } = useCoach();
  const { klanten, laden, fout, bezig, herlaad } = useKlanten();
  // Eén peilmoment voor de hele lijst: alle weeknummers rekenen vanaf dezelfde tik.
  const vandaag = vandaagISO();

  // null = Laura koos nog niets, dan kiest de data. Zodra ze zelf een pil aantikt blijft
  // die staan, ook als hij leeg is — een filter dat onder je handen terugspringt is erger
  // dan een lege lijst.
  const [gekozen, setGekozen] = useState<Filter | null>(null);
  const heeftWachtrij = klanten.some((k) => past(k, 'Wacht op jou'));
  const filter: Filter = gekozen ?? (heeftWachtrij ? 'Wacht op jou' : 'Alle');
  const zichtbaar = klanten.filter((k) => past(k, filter));

  const wachtenden = klanten.filter((k) => k.wachtOpJou).length;
  // "Actief" = lopend traject, dus alles behalve gestopt. Niet `status === 'actief'`:
  // een nieuwe of stille klant is niet uit dienst, en de kop telt Laura's werkvoorraad.
  const actief = klanten.filter((k) => k.status !== 'gestopt').length;

  return (
    <main className="px-10 pt-8 pb-10">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-serif text-[28px] tracking-[-0.01em] text-ink">Jouw klanten</h1>
            {/* Teller en pillen hangen aan de dáta, niet aan `laden`: een mislukte
                achtergrond-refresh laat de lijst staan, dus ook zijn kop.
                De teller staat op cream, waar body-soft 4,49:1 haalt — net te weinig; in
                de tabel eronder (wit) blijft body-soft wél staan. */}
            {klanten.length > 0 && (
              <p className="text-sm text-body">
                {actief} actief · {wachtenden} {wachtenden === 1 ? 'wacht' : 'wachten'} op jou
              </p>
            )}
          </div>

          {klanten.length > 0 && (
            <div className="flex gap-2">
              {FILTERS.map((f) => (
                <Filterpil key={f} label={f} actief={f === filter} kies={() => setGekozen(f)} />
              ))}
            </div>
          )}
        </div>

        {fout && (
          <div role="alert" className="rounded-card border border-clay-border bg-clay-soft p-5">
            <p className="text-sm text-clay-ink">{fout}</p>
            <Knop variant="secundair" onClick={herlaad} disabled={bezig} className="mt-3">
              {bezig ? 'Bezig…' : 'Opnieuw proberen'}
            </Knop>
          </div>
        )}

        {laden && <Skelet />}

        {!laden && !fout && klanten.length === 0 && (
          <p className="rounded-card border border-dashed border-hairline px-6 py-12 text-center text-sm text-body">
            Nog geen klanten.
          </p>
        )}

        {klanten.length > 0 && (
          <div className="overflow-hidden rounded-card border border-hairline-soft bg-surface">
            {/* Ontwerp zet de tabelkop in #A3A59A (2,5:1 op wit); body-soft is de zachtste
                tint die AA haalt (4,97:1). De kop blijft zachter dan de rijen door 11px,
                hoofdletters en tracking, niet meer door kleur alleen. */}
            <div
              className={`${RASTER} border-b border-table-head px-6 py-3.5 text-[11px] tracking-[0.12em] text-body-soft uppercase`}
            >
              {KOLOMMEN.map((kolom) => (
                <div key={kolom}>{kolom}</div>
              ))}
            </div>

            {zichtbaar.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-body-soft">
                Geen klanten in dit filter.{' '}
                <button
                  type="button"
                  onClick={() => setGekozen('Alle')}
                  className="rounded-full text-sage-deep underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
                >
                  Toon alle klanten
                </button>
              </p>
            ) : (
              <ul>
                {zichtbaar.map((klant) => (
                  <li key={klant.id}>
                    <Klantrij
                      klant={klant}
                      coachNaam={coach?.naam ?? 'Laura'}
                      vandaag={vandaag}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Op cream haalt body-soft net geen AA (4,49:1), dus staat deze voetnoot in body
            (5,63:1) — de enige tekst op deze pagina die niet op wit ligt. */}
        <p className="text-[13px] text-body">
          Klik een klant om mee te lezen, te reageren en het AI-profiel bij te stellen.
        </p>
      </div>
    </main>
  );
}

/** Filterpil zoals §7: sage-gevuld wanneer actief, anders wit met hairline-rand. */
function Filterpil({
  label,
  actief,
  kies,
}: {
  label: Filter;
  actief: boolean;
  kies: () => void;
}) {
  return (
    <button
      type="button"
      onClick={kies}
      aria-pressed={actief}
      className={`rounded-full border px-[15px] py-[9px] text-[12.5px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ${
        actief
          ? // Het ontwerp vult de actieve pil met sage, maar wit daarop is 4,39:1. Sage-deep
            // is dezelfde vulling een stap donkerder (6,28:1) — en de vulling die `Knop`
            // met variant `primair` al gebruikt.
            'border-sage-deep bg-sage-deep text-white'
          : 'border-hairline bg-surface text-body hover:border-hairline-hover'
      }`}
    >
      {label}
    </button>
  );
}

function Klantrij({
  klant,
  coachNaam,
  vandaag,
}: {
  klant: KlantRij;
  coachNaam: string;
  vandaag: string;
}) {
  const status = statuspil(klant);
  return (
    <Link
      href={`/klant/${klant.id}`}
      className={`${RASTER} border-b border-table-row px-6 py-4 transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sage ${
        // Linkerrand als inset-shadow (§Shadows): een echte border zou het raster
        // 3px verschuiven t.o.v. de rijen eronder.
        klant.wachtOpJou ? 'shadow-[inset_3px_0_0_var(--color-clay)]' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex size-9 flex-none items-center justify-center rounded-full text-[13px] ${
            klant.wachtOpJou ? 'bg-clay-soft text-clay-ink' : 'bg-neutral-soft text-body'
          }`}
        >
          {initialen(klant.naam)}
        </span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate text-[15px] text-ink">{klant.naam}</span>
          <span className="text-xs text-body-soft">
            week {weekNummer(klant.startdatum, vandaag)}
          </span>
        </span>
      </div>

      <div>
        <span className={`rounded-full px-[13px] py-1.5 text-xs ${status.klasse}`}>
          {status.label}
        </span>
      </div>

      <div className="min-w-0 truncate text-sm leading-[1.5] text-body-soft">
        {laatsteRegel(klant, coachNaam)}
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-soft"
        >
          <span
            className={`block h-full rounded-full ${
              // ≥ 4 van 7 dagen = het gaat goed (sage); daaronder juist neutraal grijs,
              // want een half-lege balk in het groen leest als een compliment.
              klant.logsDagen >= 4 ? 'bg-sage' : 'bg-hairline-hover'
            }`}
            style={{ width: `${Math.round((klant.logsDagen / 7) * 100)}%` }}
          />
        </span>
        <span aria-hidden="true" className="text-xs text-body-soft">
          {klant.logsDagen}/7
        </span>
        <span className="sr-only">{klant.logsDagen} van 7 dagen gelogd</span>
      </div>

      <div className="text-[13px] text-body">
        {klant.laatsteGesprek ? (
          <time dateTime={klant.laatsteGesprek}>{korteDagDatum(klant.laatsteGesprek)}</time>
        ) : (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Nog geen gesprek</span>
          </>
        )}
      </div>
    </Link>
  );
}

/**
 * De vier statussen uit §7. "Wacht op jou" overschrijft de traject-status: een open
 * flag is het enige dat Laura vandaag moet zien.
 */
function statuspil(klant: KlantRij): { label: string; klasse: string } {
  if (klant.wachtOpJou) return { label: 'Wacht op jou', klasse: 'bg-clay-soft text-clay-ink' };
  switch (klant.status) {
    case 'actief':
      return { label: 'Actief', klasse: 'bg-sage-soft text-sage-deep' };
    // De neutrale vlakken zijn te licht voor body-soft (4,18–4,29:1); body is hier het
    // zachtste dat AA haalt (5,24 resp. 5,38:1) — net als bij de sage- en clay-pillen,
    // waar het ontwerp zelf al de donkere ink-variant op het zachte vlak zet.
    case 'nieuw':
      return { label: 'Nieuw', klasse: 'bg-neutral-soft text-body' };
    case 'stil':
      return { label: 'Stil', klasse: 'bg-neutral-softer text-body' };
    case 'gestopt':
      // Niet in §7 getekend (het ontwerp kent alleen de vier hierboven); de neutrale
      // vorm van "Nieuw" is de rustigste plek voor een afgesloten traject.
      return { label: 'Gestopt', klasse: 'bg-neutral-soft text-body' };
  }
}

/**
 * De chatkolom zoals §7 hem toont: wat de klant zelf zei staat tussen aanhalingstekens,
 * wat Lau of Laura zei krijgt hun naam ervoor. Zo is in één regel te zien of het laatste
 * woord bij de klant lag.
 */
function laatsteRegel(klant: KlantRij, coachNaam: string): string {
  const bericht = klant.laatsteBericht;
  if (!bericht) return 'Nog geen berichten';
  const tekst = bericht.tekst?.trim();
  // Voedingslogs hebben geen tekst — toon waar het bericht over ging i.p.v. niets.
  if (bericht.food_log_id && !tekst) return 'Voedingslog toegevoegd.';
  if (!tekst) return '—';
  const spreker = afzender(bericht.sender, coachNaam);
  return spreker ? `${spreker}: “${tekst}”` : `“${tekst}”`;
}

/** null = de klant zelf; die krijgt geen naam voor haar regel (§7-demo). */
function afzender(sender: Sender, coachNaam: string): string | null {
  if (sender === 'ai') return 'Lau';
  if (sender === 'coach') return coachNaam;
  return null;
}

function Skelet() {
  return (
    <div
      className="overflow-hidden rounded-card border border-hairline-soft bg-surface"
      aria-busy="true"
    >
      <span className="sr-only">Klanten laden…</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-center gap-3 border-b border-table-row px-6 py-4"
        >
          <span className="size-9 flex-none animate-pulse rounded-full bg-neutral-soft" />
          <span className="h-3 w-40 animate-pulse rounded-full bg-neutral-soft" />
        </div>
      ))}
    </div>
  );
}
