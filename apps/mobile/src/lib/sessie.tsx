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
  tier: 'free' | 'coached' | null;
  herlaadTier: () => Promise<void>;
  login: (email: string, wachtwoord: string) => Promise<{ error: string | null }>;
  registreer: (email: string, wachtwoord: string, naam: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessieContext | null>(null);

export function SessieProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [laden, setLaden] = useState(true);
  const [heeftProfiel, setHeeftProfiel] = useState<boolean | null>(null);
  const [tier, setTier] = useState<'free' | 'coached' | null>(null);
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

  // tier ('free' | 'coached') bepaalt wat er open staat; komt uit dezelfde bron als de
  // server-side checks (RPC mijn_tier), zodat app en backend niet uit elkaar lopen.
  const herlaadTier = useCallback(async () => {
    const { data } = await supabase.rpc('mijn_tier');
    setTier(data === 'coached' ? 'coached' : 'free');
  }, []);

  useEffect(() => {
    if (!clientId) { setTier(null); return; }
    herlaadTier();
  }, [clientId, herlaadTier]);

  async function login(email: string, wachtwoord: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
    return { error: error ? 'Inloggen lukte niet. Controleer je e-mail en wachtwoord.' : null };
  }
  async function registreer(email: string, wachtwoord: string, naam: string) {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: wachtwoord,
      options: { data: { naam: naam.trim() } },
    });
    return { error: error ? 'Registreren lukte niet. Controleer je gegevens of probeer een ander e-mailadres.' : null };
  }
  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider
      value={{
        session, clientId, laden, heeftProfiel, herbepaalProfiel, markProfielAangemaakt,
        tier, herlaadTier, login, registreer, logout,
      }}
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
