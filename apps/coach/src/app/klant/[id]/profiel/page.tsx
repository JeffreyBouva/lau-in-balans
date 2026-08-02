'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AIProfile, HandKey, Porties, Veiligheidsvlag } from '@lau/shared';
import { HANDMATEN, PORTIE_DOEL_DEFAULT } from '@lau/shared';
import { Knop } from '@/components/Knop';
import { Statuspagina } from '@/components/Statuspagina';
import { useKlant } from '@/lib/hooks/useKlant';
import { useProfielVersies } from '@/lib/hooks/useProfielVersies';

const veldBasis =
  'w-full rounded-input border border-hairline bg-surface px-3.5 py-2.5 text-sm ' +
  'text-ink placeholder:text-body focus:border-sage focus:outline-2 focus:outline-offset-0 ' +
  'focus:outline-sage/40';
const veld = `${veldBasis} resize-y`;

/** Ruim boven elk realistisch dagdoel; hoger is vrijwel altijd een typefout. */
const PORTIE_MAX = 12;
const PORTIEFOUT = `Dagdoelen zijn hele getallen van 0 tot en met ${PORTIE_MAX}.`;

/** De string[]-velden van AIProfile — één tekstvak per veld, één item per regel (A7). */
type LijstVeld = {
  [K in keyof AIProfile]: AIProfile[K] extends string[] ? K : never;
}[keyof AIProfile];

const LIJSTVELDEN: { key: LijstVeld; label: string }[] = [
  { key: 'doelen', label: 'Doelen' },
  { key: 'knelpunten', label: 'Knelpunten' },
  { key: 'voorkeuren', label: 'Voorkeuren' },
  { key: 'beperkingen', label: 'Beperkingen' },
  { key: 'checkinRitme', label: 'Check-in-ritme' },
];

const VEILIGHEID: { waarde: Veiligheidsvlag; label: string }[] = [
  { waarde: 'geen', label: 'Geen — speelt niet' },
  { waarde: 'soms', label: 'Soms — houd er rekening mee' },
  { waarde: 'voorzichtig', label: 'Voorzichtig — gevoelig onderwerp' },
  { waarde: 'overgeslagen', label: 'Overgeslagen — vraag niet beantwoord' },
];

/** Alles als tekst: een half getypt getal is geen `number`, en `''` is geen 0. */
type Formulier = Record<LijstVeld, string> & {
  portiedoelen: Record<HandKey, string>;
  aanpak: string;
  toon: string;
  vermijdenInCoaching: string;
  veiligheidsvlag: Veiligheidsvlag;
};

export default function ProfielPagina() {
  // Client-side route (A2): het id komt uit de URL, niet uit server-params.
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const klantStand = useKlant(clientId);
  const profiel = useProfielVersies(clientId);
  const { actief, versies, slaOp } = profiel;

  const [form, setForm] = useState<Formulier>(() => naarFormulier(leegProfiel()));
  const [validatieFout, setValidatieFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  // Vanaf welke versie het formulier gevuld is. Bij een andere klant of een nieuwe
  // hoogste versie (eigen opslag, of een herlaad na een botsing) vullen we opnieuw:
  // het formulier hoort altijd te tonen wat er nú in de database staat.
  const [bron, setBron] = useState<string | null>(null);
  const sleutel = profiel.laden ? null : `${clientId}:${actief?.versie ?? 0}`;
  if (sleutel !== null && sleutel !== bron) {
    // State bijstellen tijdens de render i.p.v. in een effect: zo is er geen frame
    // waarin het oude profiel in de velden staat (React: "You Might Not Need an Effect").
    setBron(sleutel);
    setForm(naarFormulier(actief?.profiel ?? leegProfiel()));
    setValidatieFout(null);
    // De succesmelding hoort juist bij de versie die het formulier nu vult (eigen
    // opslag); alleen bij een ándere klant is hij misplaatst.
    if (bron !== null && !bron.startsWith(`${clientId}:`)) setSucces(null);
  }

  function wijzig(muteer: (f: Formulier) => Formulier) {
    setForm(muteer);
    // Een melding over de vórige opslag hoort niet bij de tekst die er nu staat.
    setSucces(null);
    setValidatieFout(null);
  }

  /** Apart, want een berekende sleutel uit een union is geen `Partial<Formulier>`. */
  function zetLijst(key: LijstVeld, waarde: string) {
    wijzig((f) => {
      const kopie = { ...f };
      kopie[key] = waarde;
      return kopie;
    });
  }

  async function opOpslaan(e: FormEvent) {
    e.preventDefault();
    if (profiel.opslaanBezig) return;
    const portiedoelen = leesPortiedoelen(form.portiedoelen);
    if (!portiedoelen) {
      setSucces(null);
      setValidatieFout(PORTIEFOUT);
      return;
    }
    setValidatieFout(null);
    const versie = await slaOp({
      doelen: regels(form.doelen),
      portiedoelen,
      knelpunten: regels(form.knelpunten),
      voorkeuren: regels(form.voorkeuren),
      beperkingen: regels(form.beperkingen),
      checkinRitme: regels(form.checkinRitme),
      aanpak: form.aanpak.trim(),
      toon: form.toon.trim(),
      vermijdenInCoaching: form.vermijdenInCoaching.trim(),
      veiligheidsvlag: form.veiligheidsvlag,
    });
    setSucces(
      versie === null
        ? null
        : `Versie ${versie} opgeslagen — Lau gebruikt dit profiel vanaf het volgende bericht.`,
    );
  }

  if (klantStand.laden) return <Statuspagina>Bezig met laden…</Statuspagina>;

  if (klantStand.fout) {
    return <Statuspagina rol="alert">Deze klant laden lukte niet — herlaad de pagina.</Statuspagina>;
  }

  if (!klantStand.klant) {
    // RLS geeft 0 rijen voor een klant van een andere coach: niet te onderscheiden van
    // "bestaat niet", en dat hoeft ook niet — beide zijn voor Laura hetzelfde.
    return <Statuspagina>Klant niet gevonden.</Statuspagina>;
  }

  const klant = klantStand.klant;
  // Zonder betrouwbare versies géén formulier: op een lege standaard opslaan zou het
  // bestaande profiel stilletjes vervangen door een leeg exemplaar.
  const toonFormulier = !profiel.laden && (profiel.fout === null || versies.length > 0);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header>
        <Link
          href={`/klant/${clientId}`}
          className="text-sm text-body transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
        >
          ← Terug naar {klant.naam}
        </Link>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-ink">
          AI-profiel · {klant.naam}
        </h1>
        <p className="mt-1 text-sm text-body">
          {actief
            ? `Versie ${actief.versie} · ${datumLabel(actief.created_at)}`
            : profiel.laden
              ? 'Versies laden…'
              : 'Nog geen profiel — je slaat straks versie 1 op.'}
        </p>
      </header>

      {profiel.fout && (
        <div role="alert" className="mt-6 rounded-card border border-clay-border bg-clay-soft p-5">
          <p className="text-sm text-clay-ink">{profiel.fout}</p>
          <Knop
            variant="secundair"
            onClick={profiel.herlaad}
            disabled={profiel.bezig}
            className="mt-3"
          >
            {profiel.bezig ? 'Bezig…' : 'Opnieuw proberen'}
          </Knop>
        </div>
      )}

      {profiel.laden && <Skelet />}

      {toonFormulier && (
        <form onSubmit={opOpslaan} className="mt-8 flex flex-col gap-6">
          <Blok kop="Doelen en context">
            {LIJSTVELDEN.map(({ key, label }) => (
              <Lijstveld
                key={key}
                id={key}
                label={label}
                waarde={form[key]}
                opWijzig={(waarde) => zetLijst(key, waarde)}
              />
            ))}
          </Blok>

          <Blok kop="Dagdoelen">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {HANDMATEN.map((maat) => (
                <div key={maat.key} className="flex flex-col gap-1.5">
                  <label htmlFor={`portie-${maat.key}`} className="text-sm font-medium text-ink">
                    {maat.naam}
                  </label>
                  <span id={`portie-${maat.key}-hint`} className="text-xs text-body">
                    {maat.hand.toLowerCase()}
                  </span>
                  <input
                    id={`portie-${maat.key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={PORTIE_MAX}
                    step={1}
                    value={form.portiedoelen[maat.key]}
                    aria-describedby={`portie-${maat.key}-hint`}
                    onChange={(e) =>
                      wijzig((f) => ({
                        ...f,
                        portiedoelen: { ...f.portiedoelen, [maat.key]: e.target.value },
                      }))
                    }
                    className={`${veldBasis} tabular-nums`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-body">Handmaten per dag — hele getallen.</p>
          </Blok>

          <Blok kop="Coaching">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="aanpak" className="text-sm font-medium text-ink">
                Aanpak
              </label>
              <input
                id="aanpak"
                type="text"
                value={form.aanpak}
                onChange={(e) => wijzig((f) => ({ ...f, aanpak: e.target.value }))}
                className={veldBasis}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="toon" className="text-sm font-medium text-ink">
                Toon
              </label>
              <input
                id="toon"
                type="text"
                value={form.toon}
                onChange={(e) => wijzig((f) => ({ ...f, toon: e.target.value }))}
                className={veldBasis}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="veiligheidsvlag" className="text-sm font-medium text-ink">
                Veiligheidsvlag
              </label>
              <select
                id="veiligheidsvlag"
                value={form.veiligheidsvlag}
                onChange={(e) =>
                  wijzig((f) => ({ ...f, veiligheidsvlag: e.target.value as Veiligheidsvlag }))
                }
                className={veldBasis}
              >
                {VEILIGHEID.map((optie) => (
                  <option key={optie.waarde} value={optie.waarde}>
                    {optie.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vermijden" className="text-sm font-medium text-ink">
                Vermijden in coaching (BINDEND voor Lau)
              </label>
              <textarea
                id="vermijden"
                rows={3}
                value={form.vermijdenInCoaching}
                onChange={(e) => wijzig((f) => ({ ...f, vermijdenInCoaching: e.target.value }))}
                className={veld}
              />
            </div>
          </Blok>

          <div className="flex justify-end">
            <Knop type="submit" disabled={profiel.opslaanBezig}>
              {profiel.opslaanBezig ? 'Opslaan…' : 'Profiel opslaan'}
            </Knop>
          </div>

          {validatieFout && (
            <p role="alert" className="text-sm text-clay-ink">
              {validatieFout}
            </p>
          )}

          {profiel.opslaanFout && (
            <div role="alert" className="rounded-card border border-clay-border bg-clay-soft p-4">
              <p className="text-sm text-clay-ink">{profiel.opslaanFout}</p>
              {profiel.botsing && (
                // Herladen vult het formulier opnieuw met de versie die er nú staat —
                // opslaan bovenop een versie die je niet gezien hebt, is geen optie.
                <Knop
                  variant="secundair"
                  onClick={profiel.herlaad}
                  disabled={profiel.bezig}
                  className="mt-3"
                >
                  {profiel.bezig ? 'Bezig…' : 'Herlaad het profiel'}
                </Knop>
              )}
            </div>
          )}

          {succes && (
            <p role="status" className="text-sm text-sage-ink">
              {succes}
            </p>
          )}
        </form>
      )}

      <section aria-labelledby="historie-kop" className="mt-10 border-t border-hairline pt-6">
        <h2 id="historie-kop" className="text-xs tracking-[0.12em] text-body uppercase">
          Versiehistorie
        </h2>
        {versies.length === 0 ? (
          <p className="mt-3 text-sm text-body">
            {profiel.laden ? 'Versies laden…' : 'Nog geen versies.'}
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1.5">
            {versies.map((versie) => (
              <li key={versie.versie} className="flex flex-wrap items-center gap-x-2 text-sm text-body">
                <span className="text-ink tabular-nums">v{versie.versie}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={versie.created_at}>{datumLabel(versie.created_at)}</time>
                <span aria-hidden="true">·</span>
                <span>{versie.auteur}</span>
                {versie.versie === actief?.versie && (
                  <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px] text-sage-ink">
                    actief
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs leading-relaxed text-body">
          Elke opslag maakt een nieuwe versie; oude versies blijven staan als naslag.
          Terugzetten kan nog niet.
        </p>
      </section>
    </main>
  );
}

/** Gegroepeerde velden onder één kopje — zelfde kaartvorm als de zijbalk. */
function Blok({ kop, children }: { kop: string; children: ReactNode }) {
  const id = `blok-${kop.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-5"
    >
      <h2 id={id} className="text-xs tracking-[0.12em] text-body uppercase">
        {kop}
      </h2>
      {children}
    </section>
  );
}

function Lijstveld({
  id,
  label,
  waarde,
  opWijzig,
}: {
  id: string;
  label: string;
  waarde: string;
  opWijzig: (waarde: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <span id={`${id}-hint`} className="text-xs text-body">
        één per regel
      </span>
      <textarea
        id={id}
        rows={4}
        value={waarde}
        aria-describedby={`${id}-hint`}
        onChange={(e) => opWijzig(e.target.value)}
        className={veld}
      />
    </div>
  );
}

function Skelet() {
  return (
    <div className="mt-8 flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">Profiel laden…</span>
      {[280, 140, 220].map((hoogte) => (
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

/** Het profiel van een klant die nog geen versie heeft — de coach schrijft dan versie 1. */
function leegProfiel(): AIProfile {
  return {
    doelen: [],
    portiedoelen: { ...PORTIE_DOEL_DEFAULT },
    knelpunten: [],
    voorkeuren: [],
    beperkingen: [],
    checkinRitme: [],
    aanpak: '',
    toon: '',
    vermijdenInCoaching: '',
    veiligheidsvlag: 'overgeslagen',
  };
}

/**
 * Profiel → formulier. Het profiel komt uit jsonb: het type zegt niets over wat er
 * écht staat, dus elk veld valt terug op een lege waarde in plaats van "undefined"
 * in een tekstvak te laten belanden (en zo terug de database in te schrijven).
 */
function naarFormulier(profiel: AIProfile): Formulier {
  const portiedoelen = {} as Record<HandKey, string>;
  for (const { key } of HANDMATEN) {
    const n = Number(profiel.portiedoelen?.[key]);
    portiedoelen[key] = String(Number.isFinite(n) ? n : PORTIE_DOEL_DEFAULT[key]);
  }
  return {
    doelen: lijstTekst(profiel.doelen),
    knelpunten: lijstTekst(profiel.knelpunten),
    voorkeuren: lijstTekst(profiel.voorkeuren),
    beperkingen: lijstTekst(profiel.beperkingen),
    checkinRitme: lijstTekst(profiel.checkinRitme),
    portiedoelen,
    aanpak: tekst(profiel.aanpak),
    toon: tekst(profiel.toon),
    vermijdenInCoaching: tekst(profiel.vermijdenInCoaching),
    veiligheidsvlag: VEILIGHEID.some((o) => o.waarde === profiel.veiligheidsvlag)
      ? profiel.veiligheidsvlag
      : 'overgeslagen',
  };
}

function lijstTekst(waarde: string[]): string {
  if (!Array.isArray(waarde)) return '';
  return waarde.filter((r) => typeof r === 'string').join('\n');
}

function tekst(waarde: string): string {
  return typeof waarde === 'string' ? waarde : '';
}

/** Eén item per regel; lege regels en spaties verdwijnen — geen [''] in de database. */
function regels(waarde: string): string[] {
  return waarde
    .split('\n')
    .map((regel) => regel.trim())
    .filter((regel) => regel !== '');
}

/** null = ongeldig (leeg, geen geheel getal, of buiten 0…PORTIE_MAX). */
function leesPortiedoelen(waarden: Record<HandKey, string>): Porties | null {
  const uit = {} as Porties;
  for (const { key } of HANDMATEN) {
    const rauw = waarden[key].trim();
    // Number('') is 0 — een leeggemaakt veld mag geen stil dagdoel van 0 worden.
    if (rauw === '') return null;
    const n = Number(rauw);
    if (!Number.isInteger(n) || n < 0 || n > PORTIE_MAX) return null;
    uit[key] = n;
  }
  return uit;
}

/** "2 aug. 2026" — mét jaar: een versiehistorie loopt over jaargrenzen heen. */
function datumLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}
