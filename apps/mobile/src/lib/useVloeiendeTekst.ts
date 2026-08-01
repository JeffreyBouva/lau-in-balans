import { useEffect, useRef, useState } from 'react';

/**
 * Vloeiende tekst-reveal (ChatGPT/Claude-gevoel). De server levert het antwoord in brokjes
 * (~elke 150ms); dit hookje toont ze niet met horten en stoten, maar onthult karakter-voor-
 * karakter richting `doel`. Groeit `doel` (streaming), dan blijft de reveal bijtrekken; stopt
 * 'ie, dan komt de reveal bij en stopt de lus. Historische berichten mounten mét volledige
 * tekst → getoond start gelijk, dus geen animatie.
 */
export function useVloeiendeTekst(doel: string): string {
  const [getoond, setGetoond] = useState(doel);
  const doelRef = useRef(doel);
  const getoondRef = useRef(getoond);
  doelRef.current = doel;
  getoondRef.current = getoond;

  useEffect(() => {
    // Geen prefix (nieuw/ander bericht, of correctie) → direct synchroniseren, geen reveal.
    if (!doel.startsWith(getoondRef.current)) {
      getoondRef.current = doel;
      setGetoond(doel);
      return;
    }
    if (getoondRef.current.length >= doel.length) return; // niks te onthullen

    let raf = 0;
    let vorige = 0;
    const stap = (t: number) => {
      const d = doelRef.current;
      const g = getoondRef.current;
      if (g.length >= d.length || !d.startsWith(g)) return; // bij → stop de lus (geen nieuwe frame)
      if (t - vorige >= 32) {
        vorige = t; // ~30fps
        const grootte = Math.max(2, Math.ceil((d.length - g.length) / 5)); // ease: sneller bij grotere gap
        const volgende = d.slice(0, Math.min(d.length, g.length + grootte));
        getoondRef.current = volgende;
        setGetoond(volgende);
      }
      raf = requestAnimationFrame(stap);
    };
    raf = requestAnimationFrame(stap);
    return () => cancelAnimationFrame(raf);
  }, [doel]);

  return getoond;
}
