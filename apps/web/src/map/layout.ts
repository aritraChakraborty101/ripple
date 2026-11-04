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

/** One quadratic Bézier piece of a route: start, control point, end. */
export interface Quad {
  readonly from: Point;
  readonly control: Point;
  readonly to: Point;
}

/**
 * A gentle curve between two points. `bend` offsets the control point
 * sideways so parallel routes between neighbors don't overlap.
 */
export function curveQuads(from: Point, to: Point, bend: number): Quad[] {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return [{ from, control: { x: mx - (dy / len) * bend, y: my + (dx / len) * bend }, to }];
}

/** A route that passes through waypoints (such as a strait), smoothed at each one. */
export function throughQuads(points: readonly Point[]): Quad[] {
  const quads: Quad[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const p = points[i]!;
    const control = {
      x: (prev.x + p.x) / 2,
      y: (prev.y + p.y) / 2 + ((i - 1) % 2 === 0 ? 18 : -18),
    };
    quads.push({ from: prev, control, to: p });
  }
  return quads;
}

/** Quads as an SVG path. */
export function quadsPath(quads: readonly Quad[]): string {
  if (quads.length === 0) return '';
  let d = `M${quads[0]!.from.x} ${quads[0]!.from.y}`;
  for (const q of quads) d += ` Q${q.control.x} ${q.control.y} ${q.to.x} ${q.to.y}`;
  return d;
}

function quadAt(q: Quad, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * q.from.x + 2 * u * t * q.control.x + t * t * q.to.x,
    y: u * u * q.from.y + 2 * u * t * q.control.y + t * t * q.to.y,
  };
}

/** Rough length of a piece: halfway between its chord and its control polygon. */
function quadLength(q: Quad): number {
  const chord = Math.hypot(q.to.x - q.from.x, q.to.y - q.from.y);
  const polygon =
    Math.hypot(q.control.x - q.from.x, q.control.y - q.from.y) +
    Math.hypot(q.to.x - q.control.x, q.to.y - q.control.y);
  return (chord + polygon) / 2;
}

/** The point a share `t` (0 to 1) of the way along a route, by rough length. */
export function pointAlong(quads: readonly Quad[], t: number): Point | null {
  if (quads.length === 0) return null;
  const lengths = quads.map(quadLength);
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let left = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < quads.length; i += 1) {
    const length = lengths[i]!;
    if (left <= length || i === quads.length - 1) {
      return quadAt(quads[i]!, length > 0 ? Math.min(1, left / length) : 1);
    }
    left -= length;
  }
  return null;
}

/**
 * A gentle curve between two points. `bend` offsets the control point
 * sideways so parallel routes between neighbors don't overlap.
 */
export function curve(from: Point, to: Point, bend: number): string {
  return quadsPath(curveQuads(from, to, bend));
}

/** A route that passes through waypoints (such as a strait), smoothed at each one. */
export function throughPath(points: readonly Point[]): string {
  if (points.length < 2) return '';
  return quadsPath(throughQuads(points));
}
