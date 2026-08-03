import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { View } from 'react-native';

/**
 * Registry van "tutorial-doelen": elementen die de uitleg mag uitlichten (F2, feedback 1).
 *
 * Een scherm hangt `useTutorialDoel('vandaag.opvalt')` aan een View; die meet zichzelf bij
 * elke layout met `measureInWindow` en zet z'n rechthoek hier neer. De Tutorial-overlay
 * leest met `useDoelRect(sleutel)` de rect van de stap die nu aan de beurt is en knipt daar
 * een gat in de scrim.
 *
 * Bewust géén React-state voor de rects: ze veranderen bij elke layout en scroll, en een
 * provider die daarop her-rendert trekt het hele tabblad mee. In plaats daarvan een kleine
 * store met abonnees — alleen de overlay rendert opnieuw.
 *
 * Meten in WINDOW-coördinaten: de doelen zitten in scrollviews en koppen, de overlay is een
 * absolute fill in het scherm. De overlay rekent de window-stand zelf terug naar z'n eigen
 * vlak (zie Tutorial.tsx), zodat een doel dat weggescrold is vanzelf buiten beeld valt.
 */
export type DoelRect = { x: number; y: number; breedte: number; hoogte: number };

type Registry = {
  /** Zet (of wist, met `null`) de gemeten rect van een doel en meldt het aan de abonnees. */
  zet: (sleutel: string, rect: DoelRect | null) => void;
  lees: (sleutel: string) => DoelRect | null;
  /** Een doel meldt hier z'n meetfunctie aan; `meet()` roept 'm bij een stapwissel. */
  meldAan: (sleutel: string, meet: () => void) => () => void;
  meet: (sleutel: string) => void;
  abonneer: (luister: () => void) => () => void;
};

const Ctx = createContext<Registry | null>(null);

export function TutorialDoelenProvider({ children }: { children: ReactNode }) {
  const rects = useRef(new Map<string, DoelRect>()).current;
  const meters = useRef(new Map<string, () => void>()).current;
  const abonnees = useRef(new Set<() => void>()).current;

  const registry = useMemo<Registry>(
    () => ({
      zet(sleutel, rect) {
        const oud = rects.get(sleutel) ?? null;
        if (rect === null) {
          if (!oud) return;
          rects.delete(sleutel);
        } else {
          // Layout-events herhalen zich met identieke waarden; dan niets melden.
          if (oud && oud.x === rect.x && oud.y === rect.y
            && oud.breedte === rect.breedte && oud.hoogte === rect.hoogte) return;
          rects.set(sleutel, rect);
        }
        abonnees.forEach((luister) => luister());
      },
      lees: (sleutel) => rects.get(sleutel) ?? null,
      meldAan(sleutel, meet) {
        meters.set(sleutel, meet);
        // Alleen de eigen meter afmelden: bij een remount kan een nieuw element dezelfde
        // sleutel al hebben overgenomen voordat de oude z'n opruiming draait.
        return () => { if (meters.get(sleutel) === meet) meters.delete(sleutel); };
      },
      meet(sleutel) { meters.get(sleutel)?.(); },
      abonneer(luister) { abonnees.add(luister); return () => { abonnees.delete(luister); }; },
    }),
    [rects, meters, abonnees],
  );

  return <Ctx.Provider value={registry}>{children}</Ctx.Provider>;
}

/**
 * Maak een element uitlichtbaar. Spreid het resultaat op een View:
 * `<View style={s.kaart} {...useTutorialDoel('vandaag.opvalt')}>`.
 *
 * Zonder sleutel (of buiten de provider) is het een no-op — zo mag een gedeelde component
 * als SchermKop het doel optioneel houden zonder de hook-volgorde te breken.
 */
export function useTutorialDoel(sleutel?: string) {
  const registry = useContext(Ctx);
  const node = useRef<View | null>(null);

  const meet = useCallback(() => {
    const el = node.current;
    if (!registry || !sleutel || !el || typeof el.measureInWindow !== 'function') return;
    el.measureInWindow((x, y, breedte, hoogte) => {
      // Niets gemeten (0-breedte: nog niet gelayout, of weg) telt als "geen doel": de
      // overlay valt dan terug op de kaart-only-vorm i.p.v. een gat van nul bij nul.
      const gemeten = breedte > 0 && hoogte > 0 && Number.isFinite(x) && Number.isFinite(y);
      registry.zet(sleutel, gemeten ? { x, y, breedte, hoogte } : null);
    });
  }, [registry, sleutel]);

  // Callback-ref i.p.v. een ref-object: verdwijnt het element (de Laura-knop die op slot
  // niet getoond wordt, de contactkaart die een slot-kaart wordt), dan moet z'n rect meteen
  // weg — anders wijst de uitleg naar een plek waar niets meer staat.
  const ref = useCallback((el: View | null) => {
    node.current = el;
    if (el) meet();
    else if (registry && sleutel) registry.zet(sleutel, null);
  }, [meet, registry, sleutel]);

  useEffect(() => {
    if (!registry || !sleutel) return;
    const afmelden = registry.meldAan(sleutel, meet);
    meet(); // eerste stand ná de commit; onLayout houdt 'm daarna bij
    return () => { afmelden(); registry.zet(sleutel, null); };
  }, [registry, sleutel, meet]);

  return { ref, onLayout: meet };
}

/**
 * De rect van het doel dat nu aan de beurt is. Meet vers bij elke stapwissel (het scherm
 * kan intussen gescrold of gedraaid zijn) en volgt daarna de meldingen van de registry.
 * Geen sleutel, geen provider of niets gemeten → `null`, en dat is de fallback.
 */
export function useDoelRect(sleutel: string | undefined): DoelRect | null {
  const registry = useContext(Ctx);
  const [rect, setRect] = useState<DoelRect | null>(null);

  useEffect(() => {
    if (!registry || !sleutel) { setRect(null); return; }
    const sync = () => setRect(registry.lees(sleutel));
    const stop = registry.abonneer(sync);
    registry.meet(sleutel);
    sync(); // laatst bekende stand meteen, zonder op de meting te wachten
    return stop;
  }, [registry, sleutel]);

  return rect;
}
