'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/** Sobere volle-pagina-melding met de weg terug (laden, storing, niet gevonden). */
export function Statuspagina({ children, rol }: { children: ReactNode; rol?: 'alert' }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
      <p role={rol} className="text-sm text-body">
        {children}
      </p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm text-sage transition-colors hover:text-sage-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage"
      >
        ← Klanten
      </Link>
    </main>
  );
}
