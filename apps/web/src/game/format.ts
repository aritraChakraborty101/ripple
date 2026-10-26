import { dateOf } from '@ripple/engine';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "14 March, Year 1" */
export function formatDate(tick: number): string {
  const d = dateOf(tick);
  return `${d.day} ${MONTHS[d.month - 1]}, Year ${d.year}`;
}

/** "14 Mar" */
export function formatShortDate(tick: number): string {
  const d = dateOf(tick);
  return `${d.day} ${MONTHS[d.month - 1]!.slice(0, 3)}`;
}

/** Cents to "73.00". */
export function formatPrice(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Change from a reference as a signed whole percent: "+15%", "−3%", "0%". */
export function formatChange(value: number, reference: number): string {
  if (reference === 0) return '0%';
  const pct = Math.round(((value - reference) * 100) / reference);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `−${Math.abs(pct)}%`;
  return '0%';
}

export const ARCHETYPE_LABELS: Record<string, string> = {
  industrial_importer: 'Industrial importer',
  resource_exporter: 'Resource exporter',
  transit_state: 'Transit state',
  rising_power: 'Rising power',
};

/** Fill a computer order's {self} and {target} with country names. */
export function fillNames(
  text: string,
  countries: Readonly<Record<string, { readonly name: string }>>,
  self: string,
  target?: string,
): string {
  const name = (id: string) => countries[id]?.name ?? id;
  return text
    .replaceAll('{self}', name(self))
    .replaceAll('{target}', target === undefined ? '' : name(target));
}
