'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type Coach = { id: string; naam: string };

type CoachContextWaarde = {
  /** null zolang er geen ingelogde coach is (of de check nog loopt). */
  coach: Coach | null;
  /** true zolang sessie óf coach-rij nog onderweg is — gate en formulier wachten hierop. */
  laden: boolean;
  /** Reden waarom er geen coach is (bv. een klant-account dat probeert in te loggen). */
  fout: string | null;
  login: (email: string, wachtwoord: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<CoachContextWaarde | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessieLaden, setSessieLaden] = useState(true);
  // De uitkomst van de coaches-check hangt aan de userId waarvoor hij is opgehaald.
  // Zo kan een antwoord van de vórige gebruiker (accountwissel) de nieuwe nooit
  // vervuilen, en is "nog aan het laden" af te leiden i.p.v. apart bij te houden.
  const [check, setCheck] = useState<{ userId: string; coach: Coach | null } | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const actueleCheck = userId !== null && check?.userId === userId ? check : null;
  const coach = actueleCheck?.coach ?? null;
  const coachLaden = userId !== null && actueleCheck === null;

  useEffect(() => {
    // finally: ook als storage of de auth-lock stukgaat moet sessieLaden false worden,
    // anders blijft de gate eeuwig op "laden" hangen (les uit apps/mobile/src/lib/sessie.tsx).
    supabase.auth
      .getSession()
      .then(({ data }) => setUserId(data.session?.user.id ?? null))
      .finally(() => setSessieLaden(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let actueel = true;
    (async () => {
      let gevonden: Coach | null = null;
      let melding: string | null = null;
      try {
        const { data, error } = await supabase
          .from('coaches')
          .select('id, naam')
          .eq('id', userId)
          .maybeSingle();
        if (error) melding = 'We konden je coach-account niet controleren. Probeer het opnieuw.';
        else if (!data) melding = 'Dit account is geen coach-account.';
        else gevonden = { id: data.id, naam: data.naam };
      } catch {
        melding = 'We konden je coach-account niet controleren. Probeer het opnieuw.';
      }
      if (!actueel) return;
      // Ook bij een storing een uitkomst wegschrijven: anders blijft `laden` true en
      // hangt de gate eeuwig op de spinner (les uit apps/mobile/src/lib/sessie.tsx).
      setCheck({ userId, coach: gevonden });
      setFout(melding);
      // Geen rij = definitief geen coach-account. Een fout is meestal tijdelijk, maar
      // ook dan uitloggen: dat houdt één herstelpad over (opnieuw inloggen) in plaats
      // van een sessie die aan /login blijft plakken zonder manier om te herproberen.
      if (!gevonden) await supabase.auth.signOut();
    })();
    return () => {
      actueel = false;
    };
  }, [userId]);

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
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider
      value={{ coach, laden: sessieLaden || coachLaden, fout, login, logout }}
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
 */
export function Gate({ children }: { children: ReactNode }) {
  const { coach, laden } = useCoach();
  const router = useRouter();
  const pathname = usePathname();
  const opLogin = pathname === '/login';

  useEffect(() => {
    if (laden) return;
    if (!coach && !opLogin) router.replace('/login');
    else if (coach && opLogin) router.replace('/');
  }, [coach, laden, opLogin, router]);

  if (laden) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <span className="sr-only">Bezig met laden…</span>
        <span className="size-3 animate-pulse rounded-full bg-sage" aria-hidden="true" />
      </div>
    );
  }
  // Redirect is onderweg: niets tonen voorkomt een flits van de verkeerde pagina.
  if (!coach && !opLogin) return null;
  if (coach && opLogin) return null;
  return <>{children}</>;
}
