'use client';

import { useState, type FormEvent } from 'react';

const veld =
  'w-full rounded-control border border-hairline-soft bg-surface px-3 py-2 text-[13px] ' +
  'text-ink placeholder:text-muted focus:border-sage focus:outline-2 focus:outline-offset-0 ' +
  'focus:outline-sage/40';

/** Zelfde knopvorm als "Bewaren" bij de notities — kolom 3 spreekt één taal (§8). */
const knop =
  'rounded-full border border-hairline bg-surface px-4 py-2.5 text-[12.5px] text-body ' +
  'transition-colors duration-150 hover:border-sage hover:text-sage-deep ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-hairline disabled:hover:text-body';

/** Vanaf 90% kleurt de balk clay: bijna op is iets om nú over te beslissen. */
const AANDACHT_VANAF = 0.9;

const NOG_NIET = 'Beschikbaar zodra de fase 7-migratie gepusht is.';
const PARSEFOUT = 'Vul een heel getal van 1 of hoger in, of laat het veld leeg.';

/*
 * Hoeveel Lau-berichten deze klant deze maand gebruikte, en de knop om daar een eigen
 * plafond op te zetten. Sage zolang er ruimte is (voortgang), clay vanaf 90% — de coach
 * moet dan kunnen kiezen tussen ophogen en het gesprek erover voeren. De klant ziet dit
 * getal nooit; in de app is de nette afkap de hele interface.
 */
export function LauGebruik({
  gebruik,
  eigenLimiet,
  standaardLimiet,
  beschikbaar,
  opOpslaan,
}: {
  gebruik: number;
  /** null = deze klant volgt de standaard. */
  eigenLimiet: number | null;
  standaardLimiet: number;
  /** false = de fase 7-migratie staat nog niet in de database. */
  beschikbaar: boolean;
  /** `error` null = opgeslagen; de tekst is bedoeld om te tonen. */
  opOpslaan: (waarde: number | null) => Promise<{ error: string | null }>;
}) {
  // Startwaarde uit de database; daarna is het veld van de coach. Bij een andere klant
  // valt de zijbalk eerst terug op de skeleton, dus dit blok mount opnieuw met de
  // limiet van die klant — geen restje van de vorige.
  const [invoer, setInvoer] = useState(() => teksten(eigenLimiet));
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);

  const limiet = eigenLimiet ?? standaardLimiet;
  const deel = limiet > 0 ? gebruik / limiet : 0;
  // Over de limiet heen kan (de afkap telt per bericht, niet per token): de balk stopt
  // bij vol, het getal ernaast vertelt de rest.
  const breedte = Math.min(100, Math.round(deel * 100));

  async function opslaan(e: FormEvent) {
    e.preventDefault();
    if (bezig) return;

    const schoon = invoer.trim();
    let waarde: number | null = null;
    if (schoon !== '') {
      const getal = Number(schoon);
      // Number('abc') is NaN en Number('2,5') ook: zonder deze guard zou een vertypte
      // limiet als null (= standaard) de database in glippen.
      if (!Number.isInteger(getal) || getal < 1) {
        setOpgeslagen(false);
        setFout(PARSEFOUT);
        return;
      }
      waarde = getal;
    }

    setBezig(true);
    setFout(null);
    setOpgeslagen(false);
    const { error } = await opOpslaan(waarde);
    setBezig(false);
    if (error) {
      setFout(error);
      return;
    }
    // Terug naar de opgeslagen notatie ("007" → "7"), zodat het veld hetzelfde zegt als
    // het getal in de regel erboven.
    setInvoer(teksten(waarde));
    // Zonder dit regeltje lijkt dezelfde waarde opslaan een klik in het niets.
    setOpgeslagen(true);
  }

  return (
    <section
      aria-labelledby="lau-gebruik-kop"
      className="rounded-input border border-hairline-soft bg-surface px-[17px] py-[15px]"
    >
      {/* contrast-opvolgpunt: #8C8F84 op wit ≈ 3,3:1 bij 12px — ontwerpwaarde (§8-kaartkop). */}
      <h2 id="lau-gebruik-kop" className="text-xs text-muted">
        Lau-gebruik
      </h2>

      {!beschikbaar ? (
        // Neutraal, niet in clay: dit is een openstaande deploystap, geen storing.
        <p className="mt-3 text-[13px] text-body">{NOG_NIET}</p>
      ) : (
        <>
          <p className="mt-2 text-[13px] text-ink tabular-nums">
            {gebruik} van {limiet} deze maand
          </p>

          {/* De regel hierboven zegt het al in woorden; de balk is puur beeld. */}
          <div
            aria-hidden="true"
            className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-neutral-soft"
          >
            <div
              className={`h-full rounded-full ${deel >= AANDACHT_VANAF ? 'bg-clay' : 'bg-sage'}`}
              style={{ width: `${breedte}%` }}
            />
          </div>

          {/* Ook mét een eigen limiet zichtbaar: anders is er geen enkele plek waar de
              coach ziet wat "leeg = de standaard" straks betekent. */}
          <p className="mt-2 text-[11.5px] text-muted">Standaard: {standaardLimiet}/maand</p>

          <form onSubmit={opslaan} className="mt-3.5 border-t border-hairline-soft pt-3">
            <label htmlFor="ai-limiet" className="text-[13px] text-body">
              Eigen limiet
            </label>
            <p id="ai-limiet-hint" className="mt-0.5 text-[11.5px] text-muted">
              Leeg = de standaard.
            </p>
            <input
              id="ai-limiet"
              // Bewust GEEN type="number": daarbij geeft de browser voor ongeldige invoer
              // ("2,5", "abc") een lege string terug, en dan leest een vertypte limiet als
              // "leeg = de standaard" — de guard in opslaan() zou nooit vuren en de klant
              // zou stilletjes op 300 blijven staan. Met type="text" komt de invoer
              // ongeschonden binnen; inputMode houdt het cijfertoetsenbord op mobiel.
              type="text"
              inputMode="numeric"
              value={invoer}
              aria-describedby="ai-limiet-hint"
              onChange={(e) => {
                setInvoer(e.target.value);
                setFout(null);
                setOpgeslagen(false);
              }}
              placeholder={String(standaardLimiet)}
              className={`${veld} mt-1.5 tabular-nums`}
            />
            <div className="mt-2.5 flex justify-end">
              <button type="submit" disabled={bezig} className={knop}>
                {bezig ? 'Opslaan…' : 'Limiet opslaan'}
              </button>
            </div>
            {fout && (
              <p role="alert" className="mt-2 text-[12.5px] text-clay-ink">
                {fout}
              </p>
            )}
            {!fout && opgeslagen && (
              <p role="status" className="mt-2 text-[11.5px] text-muted">
                Opgeslagen.
              </p>
            )}
          </form>
        </>
      )}
    </section>
  );
}

/** Limiet → veldwaarde; null (= de standaard) hoort een leeg veld te zijn. */
function teksten(waarde: number | null): string {
  return waarde === null ? '' : String(waarde);
}
