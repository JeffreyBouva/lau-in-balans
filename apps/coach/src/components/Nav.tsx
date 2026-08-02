'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { vandaagISO } from '@lau/shared';
import { useCoach } from '@/lib/coach';
import { initialen } from '@/lib/naam';
import { langeDatum } from '@/lib/tijd';

const focusRing =
  'rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage';

/** Alles rechts van het merk spreekt dezelfde 13px-taal — nav-links incluis (E6). */
const chromeLink = `${focusRing} text-[13px] transition-colors`;

/**
 * De chrome van het coach-dashboard (handoff §Coach-dashboard): witte balk met het merk
 * links en de datum + Laura's avatar rechts. Bewust géén onderdeel van de gate-logica:
 * de balk toont zichzelf alleen als er een coach is, dus op /login (uitgelogd) blijft
 * hij vanzelf weg en hoeft de layout niets te weten over routes.
 *
 * Het ontwerp tekent geen navigatie — er is maar één dashboard. Klanten, Invites en
 * Uitloggen bestaan wél en horen ergens: ze staan hier als compacte tekstlinks in
 * dezelfde 13px-taal, zodat ze de balk niet tot een menubalk maken.
 */
export function Nav() {
  const { coach, logout } = useCoach();
  const pathname = usePathname();

  if (!coach) return null;

  // "Klanten" blijft de actieve sectie zolang je in een klantdossier zit: /klant/… is
  // een detailweergave van die lijst, geen eigen bestemming.
  const items = [
    { href: '/', label: 'Klanten', actief: pathname === '/' || pathname.startsWith('/klant/') },
    { href: '/invites', label: 'Invites', actief: pathname === '/invites' },
  ];

  return (
    <header className="flex items-center gap-[18px] border-b border-hairline-soft bg-surface px-7 py-[18px]">
      <Link href="/" className={`${focusRing} font-serif text-[18px] text-ink`}>
        Lau in Balans{' '}
        {/* contrast-opvolgpunt: #A3A59A op wit ≈ 2,5:1 — het ontwerp schrijft deze kleur voor. */}
        <span className="font-sans text-[13px] text-muted-softer">· coach</span>
      </Link>

      <nav aria-label="Hoofdnavigatie">
        <ul className="flex items-center gap-4">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.actief ? 'page' : undefined}
                className={`${chromeLink} ${
                  item.actief ? 'font-medium text-ink' : 'text-body-soft hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => void logout()}
          className={`${chromeLink} text-body-soft hover:text-ink`}
        >
          Uitloggen
        </button>
        {/* contrast-opvolgpunt: #8C8F84 op wit ≈ 3,3:1 — ontwerpwaarde voor de datum. */}
        <time dateTime={vandaagISO()} className="text-[13px] text-muted">
          {langeDatum()}
        </time>
        <span className="flex size-[34px] items-center justify-center rounded-full bg-laura-avatar text-[13px] text-laura-avatar-ink">
          <span aria-hidden="true">{initialen(coach.naam)}</span>
          <span className="sr-only">Ingelogd als {coach.naam}</span>
        </span>
      </div>
    </header>
  );
}
