'use client';

import type { HandmaatGemiddelde } from '@/lib/hooks/useKlantContext';

/*
 * De handmaten-kaart uit §8 (kolom 3) — ook de vorm die §9 ("Wat de logs zeggen")
 * gebruikt, vandaar het losse component. Sage-pill als het doel gehaald is, clay als
 * het achterblijft: clay is hier geen alarm maar precies de kolom waar Laura op stuurt.
 */
export function HandmatenKaart({
  gemiddelden,
  dagenMetLog,
}: {
  gemiddelden: HandmaatGemiddelde[];
  dagenMetLog: number;
}) {
  return (
    <section
      aria-labelledby="handmaten-kop"
      className="flex flex-col gap-3 rounded-input border border-hairline-soft bg-surface px-[17px] py-[15px]"
    >
      {/* contrast-opvolgpunt: #8C8F84 op wit ≈ 3,3:1 bij 12px — ontwerpwaarde. */}
      <h2 id="handmaten-kop" className="text-xs text-muted">
        Handmaten · gemiddeld per dag
      </h2>

      <ul className="flex flex-col gap-2.5">
        {gemiddelden.map((maat) => {
          const gehaald = maat.gemiddeld >= maat.doel;
          return (
            <li key={maat.key} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="size-3 flex-none rounded-[4px]"
                style={{ backgroundColor: maat.kleur }}
              />
              <span className="flex-1 text-[13px] text-body">
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

      {/* contrast-opvolgpunt: #A3A59A op wit ≈ 2,5:1 bij 11,5px — ontwerpwaarde. */}
      <p className="text-[11.5px] leading-[1.5] text-muted-softer">
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
