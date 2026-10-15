/**
 * Presentation data for the map: shapes and anchor points per entity ID.
 * This lives in the web app, not in content, because it is purely visual.
 * Coordinates are in a 900 x 520 viewBox.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface CountryShape {
  readonly points: string;
  /** Where routes start and end. */
  readonly anchor: Point;
  readonly label: Point;
  readonly labelSize: number;
}

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 520;

export const COUNTRY_SHAPES: Readonly<Record<string, CountryShape>> = {
  orrin: {
    points: '60,40 200,30 232,92 122,112',
    anchor: { x: 150, y: 82 },
    label: { x: 145, y: 66 },
    labelSize: 16,
  },
  aldoria: {
    points: '120,150 300,118 360,192 332,300 200,334 108,262',
    anchor: { x: 230, y: 236 },
    label: { x: 222, y: 214 },
    labelSize: 20,
  },
  thessa: {
    points: '400,100 600,62 760,122 720,240 560,252 470,222 362,190',
    anchor: { x: 565, y: 165 },
    label: { x: 590, y: 140 },
    labelSize: 18,
  },
  corvan: {
    points: '332,300 362,190 470,222 500,318 432,380 340,362',
    anchor: { x: 410, y: 300 },
    label: { x: 418, y: 278 },
    labelSize: 17,
  },
  veskar: {
    points: '560,300 700,262 820,320 800,440 640,462 545,402',
    anchor: { x: 670, y: 380 },
    label: { x: 690, y: 356 },
    labelSize: 18,
  },
};

export const CHOKEPOINT_POSITIONS: Readonly<Record<string, Point>> = {
  south_strait: { x: 520, y: 356 },
};

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
