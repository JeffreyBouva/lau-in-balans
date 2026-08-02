'use client';

import { useState, type FormEvent } from 'react';
import { Knop } from '@/components/Knop';

const veld =
  'w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm ' +
  'text-ink placeholder:text-body focus:border-sage focus:outline-2 focus:outline-offset-0 ' +
  'focus:outline-sage/40';

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
      className="rounded-card border border-hairline bg-surface p-4"
    >
      <h2 id="lau-gebruik-kop" className="text-xs tracking-[0.12em] text-body uppercase">
        Lau-gebruik
      </h2>

      {!beschikbaar ? (
        // Neutraal, niet in clay: dit is een openstaande deploystap, geen storing.
        <p className="mt-3 text-sm text-body">{NOG_NIET}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink tabular-nums">
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

          {eigenLimiet === null && (
            <p className="mt-2 text-xs text-body">Standaard: {standaardLimiet}/maand</p>
          )}

          <form onSubmit={opslaan} className="mt-4 border-t border-hairline-soft pt-3">
            <label htmlFor="ai-limiet" className="text-sm font-medium text-ink">
              Eigen limiet
            </label>
            <p id="ai-limiet-hint" className="mt-0.5 text-xs text-body">
              Leeg = de standaard.
            </p>
            <input
              id="ai-limiet"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
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
            <div className="mt-2 flex justify-end">
              <Knop type="submit" variant="secundair" disabled={bezig}>
                {bezig ? 'Opslaan…' : 'Limiet opslaan'}
              </Knop>
            </div>
            {fout && (
              <p role="alert" className="mt-2 text-sm text-clay-ink">
                {fout}
              </p>
            )}
            {!fout && opgeslagen && (
              <p role="status" className="mt-2 text-xs text-body">
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
