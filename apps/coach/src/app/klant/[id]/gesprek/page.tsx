'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { vandaagISO, weekNummer } from '@lau/shared';
import { HandmatenKaart } from '@/components/HandmatenKaart';
import { Knop } from '@/components/Knop';
import { Statuspagina } from '@/components/Statuspagina';
import { useKlant } from '@/lib/hooks/useKlant';
import { useKlantContext, type HandmaatGemiddelde } from '@/lib/hooks/useKlantContext';
import {
  isToepasbaar,
  RODE_VLAG,
  SIGNAALOPTIES,
  useGesprek,
  VELDLABEL,
  type Voorstel,
} from '@/lib/hooks/useGesprek';
import { voornaam as eersteNaam } from '@/lib/naam';

/* Kaartvorm uit §9: wit, rand, radius 20, padding 24. */
const KAART = 'flex flex-col gap-[18px] rounded-card-lg border border-hairline-soft bg-surface p-6';
/* contrast-opvolgpunt: #A3A59A op wit ≈ 2,5:1 bij 11px — ontwerpwaarde voor de eyebrow. */
const EYEBROW = 'text-[11px] tracking-[0.12em] text-muted-softer uppercase';
const VELDLABEL_STIJL = 'text-[13px] text-body-soft';

const chipBasis =
  'rounded-full border px-[15px] py-[9px] text-[12.5px] transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ' +
  'disabled:cursor-not-allowed disabled:opacity-70';

const actiePil =
  'rounded-full px-[15px] py-[9px] text-[12.5px] transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Het wekelijkse gesprek (§9): de belangrijkste coach-flow. Laura legt vast wat er in de
 * videocall gezegd is, Lau stelt profielwijzigingen voor, Laura beslist — en hoort vóór
 * het opslaan hoe Lau maandagochtend gaat klinken.
 */
export default function GesprekPagina() {
  // Client-side route (A2): het id komt uit de URL, niet uit server-params.
  const { id } = useParams<{ id: string }>();
  const clientId = id ?? '';
  const router = useRouter();
  const klantStand = useKlant(clientId);
  const context = useKlantContext(clientId);
  const gesprek = useGesprek(clientId);

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
  const voornaam = eersteNaam(klant.naam);
  const week = weekNummer(klant.startdatum, vandaagISO());

  const {
    notitie,
    zetNotitie,
    signalen,
    wisselSignaal,
    voorstellen,
    preview,
    opgeslagen,
    nogNietBeschikbaar,
  } = gesprek;
  const heeftNotitie = notitie.trim() !== '';
  // Na het vastleggen verandert er niets meer aan de sessie-rij; velden die dan nog
  // bewerkbaar lijken zouden wijzigingen beloven die nergens meer heen gaan. Hetzelfde
  // slot gaat erop zodra de profielversie geschreven is (en alleen de sessie-rij nog
  // moet): die besluiten staan dan al in het profiel en kunnen niet meer terug.
  const opSlot = opgeslagen || gesprek.versieGeschreven;

  async function opAfsluiten() {
    // §9: eerste klik legt vast, tweede klik gaat terug naar het klantdetail.
    if (opgeslagen) {
      router.push(`/klant/${clientId}`);
      return;
    }
    await gesprek.legVast();
  }

  return (
    <main className="px-10 pt-[30px] pb-12">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
        <header className="flex items-center gap-4">
          <Link
            href={`/klant/${clientId}`}
            aria-label={`Terug naar het dossier van ${klant.naam}`}
            className="flex size-9 flex-none items-center justify-center rounded-full border border-hairline bg-surface text-[15px] text-body transition-colors duration-150 hover:border-hairline-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
          >
            <span aria-hidden="true">←</span>
          </Link>
          <div className="flex min-w-0 flex-col gap-1">
            {/* contrast-opvolgpunt: #A3A59A op cream ≈ 2,4:1 bij 11px — ontwerpwaarde. */}
            <p className="truncate text-[11px] tracking-[0.14em] text-muted-softer uppercase">
              Wekelijks gesprek · {klant.naam}
            </p>
            <h1 className="font-serif text-[26px] tracking-[-0.01em] text-ink">
              Week {week} · videocall van 30 minuten, net afgerond
            </h1>
          </div>
        </header>

        {/* Onder ~900px past 1fr 1fr niet meer; het dashboard is voor 1400px ontworpen
            (handoff §Frames), dus daaronder stapelen de twee kolommen gewoon. */}
        <div className="grid items-start gap-[22px] min-[900px]:grid-cols-2">
          {/* ── Links · stap 1 ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-[18px]">
            <section aria-labelledby="vastleggen-kop" className={KAART}>
              <h2 id="vastleggen-kop" className={EYEBROW}>
                1 · Vastleggen
              </h2>

              <div className="flex flex-col gap-2">
                <label htmlFor="gesprek-notitie" className={VELDLABEL_STIJL}>
                  Wat kwam er uit het gesprek?
                </label>
                <textarea
                  id="gesprek-notitie"
                  value={notitie}
                  onChange={(e) => zetNotitie(e.target.value)}
                  readOnly={opSlot}
                  placeholder="Wat viel op, wat zei ze zelf, waar loopt ze tegenaan…"
                  className="min-h-[200px] w-full resize-y rounded-input border border-hairline-soft bg-surface-sunken px-[17px] py-[15px] text-[14px] leading-[1.65] text-ink placeholder:text-muted read-only:text-body focus:border-sage focus:outline-2 focus:outline-offset-0 focus:outline-sage/40"
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <p className={VELDLABEL_STIJL} id="signalen-kop">
                  Wat viel op
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="signalen-kop">
                  {SIGNAALOPTIES.map((label) => {
                    const aan = signalen.includes(label);
                    // De rode vlag is geen gewoon signaal: clay is in dit dashboard de
                    // kleur van coach-aandacht, en dit is het signaal dat in productie de
                    // escalatie-flow aanzet (buiten scope, zie de spec).
                    const rood = label === RODE_VLAG;
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={aan}
                        disabled={opSlot}
                        onClick={() => wisselSignaal(label)}
                        className={`${chipBasis} ${
                          aan
                            ? rood
                              ? 'border-clay bg-clay-soft text-clay-ink'
                              : 'border-sage bg-sage-soft text-sage-deep'
                            : 'border-hairline-soft bg-surface text-body-soft hover:border-hairline-hover'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section aria-labelledby="logs-kop" className={`${KAART} gap-3.5`}>
              <h2 id="logs-kop" className={EYEBROW}>
                Wat de logs zeggen
              </h2>

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
                <div
                  aria-busy="true"
                  className="h-[168px] animate-pulse rounded-input border border-hairline-soft bg-surface-sunken"
                >
                  <span className="sr-only">Weekbeeld laden…</span>
                </div>
              ) : (
                <>
                  {/* Kaal: de kop staat al op deze kaart en de slotzin hieronder is de
                      §9-variant — de eigen voetnoot van de kaart zou hem herhalen. */}
                  <HandmatenKaart
                    gemiddelden={context.gemiddelden}
                    dagenMetLog={context.dagenMetLog}
                    variant="kaal"
                  />
                  {/* contrast-opvolgpunt: #A3A59A op wit ≈ 2,5:1 bij 12,5px — ontwerpwaarde. */}
                  <p className="text-[12.5px] leading-[1.55] text-muted-softer">
                    {logsZin(context.gemiddelden, context.dagenMetLog, context.dagen.length)}
                  </p>
                </>
              )}
            </section>
          </div>

          {/* ── Rechts · stap 2 en 3 ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-[18px]">
            <section aria-labelledby="bijstellen-kop" className={`${KAART} gap-4`}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="bijstellen-kop" className={EYEBROW}>
                  2 · Lau bijstellen
                </h2>
                <p className="text-xs text-muted-softer">
                  {voorstellen === null || voorstellen.length === 0
                    ? 'nog geen voorstellen'
                    : gesprek.aantalBeslisbaar === 0
                      ? 'niets om te beslissen'
                      : `${gesprek.aantalToegepast} van ${gesprek.aantalBeslisbaar} toegepast`}
                </p>
              </div>

              <p className="text-[13.5px] leading-[1.6] text-body-soft">
                Op basis van je notities en de logs. Jij beslist wat er in het profiel van{' '}
                {voornaam} verandert.
              </p>

              {voorstellen !== null && voorstellen.length > 0 && (
                <ol className="flex flex-col gap-3">
                  {voorstellen.map((voorstel, i) => (
                    <VoorstelKaart
                      key={`${voorstel.veld}-${i}`}
                      voorstel={voorstel}
                      opSlot={opSlot}
                      opBesluit={(besluit) => gesprek.beslis(i, besluit)}
                    />
                  ))}
                </ol>
              )}

              {voorstellen !== null && voorstellen.length === 0 && (
                <p className="rounded-input border border-dashed border-hairline px-5 py-6 text-center text-[13px] text-muted">
                  Lau zag in deze notitie geen aanleiding om het profiel bij te stellen.
                </p>
              )}

              {/* De knop verdwijnt zodra er voorstellen staan: een tweede ronde zou de
                  besluiten die Laura net genomen heeft overschrijven. */}
              {(voorstellen === null || voorstellen.length === 0) && !opSlot && (
                <div className="flex flex-col gap-2">
                  <Knop
                    onClick={() => void gesprek.haalVoorstellen()}
                    disabled={!heeftNotitie || gesprek.voorstellenBezig || nogNietBeschikbaar}
                    className="self-start"
                  >
                    {gesprek.voorstellenBezig ? 'Lau denkt na…' : 'Voorstellen ophalen'}
                  </Knop>
                  {!heeftNotitie && (
                    <p className="text-[12.5px] text-muted">
                      Schrijf eerst je notitie — de voorstellen bouwen daarop.
                    </p>
                  )}
                </div>
              )}

              {nogNietBeschikbaar && (
                <p role="status" className="text-[12.5px] leading-[1.5] text-muted">
                  {gesprek.nogNietMelding} Vastleggen kan wel: je notitie en signalen worden
                  gewoon bewaard.
                </p>
              )}

              {gesprek.voorstellenFout && (
                <p role="alert" className="text-[12.5px] text-clay-ink">
                  {gesprek.voorstellenFout}
                </p>
              )}
            </section>

            {/* ── Stap 3 · prompt-preview ──────────────────────────────────────── */}
            <section
              aria-labelledby="preview-kop"
              className="flex flex-col gap-3 rounded-card-lg bg-sage-soft p-6"
            >
              <h2
                id="preview-kop"
                className="text-[11px] tracking-[0.12em] text-sage-mid uppercase"
              >
                3 · Zo klinkt Lau maandagochtend
              </h2>

              <p className="rounded-[18px_18px_18px_5px] bg-surface px-[18px] py-4 font-serif text-[18px] leading-[1.5] text-pretty text-sage-ink">
                {preview?.opening ??
                  (preview === null
                    ? 'Ververs de preview om te horen hoe Lau gaat klinken.'
                    : 'Het model gaf geen opening terug — de volledige prompt staat er wel.')}
              </p>

              {/* contrast-opvolgpunt: #4C6749 op #E7EEE3 ≈ 4,9:1 — ruim genoeg. */}
              <p className="text-[12.5px] leading-[1.6] text-sage-deep">
                {previewToelichting(voorstellen, gesprek.aantalToegepast, preview !== null)}
                {gesprek.previewVerouderd &&
                  ' Je hebt hierna nog iets aangepast — ververs om het effect te horen.'}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void gesprek.haalPreview()}
                  disabled={
                    gesprek.previewBezig || nogNietBeschikbaar || gesprek.profiel.laden
                  }
                  className={`${actiePil} border border-sage-soft-border bg-surface text-sage-deep hover:border-sage`}
                >
                  {gesprek.previewBezig ? 'Lau schrijft…' : 'Ververs preview'}
                </button>
                {nogNietBeschikbaar && (
                  <span className="text-[12.5px] text-sage-deep">{gesprek.nogNietMelding}</span>
                )}
              </div>

              {gesprek.previewFout && (
                <p role="alert" className="text-[12.5px] text-clay-ink">
                  {gesprek.previewFout}
                </p>
              )}

              {/* E3: Jeffrey wil de prompts kunnen zien. Het ontwerp toont alleen de
                  gesimuleerde opening; de rauwe prompt zit hieronder weggevouwen. */}
              {preview !== null && preview.systemPrompt !== '' && (
                <details className="rounded-input bg-surface/60 px-3 py-2">
                  <summary className="cursor-pointer rounded-full text-[12px] text-sage-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage">
                    Bekijk de volledige prompt
                  </summary>
                  <pre className="mt-2 max-h-[280px] overflow-auto rounded-input bg-surface p-3 font-mono text-[11.5px] leading-[1.5] whitespace-pre-wrap text-body">
                    {preview.systemPrompt}
                  </pre>
                </details>
              )}

              <button
                type="button"
                onClick={() => void opAfsluiten()}
                disabled={(!heeftNotitie && !opgeslagen) || gesprek.vastleggenBezig}
                className="mt-1.5 self-start rounded-full bg-sage-deep px-5 py-3 text-[13.5px] text-white transition-colors duration-150 hover:bg-sage-deeper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gesprek.vastleggenBezig
                  ? 'Vastleggen…'
                  : opgeslagen
                    ? 'Opgeslagen — Lau is bijgesteld'
                    : `Vastleggen en terug naar ${voornaam}`}
              </button>

              {!heeftNotitie && !opgeslagen && (
                <p className="text-[12.5px] text-sage-deep">
                  Een sessie zonder notitie legt niets vast — schrijf eerst wat er besproken is.
                </p>
              )}

              {opgeslagen && (
                <p role="status" className="text-[12.5px] leading-[1.6] text-sage-deep">
                  {gesprek.nieuweVersie === null
                    ? 'Vastgelegd. Er is niets aan het profiel veranderd.'
                    : `Vastgelegd. Lau werkt vanaf het volgende bericht met versie ${gesprek.nieuweVersie}.`}{' '}
                  Klik nog een keer om terug te gaan naar {voornaam}.
                </p>
              )}

              {gesprek.vastlegFout && (
                <p role="alert" className="text-[12.5px] leading-[1.6] text-clay-ink">
                  {gesprek.vastlegFout}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Eén voorstel uit §9: veldnaam, de nieuwe waarde, de oude doorgestreept — en de
 * beslissing van Laura. Een genomen besluit blijft klikbaar (de statuspil ís de knop):
 * een misklik op "Overslaan" mag geen herlaad kosten, want dat kost de notitie.
 */
function VoorstelKaart({
  voorstel,
  opSlot,
  opBesluit,
}: {
  voorstel: Voorstel;
  opSlot: boolean;
  opBesluit: (besluit: 'toegepast' | 'overgeslagen' | 'open') => void;
}) {
  const toegepast = voorstel.besluit === 'toegepast';
  const beslist = voorstel.besluit !== 'open';
  const toepasbaar = isToepasbaar(voorstel.veld);

  return (
    <li
      className={`flex flex-col gap-3 rounded-[16px] border px-[18px] py-4 ${
        toegepast ? 'border-sage-soft-border bg-sage-tint' : 'border-table-head bg-surface-sunken'
      }`}
    >
      <div className="flex flex-col gap-[7px]">
        {/* contrast-opvolgpunt: #8C8F84 op #FBF9F5 ≈ 3,2:1 bij 12px — ontwerpwaarde. */}
        <p className="text-xs text-muted">{VELDLABEL[voorstel.veld] ?? voorstel.veld}</p>
        <p className="text-[14px] leading-[1.55] text-ink">{voorstel.nieuw}</p>
        {voorstel.oud !== '' && (
          // contrast-opvolgpunt: #A3A59A ≈ 2,5:1 bij 12,5px — ontwerpwaarde; de oude
          // waarde is bewust de zwakste regel van de kaart.
          <p className="text-[12.5px] leading-[1.5] text-muted-softer line-through">
            {voorstel.oud}
          </p>
        )}
        {voorstel.toelichting !== '' && (
          // Niet in §9 getekend, wél het antwoord op "waarom stelt Lau dit voor" — zonder
          // die regel beslist Laura op een zin zonder onderbouwing.
          <p className="text-[12px] leading-[1.5] text-body-soft">{voorstel.toelichting}</p>
        )}
      </div>

      {!toepasbaar ? (
        // Portiedoelen (en veldnamen die niet in het profiel bestaan) zijn toon-only:
        // getallen verschuiven is een bewust besluit in kolom 2 van het klantdossier,
        // niet iets wat via een zin in een voorstel de database in glijdt.
        <p className="text-[12px] leading-[1.5] text-muted">
          Ter info — dit veld stel je bewust bij in het profiel van de klant.
        </p>
      ) : beslist ? (
        <button
          type="button"
          onClick={() => opBesluit('open')}
          disabled={opSlot}
          className={`self-start rounded-full px-[14px] py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:cursor-default ${
            toegepast ? 'bg-sage-soft text-sage-deep' : 'bg-neutral-softer text-muted'
          }`}
        >
          {toegepast ? 'Toegepast in profiel' : 'Overgeslagen'}
          {!opSlot && <span className="sr-only"> — klik om opnieuw te beslissen</span>}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => opBesluit('toegepast')}
            disabled={opSlot}
            className={`${actiePil} bg-sage text-white hover:bg-sage-hover`}
          >
            Toepassen
          </button>
          <button
            type="button"
            onClick={() => opBesluit('overgeslagen')}
            disabled={opSlot}
            className={`${actiePil} border border-hairline bg-surface text-muted hover:border-hairline-hover`}
          >
            Overslaan
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * De regel onder de bubbel (§9). Het ontwerp schrijft hier per-voorstel-copy voor, maar
 * de voorstellen zijn AI-gegenereerd (E4): welke velden er langskomen staat niet vast.
 * Vandaar dezelfde boodschap, opgebouwd uit wat Laura daadwerkelijk heeft toegepast.
 */
function previewToelichting(
  voorstellen: Voorstel[] | null,
  aantalToegepast: number,
  gehaald: boolean,
): string {
  if (!gehaald) {
    return 'Deze preview draait door dezelfde prompt-pipeline als de echte Lau — je hoort dus wat de klant maandag hoort.';
  }
  if (aantalToegepast === 0) {
    return 'Let op: je hebt nog niets toegepast, dus dit is Lau zoals hij nú al klinkt.';
  }
  const velden = (voorstellen ?? [])
    .filter((v) => v.besluit === 'toegepast')
    .map((v) => (VELDLABEL[v.veld] ?? v.veld).toLowerCase());
  return `Met je ${aantalToegepast === 1 ? 'wijziging' : `${aantalToegepast} wijzigingen`} in ${lijstZin(velden)}.`;
}

/** "doel, knelpunt en toon van coaching" — een opsomming die als zin leest. */
function lijstZin(delen: string[]): string {
  if (delen.length <= 1) return delen[0] ?? '';
  return `${delen.slice(0, -1).join(', ')} en ${delen[delen.length - 1]}`;
}

/**
 * "Vijf van zeven dagen gelogd. Eiwit zit gemiddeld 0,9 handpalm onder het dagdoel."
 * Bewust een andere invalshoek dan de voetnoot in de handmaten-kaart (die benoemt de
 * zwakste én de sterkste): hier gaat het om hoeveel er te zien is en hoe groot het gat is.
 */
function logsZin(
  gemiddelden: HandmaatGemiddelde[],
  dagenMetLog: number,
  aantalDagen: number,
): string {
  if (dagenMetLog === 0) {
    return 'Deze week nog niets gelogd — er is geen weekbeeld om dit gesprek op te baseren.';
  }
  const start = `${dagenMetLog} van de ${aantalDagen} dagen gelogd.`;
  // Het grootste gat in handmaten, niet in procenten: Laura praat met de klant over
  // "een halve handpalm meer", niet over een percentage.
  const achter = gemiddelden
    .filter((m) => m.gemiddeld < m.doel)
    .sort((a, b) => b.doel - b.gemiddeld - (a.doel - a.gemiddeld))[0];
  if (!achter) return `${start} Alle handmaten zitten op of boven het dagdoel.`;
  return `${start} ${achter.naam} zit gemiddeld ${getal(achter.doel - achter.gemiddeld)} ${achter.hand.toLowerCase()} onder het dagdoel.`;
}

/** NL-notatie met komma, één decimaal — zelfde vorm als de pills in de handmaten-kaart. */
function getal(waarde: number): string {
  return waarde.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
