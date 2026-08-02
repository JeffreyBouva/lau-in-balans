import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** Render tier-afhankelijke UI niet zolang tierLaden — anders flitst free-UI voorbij. */
  tierLaden: boolean;
  herlaadTier: () => Promise<void>;
  login: (email: string, wachtwoord: string) => Promise<{ error: string | null }>;
  registreer: (
    email: string,
    wachtwoord: string,
    naam: string,
  ) => Promise<{ error: string | null; bevestigingNodig?: boolean }>;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessieContext | null>(null);

export function SessieProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [laden, setLaden] = useState(true);
  const [heeftProfiel, setHeeftProfiel] = useState<boolean | null>(null);
  const [tier, setTier] = useState<'free' | 'coached' | null>(null);
  // Eén mislukte tier-RPC mag tierLaden niet eeuwig op true laten hangen (skeleton-stall):
  // bij een fout renderen consumers free-UI en is herlaadTier() de "opnieuw proberen".
  const [tierFout, setTierFout] = useState(false);
  const clientId = session?.user.id ?? null;
  // Bij een accountwissel (logout → andere login) kan een RPC van de vórige klant nog
  // onderweg zijn. Beide laders vergelijken de clientId van vóór de await met deze ref
  // en negeren een verlaat antwoord.
  const clientIdRef = useRef<string | null>(null);

  useEffect(() => {
    // finally: ook bij een storage-/lock-storing moet laden false worden, anders
    // blijft de splash (die pas verdwijnt bij !laden) eeuwig staan.
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLaden(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // heeftProfiel woont hier (C2-fix): de routing-gate én onboarding delen dezelfde
  // bron. markProfielAangemaakt() zet 'm direct op true na de onboarding-insert, zodat
  // de gate niet terugkaatst naar onboarding voordat een verse RPC binnen is.
  const herbepaalProfiel = useCallback(async () => {
    const eigenClientId = clientIdRef.current;
    const { data } = await supabase.rpc('klant_heeft_profiel');
    if (clientIdRef.current !== eigenClientId) return;
    setHeeftProfiel(data === true);
  }, []);
  const markProfielAangemaakt = useCallback(() => setHeeftProfiel(true), []);

  useEffect(() => {
    clientIdRef.current = clientId;
    if (!clientId) { setHeeftProfiel(null); return; }
    herbepaalProfiel();
  }, [clientId, herbepaalProfiel]);

  // tier ('free' | 'coached') bepaalt wat er open staat; komt uit dezelfde bron als de
  // server-side checks (RPC mijn_tier), zodat app en backend niet uit elkaar lopen.
  const herlaadTier = useCallback(async () => {
    const eigenClientId = clientIdRef.current;
    const { data, error } = await supabase.rpc('mijn_tier');
    if (clientIdRef.current !== eigenClientId) return;
    // Bij een fout tier op null laten: stil naar 'free' vallen zou een coached klant
    // ten onrechte achter het slot zetten. tierFout voorkomt dat tierLaden blijft hangen.
    if (error) { console.warn('[tier] ophalen mislukt:', error.message); setTierFout(true); return; }
    setTierFout(false);
    setTier(data === 'coached' ? 'coached' : 'free');
  }, []);

  useEffect(() => {
    clientIdRef.current = clientId;
    if (!clientId) { setTier(null); setTierFout(false); return; }
    herlaadTier();
  }, [clientId, herlaadTier]);

  async function login(email: string, wachtwoord: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: wachtwoord });
    return { error: error ? 'Inloggen lukte niet. Controleer je e-mail en wachtwoord.' : null };
  }
  async function registreer(
    email: string,
    wachtwoord: string,
    naam: string,
  ): Promise<{ error: string | null; bevestigingNodig?: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: wachtwoord,
      options: { data: { naam: naam.trim() } },
    });
    if (error) {
      if (error.code === 'user_already_exists') return { error: 'Dit e-mailadres is al in gebruik. Log in of kies een ander adres.' };
      if (error.code === 'weak_password') return { error: 'Kies een wachtwoord van minstens 8 tekens.' };
      if (error.code === 'over_email_send_rate_limit') return { error: 'Te veel pogingen. Probeer het later opnieuw.' };
      return { error: 'Registreren lukte niet. Controleer je gegevens.' };
    }
    // Enumeration-protection: 200 + lege identities = adres bestaat al.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return { error: 'Dit e-mailadres is al in gebruik. Log in of kies een ander adres.' };
    }
    return { error: null, bevestigingNodig: !data.session };
  }
  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider
      value={{
        session, clientId, laden, heeftProfiel, herbepaalProfiel, markProfielAangemaakt,
        tier, tierLaden: clientId !== null && tier === null && !tierFout, herlaadTier,
        login, registreer, logout,
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
