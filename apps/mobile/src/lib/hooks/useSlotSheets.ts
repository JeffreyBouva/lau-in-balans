import { useCallback, useEffect, useRef, useState } from 'react';
import { SHEET_SLUIT_MS } from '@/components/Sheet';

type SlotSheet = 'geen' | 'code' | 'aanvraag';

/** Iets ruimer dan de sluit-animatie, zodat de eerste sheet zeker gedemonteerd is. */
const OVERGANG_MS = SHEET_SLUIT_MS + 30;

/**
 * De twee sheets van de slot-beleving: "Ik heb een code" (CodeSheet) en "Vraag een code
 * aan" (CodeAanvraagSheet). Beide leven op schermniveau, niet in de SlotKaart — ze moeten
 * het omklappen naar coached overleven om hun sluit-animatie af te maken.
 *
 * Eén state voor allebei, want er kan er maar één tegelijk staan. `naarAanvraag` is de
 * overstap vanuit de code-sheet: eerst dicht, dán de andere open. Ze tegelijk laten
 * staan kan niet — op iOS presenteert elke Sheet een eigen modal, en het dichtgaan van
 * de onderste sleept de bovenste mee.
 */
export function useSlotSheets() {
  const [sheet, setSheet] = useState<SlotSheet>('geen');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  // Wegnavigeren midden in de overstap zou anders een setState op een weg component doen.
  useEffect(() => stopTimer, [stopTimer]);

  const openCode = useCallback(() => { stopTimer(); setSheet('code'); }, [stopTimer]);
  const openAanvraag = useCallback(() => { stopTimer(); setSheet('aanvraag'); }, [stopTimer]);
  const sluit = useCallback(() => { stopTimer(); setSheet('geen'); }, [stopTimer]);

  const naarAanvraag = useCallback(() => {
    stopTimer();
    setSheet('geen');
    timer.current = setTimeout(() => { timer.current = null; setSheet('aanvraag'); }, OVERGANG_MS);
  }, [stopTimer]);

  return {
    codeOpen: sheet === 'code',
    aanvraagOpen: sheet === 'aanvraag',
    openCode,
    openAanvraag,
    sluit,
    naarAanvraag,
  };
}
