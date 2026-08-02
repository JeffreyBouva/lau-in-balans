'use client';

import type { HandmaatGemiddelde, Voedingsdag } from '@/lib/hooks/useKlantContext';

const DAGLETTERS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'] as const;
/** Zichtbare stomp voor een dag zonder log: een kolom van 0px leest als "kapot". */
const LEEG_PERCENTAGE = 6;

/*
 * Compacte weekkaart voor de zijbalk. Sage = klant & voortgang, dus de staafjes zijn
 * sage; een dag zonder log blijft neutraal-grijs — niet clay, want niet loggen is geen
 * alarm. Het gemiddelde staat naast het doel uit het PROFIEL (niet het statische
 * dagdoel uit HANDMATEN): Laura heeft dat per klant kunnen bijstellen.
 */
export function VoedingsWeek({
  dagen,
  gemiddelden,
  dagenMetLog,
}: {
  dagen: Voedingsdag[];
  gemiddelden: HandmaatGemiddelde[];
  dagenMetLog: number;
}) {
  // Schaal op de drukste dag: bij een rustige week zijn de verschillen zo nog leesbaar.
  const hoogste = Math.max(1, ...dagen.map((d) => d.totaal));

  return (
    <section aria-labelledby="voedingsweek-kop" className="rounded-card border border-hairline bg-surface p-4">
      <h2 id="voedingsweek-kop" className="text-xs tracking-[0.12em] text-body uppercase">
        Voedingsweek
      </h2>
      <p className="mt-1 text-xs text-body">
        {dagenMetLog} van {dagen.length} dagen gelogd
      </p>

      <ul className="mt-3 flex items-end gap-1.5">
        {dagen.map((dag) => (
          <li key={dag.datum} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="flex h-16 w-full items-end" aria-hidden="true">
              <span
                className={`w-full rounded-t ${dag.totaal > 0 ? 'bg-sage' : 'bg-neutral-soft'}`}
                style={{
                  height:
                    dag.totaal > 0
                      ? `${Math.max(LEEG_PERCENTAGE, Math.round((dag.totaal / hoogste) * 100))}%`
                      : `${LEEG_PERCENTAGE}%`,
                }}
              />
            </span>
            <span aria-hidden="true" className="text-[11px] text-body">
              {dagletter(dag.datum)}
            </span>
            <span className="sr-only">
              {volledigeDag(dag.datum)}:{' '}
              {dag.gelogd ? `${dag.totaal} handmaten gelogd` : 'niets gelogd'}
            </span>
          </li>
        ))}
      </ul>

      {dagenMetLog > 0 ? (
        <>
          <ul className="mt-4 flex flex-col gap-2 border-t border-hairline-soft pt-3">
            {gemiddelden.map((maat) => (
              <li key={maat.key} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: maat.kleur }}
                />
                <span className="flex-1 text-sm text-body">{maat.naam}</span>
                <span className="text-xs text-body tabular-nums">
                  {getal(maat.gemiddeld, 1, 1)} van {getal(maat.doel)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-body">
            Gemiddeld per gelogde dag, naast het dagdoel uit het profiel.
          </p>
        </>
      ) : (
        <p className="mt-4 border-t border-hairline-soft pt-3 text-xs leading-relaxed text-body">
          Deze week nog niets gelogd.
        </p>
      )}
    </section>
  );
}

/** Vaste letters i.p.v. toLocaleDateString: dezelfde afkorting in elke browser. */
function dagletter(isoDatum: string): string {
  return DAGLETTERS[dagObject(isoDatum).getDay()];
}

function volledigeDag(isoDatum: string): string {
  return dagObject(isoDatum).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Lokale middernacht — `new Date('2026-08-02')` zou UTC pakken en een dag verspringen. */
function dagObject(isoDatum: string): Date {
  return new Date(`${isoDatum}T00:00:00`);
}

/** NL-notatie met komma; het doel toont alleen decimalen als het er echt heeft. */
function getal(waarde: number, min = 0, max = 1): string {
  return waarde.toLocaleString('nl-NL', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}
