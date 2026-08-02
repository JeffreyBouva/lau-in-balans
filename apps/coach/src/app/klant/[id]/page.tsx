'use client';

import { Fragment, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { naarISODatum, vandaagISO, weekNummer } from '@lau/shared';
import { AntwoordBalk } from '@/components/AntwoordBalk';
import { ChatBubbel } from '@/components/ChatBubbel';
import { EtenNotitiesKolom } from '@/components/EtenNotitiesKolom';
import { FlagBanner } from '@/components/FlagBanner';
import { Knop } from '@/components/Knop';
import { ProfielKolom } from '@/components/ProfielKolom';
import { Statuspagina } from '@/components/Statuspagina';
import { useCoach } from '@/lib/coach';
import { useKlant } from '@/lib/hooks/useKlant';
import { useKlantChat } from '@/lib/hooks/useKlantChat';
import { useKlantContext } from '@/lib/hooks/useKlantContext';
import { useLogPorties } from '@/lib/hooks/useLogPorties';
import { useProfielVersies } from '@/lib/hooks/useProfielVersies';
import { initialen, voornaam as eersteNaam } from '@/lib/naam';

/*
 * Kolomvorm uit §8: elke kolom scrollt apart. Vanaf 1200px is de kolom een grid-cel met
 * een vaste hoogte (`min-h-0` laat het scrollgebied binnenin krimpen); daaronder is het
 * dashboard niet ontworpen (handoff §Afmetingen), dus stapelen de kolommen op hun eigen
 * inhoudshoogte en scrollt de pagina als geheel.
 */
const KOLOM = 'flex flex-col border-hairline-soft min-[1200px]:min-h-0 min-[1200px]:overflow-hidden';
const EYEBROW = 'text-[11px] tracking-[0.12em] text-muted-softer uppercase';

export default function KlantDetailPagina() {
  // Client-side route (A2): het id komt uit de URL, niet uit server-params.
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const { coach } = useCoach();
  const klantStand = useKlant(clientId);
  const chat = useKlantChat(clientId);
  const context = useKlantContext(clientId);
  const profiel = useProfielVersies(clientId);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Eén peilmoment per render: alle relatieve tijden en de week rekenen vanaf dezelfde tik.
  const nu = new Date();
  const vandaag = vandaagISO();

  const { berichten, verstuurAlsCoach, verstuurt } = chat;
  // Log-berichten dragen alleen een food_log_id; de porties komen er los bij.
  const logIds = useMemo(
    () => berichten.flatMap((b) => (b.food_log_id ? [b.food_log_id] : [])),
    [berichten],
  );
  const logMap = useLogPorties(logIds);

  const laatste = berichten[berichten.length - 1];
  // Scroll ook mee als het láátste bericht groeit: Lau's antwoord streamt binnen via
  // UPDATE-events, dus het aantal berichten verandert dan niet.
  const groei = `${berichten.length}|${laatste?.id ?? ''}|${laatste?.tekst?.length ?? 0}`;
  useEffect(() => {
    // §Autoscroll: scrollTop = scrollHeight op de container, géén scrollIntoView —
    // anders scrollt de hele pagina mee in plaats van alleen deze kolom.
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [groei]);

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
  const voornaam = eersteNaam(klant.naam);
  const coachNaam = coach?.naam ?? 'Laura';
  // De oudste open flag: die wacht het langst, en §8 toont er één.
  const flag = context.flags.length > 0 ? context.flags[context.flags.length - 1] : null;
  const eersteDoel = profiel.actief?.profiel?.doelen?.[0];

  // "38 · week 3 · duurzaam afvallen · 5 van 7 dagen gelogd" — ontbrekende delen vallen
  // gewoon weg; een streepje voor een lege leeftijd zegt niets.
  const meta = [
    klant.leeftijd != null ? String(klant.leeftijd) : null,
    `week ${weekNummer(klant.startdatum, vandaag)}`,
    typeof eersteDoel === 'string' && eersteDoel.trim() !== '' ? eersteDoel : null,
    context.laden ? null : `${context.dagenMetLog} van ${context.dagen.length} dagen gelogd`,
  ].filter((deel): deel is string => deel !== null);

  return (
    <main className="flex h-[calc(100dvh-var(--hoogte-chrome))] flex-col overflow-hidden">
      <header className="flex items-center gap-4 border-b border-hairline-soft bg-surface px-8 py-5">
        <Link
          href="/"
          aria-label="Terug naar de klantenlijst"
          className="flex size-9 flex-none items-center justify-center rounded-full border border-hairline bg-surface text-[15px] text-body transition-colors duration-150 hover:border-hairline-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
        >
          <span aria-hidden="true">←</span>
        </Link>

        <span
          aria-hidden="true"
          className="flex size-[42px] flex-none items-center justify-center rounded-full bg-sage-soft text-[15px] text-sage-deep"
        >
          {initialen(klant.naam)}
        </span>

        <div className="flex min-w-0 flex-col gap-[3px]">
          <h1 className="truncate font-serif text-[21px] text-ink">{klant.naam}</h1>
          {/* contrast-opvolgpunt: #8C8F84 op wit ≈ 3,3:1 bij 12px — ontwerpwaarde. */}
          <p className="truncate text-xs text-muted">{meta.join(' · ')}</p>
        </div>

        {/* De gespreksroute komt in Task 3 (§9); tot die tijd geeft deze link een 404. */}
        <Link
          href={`/klant/${clientId}/gesprek`}
          className="ml-auto flex-none rounded-full bg-sage px-[18px] py-[11px] text-[13px] text-white transition-colors duration-150 hover:bg-sage-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
        >
          Wekelijks gesprek
        </Link>
      </header>

      {flag && <FlagBanner flag={flag} voornaam={voornaam} nu={nu} />}

      <div className="min-h-0 flex-1 overflow-y-auto min-[1200px]:grid min-[1200px]:grid-cols-[1.2fr_1fr_0.8fr] min-[1200px]:overflow-hidden">
        {/* ── Kolom 1 · Meelezen ─────────────────────────────────────────────── */}
        <section
          aria-label={`Gesprek met ${klant.naam}`}
          className={`${KOLOM} border-b min-[1200px]:border-r min-[1200px]:border-b-0`}
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-3">
            <h2 className={EYEBROW}>Meelezen · deze week</h2>
            {/* contrast-opvolgpunt: #A3A59A op wit ≈ 2,5:1 bij 12px — ontwerpwaarde. */}
            <p className="text-xs text-muted-softer">Lau coacht dagelijks</p>
          </div>

          {/* flex-auto onder 1200px (de kolom heeft dan geen vaste hoogte, en een
              scrollgebied met flex-basis 0 zou tot niets inklappen); flex-1 daarboven,
              waar dit gebied juist de resthoogte van de kolom moet vullen. */}
          <div
            ref={transcriptRef}
            className="flex flex-auto flex-col gap-[11px] overflow-y-auto px-6 pt-1 pb-4 min-[1200px]:flex-1"
          >
            {chat.fout && (
              <div role="alert" className="rounded-input border border-clay-border bg-clay-soft p-4">
                <p className="text-[13px] text-clay-ink">{chat.fout}</p>
                <Knop
                  variant="secundair"
                  onClick={chat.herlaad}
                  disabled={chat.bezig}
                  className="mt-3"
                >
                  {chat.bezig ? 'Bezig…' : 'Opnieuw proberen'}
                </Knop>
              </div>
            )}

            {chat.laden && <Skelet />}

            {!chat.laden && !chat.fout && berichten.length === 0 && (
              <p className="rounded-input border border-dashed border-hairline px-5 py-10 text-center text-[13px] text-muted">
                Nog geen berichten.
              </p>
            )}

            {berichten.length > 0 && (
              <ol className="flex flex-col gap-[11px]">
                {berichten.map((bericht, i) => {
                  const vorige = i > 0 ? berichten[i - 1] : null;
                  const nieuweDag =
                    vorige === null ||
                    dagSleutel(vorige.created_at) !== dagSleutel(bericht.created_at);
                  return (
                    <Fragment key={bericht.id}>
                      {/* Niet in §8 getekend, wél in de klant-chat: zonder dagscheiding
                          leest een week transcript als één lange dag. */}
                      {nieuweDag && (
                        <li className="mt-2 flex items-center gap-3 text-[11px] text-muted-softer first:mt-0">
                          <span className="h-px flex-1 bg-hairline-soft" aria-hidden="true" />
                          {dagLabel(bericht.created_at, nu)}
                          <span className="h-px flex-1 bg-hairline-soft" aria-hidden="true" />
                        </li>
                      )}
                      <li>
                        <ChatBubbel
                          bericht={bericht}
                          log={bericht.food_log_id ? logMap[bericht.food_log_id] : undefined}
                          klantNaam={klant.naam}
                          coachNaam={coachNaam}
                        />
                      </li>
                    </Fragment>
                  );
                })}
              </ol>
            )}
          </div>

          <AntwoordBalk
            coachNaam={coachNaam}
            klantNaam={klant.naam}
            verstuur={verstuurAlsCoach}
            verstuurt={verstuurt}
            verstuurFout={chat.verstuurFout}
            flagOpen={flag !== null}
            flagBezig={flag !== null && context.bezigeFlag === flag.id}
            flagFout={context.flagFout}
            opFlagAfronden={() => {
              // De knop rondt de flag af die in de banner staat — één open vraag tegelijk.
              if (flag) void context.rondFlagAf(flag.id);
            }}
          />
        </section>

        {/* ── Kolom 2 · AI-profiel ───────────────────────────────────────────── */}
        <section
          aria-label={`AI-profiel van ${klant.naam}`}
          className={`${KOLOM} border-b min-[1200px]:border-r min-[1200px]:border-b-0`}
        >
          <ProfielKolom
            clientId={clientId}
            profiel={profiel}
            gemiddelden={context.gemiddelden}
            dagenMetLog={context.dagenMetLog}
          />
        </section>

        {/* ── Kolom 3 · Eten & notities ──────────────────────────────────────── */}
        <section aria-label={`Eten en notities van ${klant.naam}`} className={KOLOM}>
          <EtenNotitiesKolom context={context} />
        </section>
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

function Skelet() {
  return (
    <div className="flex flex-col gap-[11px]" aria-busy="true">
      <span className="sr-only">Gesprek laden…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`h-12 animate-pulse rounded-input ${
            i % 2 === 0
              ? 'w-3/5 self-start border border-table-head bg-surface'
              : 'w-1/2 self-end bg-sage-soft'
          }`}
        />
      ))}
    </div>
  );
}
