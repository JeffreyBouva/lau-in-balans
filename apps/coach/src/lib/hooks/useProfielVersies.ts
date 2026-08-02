'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIProfile } from '@lau/shared';
import { supabase } from '@/lib/supabase';
import { useCoach, type Coach } from '@/lib/coach';

const KOLOMMEN = 'versie, created_at, author, profiel';

const LAADFOUT = 'De profielversies laden lukte niet — probeer opnieuw.';
const OPSLAANFOUT = 'Het profiel opslaan lukte niet — probeer het opnieuw.';
const BOTSFOUT = 'Er is net een nieuwe versie opgeslagen — herlaad eerst.';

/** unique_violation op (client_id, versie) — iemand anders was net sneller. */
const UNIEK = '23505';

type VersieRij = {
  versie: number;
  created_at: string;
  /** null = door de klant zelf geschreven: de onboarding of haar profielscherm. */
  author: string | null;
  profiel: AIProfile;
};

export type ProfielVersie = VersieRij & {
  /** Weergavenaam van de auteur — zie `auteurLabel`. */
  auteur: string;
};

/**
 * Versies getagd met de clientId waarvoor ze opgehaald zijn: Next hergebruikt deze
 * pagina als alléén [id] verandert, dus zonder die tag zou het profiel van de vorige
 * klant even in het nieuwe formulier staan (zelfde truc als in useKlantChat).
 */
type Stand = { clientId: string; versies: VersieRij[]; fout: string | null };

/**
 * Wie schreef deze versie? De coaches-RLS geeft een coach álléén haar eigen rij
 * (coach_leest_zichzelf) plus die van klanten, dus de naam van een ándere auteur is
 * per definitie niet op te halen: die versie heet "andere coach". Geen extra query dus —
 * de ingelogde coach is de enige naam die we kunnen kennen.
 */
function auteurLabel(author: string | null, coach: Coach | null): string {
  // author null was ooit alleen de onboarding; sinds fase 6 schrijft de klant ook vanaf
  // haar profielscherm versies. Beide zijn "door de klant zelf" — vandaar het dubbellabel.
  if (author === null) return 'klant/onboarding';
  if (coach && author === coach.id) return coach.naam;
  return 'andere coach';
}

/**
 * Alle AI-profielversies van één klant, nieuwste eerst — de hoogste versie is het
 * actieve profiel (zo leest de prompt-builder het ook).
 *
 * Opslaan is altijd een insert van versie hoogste + 1: het profiel is een logboek,
 * geen rij die je overschrijft. De unique op (client_id, versie) is daarmee tegelijk
 * de gelijktijdigheids-bewaking — botst de insert, dan is er ondertussen elders
 * opgeslagen en moet er eerst herladen worden.
 */
export function useProfielVersies(clientId: string) {
  const { coach } = useCoach();
  const coachId = coach?.id ?? null;

  const [stand, setStand] = useState<Stand | null>(null);
  const [bezig, setBezig] = useState(false);
  // Ophogen = opnieuw ophalen. Via een teller i.p.v. een callback die zelf fetcht,
  // zodat élke laadbeurt dezelfde weg loopt en de effect-cleanup de race-guard is.
  const [tik, setTik] = useState(0);

  const [opslaanBezig, setOpslaanBezig] = useState(false);
  const [opslaanFout, setOpslaanFout] = useState<string | null>(null);
  const [botsing, setBotsing] = useState(false);

  const actueel = stand?.clientId === clientId ? stand : null;

  useEffect(() => {
    let geldig = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('ai_profile_versions')
          .select(KOLOMMEN)
          // client_id-filter is nodig: RLS geeft de coach de profielen van ál haar klanten.
          .eq('client_id', clientId)
          .order('versie', { ascending: false });
        if (error) throw error;
        if (!geldig) return;
        setStand({ clientId, versies: (data ?? []) as VersieRij[], fout: null });
      } catch (e) {
        console.error('[profielversies] laden mislukt:', e);
        if (!geldig) return;
        // Ook bij een storing een stand wegschrijven: anders blijft `laden` true en
        // hangt de pagina eeuwig op de skeleton. Een mislukte retry laat de laatst
        // bekende versies staan, mét melding erboven.
        setStand((s) =>
          s?.clientId === clientId
            ? { ...s, fout: LAADFOUT }
            : { clientId, versies: [], fout: LAADFOUT },
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

  const herlaad = useCallback(() => {
    setBezig(true);
    setTik((t) => t + 1);
    // De botsmelding hoort bij de stand die we nu juist gaan vervangen.
    setOpslaanFout(null);
    setBotsing(false);
  }, []);

  // Dubbelklik-guard in een ref: `opslaanBezig` is er voor de knopstaat, maar die is
  // pas ná de re-render zichtbaar in deze closure.
  const opslaanRef = useRef(false);

  /** Het nieuwe versienummer, of null als er niets is opgeslagen (zie `opslaanFout`). */
  const slaOp = useCallback(
    async (profiel: AIProfile): Promise<number | null> => {
      if (opslaanRef.current) return null;
      const huidig = stand?.clientId === clientId ? stand : null;
      if (!coachId || huidig === null) {
        // Kan alleen als de sessie onder Laura's voeten wegvalt, of als er nog niets
        // geladen is; nooit stil laten.
        setOpslaanFout(OPSLAANFOUT);
        return null;
      }

      opslaanRef.current = true;
      setOpslaanBezig(true);
      setOpslaanFout(null);
      setBotsing(false);

      // Exact de twee dingen die de policy eist (is_coach_of + author = auth.uid()).
      const volgende = (huidig.versies[0]?.versie ?? 0) + 1;
      const plaats = () =>
        supabase
          .from('ai_profile_versions')
          .insert({ client_id: clientId, versie: volgende, author: coachId, profiel })
          .select(KOLOMMEN)
          .single();
      let { data, error } = await plaats();
      if (error && error.code !== UNIEK) {
        // Vrijwel altijd een verlopen token (laptop uit slaapstand) → sessie verversen
        // en precies één keer opnieuw proberen. Bij een botsing heeft dat geen zin:
        // hetzelfde versienummer botst gegarandeerd nog een keer.
        await supabase.auth.refreshSession();
        ({ data, error } = await plaats());
      }

      opslaanRef.current = false;
      setOpslaanBezig(false);

      if (error?.code === UNIEK) {
        setBotsing(true);
        setOpslaanFout(BOTSFOUT);
        return null;
      }
      if (error || !data) {
        // Nooit stil falen: Laura moet zien dat haar profiel níet opgeslagen is.
        console.error('[profielversies] opslaan mislukt:', error?.message ?? 'geen rij terug');
        setOpslaanFout(OPSLAANFOUT);
        return null;
      }

      const rij = data as VersieRij;
      // Vooraan: de lijst staat op versie aflopend en dit is de nieuwste.
      setStand((s) =>
        s?.clientId === clientId ? { ...s, versies: [rij, ...s.versies] } : s,
      );
      return rij.versie;
    },
    [clientId, coachId, stand],
  );

  const versies = useMemo<ProfielVersie[]>(
    () => (actueel?.versies ?? []).map((v) => ({ ...v, auteur: auteurLabel(v.author, coach) })),
    [actueel, coach],
  );

  return {
    versies,
    /** De hoogste versie = het actieve profiel; null bij een klant zonder profiel. */
    actief: versies[0] ?? null,
    /** Alleen de allereerste keer: een retry laat de laatst bekende versies staan. */
    laden: actueel === null,
    fout: actueel?.fout ?? null,
    /** true zolang een handmatige retry loopt (voor de knop-staat). */
    bezig,
    herlaad,
    slaOp,
    opslaanBezig,
    opslaanFout,
    /** true = de fout is een versiebotsing; de pagina biedt dan de herlaad-actie aan. */
    botsing,
  };
}
