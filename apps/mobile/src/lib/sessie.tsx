import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type SessieContext = {
  session: Session | null;
  clientId: string | null;
  laden: boolean;
  heeftProfiel: boolean | null;
  herbepaalProfiel: () => Promise<void>;
  markProfielAangemaakt: () => void;
  login: (email: string, wachtwoord: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessieContext | null>(null);

export function SessieProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [laden, setLaden] = useState(true);
  const [heeftProfiel, setHeeftProfiel] = useState<boolean | null>(null);
  const clientId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLaden(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // heeftProfiel woont hier (C2-fix): de routing-gate én onboarding delen dezelfde
  // bron. markProfielAangemaakt() zet 'm direct op true na de onboarding-insert, zodat
  // de gate niet terugkaatst naar onboarding voordat een verse RPC binnen is.
  const herbepaalProfiel = useCallback(async () => {
    const { data } = await supabase.rpc('klant_heeft_profiel');
    setHeeftProfiel(data === true);
  }, []);
  const markProfielAangemaakt = useCallback(() => setHeeftProfiel(true), []);

  useEffect(() => {
    if (!clientId) { setHeeftProfiel(null); return; }
    herbepaalProfiel();
  }, [clientId, herbepaalProfiel]);

  async function login(email: string, wachtwoord: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
    return { error: error ? 'Inloggen lukte niet. Controleer je e-mail en wachtwoord.' : null };
  }
  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider
      value={{ session, clientId, laden, heeftProfiel, herbepaalProfiel, markProfielAangemaakt, login, logout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSessie() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSessie buiten SessieProvider');
  return v;
}
