import { createContext, useContext, useState, type ReactNode } from 'react';
import { LogSheet } from '@/components/LogSheet';
import { LauraSheet } from '@/components/LauraSheet';

/**
 * SheetsProvider (handoff § 5 + § 6). Rendert de twee bottom-sheets één keer op
 * tabs-niveau, zodat ze over álles heen kunnen en elk tab-scherm ze via
 * `useSheets()` kan openen. De sheets zijn zelf Modals — ze verschijnen boven de
 * tabbar ongeacht waar deze provider in de boom staat.
 */
const Ctx = createContext<{ openLog: () => void; openLaura: () => void } | null>(null);

export function useSheets() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSheets buiten SheetsProvider');
  return v;
}

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [logOpen, setLogOpen] = useState(false);
  const [lauraOpen, setLauraOpen] = useState(false);
  return (
    <Ctx.Provider value={{ openLog: () => setLogOpen(true), openLaura: () => setLauraOpen(true) }}>
      {children}
      <LogSheet zichtbaar={logOpen} onSluit={() => setLogOpen(false)} />
      <LauraSheet zichtbaar={lauraOpen} onSluit={() => setLauraOpen(false)} />
    </Ctx.Provider>
  );
}
