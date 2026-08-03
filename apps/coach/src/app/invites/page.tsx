'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Knop } from '@/components/Knop';
import { useCodeAanvragen, type CodeAanvraag } from '@/lib/hooks/useCodeAanvragen';
import { useInvites, type InviteCode } from '@/lib/hooks/useInvites';
import { relatieveTijd, relatieveZin } from '@/lib/tijd';

/** Groot en uit elkaar: deze code wordt overgetypt of voorgelezen, niet gescand. */
const codeStijl = 'font-mono tracking-[0.25em] text-ink uppercase';

/**
 * De verse code hoort één keer groot in beeld: bij de "Nieuwe code"-knop (voorAanvraag
 * null) of in de kaart van de aanvraag waarvoor hij gemaakt is. Eén code tegelijk —
 * Laura handelt één aanvraag tegelijk af.
 */
type VerseStand = { code: string; voorAanvraag: string | null };

export default function InvitesPagina() {
  const {
    codes,
    laden,
    fout,
    bezig,
    herlaad,
    nogNietBeschikbaar,
    maakCode,
    maakBezig,
    maakFout,
    trekIn,
    bezigeCode,
    trekFout,
  } = useInvites();

  const {
    aanvragen,
    laden: aanvragenLaden,
    fout: aanvragenFout,
    bezig: aanvragenBezig,
    herlaad: herlaadAanvragen,
    nogNietBeschikbaar: aanvragenNogNiet,
    handelAf,
    bezigeAanvraag,
    afhandelFout,
  } = useCodeAanvragen();

  // De zojuist gemaakte code: die staat ook in de lijst, maar hoort één keer groot in
  // beeld — dit is het moment waarop Laura hem doorgeeft.
  const [verse, setVerse] = useState<VerseStand | null>(null);
  // Intrekken vraagt om een bevestiging, maar niet via window.confirm: dat blokkeert de
  // pagina en oogt als een browserfout. Eén id tegelijk in bevestig-stand.
  const [bevestigt, setBevestigt] = useState<string | null>(null);
  // Wélke knop de lopende maakCode() startte: `maakBezig` is één vlag voor de hele
  // pagina, en zonder dit zou "Bezig…" op álle code-knoppen tegelijk verschijnen.
  const [codeBezigVoor, setCodeBezigVoor] = useState<string | null>(null);
  // Eén peilmoment voor de hele pagina: alle tijden rekenen vanaf dezelfde tik.
  const nu = new Date();

  async function nieuweCode(voorAanvraag: string | null = null) {
    setCodeBezigVoor(voorAanvraag);
    const code = await maakCode();
    setCodeBezigVoor(null);
    if (code) setVerse({ code, voorAanvraag });
  }

  async function bevestigIntrekken(rij: InviteCode) {
    const gelukt = await trekIn(rij.id);
    setBevestigt(null);
    // De grote code hoort niet te blijven staan als hij net is ingetrokken.
    if (gelukt && verse?.code === rij.code) setVerse(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-sage-deep transition-colors hover:text-sage-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
      >
        ← Klanten
      </Link>

      <h1 className="mt-4 font-serif text-3xl text-ink">Invite-codes</h1>
      <p className="mt-1 text-sm text-body">
        Een code geeft een klant toegang tot het volledige coachingtraject — eenmalig te
        gebruiken.
      </p>

      {/* Aanvragen bóven de codes: dit is de werkvoorraad, de codes eronder zijn de
          administratie. */}
      <section aria-labelledby="aanvragen-kop" className="mt-8">
        <h2 id="aanvragen-kop" className="font-serif text-xl text-ink">
          Aanvragen
        </h2>
        <p className="mt-1 text-sm text-body">
          Klanten die vanuit de app om een traject vroegen. Maak een code aan, geef hem zelf
          door, en zet de aanvraag daarna op afgehandeld.
        </p>

        {aanvragenNogNiet && (
          <div className="mt-4 rounded-card border border-clay-border bg-clay-soft p-5">
            <p className="font-serif text-lg text-clay-ink">Nog niet beschikbaar</p>
            <p className="mt-1.5 text-sm text-clay-ink">
              De migratie voor codeaanvragen is nog niet gepusht. Zodra die in de database
              staat, verschijnen aanvragen hier vanzelf.
            </p>
          </div>
        )}

        {aanvragenFout && (
          <div
            role="alert"
            className="mt-4 rounded-card border border-clay-border bg-clay-soft p-5"
          >
            <p className="text-sm text-clay-ink">{aanvragenFout}</p>
            <Knop
              variant="secundair"
              onClick={herlaadAanvragen}
              disabled={aanvragenBezig}
              className="mt-3"
            >
              {aanvragenBezig ? 'Bezig…' : 'Opnieuw proberen'}
            </Knop>
          </div>
        )}

        {afhandelFout && (
          <p role="alert" className="mt-4 text-sm text-clay-ink">
            {afhandelFout}
          </p>
        )}

        {aanvragenLaden && <Skelet label="Aanvragen laden…" />}

        {!aanvragenLaden && !aanvragenFout && !aanvragenNogNiet && aanvragen.length === 0 && (
          <p className="mt-4 rounded-card border border-dashed border-hairline px-6 py-10 text-center text-sm text-body">
            Geen openstaande aanvragen.
          </p>
        )}

        {aanvragen.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2.5">
            {aanvragen.map((rij) => (
              <Aanvraag
                key={rij.id}
                rij={rij}
                nu={nu}
                verse={verse?.voorAanvraag === rij.id ? verse.code : null}
                maakBezig={maakBezig}
                codeBezig={maakBezig && codeBezigVoor === rij.id}
                opCode={() => nieuweCode(rij.id)}
                opAfhandelen={() => handelAf(rij.id)}
                bezigeAanvraag={bezigeAanvraag}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="codes-kop" className="mt-10">
        <h2 id="codes-kop" className="font-serif text-xl text-ink">
          Codes
        </h2>

        <div className="mt-4">
          <Knop onClick={() => nieuweCode()} disabled={maakBezig}>
            {maakBezig && codeBezigVoor === null ? 'Bezig…' : 'Nieuwe code'}
          </Knop>
        </div>

        {maakFout && (
          <p role="alert" className="mt-3 text-sm text-clay-ink">
            {maakFout}
          </p>
        )}

        {verse && verse.voorAanvraag === null && <VerseCode code={verse.code} key={verse.code} />}

        {nogNietBeschikbaar && (
          <div className="mt-6 rounded-card border border-clay-border bg-clay-soft p-5">
            <p className="font-serif text-lg text-clay-ink">Nog niet beschikbaar</p>
            <p className="mt-1.5 text-sm text-clay-ink">
              De invite-migratie is nog niet gepusht. Zodra de fase 5-migratie in de database
              staat, werkt dit scherm.
            </p>
          </div>
        )}

        {fout && (
          <div role="alert" className="mt-6 rounded-card border border-clay-border bg-clay-soft p-5">
            <p className="text-sm text-clay-ink">{fout}</p>
            <Knop variant="secundair" onClick={herlaad} disabled={bezig} className="mt-3">
              {bezig ? 'Bezig…' : 'Opnieuw proberen'}
            </Knop>
          </div>
        )}

        {trekFout && (
          <p role="alert" className="mt-4 text-sm text-clay-ink">
            {trekFout}
          </p>
        )}

        {laden && <Skelet label="Invite-codes laden…" />}

        {!laden && !fout && !nogNietBeschikbaar && codes.length === 0 && (
          <p className="mt-6 rounded-card border border-dashed border-hairline px-6 py-12 text-center text-sm text-body">
            Nog geen codes.
          </p>
        )}

        {codes.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2.5">
            {codes.map((rij) => {
              const bevestigd = bevestigt === rij.id;
              const werkt = bezigeCode === rij.id;
              return (
                <li
                  key={rij.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-hairline bg-surface px-5 py-4"
                >
                  <span className={`${codeStijl} text-lg`}>
                    <span aria-hidden="true">{rij.code}</span>
                    <span className="sr-only">{gespeld(rij.code)}</span>
                  </span>

                  <time
                    dateTime={rij.created_at}
                    title={volledigeTijd(rij.created_at)}
                    className="text-xs text-body"
                  >
                    {relatieveTijd(rij.created_at, nu)}
                  </time>

                  <Status rij={rij} nu={nu} />

                  {/* Eén knop die van label wisselt i.p.v. twee knoppen die elkaar
                      vervangen: zo blijft het aangeklikte element bestaan en springt de
                      focus niet naar de body bij het bevestigen. */}
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    {!gebruikt(rij) && (
                      <>
                        {bevestigd && (
                          <span role="status" className="text-xs text-body">
                            Zeker weten?
                          </span>
                        )}
                        <Knop
                          variant="secundair"
                          onClick={() =>
                            bevestigd ? bevestigIntrekken(rij) : setBevestigt(rij.id)
                          }
                          disabled={bezigeCode !== null && bezigeCode !== rij.id} aria-busy={bezigeCode === rij.id}
                        >
                          {werkt ? 'Bezig…' : bevestigd ? 'Ja, intrekken' : 'Intrekken'}
                        </Knop>
                        {bevestigd && (
                          <Knop
                            variant="secundair"
                            onClick={() => setBevestigt(null)}
                            disabled={werkt}
                          >
                            Annuleren
                          </Knop>
                        )}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * Eén openstaande aanvraag. Het e-mailadres van de klant staat in auth.users en is voor
 * een coach niet leesbaar — vandaar naam + aanvraagmoment, en het bericht dat de klant
 * zelf meestuurde.
 */
function Aanvraag({
  rij,
  nu,
  verse,
  maakBezig,
  codeBezig,
  opCode,
  opAfhandelen,
  bezigeAanvraag,
}: {
  rij: CodeAanvraag;
  nu: Date;
  /** De zojuist voor déze aanvraag gemaakte code, of null. */
  verse: string | null;
  /** Er loopt érgens op de pagina een maakCode() — alle code-knoppen op slot. */
  maakBezig: boolean;
  /** …en die is door déze regel gestart: alleen hier hoort "Bezig…" te staan. */
  codeBezig: boolean;
  opCode: () => void;
  opAfhandelen: () => void;
  bezigeAanvraag: string | null;
}) {
  // Zonder naam: de klant is net verwijderd (AVG) terwijl de aanvraag nog openstond.
  const naam = rij.klantNaam ?? 'een verwijderde klant';
  const bericht = rij.bericht.trim();
  const wanneer = relatieveZin(rij.created_at, nu);
  const werkt = bezigeAanvraag === rij.id;

  return (
    <li className="rounded-card border border-hairline bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] font-medium text-ink">{naam}</span>
        <time
          dateTime={rij.created_at}
          title={volledigeTijd(rij.created_at)}
          className="text-xs text-body"
        >
          {wanneer === '' ? 'Aangevraagd' : `Aangevraagd ${wanneer}`}
        </time>
      </div>

      {bericht && <p className="mt-2 text-sm text-body">“{bericht}”</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Knop onClick={opCode} disabled={maakBezig} aria-busy={codeBezig}>
          {codeBezig ? 'Bezig…' : 'Code aanmaken'}
        </Knop>
        <Knop
          variant="secundair"
          onClick={opAfhandelen}
          disabled={bezigeAanvraag !== null && !werkt}
          aria-busy={werkt}
        >
          {werkt ? 'Bezig…' : 'Afhandelen'}
        </Knop>
      </div>

      {verse && (
        <>
          <VerseCode code={verse} label={`Code voor ${naam}`} key={verse} />
          <p className="mt-2 text-xs text-body">
            Geef de code door en zet de aanvraag daarna op afgehandeld.
          </p>
        </>
      )}
    </li>
  );
}

/** Een code is verbrand zodra used_at staat — ook als de klant later verwijderd is. */
function gebruikt(rij: InviteCode): boolean {
  return rij.used_at !== null;
}

function Status({ rij, nu }: { rij: InviteCode; nu: Date }) {
  if (!gebruikt(rij)) {
    return (
      <span className="rounded-full border border-sage-soft-border bg-sage-soft px-2.5 py-0.5 text-xs text-sage-ink">
        Open
      </span>
    );
  }
  // Zonder naam: de klant is verwijderd (used_by → null) of viel buiten de klantenlijst.
  const naam = rij.klantNaam ?? 'een verwijderde klant';
  return (
    <span className="rounded-full border border-hairline bg-neutral-soft px-2.5 py-0.5 text-xs text-body">
      Gebruikt door {naam}
      {rij.used_at && ` · ${korteDatum(rij.used_at, nu)}`}
    </span>
  );
}

/** De verse code, één keer groot in beeld — met de kortste weg naar het plakbord. */
function VerseCode({ code, label = 'Nieuwe code' }: { code: string; label?: string }) {
  return (
    <div className="mt-6 rounded-card border border-sage-soft-border bg-sage-soft p-6 text-center">
      <p className="text-xs tracking-[0.12em] text-sage-ink uppercase">{label}</p>
      <p className={`mt-3 text-4xl ${codeStijl}`}>
        <span aria-hidden="true">{code}</span>
        <span className="sr-only">{gespeld(code)}</span>
      </p>
      <div className="mt-4 flex justify-center">
        <KopieerKnop code={code} />
      </div>
    </div>
  );
}

function KopieerKnop({ code }: { code: string }) {
  const [stand, setStand] = useState<'rust' | 'gekopieerd' | 'mislukt'>('rust');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(code);
      setStand('gekopieerd');
    } catch {
      // Geen clipboard-permissie of geen beveiligde context — de code staat groot in
      // beeld, dus overtypen blijft altijd mogelijk.
      setStand('mislukt');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStand('rust'), 2500);
  }

  const label = { rust: 'Kopieer', gekopieerd: 'Gekopieerd', mislukt: 'Kopiëren lukt niet' };
  const melding = { rust: '', gekopieerd: 'Code gekopieerd', mislukt: 'Kopiëren lukte niet' };

  return (
    <>
      <Knop variant="secundair" onClick={kopieer}>
        {label[stand]}
      </Knop>
      {/* Een knoplabel dat verandert wordt niet altijd voorgelezen; dit wél. */}
      <span role="status" className="sr-only">
        {melding[stand]}
      </span>
    </>
  );
}

/** "AB3K9P" → "A B 3 K 9 P": voorgelezen als losse tekens i.p.v. als woord. */
function gespeld(code: string): string {
  return code.split('').join(' ');
}

/** "12 jul", met jaar zodra het afwijkt — anders ruis op elke regel (zie tijd.ts). */
function korteDatum(iso: string, nu: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === nu.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Het exacte tijdstip als tooltip — de relatieve tijd blijft kort (zie ChatBubbel). */
function volledigeTijd(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
}

function Skelet({ label }: { label: string }) {
  return (
    <div className="mt-6 flex flex-col gap-2.5" aria-busy="true">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-[70px] animate-pulse rounded-card border border-hairline bg-surface"
        />
      ))}
    </div>
  );
}
