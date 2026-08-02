'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCoach } from '@/lib/coach';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage rounded-full';

const navLink = `${focusRing} px-3 py-1.5 text-sm transition-colors`;

/**
 * Vaste balk boven elke ingelogde pagina. Bewust géén onderdeel van de gate-logica:
 * de nav toont zichzelf alleen als er een coach is, dus op /login (uitgelogd) blijft
 * hij vanzelf weg en hoeft de layout niets te weten over routes.
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
    <header className="border-b border-hairline bg-cream">
      <nav
        aria-label="Hoofdnavigatie"
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3"
      >
        <Link href="/" className={`${focusRing} font-serif text-sm text-ink`}>
          Lau in Balans
        </Link>

        <ul className="flex items-center gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.actief ? 'page' : undefined}
                className={`${navLink} ${
                  item.actief
                    ? 'bg-neutral-soft font-medium text-ink'
                    : 'text-body hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="ml-auto flex items-center gap-2 text-sm text-body">
          <span>{coach.naam}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => void logout()}
            className={`${focusRing} px-1 py-0.5 text-body transition-colors hover:text-ink`}
          >
            Uitloggen
          </button>
        </p>
      </nav>
    </header>
  );
}
