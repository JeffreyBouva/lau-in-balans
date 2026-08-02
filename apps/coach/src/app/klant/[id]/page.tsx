'use client';

import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { naarISODatum, vandaagISO, weekNummer } from '@lau/shared';
import { ChatBubbel } from '@/components/ChatBubbel';
import { FlagKaart } from '@/components/FlagKaart';
import { Knop, knopStijl } from '@/components/Knop';
import { Notities } from '@/components/Notities';
import { Statuspagina } from '@/components/Statuspagina';
import { StatusChip } from '@/components/StatusChip';
import { VoedingsWeek } from '@/components/VoedingsWeek';
import { useKlant } from '@/lib/hooks/useKlant';
import { useKlantChat } from '@/lib/hooks/useKlantChat';
import { useKlantContext } from '@/lib/hooks/useKlantContext';

const veld =
  'w-full resize-y rounded-input border border-hairline bg-surface px-3.5 py-2.5 text-sm ' +
  'text-ink placeholder:text-muted focus:border-sage focus:outline-2 focus:outline-offset-0 ' +
  'focus:outline-sage/40';

export default function KlantDetailPagina() {
  // Client-side route (A2): het id komt uit de URL, niet uit server-params.
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const klantStand = useKlant(clientId);
  const chat = useKlantChat(clientId);
  const context = useKlantContext(clientId);
  const [concept, setConcept] = useState('');
  const onderRef = useRef<HTMLDivElement>(null);

  // Eén peilmoment per render: alle relatieve tijden en de week rekenen vanaf dezelfde tik.
  const nu = new Date();
  const vandaag = vandaagISO();

  const { berichten, verstuurAlsCoach, verstuurt } = chat;
  const laatste = berichten[berichten.length - 1];
  // Scroll ook mee als het láátste bericht groeit: Lau's antwoord streamt binnen via
  // UPDATE-events, dus het aantal berichten verandert dan niet.
  const groei = `${berichten.length}|${laatste?.id ?? ''}|${laatste?.tekst?.length ?? 0}`;
  useEffect(() => {
    onderRef.current?.scrollIntoView({ block: 'end' });
  }, [groei]);

  async function verzend() {
    const tekst = concept.trim();
    if (!tekst || verstuurt) return;
    const gelukt = await verstuurAlsCoach(tekst);
    // Alleen leegmaken als het bericht echt staat — anders is Laura haar tekst kwijt.
    if (gelukt) setConcept('');
  }

  function opVerstuur(e: FormEvent) {
    e.preventDefault();
    void verzend();
  }

  function opToets(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter houdt een nieuwe regel; ⌘/Ctrl + Enter verstuurt (langere antwoorden zijn
    // hier de norm, dus versturen mag niet het gemakkelijkste ongeluk zijn).
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void verzend();
    }
  }

  if (klantStand.laden) return <Statuspagina>Bezig met laden…</Statuspagina>;

  if (klantStand.fout) {
    return (
      <Statuspagina rol="alert">
        Deze klant laden lukte niet — herlaad de pagina.
      </Statuspagina>
    );
  }

  if (!klantStand.klant) {
    // RLS geeft 0 rijen voor een klant van een andere coach: niet te onderscheiden van
    // "bestaat niet", en dat hoeft ook niet — beide zijn voor Laura hetzelfde.
    return <Statuspagina>Klant niet gevonden.</Statuspagina>;
  }

  const klant = klantStand.klant;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header>
        <Link
          href="/"
          className="text-sm text-body transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
        >
          ← Klanten
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="font-serif text-3xl leading-tight text-ink">{klant.naam}</h1>
          <StatusChip status={klant.status} />
          <span className="text-xs text-body">Week {weekNummer(klant.startdatum, vandaag)}</span>
        </div>
      </header>

      {/* Twee kolommen: gesprek links, context-zijbalk rechts. Onder lg valt de
          zijbalk weg — het gesprek is het werk, de context is naslag. */}
      <div className="mt-8 flex gap-8">
        <section aria-label="Gesprek" className="mx-auto flex w-full max-w-2xl min-w-0 flex-col">
          {chat.fout && (
            <div role="alert" className="rounded-card border border-clay-border bg-clay-soft p-5">
              <p className="text-sm text-clay-ink">{chat.fout}</p>
              <Knop variant="secundair" onClick={chat.herlaad} disabled={chat.bezig} className="mt-3">
                {chat.bezig ? 'Bezig…' : 'Opnieuw proberen'}
              </Knop>
            </div>
          )}

          {chat.laden && <Skelet />}

          {!chat.laden && !chat.fout && berichten.length === 0 && (
            <p className="rounded-card border border-dashed border-hairline px-6 py-12 text-center text-sm text-body">
              Nog geen berichten.
            </p>
          )}

          {berichten.length > 0 && (
            <ol className="flex flex-col gap-3">
              {berichten.map((bericht, i) => {
                const vorige = i > 0 ? berichten[i - 1] : null;
                const nieuweDag =
                  vorige === null || dagSleutel(vorige.created_at) !== dagSleutel(bericht.created_at);
                return (
                  <Fragment key={bericht.id}>
                    {nieuweDag && (
                      <li className="mt-3 flex items-center gap-3 first:mt-0 text-xs text-body">
                        <span className="h-px flex-1 bg-hairline-soft" aria-hidden="true" />
                        {dagLabel(bericht.created_at, nu)}
                        <span className="h-px flex-1 bg-hairline-soft" aria-hidden="true" />
                      </li>
                    )}
                    <li>
                      <ChatBubbel bericht={bericht} nu={nu} />
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          )}

          {/* Ankerpunt voor de autoscroll; de scroll-marge houdt het boven de composer. */}
          <div ref={onderRef} aria-hidden="true" className="h-px scroll-mb-44" />

          <form
            onSubmit={opVerstuur}
            className="sticky bottom-0 mt-6 border-t border-hairline bg-cream pt-4 pb-6"
          >
            <label htmlFor="antwoord" className="sr-only">
              Antwoord aan {klant.naam}
            </label>
            <textarea
              id="antwoord"
              rows={2}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={opToets}
              placeholder="Schrijf een antwoord…"
              className={veld}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-body">⌘/Ctrl + Enter verstuurt</p>
              <Knop type="submit" disabled={concept.trim() === '' || verstuurt}>
                {verstuurt ? 'Versturen…' : 'Antwoord als Laura'}
              </Knop>
            </div>
            {chat.verstuurFout && (
              <p role="alert" className="mt-2 text-sm text-clay-ink">
                {chat.verstuurFout}
              </p>
            )}
          </form>
        </section>

        <aside
          aria-label={`Context van ${klant.naam}`}
          className="hidden w-80 shrink-0 flex-col gap-5 lg:flex"
        >
          {context.fout && (
            <div role="alert" className="rounded-card border border-clay-border bg-clay-soft p-4">
              <p className="text-sm text-clay-ink">{context.fout}</p>
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
            <ZijbalkSkelet />
          ) : (
            <>
              {/* Bovenaan en in clay: een open flag betekent dat een klant op een mens
                  wacht — dat mag de aandacht trekken die het verdient. */}
              {context.flags.length > 0 && (
                <section aria-labelledby="flags-kop">
                  <h2 id="flags-kop" className="text-xs tracking-[0.12em] text-body uppercase">
                    {context.flags.length === 1 ? 'Open flag' : `Open flags (${context.flags.length})`}
                  </h2>
                  <ul className="mt-2 flex flex-col gap-2.5">
                    {context.flags.map((flag) => (
                      <li key={flag.id}>
                        <FlagKaart
                          flag={flag}
                          nu={nu}
                          bezig={context.bezigeFlag === flag.id}
                          opAfronden={(flagId) => void context.rondFlagAf(flagId)}
                        />
                      </li>
                    ))}
                  </ul>
                  {context.flagFout && (
                    <p role="alert" className="mt-2 text-sm text-clay-ink">
                      {context.flagFout}
                    </p>
                  )}
                </section>
              )}

              <VoedingsWeek
                dagen={context.dagen}
                gemiddelden={context.gemiddelden}
                dagenMetLog={context.dagenMetLog}
              />

              {/* Direct onder de voedingsweek: de dagdoelen in die kaart komen uit
                  precies dit profiel. */}
              <section
                aria-labelledby="profiel-kop"
                className="rounded-card border border-hairline bg-surface p-4"
              >
                <h2 id="profiel-kop" className="text-xs tracking-[0.12em] text-body uppercase">
                  AI-profiel
                </h2>
                <p className="mt-1 text-xs text-body">
                  {context.profielVersie === null
                    ? 'Nog geen profiel'
                    : `Versie ${context.profielVersie}`}
                </p>
                <Link
                  href={`/klant/${clientId}/profiel`}
                  className={`${knopStijl('secundair')} mt-3 w-full`}
                >
                  Profiel bewerken
                </Link>
              </section>

              <Notities
                notities={context.notities}
                opOpslaan={context.voegNotitieToe}
                bezig={context.notitieBezig}
                fout={context.notitieFout}
              />
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

/** Lokale kalenderdag — de scheidingslijn valt op middernacht bij Laura, niet in UTC. */
function dagSleutel(iso: string): string {
  return naarISODatum(new Date(iso));
}

function dagLabel(iso: string, nu: Date): string {
  const d = new Date(iso);
  const dag = naarISODatum(d);
  if (dag === naarISODatum(nu)) return 'Vandaag';
  const gisteren = new Date(nu);
  gisteren.setDate(gisteren.getDate() - 1);
  if (dag === naarISODatum(gisteren)) return 'Gisteren';
  return d.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    // Jaar alleen als het afwijkt — anders ruis op elke scheider.
    ...(d.getFullYear() === nu.getFullYear() ? {} : { year: 'numeric' }),
  });
}

function ZijbalkSkelet() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <span className="sr-only">Klantcontext laden…</span>
      {[160, 200].map((hoogte) => (
        <div
          key={hoogte}
          aria-hidden="true"
          style={{ height: hoogte }}
          className="animate-pulse rounded-card border border-hairline bg-surface"
        />
      ))}
    </div>
  );
}

function Skelet() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">Gesprek laden…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`h-16 animate-pulse rounded-card bg-surface ${
            i % 2 === 0 ? 'w-3/5 self-start border border-hairline-soft' : 'w-1/2 self-end bg-sage-soft'
          }`}
        />
      ))}
    </div>
  );
}
