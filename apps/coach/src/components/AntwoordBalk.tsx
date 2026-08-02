'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { initialen, voornaam as eersteNaam } from '@/lib/naam';

/** Hoe lang de bevestiging blijft staan voordat de hint-regel terugvalt (§8). */
const BEVESTIGING_MS = 4000;

/*
 * Laura's directe kanaal onderaan kolom 1 (handoff §8). Eén regel input met een ronde
 * verzendknop in Laura's eigen kleur (#8C6A56) — niet sage: dit bericht komt van een
 * mens, en dat mag ook in de knop te zien zijn.
 *
 * De "Flag afronden"-knop staat hier en niet bij de banner: het ontwerp zet 'm bewust
 * náást de antwoordbalk, zodat afronden voelt als de afsluiting van het antwoorden.
 */
export function AntwoordBalk({
  coachNaam,
  klantNaam,
  verstuur,
  verstuurt,
  verstuurFout,
  flagOpen,
  flagBezig,
  flagFout,
  opFlagAfronden,
}: {
  coachNaam: string;
  klantNaam: string;
  /** true = geplaatst; alleen dán maakt de balk het veld leeg. */
  verstuur: (tekst: string) => Promise<boolean>;
  verstuurt: boolean;
  verstuurFout: string | null;
  /** false = geen open flag meer; de knop verdwijnt dan (zoals de banner). */
  flagOpen: boolean;
  flagBezig: boolean;
  flagFout: string | null;
  opFlagAfronden: () => void;
}) {
  const [concept, setConcept] = useState('');
  const [netVerstuurd, setNetVerstuurd] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const coach = eersteNaam(coachNaam);
  const klant = eersteNaam(klantNaam);
  const bevestiging = `Verstuurd als ${coach} · ${klant} krijgt een melding`;

  useEffect(() => {
    // Laatste timer opruimen bij unmount (andere klant, weg van de pagina).
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function opVerstuur(e: FormEvent) {
    e.preventDefault();
    const tekst = concept.trim();
    if (!tekst || verstuurt) return;
    const gelukt = await verstuur(tekst);
    // Alleen leegmaken als het bericht echt staat — anders is Laura haar tekst kwijt.
    if (!gelukt) return;
    setConcept('');
    setNetVerstuurd(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNetVerstuurd(false), BEVESTIGING_MS);
  }

  return (
    <div className="flex flex-col gap-[9px] border-t border-table-head bg-surface-sunken px-6 pt-3 pb-5">
      <form onSubmit={opVerstuur} className="flex items-center gap-[9px]">
        <span
          aria-hidden="true"
          className="flex size-[26px] flex-none items-center justify-center rounded-full bg-laura-avatar font-serif text-xs text-laura-avatar-ink"
        >
          {initialen(coachNaam)}
        </span>
        <label htmlFor="antwoord" className="sr-only">
          Antwoord aan {klantNaam}, als {coachNaam}
        </label>
        <input
          id="antwoord"
          type="text"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          // Enter verstuurt (§8): één regel, dus er is geen nieuwe regel om te maken.
          placeholder={`Reageer als ${coach} — ${klant} ziet dat dit van jou komt…`}
          className="min-w-0 flex-1 rounded-full border border-hairline bg-surface px-[15px] py-3 text-[13.5px] text-ink placeholder:text-muted focus:border-sage focus:outline-2 focus:outline-offset-0 focus:outline-sage/40"
        />
        <button
          type="submit"
          disabled={concept.trim() === '' || verstuurt}
          className="flex size-[38px] flex-none items-center justify-center rounded-full bg-laura-avatar-ink text-[15px] text-white transition-colors duration-150 hover:bg-laura-avatar-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-laura-avatar-ink"
        >
          <span aria-hidden="true">↑</span>
          <span className="sr-only">{verstuurt ? 'Versturen…' : 'Versturen'}</span>
        </button>
      </form>

      <div className="flex items-center gap-2.5">
        {/* De aankondiging staat in een eigen live-region die vanaf de eerste render
            bestaat maar leeg is. Een `role="status"` dat de hint-regel permanent draagt
            zou die uitleg als mededeling voorlezen — en een live-region die pas mét tekst
            in de DOM verschijnt, wordt door veel screenreaders juist níet voorgelezen. */}
        <p aria-live="polite" className="sr-only">
          {netVerstuurd ? bevestiging : ''}
        </p>
        {/* contrast-opvolgpunt: #A3A59A op #FBF9F5 ≈ 2,4:1 bij 11,5px — ontwerpwaarden. */}
        <p className="text-[11.5px] text-muted-softer">
          {netVerstuurd
            ? bevestiging
            : `${klant} ziet duidelijk dat dit bericht van jou komt, niet van Lau.`}
        </p>
        {flagOpen && (
          <button
            type="button"
            onClick={opFlagAfronden}
            disabled={flagBezig}
            className="ml-auto flex-none rounded-full border border-clay-border bg-surface px-[13px] py-[7px] text-[11.5px] text-clay-ink transition-colors duration-150 hover:border-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:cursor-not-allowed disabled:opacity-60"
          >
            {flagBezig ? 'Bezig…' : 'Flag afronden'}
          </button>
        )}
      </div>

      {(verstuurFout || flagFout) && (
        <p role="alert" className="text-[11.5px] text-clay-ink">
          {verstuurFout ?? flagFout}
        </p>
      )}
    </div>
  );
}
