'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Knop } from '@/components/Knop';

export type Coach = { id: string; naam: string };

type CoachContextWaarde = {
  /** null zolang er geen ingelogde coach is (of de check nog loopt). */
  coach: Coach | null;
  /** true zolang sessie óf coach-rij nog onderweg is — gate en formulier wachten hierop. */
  laden: boolean;
  /** Reden waarom er geen coach is (bv. een klant-account dat probeert in te loggen). */
  fout: string | null;
  /** true als de coach-check faalde door een storing — sessie blijft staan, retry mogelijk. */
  onbereikbaar: boolean;
  /** Draait de coach-check opnieuw (het herstelpad bij `onbereikbaar`). */
  probeerOpnieuw: () => void;
  login: (email: string, wachtwoord: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<CoachContextWaarde | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessieLaden, setSessieLaden] = useState(true);
  const [poging, setPoging] = useState(0);
  // De uitkomst van de coaches-check hangt aan de userId waarvoor hij is opgehaald.
  // Zo kan een antwoord van de vórige gebruiker (accountwissel) de nieuwe nooit
  // vervuilen, en is "nog aan het laden" af te leiden i.p.v. apart bij te houden.
  // Drie uitkomsten: coach gevonden · geen-coach (definitief → signOut) ·
  // onbereikbaar (storing → sessie BLIJFT staan, retry via probeerOpnieuw).
  const [check, setCheck] = useState<{
    userId: string;
    coach: Coach | null;
    reden: 'geen-coach' | 'onbereikbaar' | null;
  } | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const actueleCheck = userId !== null && check?.userId === userId ? check : null;
  const coach = actueleCheck?.coach ?? null;
  const onbereikbaar = actueleCheck?.reden === 'onbereikbaar';
  const coachLaden = userId !== null && actueleCheck === null;

  useEffect(() => {
    // catch + finally: ook als storage of de auth-call stukgaat moet sessieLaden false
    // worden, anders blijft de gate eeuwig op "laden" hangen (les uit mobile sessie.tsx).
    supabase.auth
      .getSession()
      .then(({ data }) => setUserId(data.session?.user.id ?? null))
      .catch(() => setUserId(null))
      .finally(() => setSessieLaden(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let actueel = true;
    (async () => {
      let gevonden: Coach | null = null;
      let reden: 'geen-coach' | 'onbereikbaar' | null = null;
      try {
        const { data, error } = await supabase
          .from('coaches')
          .select('id, naam')
          .eq('id', userId)
          .maybeSingle();
        // LET OP: een stervende sessie laat supabase-js terugvallen op de anon-key →
        // RLS geeft dan 0 rijen ZONDER error. Alleen een échte lege uitkomst mét
        // geldige sessie is "geen coach"; een error is altijd "onbereikbaar".
        if (error) reden = 'onbereikbaar';
        else if (!data) reden = 'geen-coach';
        else gevonden = { id: data.id, naam: data.naam };
      } catch {
        reden = 'onbereikbaar';
      }
      if (!actueel) return;
      // Ook bij een storing een uitkomst wegschrijven: anders blijft `laden` true en
      // hangt de gate eeuwig op de spinner (les uit apps/mobile/src/lib/sessie.tsx).
      setCheck({ userId, coach: gevonden, reden });
      setFout(reden === 'geen-coach' ? 'Dit account is geen coach-account.' : null);
      // Alleen bij definitief geen-coach uitloggen. Bij een storing blijft de sessie
      // staan — probeerOpnieuw() is dan het herstelpad, niet opnieuw je wachtwoord typen.
      if (reden === 'geen-coach') await supabase.auth.signOut().catch(() => {});
    })();
    return () => {
      actueel = false;
    };
  }, [userId, poging]);

  async function login(email: string, wachtwoord: string) {
    setFout(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: wachtwoord,
    });
    return { error: error ? 'Inloggen lukte niet. Controleer je e-mail en wachtwoord.' : null };
  }

  async function logout() {
    setFout(null);
    await supabase.auth.signOut().catch(() => {});
  }

  return (
    <Ctx.Provider
      value={{
        coach,
        laden: sessieLaden || coachLaden,
        fout,
        onbereikbaar,
        probeerOpnieuw: () => setPoging((p) => p + 1),
        login,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCoach() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCoach buiten CoachProvider');
  return v;
}

/**
 * Routing-gate: zonder coach hoort alleen /login zichtbaar te zijn, mét coach juist
 * niet. Client-side (A2: geen SSR-auth), dus de redirect gebeurt na hydratatie.
 * Bij een storing in de coach-check ('onbereikbaar') blijft de sessie staan en tonen
 * we een retry-paneel i.p.v. uit te loggen.
 */
export function Gate({ children }: { children: ReactNode }) {
  const { coach, laden, onbereikbaar, probeerOpnieuw } = useCoach();
  const router = useRouter();
  const pathname = usePathname();
  const opLogin = pathname === '/login';

  useEffect(() => {
    if (laden || onbereikbaar) return;
    if (!coach && !opLogin) router.replace('/login');
    else if (coach && opLogin) router.replace('/');
  }, [coach, laden, onbereikbaar, opLogin, router]);

  if (laden) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-busy="true">
        <span className="sr-only">Bezig met laden…</span>
        <span className="size-3 animate-pulse rounded-full bg-sage" aria-hidden="true" />
      </div>
    );
  }
  if (onbereikbaar) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-6 text-center">
          <p className="font-serif text-lg text-ink">Even geen verbinding</p>
          <p className="mt-2 text-sm text-body">
            We konden je coach-account niet controleren. Je bent niet uitgelogd.
          </p>
          <div className="mt-4">
            <Knop onClick={probeerOpnieuw}>Opnieuw proberen</Knop>
          </div>
        </div>
      </div>
    );
  }
  // Redirect is onderweg: niets tonen voorkomt een flits van de verkeerde pagina.
  if (!coach && !opLogin) return null;
  if (coach && opLogin) return null;
  return <>{children}</>;
}
