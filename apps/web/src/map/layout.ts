/**
 * Geometry helpers for drawing the map. The map's data (country shapes and
 * strait positions) lives with the scenario in map.yaml; this file only turns
 * it into SVG paths.
 */

import type { CountryShape, MapPoint } from '@ripple/content';

export type Point = MapPoint;

/** A country's outline as an SVG polygon `points` attribute. */
export function outlinePoints(shape: CountryShape): string {
  return shape.outline.map((p) => `${p.x},${p.y}`).join(' ');
}

/**
 * A gentle curve between two points. `bend` offsets the control point
 * sideways so parallel routes between neighbors don't overlap.
 */
export function curve(from: Point, to: Point, bend: number): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return `M${from.x} ${from.y} Q${cx} ${cy} ${to.x} ${to.y}`;
}

/** A route that passes through waypoints (such as a strait), smoothed at each one. */
export function throughPath(points: readonly Point[]): string {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  let d = `M${first!.x} ${first!.y}`;
  for (let i = 0; i < rest.length; i += 1) {
    const p = rest[i]!;
    const prev = points[i]!;
    const cx = (prev.x + p.x) / 2;
    const cy = (prev.y + p.y) / 2 + (i % 2 === 0 ? 18 : -18);
    d += ` Q${cx} ${cy} ${p.x} ${p.y}`;
  }
  return d;
}
