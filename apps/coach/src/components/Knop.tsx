'use client';

import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primair' | 'secundair';
};

const basis =
  'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-sage disabled:cursor-not-allowed disabled:opacity-60';

const varianten = {
  primair: 'bg-sage text-white hover:bg-sage-hover disabled:hover:bg-sage',
  secundair:
    'border border-hairline bg-surface text-ink hover:border-hairline-hover disabled:hover:border-hairline',
} as const;

/**
 * Dezelfde vormgeving voor een <a>/<Link> die als knop leest — een navigatie hoort
 * een link te blijven (nieuw tabblad, sleepbaar), maar niet anders te ogen.
 */
export function knopStijl(variant: 'primair' | 'secundair' = 'primair'): string {
  return `${basis} ${varianten[variant]}`;
}

export function Knop({ variant = 'primair', className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={`${knopStijl(variant)} ${className}`} {...rest} />;
}
