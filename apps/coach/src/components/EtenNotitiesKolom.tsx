'use client';

import { HandmatenKaart } from '@/components/HandmatenKaart';
import { Knop } from '@/components/Knop';
import { LauGebruik } from '@/components/LauGebruik';
import { NotitieFormulier, Notities } from '@/components/Notities';
import type { useKlantContext } from '@/lib/hooks/useKlantContext';

/*
 * Kolom 3 uit §8: wat de klant at, wat Laura noteerde — en onderaan hoeveel Lau er deze
 * maand voor nodig had. Alles dezelfde kaartvorm (wit, rand hairline-soft, radius 14),
 * zodat de kolom als één kolom leest en niet als drie losse widgets.
 */
export function EtenNotitiesKolom({ context }: { context: ReturnType<typeof useKlantContext> }) {
  return (
    <>
      {/* Zelfde eyebrow als de andere twee kolommen — op cream, dus body (zie EYEBROW in
          klant/[id]/page.tsx). */}
      <h2 className="px-6 pt-4 pb-3 text-[11px] tracking-[0.12em] text-body uppercase">
        Eten &amp; notities
      </h2>

      {/* flex-auto onder 1200px (gestapelde kolom zonder vaste hoogte), flex-1 daarboven
          waar dit gebied de resthoogte van de kolom vult en zelf scrollt. */}
      <div className="flex flex-auto flex-col gap-3.5 overflow-y-auto px-6 pt-1 pb-4 min-[1200px]:flex-1">
        {context.fout && (
          <div role="alert" className="rounded-input border border-clay-border bg-clay-soft p-4">
            <p className="text-[13px] text-clay-ink">{context.fout}</p>
            <Knop
              variant="secundair"
              onClick={context.herlaad}
              disabled={context.bezig}
              className="mt-3"
            >
              {context.bezig ? 'Bezig…' : 'Opnieuw proberen'}
            </Knop>
          </div>
        )}

        {context.laden ? (
          <Skelet />
        ) : (
          <>
            <HandmatenKaart gemiddelden={context.gemiddelden} dagenMetLog={context.dagenMetLog} />

            <Notities notities={context.notities} />

            {/* Onderaan: het gebruik hoort bij Lau's werk aan deze klant, niet bij
                Laura's eigen aantekeningen. Dit blok mount opnieuw per klant (de
                skeleton hierboven), zodat het limiet-veld nooit een restje van de
                vorige klant toont. */}
            <LauGebruik
              gebruik={context.gebruik}
              eigenLimiet={context.eigenLimiet}
              standaardLimiet={context.standaardLimiet}
              beschikbaar={context.gebruikBeschikbaar}
              opOpslaan={context.stelLimietIn}
            />
          </>
        )}
      </div>

      {/* Vaste voet onder het scrollgebied (§8): het notitieformulier zakt niet mee met
          de lijst. Het Lau-gebruik blijft wél in de scroll — dat is informatie, geen
          actie die altijd binnen bereik hoeft te zijn. */}
      <NotitieFormulier
        opOpslaan={context.voegNotitieToe}
        bezig={context.notitieBezig}
        fout={context.notitieFout}
      />
    </>
  );
}

function Skelet() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true">
      <span className="sr-only">Eten en notities laden…</span>
      {[150, 90, 90].map((hoogte, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{ height: hoogte }}
          className="animate-pulse rounded-input border border-hairline-soft bg-surface"
        />
      ))}
    </div>
  );
}
