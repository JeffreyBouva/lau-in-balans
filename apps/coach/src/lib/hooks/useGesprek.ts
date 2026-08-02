'use client';

import { useCallback, useRef, useState } from 'react';
import type { AIProfile, HandKey, Porties, Veiligheidsvlag } from '@lau/shared';
import { HANDMATEN, PORTIE_DOEL_DEFAULT } from '@lau/shared';
import { supabase } from '@/lib/supabase';
import { useProfielVersies } from '@/lib/hooks/useProfielVersies';

/** Max drie voorstellen per gesprek — §9 tekent er drie, Task 4 vraagt het model om drie. */
const MAX_VOORSTELLEN = 3;

const VOORSTELFOUT = 'De voorstellen ophalen lukte niet — probeer het opnieuw.';
const PREVIEWFOUT = 'De preview ophalen lukte niet — probeer het opnieuw.';
const VASTLEGFOUT = 'Het gesprek vastleggen lukte niet — probeer het opnieuw.';
const PROFIELLAADFOUT =
  'Het profiel is niet geladen — herlaad de pagina voordat je wijzigingen toepast.';
const PROFIELSCHRIJFFOUT =
  'De profielwijzigingen opslaan lukte niet — mogelijk is er net een nieuwe versie ' +
  'opgeslagen. Herlaad de pagina en probeer het opnieuw. Er is nog niets vastgelegd.';
/** Zolang `sessie-voorstellen` en `prompt-preview` niet gedeployed zijn (Task 4). */
const NOG_NIET = 'Beschikbaar na deploy van de nieuwe functions.';

/**
 * De zes signalen uit §9 als vaste set. Bewust géén vrije tekst: dit veld is bedoeld om
 * over sessies heen te kunnen tellen ("hoe vaak was gewicht gevoelig?"), en dat kan
 * alleen met een gesloten vocabulaire. Wat hier niet in past hoort in de notitie.
 */
export const SIGNAALOPTIES = [
  'Trots op avondroutine',
  'Donderdag knelpunt',
  'Eiwit blijft achter',
  'Gewicht is gevoelig',
  'Wil concrete maaltijd',
  'Rode vlag',
] as const;

/**
 * De clay-chip uit §9. Markeert het signaal; de escalatie-flow (doorverwijzing
 * behandelaar) is bewust buiten scope — zie de spec.
 */
export const RODE_VLAG = 'Rode vlag';

/** De string[]-velden van AIProfile: een voorstel levert ze als '·'-gejoinde string aan. */
const LIJSTVELDEN = ['doelen', 'knelpunten', 'voorkeuren', 'beperkingen', 'checkinRitme'] as const;
/** De vrije-tekstvelden: de nieuwe waarde is de tekst zelf. */
const TEKSTVELDEN = ['aanpak', 'toon', 'vermijdenInCoaching'] as const;

type LijstVeld = (typeof LIJSTVELDEN)[number];
type TekstVeld = (typeof TEKSTVELDEN)[number];

/** Veldnaam uit de function → het label dat kolom 2 van §8 gebruikt. */
export const VELDLABEL: Record<string, string> = {
  doelen: 'Doel',
  portiedoelen: 'Portiedoelen (handmaten, per dag)',
  knelpunten: 'Knelpunt',
  voorkeuren: 'Voorkeuren',
  beperkingen: 'Beperkingen',
  checkinRitme: 'Check-in ritme',
  aanpak: 'Aanpak',
  toon: 'Toon van coaching',
  vermijdenInCoaching: 'Vermijden in coaching',
};

export type Besluit = 'open' | 'toegepast' | 'overgeslagen';

export type Voorstel = {
  /** Veldnaam uit de vaste enum van `sessie-voorstellen`; onbekend = alleen tonen. */
  veld: string;
  /** De huidige waarde zoals het model die zag; mag leeg zijn (veld was nog leeg). */
  oud: string;
  nieuw: string;
  toelichting: string;
  besluit: Besluit;
};

export type Preview = {
  /** De volledige systemprompt die Lau krijgt — E3: Jeffrey wil de prompts kunnen zien. */
  systemPrompt: string;
  /** Het gesimuleerde openingsbericht; null als het model niets bruikbaars gaf. */
  opening: string | null;
};

/**
 * Kan dit voorstel automatisch in het profiel gezet worden?
 *
 * `portiedoelen` bewust niet: dat zijn getallen, en een dagdoel verschuiven is een
 * besluit dat Laura in kolom 2 van het klantdetail neemt — niet iets wat via een
 * zin-in-een-voorstel de database in glipt. Onbekende velden net zo: als het model een
 * veldnaam verzint die niet in AIProfile bestaat, tonen we hem wél (het kan een zinnige
 * observatie zijn) maar schrijven we niets.
 */
export function isToepasbaar(veld: string): boolean {
  return isLijstVeld(veld) || isTekstVeld(veld);
}

function isLijstVeld(veld: string): veld is LijstVeld {
  return (LIJSTVELDEN as readonly string[]).includes(veld);
}

function isTekstVeld(veld: string): veld is TekstVeld {
  return (TEKSTVELDEN as readonly string[]).includes(veld);
}

/**
 * Plafonds gelijk aan het klant-pad (`werk_mijn_profiel_bij`, fase 7): 20 items van elk
 * hoogstens 200 tekens. Dit profiel gaat bij élk bericht mee in Lau's systemprompt, en
 * een uitgelopen lijst zou daar de context vullen. De coach-kant schrijft rechtstreeks
 * in `ai_profile_versions` en heeft dus geen database-cap die dit voor haar doet.
 */
const MAX_ITEMS = 20;
const MAX_ITEM = 200;

/**
 * '·'-gejoinde string → lijst. Dat is het formaat waarin de function lijstvelden
 * aanlevert (Task 4), precies zodat een voorstel één leesbare regel blijft.
 *
 * Ook op •, puntkomma en regeleinde: dat is wat een model ervan maakt als het de
 * opdracht net anders leest, en dan hoort elk item een eigen chip te worden in plaats
 * van één regel met scheidingstekens erin.
 */
function naarLijst(waarde: string): string[] {
  return waarde
    .split(/[·•\n;]/)
    .map((deel) => deel.trim().slice(0, MAX_ITEM))
    .filter((deel) => deel !== '')
    .slice(0, MAX_ITEMS);
}

/**
 * Herkent "deze function bestaat nog niet op dit project" — dan is Task 4 nog niet
 * gedeployed. supabase-js geeft bij een non-2xx een FunctionsHttpError terug waarvan
 * `context` de fetch-Response is (zelfde truc als `isLimiet` in de app), en een
 * onbekende function-naam levert een 404. Bewust smal: een 500 uit de function zelf is
 * een storing, geen ontbrekende deploy.
 */
function nietGedeployed(error: unknown): boolean {
  return (error as { context?: { status?: unknown } } | null | undefined)?.context?.status === 404;
}

function tekst(waarde: unknown): string {
  return typeof waarde === 'string' ? waarde.trim() : '';
}

/** Response van `sessie-voorstellen` → voorstellen. Defensief: dit komt uit een LLM. */
function leesVoorstellen(data: unknown): Voorstel[] {
  const rauw = (data as { voorstellen?: unknown } | null)?.voorstellen;
  if (!Array.isArray(rauw)) return [];
  return rauw.slice(0, MAX_VOORSTELLEN).flatMap((item): Voorstel[] => {
    const v = (item ?? {}) as Record<string, unknown>;
    const veld = tekst(v.veld);
    const nieuw = tekst(v.nieuw);
    // Zonder veld of zonder nieuwe waarde valt er niets te beslissen.
    if (veld === '' || nieuw === '') return [];
    return [{ veld, oud: tekst(v.oud), nieuw, toelichting: tekst(v.toelichting), besluit: 'open' }];
  });
}

const VEILIG: Veiligheidsvlag[] = ['geen', 'soms', 'voorzichtig', 'overgeslagen'];

function lijst(waarde: unknown): string[] {
  if (!Array.isArray(waarde)) return [];
  return waarde
    .filter((r): r is string => typeof r === 'string' && r.trim() !== '')
    .map((r) => r.trim());
}

/** Ontbrekende of onzinnige dagdoelen → de standaard; nooit NaN de database in. */
function porties(waarde: unknown): Porties {
  const bron = (waarde ?? {}) as Partial<Record<HandKey, unknown>>;
  const uit = { ...PORTIE_DOEL_DEFAULT };
  for (const { key } of HANDMATEN) {
    const n = Number(bron[key]);
    if (Number.isFinite(n)) uit[key] = n;
  }
  return uit;
}

/** Het profiel van een klant die nog geen versie heeft — dan schrijft dit de eerste. */
export function leegProfiel(): AIProfile {
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
 * Het conceptprofiel: de hoogste versie met de toegepaste voorstellen erop. Dit is wat
 * de preview te horen krijgt én wat er bij vastleggen als nieuwe versie in gaat — één
 * mapping voor beide, zodat Laura nooit iets anders opslaat dan ze gehoord heeft.
 *
 * De basis gaat eerst door dezelfde molen als in kolom 2: het profiel komt uit jsonb, en
 * een ontbrekend veld mag geen `undefined` worden dat we zo weer terugschrijven.
 */
export function bouwConcept(basis: AIProfile, voorstellen: Voorstel[]): AIProfile {
  const concept: AIProfile = {
    doelen: lijst(basis.doelen),
    portiedoelen: porties(basis.portiedoelen),
    knelpunten: lijst(basis.knelpunten),
    voorkeuren: lijst(basis.voorkeuren),
    beperkingen: lijst(basis.beperkingen),
    checkinRitme: lijst(basis.checkinRitme),
    aanpak: tekst(basis.aanpak),
    toon: tekst(basis.toon),
    vermijdenInCoaching: tekst(basis.vermijdenInCoaching),
    // De veiligheidsvlag komt uit de onboarding en hoort nooit via een gespreksvoorstel
    // te bewegen — hij wordt hier alleen ongeschonden doorgegeven.
    veiligheidsvlag: VEILIG.includes(basis.veiligheidsvlag) ? basis.veiligheidsvlag : 'overgeslagen',
  };
  for (const voorstel of voorstellen) {
    if (voorstel.besluit !== 'toegepast') continue;
    if (isLijstVeld(voorstel.veld)) concept[voorstel.veld] = naarLijst(voorstel.nieuw);
    else if (isTekstVeld(voorstel.veld)) concept[voorstel.veld] = voorstel.nieuw.trim();
    // portiedoelen en onbekende velden: zie isToepasbaar — die kaarten zijn toon-only.
  }
  return concept;
}

/**
 * Het wekelijkse gesprek (§9): wat Laura vastlegt, wat Lau daarvan voorstelt, en wat
 * daarvan écht in het profiel belandt.
 *
 * De twee AI-stappen lopen via edge functions (Task 4). Zolang die niet gedeployed zijn
 * geeft Supabase een 404 en toont de pagina dat als een bekende tussenstand — niet als
 * storing. Vastleggen werkt sowieso zónder AI: notitie + signalen is een volwaardige
 * sessie.
 */
export function useGesprek(clientId: string) {
  const profiel = useProfielVersies(clientId);

  const [notitie, zetNotitie] = useState('');
  const [signalen, setSignalen] = useState<string[]>([]);
  // null = nog niet opgehaald; [] = opgehaald en het model zag geen wijziging.
  const [voorstellen, setVoorstellen] = useState<Voorstel[] | null>(null);
  const [voorstellenBezig, setVoorstellenBezig] = useState(false);
  const [voorstellenFout, setVoorstellenFout] = useState<string | null>(null);

  const [preview, setPreview] = useState<Preview | null>(null);
  // Het conceptprofiel waarop de laatste preview gemaakt is — zo is te zien wanneer een
  // toggle de preview achterhaald heeft (E8: verversen kost tokens, dus alleen op de knop).
  const [previewBasis, setPreviewBasis] = useState<string | null>(null);
  const [previewBezig, setPreviewBezig] = useState(false);
  const [previewFout, setPreviewFout] = useState<string | null>(null);

  /** Eén vlag voor beide functions: ze horen bij dezelfde deploy. */
  const [nogNietBeschikbaar, setNogNiet] = useState(false);

  const [vastleggenBezig, setVastleggenBezig] = useState(false);
  const [vastlegFout, setVastlegFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);
  // De profielversie is geschreven, de sessie-rij (nog) niet. Vanaf dat moment liggen de
  // besluiten vast: een omgezet besluit zou bij een tweede poging een TWEEDE versie
  // bovenop de eerste zetten, want dan past de sleutel van `geschrevenRef` niet meer.
  const [versieGeschreven, setVersieGeschreven] = useState(false);
  /** Het versienummer dat dit gesprek opleverde; null = er is niets aan het profiel veranderd. */
  const [nieuweVersie, setNieuweVersie] = useState<number | null>(null);

  // Dubbelklik-guards in refs: de bezig-states zijn er voor de knoppen, maar die zijn
  // pas ná de re-render zichtbaar in deze closures.
  const voorstellenRef = useRef(false);
  const previewRef = useRef(false);
  const vastRef = useRef(false);
  // Wat een eerdere (half mislukte) vastlegpoging al als profielversie wegschreef. Zonder
  // dit zou een tweede klik ná een mislukte sessie-insert een tweede, identieke versie
  // maken. Op sleutel, want tussen twee pogingen kan Laura nog een voorstel toepassen.
  const geschrevenRef = useRef<{ sleutel: string; versie: number; id: string | null } | null>(null);

  const toegepast = (voorstellen ?? []).filter((v) => v.besluit === 'toegepast');
  const basisProfiel = profiel.actief?.profiel ?? null;
  /** null zolang het profiel laadt: dan valt er niets te previewen of op te slaan. */
  const conceptProfiel =
    profiel.laden ? null : bouwConcept(basisProfiel ?? leegProfiel(), toegepast);
  const previewVerouderd =
    preview !== null && conceptProfiel !== null && JSON.stringify(conceptProfiel) !== previewBasis;

  const wisselSignaal = useCallback((label: string) => {
    setSignalen((s) => (s.includes(label) ? s.filter((v) => v !== label) : [...s, label]));
  }, []);

  const beslis = useCallback((index: number, besluit: Besluit) => {
    setVoorstellen((v) => (v === null ? v : v.map((r, i) => (i === index ? { ...r, besluit } : r))));
  }, []);

  const haalVoorstellen = useCallback(async () => {
    const schoon = notitie.trim();
    // De knop is dan al disabled; dit is het vangnet. Zonder notitie heeft het model
    // niets om op te bouwen en zou het puur de logs gaan interpreteren.
    if (voorstellenRef.current || schoon === '') return;

    voorstellenRef.current = true;
    setVoorstellenBezig(true);
    setVoorstellenFout(null);

    const roep = () =>
      supabase.functions.invoke('sessie-voorstellen', {
        body: { client_id: clientId, notitie: schoon, signalen },
      });
    let { data, error } = await roep();
    if (error && !nietGedeployed(error)) {
      // Vrijwel altijd een verlopen token (laptop uit slaapstand) → sessie verversen en
      // precies één keer opnieuw proberen. Bij een ontbrekende deploy heeft dat geen zin.
      await supabase.auth.refreshSession();
      ({ data, error } = await roep());
    }

    voorstellenRef.current = false;
    setVoorstellenBezig(false);

    if (error) {
      if (nietGedeployed(error)) {
        setNogNiet(true);
        return;
      }
      // Nooit stil falen: Laura moet zien dat er géén voorstellen zijn, niet dat er
      // geen wijzigingen nodig waren.
      console.error('[gesprek] voorstellen ophalen mislukt:', error.message);
      setVoorstellenFout(VOORSTELFOUT);
      return;
    }

    setNogNiet(false);
    setVoorstellen(leesVoorstellen(data));
  }, [clientId, notitie, signalen]);

  const haalPreview = useCallback(async () => {
    if (previewRef.current || conceptProfiel === null) return;

    previewRef.current = true;
    setPreviewBezig(true);
    setPreviewFout(null);

    // Het concept van dít moment vastpinnen: tussen de invoke en het antwoord kan Laura
    // al een voorstel toegepast hebben, en dan hoort de preview meteen als achterhaald
    // te lezen in plaats van bij de nieuwe stand te worden gehangen.
    const concept = conceptProfiel;
    const roep = () =>
      supabase.functions.invoke('prompt-preview', {
        body: { client_id: clientId, concept_profiel: concept },
      });
    let { data, error } = await roep();
    if (error && !nietGedeployed(error)) {
      await supabase.auth.refreshSession();
      ({ data, error } = await roep());
    }

    previewRef.current = false;
    setPreviewBezig(false);

    if (error) {
      if (nietGedeployed(error)) {
        setNogNiet(true);
        return;
      }
      console.error('[gesprek] preview ophalen mislukt:', error.message);
      setPreviewFout(PREVIEWFOUT);
      return;
    }

    const d = (data ?? {}) as { systemPrompt?: unknown; opening?: unknown };
    const systemPrompt = typeof d.systemPrompt === 'string' ? d.systemPrompt : '';
    const opening = tekst(d.opening);
    if (systemPrompt === '' && opening === '') {
      console.error('[gesprek] preview leeg:', data);
      setPreviewFout(PREVIEWFOUT);
      return;
    }

    setNogNiet(false);
    setPreview({ systemPrompt, opening: opening === '' ? null : opening });
    setPreviewBasis(JSON.stringify(concept));
  }, [clientId, conceptProfiel]);

  /**
   * Het gesprek vastleggen: eerst de toegepaste voorstellen als één nieuwe profielversie,
   * dan de sessie-rij met de verwijzing daarnaartoe. In die volgorde, want een sessie die
   * naar een niet-bestaande versie wijst is erger dan een versie zonder sessie-rij.
   *
   * true = vastgelegd (de knop mag door naar het klantdetail).
   */
  const legVast = useCallback(async (): Promise<boolean> => {
    const schoon = notitie.trim();
    // Al vastgelegd: nog een keer inserten zou een tweede sessie voor dezelfde week
    // opleveren. De knop navigeert dan (zie de pagina).
    if (vastRef.current || opgeslagen || schoon === '') return false;

    const alle = voorstellen ?? [];
    const toepassingen = alle.filter((v) => v.besluit === 'toegepast' && isToepasbaar(v.veld));

    vastRef.current = true;
    setVastleggenBezig(true);
    setVastlegFout(null);

    const klaar = () => {
      vastRef.current = false;
      setVastleggenBezig(false);
    };

    let versieId: string | null = null;
    let versie: number | null = null;
    if (toepassingen.length > 0) {
      const sleutel = JSON.stringify(toepassingen);
      const eerder = geschrevenRef.current;
      if (eerder !== null && eerder.sleutel === sleutel) {
        // Deze wijzigingen staan al in het profiel (een eerdere poging strandde pas op de
        // sessie-rij) — nog een keer opslaan zou een identieke versie toevoegen.
        versie = eerder.versie;
        versieId = eerder.id;
      } else if (profiel.laden || (basisProfiel === null && profiel.fout !== null)) {
        // Zonder betrouwbaar profiel géén nieuwe versie: die zou het bestaande profiel
        // stilletjes vervangen door een bijna leeg exemplaar.
        klaar();
        setVastlegFout(PROFIELLAADFOUT);
        return false;
      } else {
        versie = await profiel.slaOp(bouwConcept(basisProfiel ?? leegProfiel(), toepassingen));
        if (versie === null) {
          // Waarom geen onderscheid tussen botsing en storing: `profiel.botsing` is in deze
          // closure nog de waarde van vóór de opslag. Eén eerlijke melding die beide dekt —
          // en er is nog niets vastgelegd, dus opnieuw proberen is veilig.
          klaar();
          setVastlegFout(PROFIELSCHRIJFFOUT);
          return false;
        }
        versieId = await haalVersieId(clientId, versie);
        geschrevenRef.current = { sleutel, versie, id: versieId };
        // Meteen op slot: deze besluiten staan nu in het profiel. Faalt de sessie-rij
        // hierna, dan doet een retry alléén die insert opnieuw (zie de sleutel-check).
        setVersieGeschreven(true);
      }
    }

    const rij = {
      client_id: clientId,
      notitie: schoon,
      signalen,
      // Mét besluit per voorstel: over een maand is "wat heeft Lau voorgesteld en wat
      // heeft Laura ermee gedaan" de interessante vraag, niet alleen de uitkomst.
      voorstellen: alle,
      resulting_profile_version: versieId,
    };
    const plaats = () => supabase.from('weekly_sessions').insert(rij).select('id');
    let { data, error } = await plaats();
    if (error) {
      await supabase.auth.refreshSession();
      ({ data, error } = await plaats());
    }

    klaar();

    // LET OP: een door RLS geweigerde insert kan 0 rijen teruggeven i.p.v. een fout —
    // zonder deze telling zou een mislukte vastlegging als succes op het scherm komen.
    if (error || (data ?? []).length === 0) {
      console.error('[gesprek] vastleggen mislukt:', error?.message ?? '0 rijen geraakt');
      // De profielversie staat er dan wél al. Dat is de goede kant om op te falen: de
      // bijstelling van Lau is het doel, de sessie-rij is de administratie eromheen.
      setVastlegFout(
        versie === null
          ? VASTLEGFOUT
          : `${VASTLEGFOUT} De profielwijzigingen staan wél in versie ${versie}.`,
      );
      return false;
    }

    setNieuweVersie(versie);
    setOpgeslagen(true);
    return true;
  }, [basisProfiel, clientId, notitie, opgeslagen, profiel, signalen, voorstellen]);

  return {
    notitie,
    zetNotitie,
    signalen,
    wisselSignaal,
    voorstellen,
    haalVoorstellen,
    voorstellenBezig,
    voorstellenFout,
    beslis,
    aantalToegepast: toegepast.length,
    /**
     * De noemer van de teller: alleen voorstellen waar Laura écht een besluit over neemt.
     * `sessie-voorstellen` levert alleen toepasbare velden, maar een oudere deploy (of een
     * model dat een veldnaam verzint) zou anders een kaart meetellen die geen knoppen heeft
     * — en dan haalt "3 van 3 toegepast" nooit zijn eigen noemer.
     */
    aantalBeslisbaar: (voorstellen ?? []).filter((v) => isToepasbaar(v.veld)).length,
    preview,
    haalPreview,
    previewBezig,
    previewFout,
    /** true = er is sinds de laatste preview een besluit gewijzigd (E8: geen live preview). */
    previewVerouderd,
    /** true = `sessie-voorstellen`/`prompt-preview` staan nog niet op dit project. */
    nogNietBeschikbaar,
    nogNietMelding: NOG_NIET,
    legVast,
    vastleggenBezig,
    vastlegFout,
    opgeslagen,
    /** true = de profielversie staat er al; de besluiten liggen vast (zie de state). */
    versieGeschreven,
    nieuweVersie,
    /** De profielversies van deze klant — de pagina toont er de laad-/foutstaat van. */
    profiel,
  };
}

/**
 * Het uuid van een zojuist geschreven versie; `slaOp` geeft alleen het nummer terug.
 * null = niet gevonden — de versie ís dan opgeslagen, alleen de verwijzing in de
 * sessie-rij blijft leeg. Dat is het lichtste van de mogelijke gebreken hier.
 */
async function haalVersieId(clientId: string, versie: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('ai_profile_versions')
    .select('id')
    // client_id-filter is nodig: RLS geeft de coach de profielen van ál haar klanten.
    .eq('client_id', clientId)
    .eq('versie', versie)
    .maybeSingle();
  if (error || !data) {
    console.error('[gesprek] versie-id ophalen mislukt:', error?.message ?? 'geen rij terug');
    return null;
  }
  return (data as { id: string }).id;
}
