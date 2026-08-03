'use client';

import type { HandmaatGemiddelde } from '@/lib/hooks/useKlantContext';

/*
 * De handmaten-kaart uit §8 (kolom 3) — ook de vorm die §9 ("Wat de logs zeggen")
 * gebruikt, vandaar het losse component. Sage-pill als het doel gehaald is, clay als
 * het achterblijft: clay is hier geen alarm maar precies de kolom waar Laura op stuurt.
 *
 * `variant`:
 * - `kaart` (§8) — eigen witte kaart met label en voetnoot; dit is de zelfstandige vorm.
 * - `kaal` (§9) — alleen de vier regels, iets ruimer gezet (13,5px, rij-gap 12). Daar
 *   staat de kop al op de omliggende kaart en volgt er een eigen slotzin; een kaart-in-
 *   een-kaart mét tweede voetnoot zou hetzelfde twee keer zeggen.
 */
export function HandmatenKaart({
  gemiddelden,
  dagenMetLog,
  variant = 'kaart',
}: {
  gemiddelden: HandmaatGemiddelde[];
  dagenMetLog: number;
  variant?: 'kaart' | 'kaal';
}) {
  const kaal = variant === 'kaal';

  const regels = (
    <ul className={`flex flex-col ${kaal ? 'gap-3' : 'gap-2.5'}`}>
      {gemiddelden.map((maat) => {
        const gehaald = maat.gemiddeld >= maat.doel;
        return (
          <li key={maat.key} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-3 flex-none rounded-[4px]"
              style={{ backgroundColor: maat.kleur }}
            />
            <span className={`flex-1 ${kaal ? 'text-[13.5px]' : 'text-[13px]'} text-body`}>
              {maat.naam} · {maat.hand.toLowerCase()}
            </span>
            <span
              className={`flex-none rounded-full px-[11px] py-[5px] text-[11.5px] tabular-nums ${
                gehaald ? 'bg-sage-soft text-sage-deep' : 'bg-clay-soft text-clay-ink'
              }`}
            >
              {getal(maat.gemiddeld, 1, 1)} van {getal(maat.doel)}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (kaal) return regels;

  return (
    <section
      aria-labelledby="handmaten-kop"
      className="flex flex-col gap-3 rounded-input border border-hairline-soft bg-surface px-[17px] py-[15px]"
    >
      <h2 id="handmaten-kop" className="text-xs text-body">
        Handmaten · gemiddeld per dag
      </h2>

      {regels}

      {/* De kaart is wit, dus de voetnoot mag in body-soft (4,97:1) blijven staan: zachter
          dan de kop en de regels erboven, en toch leesbaar. */}
      <p className="text-[11.5px] leading-[1.5] text-body-soft">
        {voetnoot(gemiddelden, dagenMetLog)}
      </p>
    </section>
  );
}

/**
 * "Eiwit blijft achter op het doel. Groente zit ruim goed." — de zwakste en de sterkste
 * handmaat benoemd (§8). Vergelijken op verhouding tot het eigen doel, niet op het rauwe
 * gemiddelde: 4 vuisten groente en 2 handpalmen eiwit zijn anders niet te vergelijken.
 */
function voetnoot(gemiddelden: HandmaatGemiddelde[], dagenMetLog: number): string {
  if (dagenMetLog === 0 || gemiddelden.length === 0) {
    return 'Deze week nog niets gelogd — er is nog geen gemiddelde om iets over te zeggen.';
  }
  const verhouding = (m: HandmaatGemiddelde) => (m.doel > 0 ? m.gemiddeld / m.doel : 1);
  const gesorteerd = [...gemiddelden].sort((a, b) => verhouding(a) - verhouding(b));
  const zwakste = gesorteerd[0];
  const sterkste = gesorteerd[gesorteerd.length - 1];

  const delen: string[] = [];
  if (verhouding(zwakste) < 1) delen.push(`${zwakste.naam} blijft achter op het doel.`);
  if (verhouding(sterkste) >= 1 && sterkste.key !== zwakste.key) {
    delen.push(`${sterkste.naam} zit ruim goed.`);
  }
  if (delen.length === 0) return 'Alle handmaten zitten op of boven het doel.';
  return delen.join(' ');
}

/** NL-notatie met komma; het doel toont alleen decimalen als het er echt heeft. */
function getal(waarde: number, min = 0, max = 1): string {
  return waarde.toLocaleString('nl-NL', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}
