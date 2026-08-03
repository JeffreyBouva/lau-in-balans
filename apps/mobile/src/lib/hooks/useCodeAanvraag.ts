import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/** Cap uit de migratie: `check (length(bericht) <= 1000)`. Boven de cap geeft Postgres 23514. */
export const MAX_BERICHT = 1000;

const VERSTUUR_FOUT = 'Je aanvraag versturen lukte even niet — probeer het zo nog eens.';
const TE_LANG_FOUT = 'Je bericht is net iets te lang — kort het een beetje in.';
/** Zolang de migratie code_aanvragen niet gepusht is; hoort bij `nogNietBeschikbaar`. */
export const NIET_BESCHIKBAAR = 'Aanvragen kan zodra de update live staat.';

/**
 * "Deze tabel bestaat nog niet" — de migratie 20260803140000_code_aanvragen.sql is een
 * handmatige `supabase db push`. Zelfde codes als apps/coach/src/lib/migratie.ts, maar
 * lokaal gehouden: dit is voorlopig de enige plek in de app die erop leunt.
 *
 * PGRST205 = tabel niet in de schema-cache · 42P01 = undefined_table · 42501 = geen recht
 * (de grant hoort bij dezelfde migratie). Na de push kan een ingelogde klant deze codes
 * niet meer krijgen.
 */
function ontbreektNog(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (['PGRST205', '42P01', '42501'].includes(error.code ?? '')) return true;
  // Bewust smal: 'does not exist' matcht ook onverwante schemafouten.
  return (error.message ?? '').toLowerCase().includes('schema cache');
}

export type OpenAanvraag = { created_at: string };

/**
 * De eigen codeaanvraag: staat er al één open, en zo niet, er één maken (F1 — een verzoek,
 * geen toekenning; Laura deelt de codes zelf uit, buiten de app om).
 *
 * `actief` houdt de query bij het moment dat 'ie ertoe doet: de sheet geeft z'n
 * zichtbaarheid door, zodat een coached klant die de sheet nooit opent hier ook nooit
 * voor query't — en zodat elke heropening een verse stand ophaalt (Laura kan de aanvraag
 * inmiddels afgehandeld hebben).
 *
 * Bewust geen annuleer-knop: de klant heeft alleen insert- en select-policies, updaten en
 * verwijderen kan niet. En bewust geen realtime: de stand ververst bij het openen, dat is
 * ruim genoeg voor iets wat Laura handmatig oppakt.
 */
export function useCodeAanvraag(actief: boolean) {
  const [openAanvraag, setOpenAanvraag] = useState<OpenAanvraag | null>(null);
  // Alleen de eerste keer: een verse laadbeurt bij heropenen laat de laatst bekende stand
  // staan in plaats van er een spinner overheen te leggen.
  const [laden, setLaden] = useState(true);
  const [nogNietBeschikbaar, setNogNiet] = useState(false);
  // Ophogen = opnieuw ophalen. Via een teller i.p.v. een callback die zelf fetcht, zodat
  // élke laadbeurt dezelfde weg loopt en de effect-cleanup de race-guard is.
  const [tik, setTik] = useState(0);

  useEffect(() => {
    if (!actief) return;
    let actueel = true;
    (async () => {
      // getSession() wacht op het herstel uit storage; zonder sessie niet query'en, anders
      // draait 'ie als anon → 0 rijen → "je hebt niets openstaan" terwijl dat niet klopt.
      const { data: { session } } = await supabase.auth.getSession();
      if (!actueel) return;
      if (!session) { setLaden(false); return; }
      // client_id staat er expliciet bij: de policy scopet al op auth.uid(), maar Laura is
      // admin en zou zonder dit filter álle open aanvragen terugkrijgen — en dan klapt
      // maybeSingle() om in een fout op haar eigen telefoon.
      const { data, error } = await supabase
        .from('code_aanvragen')
        .select('id, status, created_at')
        .eq('client_id', session.user.id)
        .eq('status', 'open')
        .maybeSingle();
      if (!actueel) return;
      if (error) {
        console.warn('[aanvraag] laden mislukt:', error.message);
        // Bij een gewone storing de laatst bekende stand laten staan: de sheet toont dan
        // het formulier, en een dubbele aanvraag vangt de unique index alsnog op (23505).
        if (ontbreektNog(error)) setNogNiet(true);
        setLaden(false);
        return;
      }
      const rij = data as { created_at: string } | null;
      setNogNiet(false); // een geslaagde laadbeurt bewijst dat de migratie er is
      setOpenAanvraag(rij ? { created_at: rij.created_at } : null);
      setLaden(false);
    })();
    return () => {
      // Een nieuwe beurt (tik/heropening) of unmount: dit antwoord telt niet meer.
      actueel = false;
    };
  }, [actief, tik]);

  /**
   * Eén aanvraag versturen. Nooit als array inserten: PostgREST nult bij een batch de
   * weggelaten kolommen, en dan botst `status = null` op de policy. `status` en de
   * afgehandeld-velden gaan hier dus ook nooit mee — die eist de policy op de default.
   */
  const vraagAan = useCallback(async (bericht: string): Promise<{ error: string | null }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: VERSTUUR_FOUT }; // de gate stuurt zo meteen naar inloggen
    const rij = { client_id: session.user.id, bericht: bericht.trim().slice(0, MAX_BERICHT) };
    const stuur = () => supabase.from('code_aanvragen').insert(rij);

    let { error } = await stuur();
    // Vrijwel altijd een verlopen token → sessie verversen en precies één keer opnieuw
    // proberen. Bij een ontbrekende tabel of een geweigerde rij heeft dat geen zin.
    if (error && !ontbreektNog(error) && error.code !== '23505' && error.code !== '23514') {
      await supabase.auth.refreshSession();
      ({ error } = await stuur());
    }

    if (!error) {
      setTik((t) => t + 1); // verse stand, zodat een heropening de aanvraag toont
      return { error: null };
    }
    // 23505 = de partial unique index code_aanvragen_een_open_per_klant. Er stond al een
    // aanvraag open (tweede tik, tweede toestel): geen storing maar precies wat de klant
    // wil — ze staat klaar. De verse stand haalt het moment erbij.
    if (error.code === '23505') {
      setTik((t) => t + 1);
      return { error: null };
    }
    console.warn('[aanvraag] versturen mislukt:', error.message);
    if (ontbreektNog(error)) {
      setNogNiet(true);
      return { error: NIET_BESCHIKBAAR };
    }
    // Kan alleen als de cap in de UI omzeild is; de invoer knipt zelf al op MAX_BERICHT.
    if (error.code === '23514') return { error: TE_LANG_FOUT };
    return { error: VERSTUUR_FOUT };
  }, []);

  return { openAanvraag, laden, nogNietBeschikbaar, vraagAan };
}
