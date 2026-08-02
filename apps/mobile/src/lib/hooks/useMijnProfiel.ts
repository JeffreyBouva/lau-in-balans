import { useCallback, useEffect, useState } from 'react';
import { PORTIE_DOEL_DEFAULT, type AIProfile, type HandKey, type Porties } from '@lau/shared';
import { supabase } from '../supabase';

/**
 * Het eigen profiel, zoals de klant het mag zien en bewerken. De coach-velden (aanpak,
 * toon, vermijdenInCoaching, veiligheidsvlag) zitten hier bewust niet in: de RPC
 * `mijn_profiel` geeft ze niet terug en `werk_mijn_profiel_bij` neemt ze niet aan.
 */
export type KlantProfiel = Pick<
  AIProfile,
  'doelen' | 'portiedoelen' | 'knelpunten' | 'voorkeuren' | 'beperkingen' | 'checkinRitme'
>;
/** Deelwijziging: ontbrekende keys laat de server ongemoeid. */
export type KlantProfielWijziging = Partial<KlantProfiel>;

export const PROFIEL_VELDEN = ['doelen', 'knelpunten', 'voorkeuren', 'beperkingen', 'checkinRitme'] as const;
export type ProfielLijstVeld = (typeof PROFIEL_VELDEN)[number];

const LAAD_FOUT = 'Profiel laden lukte niet — probeer het later opnieuw.';
const OPSLAAN_FOUT = 'Opslaan lukte niet — probeer het zo nog eens.';

/** jsonb kan alles zijn (of ontbreken) — alleen strings overleven. */
function lijst(waarde: unknown): string[] {
  return Array.isArray(waarde) ? waarde.filter((x): x is string => typeof x === 'string') : [];
}

/** Ontbrekende of rare handmaten vallen terug op het standaarddoel; klem op 0..12. */
function porties(waarde: unknown): Porties {
  const bron = (waarde ?? {}) as Partial<Record<HandKey, unknown>>;
  const uit = { ...PORTIE_DOEL_DEFAULT } as Porties;
  (Object.keys(uit) as HandKey[]).forEach((k) => {
    const n = bron[k];
    if (typeof n === 'number' && Number.isFinite(n)) uit[k] = Math.min(12, Math.max(0, Math.round(n)));
  });
  return uit;
}

/**
 * Laadt en bewaart het eigen profiel via de twee fase-6-RPC's. Beide kanten zijn
 * fail-safe: zolang de migratie niet gepusht is, geeft PostgREST een "function not
 * found" — dat wordt hier een nette foutmelding met een herlaad-knop, geen crash.
 *
 * `bezig` bij het opslaan houdt de caller bij (zelfde patroon als CodeSheet en de
 * onboarding: de knop weet zelf wanneer 'ie draait).
 */
export function useMijnProfiel() {
  const [profiel, setProfiel] = useState<(KlantProfiel & { versie: number }) | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const herlaad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    // getSession() wacht op het herstel uit storage; zonder sessie niet query'en, anders
    // draait de RPC als anon (die mag 'm niet) → onterechte foutmelding.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setProfiel(null); setLaden(false); return; }
    const { data, error } = await supabase.rpc('mijn_profiel');
    if (error) {
      console.warn('[profiel] laden mislukt:', error.message);
      setProfiel(null);
      setFout(LAAD_FOUT);
      setLaden(false);
      return;
    }
    if (!data) {
      // Geen profiel = onboarding niet afgerond; de gate laat dit scherm dan niet toe.
      // Zelfde nette uitweg als bij een storing, in plaats van een leeg formulier dat
      // bij opslaan alsnog stukloopt ('geen profiel' in de RPC).
      setProfiel(null);
      setFout(LAAD_FOUT);
      setLaden(false);
      return;
    }
    const rij = data as Record<string, unknown>;
    setProfiel({
      versie: typeof rij.versie === 'number' ? rij.versie : 0,
      doelen: lijst(rij.doelen),
      knelpunten: lijst(rij.knelpunten),
      voorkeuren: lijst(rij.voorkeuren),
      beperkingen: lijst(rij.beperkingen),
      checkinRitme: lijst(rij.checkinRitme),
      portiedoelen: porties(rij.portiedoelen),
    });
    setLaden(false);
  }, []);

  useEffect(() => { herlaad(); }, [herlaad]);

  const slaOp = useCallback(
    async (wijziging: KlantProfielWijziging): Promise<{ error: string | null; versie?: number }> => {
      const { data, error } = await supabase.rpc('werk_mijn_profiel_bij', { p_wijziging: wijziging });
      if (error) {
        console.warn('[profiel] opslaan mislukt:', error.message);
        return { error: OPSLAAN_FOUT };
      }
      const versie = typeof data === 'number' ? data : undefined;
      // Lokale kopie meteen bij: een tweede keer opslaan stuurt dan alleen wat er sindsdien
      // écht veranderd is (en het scherm toont de nieuwe versie).
      setProfiel((p) => (p ? { ...p, ...wijziging, versie: versie ?? p.versie } : p));
      return { error: null, versie };
    },
    [],
  );

  return { profiel, laden, fout, herlaad, slaOp };
}
