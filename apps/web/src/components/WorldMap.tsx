import {
  effectiveStat,
  isLinkOpen,
  relationId,
  sortedIds,
  type GameState,
  type Link,
} from '@ripple/engine';
import type { KeyboardEvent } from 'react';
import { relationLabel, relationTone, type Tone } from '../game/describe';
import type { Selection } from '../game/selection';
import {
  CHOKEPOINT_POSITIONS,
  COUNTRY_SHAPES,
  MAP_HEIGHT,
  MAP_WIDTH,
  curve,
  throughPath,
  type Point,
} from '../map/layout';

interface Props {
  readonly game: GameState;
  readonly paused: boolean;
  readonly selection: Selection;
  readonly onSelect: (selection: Selection) => void;
  /** A country in crisis right now, ringed on the map. */
  readonly alertCountry: string | null;
  readonly showLegend: boolean;
  /** A country to draw the eye to, such as the next first step. */
  readonly highlightCountry: string | null;
}

const TONE_COLOR: Record<Tone, string> = {
  calm: 'var(--land-edge)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
};

function routePath(link: Link, bend: number): string | null {
  const from = COUNTRY_SHAPES[link.from]?.anchor;
  const to = COUNTRY_SHAPES[link.to]?.anchor;
  if (!from || !to) return null;
  if (link.via.length === 0) return curve(from, to, bend);
  const waypoints: Point[] = link.via
    .map((id) => CHOKEPOINT_POSITIONS[id])
    .filter((p): p is Point => p !== undefined);
  return throughPath([from, ...waypoints, to]);
}

function routeTitle(game: GameState, link: Link, open: boolean, capacity: number): string {
  const resource = game.world.resources[link.resource]?.name ?? link.resource;
  const from = game.world.countries[link.from]?.name ?? link.from;
  const to = game.world.countries[link.to]?.name ?? link.to;
  if (capacity <= 0) return `${resource}: ${from} to ${to}, planned, not built yet`;
  const blocked = link.via
    .map((id) => game.world.chokepoints[id])
    .filter((c) => c && !c.open)
    .map((c) => c!.name);
  return `${resource}: ${from} to ${to}, ${capacity} a day${
    open ? '' : `. Cut at the ${blocked.join(', ')}`
  }`;
}

/** Enter or Space activates an SVG element that acts as a button. */
function activateOnKey(action: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
}

export function WorldMap({
  game,
  paused,
  selection,
  onSelect,
  alertCountry,
  showLegend,
  highlightCountry,
}: Props) {
  const player = game.rules.playerCountry;
  const relationOf = (id: string) =>
    effectiveStat(game, { kind: 'relation', id: relationId(player, id), stat: 'value' });

  // Routes between the same two countries get different bends so they don't overlap.
  const pairCounts = new Map<string, number>();
  const routes = sortedIds(game.world.links).map((id) => {
    const link = game.world.links[id]!;
    const pair = [link.from, link.to].sort().join('|');
    const index = pairCounts.get(pair) ?? 0;
    pairCounts.set(pair, index + 1);
    const open = isLinkOpen(game.world, link);
    const capacity = effectiveStat(game, { kind: 'link', id, stat: 'capacity' });
    return { link, open, capacity, d: routePath(link, 22 + index * 18) };
  });

  const isSelected = (kind: 'country' | 'chokepoint', id: string) =>
    selection?.kind === kind && selection.id === id;

  return (
    <div className="map">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Map. Select a country or the strait for details."
      >
        {/* Clickable land */}
        {sortedIds(game.world.countries).map((id) => {
          const shape = COUNTRY_SHAPES[id];
          if (!shape) return null;
          const isPlayer = id === player;
          const name = game.world.countries[id]!.name;
          const value = isPlayer ? 0 : relationOf(id);
          const tone: Tone = isPlayer ? 'calm' : relationTone(value);
          const selected = isSelected('country', id);
          const select = () => onSelect(selected ? null : { kind: 'country', id });
          return (
            <g
              key={id}
              className={`country-hit ${selected ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={
                isPlayer
                  ? `${name}, your country. Show details.`
                  : `${name}, relations ${value}, ${relationLabel(value)}. Show details.`
              }
              onClick={select}
              onKeyDown={activateOnKey(select)}
            >
              <polygon
                className="country"
                points={shape.points}
                fill={
                  isPlayer
                    ? 'var(--accent-tint)'
                    : id === 'corvan'
                      ? 'var(--land-alt)'
                      : 'var(--land)'
                }
                stroke={isPlayer ? 'var(--accent)' : TONE_COLOR[tone]}
                strokeWidth={isPlayer ? 2 : tone === 'calm' ? 1 : 1.5}
              />
            </g>
          );
        })}

        {/* Trade routes */}
        {routes.map(({ link, open, capacity, d }) => {
          if (!d) return null;
          const planned = capacity <= 0;
          return (
            <path
              key={link.id}
              className="route"
              d={d}
              fill="none"
              stroke={!open ? 'var(--critical)' : planned ? 'var(--land-edge)' : 'var(--route)'}
              strokeWidth={open ? 1.5 : 1.75}
              strokeDasharray={!open ? '6 6' : planned ? '2 5' : undefined}
              opacity={open ? 0.75 : 1}
            >
              <title>{routeTitle(game, link, open, capacity)}</title>
            </path>
          );
        })}

        {/* Chokepoints */}
        {sortedIds(game.world.chokepoints).map((id) => {
          const point = CHOKEPOINT_POSITIONS[id];
          const chokepoint = game.world.chokepoints[id]!;
          if (!point) return null;
          const selected = isSelected('chokepoint', id);
          const select = () => onSelect(selected ? null : { kind: 'chokepoint', id });
          return (
            <g
              key={id}
              className={`chokepoint-hit ${selected ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${chokepoint.name}, ${chokepoint.open ? 'open' : 'closed'}. Show details.`}
              onClick={select}
              onKeyDown={activateOnKey(select)}
            >
              {!chokepoint.open && (
                <circle
                  className="pulse"
                  cx={point.x}
                  cy={point.y}
                  r={13}
                  fill="none"
                  stroke="var(--critical)"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={13}
                fill={chokepoint.open ? 'var(--map-sea)' : 'var(--critical-tint)'}
                stroke={
                  selected ? 'var(--ink)' : chokepoint.open ? 'var(--route)' : 'var(--critical)'
                }
                strokeWidth={selected ? 2 : 1.5}
              />
              {chokepoint.open ? (
                <circle cx={point.x} cy={point.y} r={3.5} fill="var(--route)" />
              ) : (
                <path
                  d={`M${point.x - 6} ${point.y - 6} L${point.x + 6} ${point.y + 6} M${point.x + 6} ${point.y - 6} L${point.x - 6} ${point.y + 6}`}
                  stroke="var(--critical)"
                  strokeWidth={1.75}
                />
              )}
              <text
                x={point.x}
                y={point.y + 34}
                textAnchor="middle"
                fontFamily="var(--sans)"
                fontSize={12}
                fill={chokepoint.open ? 'var(--ink-muted)' : 'var(--critical)'}
              >
                {chokepoint.name}
                {chokepoint.open ? '' : ' · closed'}
              </text>
            </g>
          );
        })}

        {/* Labels and relation badges sit on top but let clicks through to the land. */}
        <g pointerEvents="none">
          {sortedIds(game.world.countries).map((id) => {
            const shape = COUNTRY_SHAPES[id];
            if (!shape) return null;
            const isPlayer = id === player;
            const value = isPlayer ? 0 : relationOf(id);
            const tone: Tone = isPlayer ? 'calm' : relationTone(value);
            const badge = isPlayer
              ? 'You'
              : value > 0
                ? `+${value}`
                : value < 0
                  ? `−${-value}`
                  : '0';
            const badgeWidth = 12 + badge.length * 7.5;
            const by = shape.label.y + 10;
            return (
              <g key={id}>
                {alertCountry === id && (
                  <circle
                    className="pulse"
                    cx={shape.label.x}
                    cy={shape.label.y - 6}
                    r={26}
                    fill="none"
                    stroke="var(--critical)"
                  />
                )}
                {highlightCountry === id && alertCountry !== id && (
                  <circle
                    className="pulse"
                    cx={shape.label.x}
                    cy={shape.label.y - 6}
                    r={26}
                    fill="none"
                    stroke="var(--accent)"
                  />
                )}
                <text
                  x={shape.label.x}
                  y={shape.label.y}
                  textAnchor="middle"
                  fontFamily="var(--serif)"
                  fontSize={shape.labelSize}
                  fill={isPlayer ? 'var(--accent-strong)' : 'var(--ink-soft)'}
                >
                  {game.world.countries[id]!.name}
                </text>
                <rect
                  x={shape.label.x - badgeWidth / 2}
                  y={by}
                  width={badgeWidth}
                  height={18}
                  rx={9}
                  fill={
                    isPlayer
                      ? 'var(--accent-tint)'
                      : tone === 'critical'
                        ? 'var(--critical-tint)'
                        : tone === 'warning'
                          ? 'var(--warning-tint)'
                          : 'var(--panel)'
                  }
                  stroke={isPlayer ? 'var(--accent)' : TONE_COLOR[tone]}
                  strokeWidth={1}
                />
                <text
                  x={shape.label.x}
                  y={by + 13}
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                  fontSize={11}
                  fill={
                    isPlayer
                      ? 'var(--accent-strong)'
                      : tone === 'critical'
                        ? 'var(--critical)'
                        : tone === 'warning'
                          ? 'var(--warning-ink)'
                          : 'var(--ink-muted)'
                  }
                >
                  {badge}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {showLegend && (
        <div className="legend" aria-hidden="true">
          <span>
            <svg width="22" height="6">
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--route)" strokeWidth="1.5" />
            </svg>
            Trade route
          </span>
          <span>
            <svg width="22" height="6">
              <line
                x1="0"
                y1="3"
                x2="22"
                y2="3"
                stroke="var(--critical)"
                strokeWidth="1.75"
                strokeDasharray="4 4"
              />
            </svg>
            Route cut
          </span>
          <span>
            <span className="legend-badge">+10</span>
            Relations with you
          </span>
        </div>
      )}
      {paused && <div className="paused-badge">Paused</div>}
    </div>
  );
}
