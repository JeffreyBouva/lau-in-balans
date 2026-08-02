'use client';

import { useState, type FormEvent } from 'react';
import { Knop } from '@/components/Knop';
import { useCoach } from '@/lib/coach';

const veld =
  'w-full rounded-input border border-hairline bg-surface px-3.5 py-2.5 text-base ' +
  'text-ink placeholder:text-muted focus:border-sage focus:outline-2 focus:outline-offset-0 ' +
  'focus:outline-sage/40';

export default function LoginPagina() {
  const { login, laden, fout } = useCoach();
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [bezig, setBezig] = useState(false);
  const [lokaleFout, setLokaleFout] = useState<string | null>(null);

  // fout uit de provider (bv. "geen coach-account") wint: die komt ná een geslaagde
  // inlogpoging en is dus het meest recente nieuws.
  const melding = fout ?? lokaleFout;

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setLokaleFout(null);
    setBezig(true);
    const { error } = await login(email, wachtwoord);
    setLokaleFout(error);
    setBezig(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 shadow-[0_1px_2px_rgba(38,42,36,0.04)]">
        <h1 className="font-serif text-2xl text-ink">Lau in Balans</h1>
        <p className="mt-1 text-sm text-body">Coach-dashboard</p>

        <form onSubmit={verstuur} className="mt-7 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-ink">
              E-mailadres
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={veld}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="wachtwoord" className="text-sm font-medium text-ink">
              Wachtwoord
            </label>
            <input
              id="wachtwoord"
              name="wachtwoord"
              type="password"
              autoComplete="current-password"
              required
              value={wachtwoord}
              onChange={(e) => setWachtwoord(e.target.value)}
              className={veld}
            />
          </div>

          {melding && (
            <p role="alert" className="text-sm text-clay-ink">
              {melding}
            </p>
          )}

          <Knop type="submit" disabled={bezig || laden} className="mt-1 w-full">
            {bezig || laden ? 'Bezig…' : 'Inloggen'}
          </Knop>
        </form>
      </div>
    </main>
  );
}
