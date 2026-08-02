'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIProfile, HandKey, Porties } from '@lau/shared';
import { HANDMATEN, LEGE_PORTIES, PORTIE_DOEL_DEFAULT, naarISODatum, telPortiesOp } from '@lau/shared';
import { supabase } from '@/lib/supabase';
import { useCoach } from '@/lib/coach';

/** Zeven dagen: de voedingsweek in de zijbalk kijkt precies zo ver terug als de app. */
const VENSTER = 7;
/** Ruim boven wat Laura in één blik leest; oudere notities horen in het klantdossier. */
const NOTITIE_LIMIET = 20;

const LAADFOUT = 'De klantcontext laden lukte niet — probeer opnieuw.';
const FLAGFOUT = 'Deze flag afronden lukte niet — probeer het opnieuw.';
const NOTITIEFOUT = 'Je notitie opslaan lukte niet — probeer het opnieuw.';

export type OpenFlag = {
  id: string;
  /** Mag leeg zijn: de klant kan om Laura vragen zonder toelichting. */
  tekst: string | null;
  redenen: string[];
  created_at: string;
};

export type Notitie = { id: string; datum: string; tekst: string };

/** Eén kolom in de voedingsweek: hoeveel handmaten er die dag gelogd zijn. */
export type Voedingsdag = {
  /** ISO-datum (YYYY-MM-DD), lokale kalenderdag. */
  datum: string;
  totaal: number;
  /** Er staat een log voor deze dag — ook als de porties samen 0 zijn. */
  gelogd: boolean;
};

export type HandmaatGemiddelde = {
  key: HandKey;
  naam: string;
  kleur: string;
  /** Gemiddelde per gelogde dag — niet per kalenderdag (zie `aggregeer`). */
  gemiddeld: number;
  /** Dagdoel uit de hoogste profielversie, niet het statische dagdoel uit HANDMATEN. */
  doel: number;
};

type Context = {
  flags: OpenFlag[];
  dagen: Voedingsdag[];
  gemiddelden: HandmaatGemiddelde[];
  dagenMetLog: number;
  notities: Notitie[];
  /** Nummer van de hoogste (= actieve) profielversie; null zonder profiel. */
  profielVersie: number | null;
};

/**
 * Alles wat aan één klant hangt in één state-object, getagd met de clientId waarvoor
 * het opgehaald is. Next hergebruikt de pagina als alléén [id] verandert, dus zonder
 * die tag zouden de flags van de vorige klant even in het nieuwe scherm staan
 * (zelfde truc als in useKlantChat).
 */
type Stand = Context & { clientId: string; fout: string | null };

type LogRij = { datum: string; porties: unknown };

/** De laatste n kalenderdagen, oud → nieuw, eindigend op vandaag (lokale tijd). */
function laatsteDagen(n: number): string[] {
  const uit: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    uit.push(naarISODatum(d));
  }
  return uit;
}

/**
 * `porties` en `portiedoelen` komen uit jsonb: het type zegt niets over wat er echt
 * staat. Ontbrekende of onzinnige waarden vallen terug op `standaard` i.p.v. NaN in
 * de staafjes te laten belanden.
 */
function veiligePorties(waarde: unknown, standaard: Porties): Porties {
  const bron = (waarde ?? {}) as Partial<Record<HandKey, unknown>>;
  const uit = { ...standaard };
  for (const { key } of HANDMATEN) {
    const n = Number(bron[key]);
    if (Number.isFinite(n)) uit[key] = n;
  }
  return uit;
}

/**
 * Kleine lokale reduce — bewust niet gedeeld met apps/mobile: die rekent per dag voor
 * de klant zelf, hier gaat het om een weekbeeld voor de coach.
 *
 * Gemiddelde per handmaat over de dagen mét log, niet over alle zeven: "gemiddeld 1
 * handpalm eiwit op de dagen dat je logt" is coachbare informatie, terwijl delen door
 * 7 vooral meet hoe vaak er gelogd is — dat staat al in `dagenMetLog`.
 */
function aggregeer(
  rijen: LogRij[],
  venster: string[],
  doelen: Porties,
): Omit<Context, 'flags' | 'notities' | 'profielVersie'> {
  const perDag = new Map<string, Porties>(venster.map((datum) => [datum, { ...LEGE_PORTIES }]));
  const gelogd = new Set<string>();
  for (const rij of rijen) {
    const som = perDag.get(rij.datum);
    // Buiten het venster (server- en clientdatum kunnen rond middernacht uiteenlopen).
    if (!som) continue;
    perDag.set(rij.datum, telPortiesOp(som, veiligePorties(rij.porties, LEGE_PORTIES)));
    gelogd.add(rij.datum);
  }

  const dagen = venster.map((datum) => {
    const porties = perDag.get(datum) ?? LEGE_PORTIES;
    return {
      datum,
      totaal: HANDMATEN.reduce((t, h) => t + porties[h.key], 0),
      gelogd: gelogd.has(datum),
    };
  });

  const dagenMetLog = gelogd.size;
  const gemiddelden = HANDMATEN.map((h) => {
    const som = venster.reduce(
      (t, datum) => t + (gelogd.has(datum) ? (perDag.get(datum) ?? LEGE_PORTIES)[h.key] : 0),
      0,
    );
    return {
      key: h.key,
      naam: h.naam,
      kleur: h.kleur,
      gemiddeld: dagenMetLog > 0 ? som / dagenMetLog : 0,
      doel: doelen[h.key],
    };
  });

  return { dagen, gemiddelden, dagenMetLog };
}

/** Lege week met de standaarddoelen — de stand vóór (of ná een mislukte) fetch. */
function legeContext(): Context {
  return {
    flags: [],
    notities: [],
    profielVersie: null,
    ...aggregeer([], laatsteDagen(VENSTER), PORTIE_DOEL_DEFAULT),
  };
}

/**
 * Vier lichte query's parallel (A11: zes klanten, geen view-optimalisatie). Gooit door
 * bij élke fout: een mislukte deelquery zou anders als "geen flags" of "niets gelogd"
 * op het scherm belanden — precies het soort stilte waar een coach op afgaat.
 */
async function haalContext(clientId: string): Promise<Context> {
  const venster = laatsteDagen(VENSTER);
  const [flags, logs, profiel, notities] = await Promise.all([
    supabase
      .from('flags')
      .select('id, tekst, redenen, created_at')
      .eq('client_id', clientId)
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    // client_id-filter is hier wél nodig: RLS geeft de coach álle logs van ál haar klanten.
    supabase
      .from('food_logs')
      .select('datum, porties')
      .eq('client_id', clientId)
      .gte('datum', venster[0]),
    supabase
      .from('ai_profile_versions')
      // `versie` erbij voor de profielkaart in de zijbalk — dezelfde rij, geen extra query.
      .select('versie, profiel')
      .eq('client_id', clientId)
      .order('versie', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('coach_notes')
      .select('id, datum, tekst')
      .eq('client_id', clientId)
      .order('datum', { ascending: false })
      // Twee notities op dezelfde dag houden zo een vaste volgorde (datum is een date).
      .order('created_at', { ascending: false })
      .limit(NOTITIE_LIMIET),
  ]);
  if (flags.error) throw flags.error;
  if (logs.error) throw logs.error;
  if (profiel.error) throw profiel.error;
  if (notities.error) throw notities.error;

  // Nog geen profiel (klant midden in de onboarding) → de standaarddoelen.
  const profielRij = profiel.data as { versie: number; profiel: AIProfile } | null;
  const doelen = veiligePorties(profielRij?.profiel?.portiedoelen, PORTIE_DOEL_DEFAULT);

  return {
    flags: (flags.data ?? []) as OpenFlag[],
    notities: (notities.data ?? []) as Notitie[],
    profielVersie: profielRij?.versie ?? null,
    ...aggregeer((logs.data ?? []) as LogRij[], venster, doelen),
  };
}

/**
 * De context-zijbalk van één klant: open flags (live), de voedingsweek en de notities.
 *
 * Flags hebben realtime nodig — een klant die om Laura vraagt terwijl het scherm
 * openstaat, mag niet wachten op een refresh. Eén tik herlaadt het hele blok: bij vier
 * lichte query's weegt één code-pad zwaarder dan het uitsparen van drie requests.
 */
export function useKlantContext(clientId: string) {
  const { coach } = useCoach();
  const coachId = coach?.id ?? null;

  const [stand, setStand] = useState<Stand | null>(null);
  const [bezig, setBezig] = useState(false);
  // Ophogen = opnieuw ophalen. Via een teller i.p.v. een callback die zelf fetcht,
  // zodat élke laadbeurt dezelfde weg loopt en de effect-cleanup de race-guard is.
  const [tik, setTik] = useState(0);

  const [bezigeFlag, setBezigeFlag] = useState<string | null>(null);
  const [flagFout, setFlagFout] = useState<string | null>(null);
  const [notitieBezig, setNotitieBezig] = useState(false);
  const [notitieFout, setNotitieFout] = useState<string | null>(null);

  const actueel = stand?.clientId === clientId ? stand : null;

  useEffect(() => {
    let geldig = true;
    (async () => {
      try {
        const context = await haalContext(clientId);
        if (!geldig) return;
        setStand({ clientId, ...context, fout: null });
      } catch (e) {
        console.error('[klantcontext] laden mislukt:', e);
        if (!geldig) return;
        // Ook bij een storing een stand wegschrijven: anders blijft `laden` true en
        // hangt de zijbalk eeuwig op de skeleton. Een mislukte retry laat de laatst
        // bekende stand staan, mét melding erboven.
        setStand((s) =>
          s?.clientId === clientId
            ? { ...s, fout: LAADFOUT }
            : { clientId, ...legeContext(), fout: LAADFOUT },
        );
      } finally {
        if (geldig) setBezig(false);
      }
    })();
    return () => {
      // Nieuwe beurt (tik), andere klant of unmount: dit antwoord telt niet meer.
      geldig = false;
    };
  }, [clientId, tik]);

  useEffect(() => {
    const topic = `dash-flags:${clientId}`;
    // Ruim een achtergebleven kanaal met dezelfde topic op (Fast Refresh / dubbele
    // mount in StrictMode), anders gooit supabase-js "cannot add postgres_changes
    // callbacks after subscribe()".
    supabase
      .getChannels()
      .filter((c) => c.topic === `realtime:${topic}`)
      .forEach((c) => supabase.removeChannel(c));
    const kanaal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flags', filter: `client_id=eq.${clientId}` },
        () => {
          // Elk event (nieuwe flag, elders afgerond) → verse stand. De payload zelf
          // volgen zou een tweede waarheid opleveren voor één rij per dag.
          setTik((t) => t + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [clientId]);

  const herlaad = useCallback(() => {
    setBezig(true);
    setTik((t) => t + 1);
  }, []);

  // Dubbelklik-guards in refs: de bezig-states zijn er voor de knoppen, maar die zijn
  // pas ná de re-render zichtbaar in deze closures.
  const flagRef = useRef(false);
  const notitieRef = useRef(false);

  /** true = afgerond (de kaart verdwijnt uit de open-lijst). */
  const rondFlagAf = useCallback(
    async (flagId: string): Promise<boolean> => {
      if (flagRef.current) return false;
      if (!coachId) {
        // Kan alleen als de sessie onder Laura's voeten wegvalt; nooit stil laten.
        setFlagFout(FLAGFOUT);
        return false;
      }
      flagRef.current = true;
      setBezigeFlag(flagId);
      setFlagFout(null);

      // Exact de drie velden die de policy eist (status + resolved_by = auth.uid() +
      // resolved_at not null); `status = 'open'` in de USING-kant maakt afronden
      // idempotent, dus filteren we er zelf ook op.
      const rond = () =>
        supabase
          .from('flags')
          .update({
            status: 'resolved',
            resolved_by: coachId,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', flagId)
          .eq('status', 'open')
          .select('id');
      let { data, error } = await rond();
      if (error) {
        // Vrijwel altijd een verlopen token (laptop uit slaapstand) → sessie verversen
        // en precies één keer opnieuw proberen.
        await supabase.auth.refreshSession();
        ({ data, error } = await rond());
      }

      flagRef.current = false;
      setBezigeFlag(null);
      // LET OP: een door RLS geweigerde update geeft géén error maar 0 rijen — zonder
      // deze telling zou een mislukte afronding als succes op het scherm komen.
      if (error || (data ?? []).length === 0) {
        console.error('[klantcontext] flag afronden mislukt:', error?.message ?? '0 rijen geraakt');
        setFlagFout(FLAGFOUT);
        return false;
      }

      // Meteen weghalen; het realtime-event dat hierop volgt herlaadt toch al.
      setStand((s) =>
        s?.clientId === clientId ? { ...s, flags: s.flags.filter((f) => f.id !== flagId) } : s,
      );
      return true;
    },
    [clientId, coachId],
  );

  /** true = opgeslagen (het formulier mag de textarea leegmaken). */
  const voegNotitieToe = useCallback(
    async (tekst: string): Promise<boolean> => {
      const schoon = tekst.trim();
      if (!schoon || notitieRef.current) return false;
      notitieRef.current = true;
      setNotitieBezig(true);
      setNotitieFout(null);

      // `datum` en `type` hebben defaults in de DB (vandaag in Europe/Amsterdam, 'los').
      const plaats = () =>
        supabase
          .from('coach_notes')
          .insert({ client_id: clientId, tekst: schoon })
          .select('id, datum, tekst')
          .single();
      let { data, error } = await plaats();
      if (error) {
        await supabase.auth.refreshSession();
        ({ data, error } = await plaats());
      }

      notitieRef.current = false;
      setNotitieBezig(false);
      if (error || !data) {
        // Nooit stil falen: Laura moet zien dat haar notitie níet bewaard is.
        console.error('[klantcontext] notitie opslaan mislukt:', error?.message);
        setNotitieFout(NOTITIEFOUT);
        return false;
      }

      const rij = data as Notitie;
      // Vooraan: de lijst staat op datum aflopend en dit is de nieuwste.
      setStand((s) =>
        s?.clientId === clientId ? { ...s, notities: [rij, ...s.notities] } : s,
      );
      return true;
    },
    [clientId],
  );

  return {
    flags: actueel?.flags ?? [],
    dagen: actueel?.dagen ?? [],
    gemiddelden: actueel?.gemiddelden ?? [],
    dagenMetLog: actueel?.dagenMetLog ?? 0,
    notities: actueel?.notities ?? [],
    profielVersie: actueel?.profielVersie ?? null,
    /** Alleen de allereerste keer: een retry laat de laatste stand staan. */
    laden: actueel === null,
    fout: actueel?.fout ?? null,
    /** true zolang een handmatige retry loopt (voor de knop-staat). */
    bezig,
    herlaad,
    rondFlagAf,
    /** Id van de flag die nu afgerond wordt (voor de knop-staat), anders null. */
    bezigeFlag,
    flagFout,
    voegNotitieToe,
    notitieBezig,
    notitieFout,
  };
}
