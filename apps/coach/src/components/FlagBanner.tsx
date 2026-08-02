'use client';

import type { OpenFlag } from '@/lib/hooks/useKlantContext';
import { openSindsLabel, relatieveZin } from '@/lib/tijd';

/*
 * De flag-banner uit §8: één regel over de volle breedte, direct onder de sub-header.
 * Clay = coach-aandacht, en dit is het enige dat over álle drie de kolommen heen mag
 * schreeuwen — een klant die om een mens vroeg, wacht op een mens. Afronden gebeurt
 * bewust niet hier maar in de antwoordbalk (§8): eerst reageren, dán afvinken.
 */
export function FlagBanner({
  flag,
  voornaam,
  nu,
}: {
  flag: OpenFlag;
  voornaam: string;
  /** Peilmoment voor de relatieve tijd — één tik voor de hele pagina. */
  nu: Date;
}) {
  const tekst = flag.tekst?.trim();
  // Lege string = een tijdstempel die niet te lezen is; dan liever geen halve zin.
  const wanneer = relatieveZin(flag.created_at, nu);
  const zin = wanneer === '' ? `${voornaam} vroeg om jou` : `${voornaam} vroeg ${wanneer} om jou`;

  return (
    <div className="flex items-center gap-3 border-b border-clay-border bg-clay-soft px-8 py-[13px]">
      <span aria-hidden="true" className="size-2 flex-none rounded-full bg-clay" />
      <p className="min-w-0 text-[13.5px] text-clay-ink">
        {zin}
        {tekst ? `: “${tekst}”` : '.'}
      </p>
      {/* contrast-opvolgpunt: #B0603F op #F6E7E0 ≈ 3,5:1 bij 12,5px — ontwerpwaarden. */}
      <time
        dateTime={flag.created_at}
        className="ml-auto flex-none text-[12.5px] whitespace-nowrap text-clay"
      >
        Open sinds {openSindsLabel(flag.created_at, nu)}
      </time>
    </div>
  );
}
