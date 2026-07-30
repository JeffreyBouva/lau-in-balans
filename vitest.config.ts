import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // RLS-tests praten met de gehoste Supabase — netwerk-latency, dus ruimer.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Datumlogica deterministisch, ongeacht de zone van de machine/CI.
    env: { TZ: 'Europe/Amsterdam' },
  },
});
