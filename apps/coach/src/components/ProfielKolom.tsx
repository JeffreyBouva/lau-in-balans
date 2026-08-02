'use client';

import { useState, type ReactNode } from 'react';
import type { AIProfile, HandKey, Porties, Veiligheidsvlag } from '@lau/shared';
import { HANDMATEN, PORTIE_DOEL_DEFAULT } from '@lau/shared';
import { Knop } from '@/components/Knop';
import type { HandmaatGemiddelde } from '@/lib/hooks/useKlantContext';
import type { useProfielVersies } from '@/lib/hooks/useProfielVersies';

/** Ruim boven elk realistisch dagdoel; hoger is vrijwel altijd een typefout. */
const PORTIE_MAX = 12;
const PORTIEFOUT = `Dagdoelen zijn hele getallen van 0 tot en met ${PORTIE_MAX}.`;

const UITLEG =
  'Gestructureerde data, geen vrije tekst. Lau krijgt dit bij elk bericht mee — inclusief de portiedoelen.';

const veldTekst =
  'w-full resize-y rounded-control border border-hairline-soft bg-surface px-3.5 py-3 ' +
  'text-[13.5px] leading-[1.55] text-ink placeholder:text-muted focus:border-sage ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-sage/40';

const chipBasis =
  'rounded-full px-[13px] py-[7px] text-[12.5px] transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage';

/**
 * Chip-varianten uit §8. De mapping (plan Task 2) is bewust smal en uitlegbaar:
 * - `positief` — het eerste doel: dat is de kop van het traject.
 * - `letop` — een portiedoel waar het weekgemiddelde ónder blijft (daar moet Laura op
 *   sturen) en een beperking met "allergie" erin (veiligheid, guardrail 4).
 * - `neutraal` — al het overige. Liever te weinig kleur dan een kleur die niets betekent.
 */
type Variant = 'neutraal' | 'positief' | 'letop';

const CHIPSTIJL: Record<Variant, string> = {
  neutraal: 'bg-neutral-softer text-body',
  positief: 'bg-sage-soft text-sage-deep',
  // contrast-opvolgpunt: #93472B op #F6E7E0 ≈ 5,6:1 — ruim genoeg; hier alleen ter info.
  letop: 'bg-clay-soft text-clay-ink',
};

/** Weggeklikte chip: hij blijft staan (terugzetten moet kunnen), maar telt niet mee. */
const CHIP_UIT = 'bg-neutral-softer text-muted line-through';

/** De string[]-velden van AIProfile — in de UI één chip per item. */
type LijstVeld = 'doelen' | 'knelpunten' | 'voorkeuren' | 'beperkingen' | 'checkinRitme';

/** Eén chip: de waarde plus of hij ná opslaan nog in het profiel staat. */
type ChipItem = { waarde: string; aan: boolean };

/** Alles als tekst: een half getypt getal is geen `number`, en `''` is geen 0. */
type Formulier = Record<LijstVeld, ChipItem[]> & {
  portiedoelen: Record<HandKey, string>;
  aanpak: string;
  toon: string;
  vermijdenInCoaching: string;
  veiligheidsvlag: Veiligheidsvlag;
};

const VEILIGHEID: { waarde: Veiligheidsvlag; label: string }[] = [
  { waarde: 'geen', label: 'Speelt niet' },
  { waarde: 'soms', label: 'Soms — houd er rekening mee' },
  { waarde: 'voorzichtig', label: 'Voorzichtig — gevoelig' },
  { waarde: 'overgeslagen', label: 'Vraag overgeslagen' },
];

/**
 * Kolom 2 uit §8: het AI-profiel als bewerkbare chips en tekstvelden. Dit is de
 * personalisatielaag van de prompt van Lau — vandaar dat élke wijziging een nieuwe
 * versie is (useProfielVersies.slaOp) en niet een overschrijving.
 *
 * Deze kolom vervángt de losse /klant/[id]/profiel-route; die redirect hierheen.
 */
export function ProfielKolom({
  clientId,
  profiel,
  gemiddelden,
  dagenMetLog,
}: {
  /** Alleen voor de formulier-sleutel: bij een andere klant hoort het formulier opnieuw. */
  clientId: string;
  profiel: ReturnType<typeof useProfielVersies>;
  /** Weekgemiddelden per handmaat — bepalen welk portiedoel als "let op" leest. */
  gemiddelden: HandmaatGemiddelde[];
  dagenMetLog: number;
}) {
  const { actief, versies, slaOp } = profiel;

  const [form, setForm] = useState<Formulier>(() => naarFormulier(leegProfiel()));
  const [nieuweChip, setNieuweChip] = useState<Record<string, string>>({});
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
    setNieuweChip({});
    setValidatieFout(null);
    // De succesmelding hoort juist bij de versie die het formulier nu vult (eigen
    // opslag); alleen bij een ándere klant is hij misplaatst.
    if (bron !== null && !bron.startsWith(`${clientId}:`)) setSucces(null);
  }

  function wijzig(muteer: (f: Formulier) => Formulier) {
    setForm(muteer);
    // Een melding over de vórige opslag hoort niet bij wat er nu staat.
    setSucces(null);
    setValidatieFout(null);
  }

  /** Apart, want een berekende sleutel uit een union is geen `Partial<Formulier>`. */
  function zetLijst(key: LijstVeld, items: ChipItem[]) {
    wijzig((f) => {
      const kopie = { ...f };
      kopie[key] = items;
      return kopie;
    });
  }

  function toggle(key: LijstVeld, index: number) {
    zetLijst(
      key,
      form[key].map((item, i) => (i === index ? { ...item, aan: !item.aan } : item)),
    );
  }

  function voegToe(key: LijstVeld) {
    const waarde = (nieuweChip[key] ?? '').trim();
    if (waarde === '') return;
    // Dubbele waarde? Dan alleen de bestaande weer aanzetten — geen twee gelijke chips.
    const bestaat = form[key].findIndex((item) => item.waarde === waarde);
    zetLijst(
      key,
      bestaat === -1
        ? [...form[key], { waarde, aan: true }]
        : form[key].map((item, i) => (i === bestaat ? { ...item, aan: true } : item)),
    );
    setNieuweChip((n) => ({ ...n, [key]: '' }));
  }

  async function opOpslaan() {
    if (profiel.opslaanBezig) return;
    const nieuw = leesFormulier(form);
    if (!nieuw) {
      setSucces(null);
      setValidatieFout(PORTIEFOUT);
      return;
    }
    setValidatieFout(null);
    const versie = await slaOp(nieuw);
    setSucces(
      versie === null
        ? null
        : `Versie ${versie} opgeslagen — Lau gebruikt dit profiel vanaf het volgende bericht.`,
    );
  }

  // Zonder betrouwbare versies géén formulier: op een lege standaard opslaan zou het
  // bestaande profiel stilletjes vervangen door een leeg exemplaar.
  const toonFormulier = !profiel.laden && (profiel.fout === null || versies.length > 0);
  // Beide kanten door dezelfde molen: zo leest een profiel dat ongemoeid uit de database
  // komt nooit als "gewijzigd" door een trim of een ontbrekend portiedoel.
  const opgeslagenVorm = JSON.stringify(leesFormulier(naarFormulier(actief?.profiel ?? leegProfiel())));
  const bewaard = JSON.stringify(leesFormulier(form)) === opgeslagenVorm;

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-3">
        {/* contrast-opvolgpunt: #A3A59A op wit ≈ 2,5:1 — ontwerpwaarde voor de eyebrow. */}
        <h2 className="text-[11px] tracking-[0.12em] text-muted-softer uppercase">AI-profiel</h2>
        {toonFormulier && (
          // contrast-opvolgpunt: #63805F op wit ≈ 3,9:1 bij 12px — het ontwerp zet beide
          // savestatussen in sage; "niet bewaard" krijgt daarom geen eigen kleur.
          <p role="status" className="text-xs text-sage">
            {bewaard ? 'opgeslagen' : 'wijziging niet bewaard'}
          </p>
        )}
      </div>

      {/* flex-auto onder 1200px (gestapelde kolom zonder vaste hoogte), flex-1 daarboven
          waar dit gebied de resthoogte van de kolom vult en zelf scrollt. */}
      <div className="flex flex-auto flex-col gap-4 overflow-y-auto px-6 pt-1 pb-6 min-[1200px]:flex-1">
        {profiel.fout && (
          <div role="alert" className="rounded-input border border-clay-border bg-clay-soft p-4">
            <p className="text-[13px] text-clay-ink">{profiel.fout}</p>
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
          <>
            <Veld label="Doel">
              <Chiprij>
                {form.doelen.map((item, i) => (
                  <Chip
                    key={`${item.waarde}-${i}`}
                    label={item.waarde}
                    aan={item.aan}
                    // Het eerste doel is de kop van het traject → positief.
                    variant={i === 0 ? 'positief' : 'neutraal'}
                    opKlik={() => toggle('doelen', i)}
                  />
                ))}
                <ChipInvoer
                  veldnaam="Doel"
                  waarde={nieuweChip.doelen ?? ''}
                  opWijzig={(v) => setNieuweChip((n) => ({ ...n, doelen: v }))}
                  opBevestig={() => voegToe('doelen')}
                />
              </Chiprij>
            </Veld>

            <Veld label="Portiedoelen (handmaten, per dag)">
              <Chiprij>
                {HANDMATEN.map((maat) => {
                  const gem = gemiddelden.find((g) => g.key === maat.key);
                  const doel = Number(form.portiedoelen[maat.key]);
                  // Blijft het weekgemiddelde onder het doel, dan is dít het getal waar
                  // Laura op stuurt — zonder logs is er niets te oordelen.
                  const achter =
                    dagenMetLog > 0 && gem != null && Number.isFinite(doel) && gem.gemiddeld < doel;
                  return (
                    <span
                      key={maat.key}
                      className={`inline-flex items-center gap-1.5 ${chipBasis} ${
                        CHIPSTIJL[achter ? 'letop' : 'neutraal']
                      }`}
                    >
                      {/* Portiedoelen zijn getallen, geen vrije tekst: geen toggle maar
                          een klein invoerveldje in de chip zelf. */}
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Dagdoel ${maat.naam}`}
                        value={form.portiedoelen[maat.key]}
                        onChange={(e) =>
                          wijzig((f) => ({
                            ...f,
                            portiedoelen: { ...f.portiedoelen, [maat.key]: e.target.value },
                          }))
                        }
                        className="w-6 rounded-[4px] bg-surface/60 text-center tabular-nums outline-none focus:outline-2 focus:outline-offset-1 focus:outline-sage"
                      />
                      × {maat.hand.toLowerCase()} {maat.naam.toLowerCase()}
                    </span>
                  );
                })}
              </Chiprij>
            </Veld>

            <Lijstveld
              label="Knelpunt"
              items={form.knelpunten}
              variant={() => 'neutraal'}
              opToggle={(i) => toggle('knelpunten', i)}
              nieuw={nieuweChip.knelpunten ?? ''}
              opNieuw={(v) => setNieuweChip((n) => ({ ...n, knelpunten: v }))}
              opBevestig={() => voegToe('knelpunten')}
            />

            <Lijstveld
              label="Voorkeuren"
              items={form.voorkeuren}
              variant={() => 'neutraal'}
              opToggle={(i) => toggle('voorkeuren', i)}
              nieuw={nieuweChip.voorkeuren ?? ''}
              opNieuw={(v) => setNieuweChip((n) => ({ ...n, voorkeuren: v }))}
              opBevestig={() => voegToe('voorkeuren')}
            />

            <Lijstveld
              label="Beperkingen"
              items={form.beperkingen}
              // Allergieën zijn het enige in dit veld waar Lau nóóit langs mag.
              variant={(waarde) => (waarde.toLowerCase().includes('allergie') ? 'letop' : 'neutraal')}
              opToggle={(i) => toggle('beperkingen', i)}
              nieuw={nieuweChip.beperkingen ?? ''}
              opNieuw={(v) => setNieuweChip((n) => ({ ...n, beperkingen: v }))}
              opBevestig={() => voegToe('beperkingen')}
            />

            <Lijstveld
              label="Check-in ritme"
              items={form.checkinRitme}
              variant={() => 'neutraal'}
              opToggle={(i) => toggle('checkinRitme', i)}
              nieuw={nieuweChip.checkinRitme ?? ''}
              opNieuw={(v) => setNieuweChip((n) => ({ ...n, checkinRitme: v }))}
              opBevestig={() => voegToe('checkinRitme')}
            />

            <Tekstveld
              id="aanpak"
              label="Aanpak"
              waarde={form.aanpak}
              opWijzig={(v) => wijzig((f) => ({ ...f, aanpak: v }))}
            />
            <Tekstveld
              id="toon"
              label="Toon van coaching"
              waarde={form.toon}
              opWijzig={(v) => wijzig((f) => ({ ...f, toon: v }))}
            />
            <Tekstveld
              id="vermijden"
              label="Vermijden in coaching"
              waarde={form.vermijdenInCoaching}
              opWijzig={(v) => wijzig((f) => ({ ...f, vermijdenInCoaching: v }))}
            />

            {/* Niet in §8 getekend, maar wél in het profiel: zonder dit veld zou de
                veiligheidsvlag uit de onboarding bij elke opslag stilletjes terugvallen
                op "overgeslagen" — en dat raakt guardrail 4 (rode vlaggen). */}
            <Veld label="Veiligheidsvlag (eetstoornis / lichaamsbeeld)">
              <Chiprij>
                {VEILIGHEID.map((optie) => {
                  const gekozen = form.veiligheidsvlag === optie.waarde;
                  const variant: Variant =
                    optie.waarde === 'geen'
                      ? 'positief'
                      : optie.waarde === 'overgeslagen'
                        ? 'neutraal'
                        : 'letop';
                  return (
                    <button
                      key={optie.waarde}
                      type="button"
                      aria-pressed={gekozen}
                      onClick={() => wijzig((f) => ({ ...f, veiligheidsvlag: optie.waarde }))}
                      className={`${chipBasis} ${
                        gekozen ? CHIPSTIJL[variant] : 'border border-hairline-soft bg-surface text-muted'
                      }`}
                    >
                      {optie.label}
                    </button>
                  );
                })}
              </Chiprij>
            </Veld>

            <div className="flex items-center justify-end gap-3">
              <Knop onClick={() => void opOpslaan()} disabled={profiel.opslaanBezig}>
                {profiel.opslaanBezig ? 'Opslaan…' : 'Profiel opslaan'}
              </Knop>
            </div>

            {validatieFout && (
              <p role="alert" className="text-[12.5px] text-clay-ink">
                {validatieFout}
              </p>
            )}

            {profiel.opslaanFout && (
              <div role="alert" className="rounded-input border border-clay-border bg-clay-soft p-4">
                <p className="text-[13px] text-clay-ink">{profiel.opslaanFout}</p>
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
              <p role="status" className="text-[12.5px] text-sage-deep">
                {succes}
              </p>
            )}
          </>
        )}

        {/* contrast-opvolgpunt: #8C8F84 op #FBF9F5 ≈ 3,2:1 bij 12px — ontwerpwaarden. */}
        <p className="rounded-input border border-table-head bg-surface-sunken px-4 py-3.5 text-xs leading-[1.55] text-muted">
          {UITLEG}
        </p>

        <details className="text-[12.5px] text-body">
          <summary className="cursor-pointer rounded-full text-[11.5px] text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage">
            Versiehistorie{versies.length > 0 ? ` (${versies.length})` : ''}
          </summary>
          {versies.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted">
              {profiel.laden ? 'Versies laden…' : 'Nog geen versies.'}
            </p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1">
              {versies.map((versie) => (
                <li key={versie.versie} className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted">
                  <span className="text-body tabular-nums">v{versie.versie}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={versie.created_at}>{datumLabel(versie.created_at)}</time>
                  <span aria-hidden="true">·</span>
                  <span>{versie.auteur}</span>
                </li>
              ))}
            </ol>
          )}
        </details>
      </div>
    </>
  );
}

function Veld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px]">
      {/* contrast-opvolgpunt: #8C8F84 op wit ≈ 3,3:1 bij 12px — ontwerpwaarde. */}
      <p className="text-xs text-muted">{label}</p>
      {children}
    </div>
  );
}

function Chiprij({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-[7px]">{children}</div>;
}

function Chip({
  label,
  aan,
  variant,
  opKlik,
}: {
  label: string;
  aan: boolean;
  variant: Variant;
  opKlik: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={aan}
      onClick={opKlik}
      className={`${chipBasis} ${aan ? CHIPSTIJL[variant] : CHIP_UIT}`}
    >
      {label}
      <span className="sr-only">
        {aan ? ' — staat in het profiel, klik om weg te halen' : ' — weggehaald, klik om terug te zetten'}
      </span>
    </button>
  );
}

/** Nieuwe waarde toevoegen: Enter bevestigt, en wegklikken ook — anders raakt het kwijt. */
function ChipInvoer({
  veldnaam,
  waarde,
  opWijzig,
  opBevestig,
}: {
  /** Het zichtbare label van het veld, voor een leesbaar aria-label. */
  veldnaam: string;
  waarde: string;
  opWijzig: (waarde: string) => void;
  opBevestig: () => void;
}) {
  return (
    <input
      type="text"
      aria-label={`Toevoegen aan ${veldnaam.toLowerCase()}`}
      value={waarde}
      onChange={(e) => opWijzig(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          opBevestig();
        }
      }}
      onBlur={opBevestig}
      placeholder="+ toevoegen"
      className="w-[116px] rounded-full border border-dashed border-hairline bg-surface px-[13px] py-[7px] text-[12.5px] text-ink placeholder:text-muted focus:border-solid focus:border-sage focus:outline-none"
    />
  );
}

function Lijstveld({
  label,
  items,
  variant,
  opToggle,
  nieuw,
  opNieuw,
  opBevestig,
}: {
  label: string;
  items: ChipItem[];
  variant: (waarde: string, index: number) => Variant;
  opToggle: (index: number) => void;
  nieuw: string;
  opNieuw: (waarde: string) => void;
  opBevestig: () => void;
}) {
  return (
    <Veld label={label}>
      <Chiprij>
        {items.map((item, i) => (
          <Chip
            key={`${item.waarde}-${i}`}
            label={item.waarde}
            aan={item.aan}
            variant={variant(item.waarde, i)}
            opKlik={() => opToggle(i)}
          />
        ))}
        <ChipInvoer veldnaam={label} waarde={nieuw} opWijzig={opNieuw} opBevestig={opBevestig} />
      </Chiprij>
    </Veld>
  );
}

function Tekstveld({
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
    <div className="flex flex-col gap-[7px]">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <textarea
        id={id}
        value={waarde}
        onChange={(e) => opWijzig(e.target.value)}
        className={`${veldTekst} min-h-[62px]`}
      />
    </div>
  );
}

function Skelet() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Profiel laden…</span>
      {[64, 64, 92].map((hoogte, i) => (
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
 * in een veld te laten belanden (en zo terug de database in te schrijven).
 */
function naarFormulier(profiel: AIProfile): Formulier {
  const portiedoelen = {} as Record<HandKey, string>;
  for (const { key } of HANDMATEN) {
    const n = Number(profiel.portiedoelen?.[key]);
    portiedoelen[key] = String(Number.isFinite(n) ? n : PORTIE_DOEL_DEFAULT[key]);
  }
  return {
    doelen: chips(profiel.doelen),
    knelpunten: chips(profiel.knelpunten),
    voorkeuren: chips(profiel.voorkeuren),
    beperkingen: chips(profiel.beperkingen),
    checkinRitme: chips(profiel.checkinRitme),
    portiedoelen,
    aanpak: tekst(profiel.aanpak),
    toon: tekst(profiel.toon),
    vermijdenInCoaching: tekst(profiel.vermijdenInCoaching),
    veiligheidsvlag: VEILIGHEID.some((o) => o.waarde === profiel.veiligheidsvlag)
      ? profiel.veiligheidsvlag
      : 'overgeslagen',
  };
}

/** Formulier → profiel; null = ongeldige portiedoelen (zie `leesPortiedoelen`). */
function leesFormulier(form: Formulier): AIProfile | null {
  const portiedoelen = leesPortiedoelen(form.portiedoelen);
  if (!portiedoelen) return null;
  return {
    doelen: aanstaand(form.doelen),
    portiedoelen,
    knelpunten: aanstaand(form.knelpunten),
    voorkeuren: aanstaand(form.voorkeuren),
    beperkingen: aanstaand(form.beperkingen),
    checkinRitme: aanstaand(form.checkinRitme),
    aanpak: form.aanpak.trim(),
    toon: form.toon.trim(),
    vermijdenInCoaching: form.vermijdenInCoaching.trim(),
    veiligheidsvlag: form.veiligheidsvlag,
  };
}

function chips(waarde: string[]): ChipItem[] {
  if (!Array.isArray(waarde)) return [];
  return waarde
    .filter((r): r is string => typeof r === 'string' && r.trim() !== '')
    .map((r) => ({ waarde: r.trim(), aan: true }));
}

/** Alleen de chips die aan staan gaan de nieuwe versie in. */
function aanstaand(items: ChipItem[]): string[] {
  return items.filter((item) => item.aan).map((item) => item.waarde);
}

function tekst(waarde: string): string {
  return typeof waarde === 'string' ? waarde : '';
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
