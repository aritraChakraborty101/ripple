/** Response curves: turning a measured number into appeal from 0 to 10000. */

import type { Curve } from './types';

export const FULL = 10_000;

/** 0 at `from`, FULL at `to`, a straight line between, clamped. Works in either direction. */
function line(value: number, from: number, to: number): number {
  if (from === to) return value >= to ? FULL : 0;
  const t = Math.trunc(((value - from) * FULL) / (to - from));
  return Math.min(FULL, Math.max(0, t));
}

export function curveValue(curve: Curve, value: number): number {
  switch (curve.type) {
    case 'rises':
      return line(value, curve.from, curve.to);
    case 'falls':
      return FULL - line(value, curve.from, curve.to);
    case 'peaks':
      return Math.min(line(value, curve.from, curve.peak), line(value, curve.to, curve.peak));
    case 'step':
      return value >= curve.at ? FULL : 0;
  }
}

/** How a curve reads in a report, such as "rises from -20 to -60". */
export function curveLabel(curve: Curve): string {
  switch (curve.type) {
    case 'rises':
    case 'falls':
      return `${curve.type} from ${curve.from} to ${curve.to}`;
    case 'peaks':
      return `peaks at ${curve.peak}, between ${curve.from} and ${curve.to}`;
    case 'step':
      return `at least ${curve.at}`;
  }
}
