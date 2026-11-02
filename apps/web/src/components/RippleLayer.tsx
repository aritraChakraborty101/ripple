import type { ScenarioMap } from '@ripple/content';
import { useState } from 'react';
import type { Ripple, RippleTone } from '../game/ripples';
import type { Point } from '../map/layout';

/** A route the ripple runs along: its path, and the chokepoints it passes. */
export interface RippleRoute {
  readonly key: string;
  readonly d: string;
  readonly via: readonly string[];
}

interface Props {
  readonly ripples: readonly Ripple[];
  readonly map: ScenarioMap;
  readonly routes: readonly RippleRoute[];
}

const TONE: Record<RippleTone, string> = {
  threat: 'var(--threat)',
  friend: 'var(--friend)',
  you: 'var(--you)',
  quiet: 'var(--ink-quiet)',
};

/** Rings per ripple, spreading one after another. */
const RINGS = [0, 1, 2, 3] as const;

function placeOf(map: ScenarioMap, ripple: Ripple): Point | null {
  if (ripple.at.kind === 'chokepoint') return map.chokepoints[ripple.at.id] ?? null;
  const shape = map.countries[ripple.at.id];
  return shape ? { x: shape.label.x, y: shape.label.y - 6 } : null;
}

/**
 * Rings spread from where something happened; when a chokepoint closes or
 * reopens, a pulse then runs along every route through it. Each ripple plays
 * once (about 1.5 seconds, paused or not) and is retired when its last ring ends.
 */
export function RippleLayer({ ripples, map, routes }: Props) {
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());
  const finish = (id: number) => setDone((prev) => new Set(prev).add(id));

  return (
    <g className="ripples" aria-hidden="true" pointerEvents="none">
      {ripples.map((ripple) => {
        if (done.has(ripple.id)) return null;
        const at = placeOf(map, ripple);
        if (!at) return null;
        const color = TONE[ripple.tone];
        const through =
          ripple.at.kind === 'chokepoint' ? routes.filter((r) => r.via.includes(ripple.at.id)) : [];
        return (
          <g key={ripple.id} className={`ripple tone-${ripple.tone}`}>
            {through.map((route) => (
              <path
                key={route.key}
                className="ripple-route"
                d={route.d}
                pathLength={100}
                fill="none"
                stroke={color}
              />
            ))}
            {RINGS.map((i) => (
              <circle
                key={i}
                className="ripple-ring"
                cx={at.x}
                cy={at.y}
                r={150}
                fill="none"
                stroke={color}
                style={{ animationDelay: `${i * 170}ms` }}
                {...(i === RINGS.length - 1 ? { onAnimationEnd: () => finish(ripple.id) } : {})}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}
