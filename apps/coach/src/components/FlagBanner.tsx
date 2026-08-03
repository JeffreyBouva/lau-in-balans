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
      {/* Het ontwerp zet deze regel in clay (3,5:1 op clay-soft); clay-ink is de donkere
          helft van hetzelfde soft/ink-paar (5,5:1). Hij blijft ondergeschikt aan de zin
          links door 12,5px i.p.v. 13,5px en zijn plek helemaal rechts. */}
      <time
        dateTime={flag.created_at}
        className="ml-auto flex-none text-[12.5px] whitespace-nowrap text-clay-ink"
      >
        Open sinds {openSindsLabel(flag.created_at, nu)}
      </time>
    </div>
  );
}
