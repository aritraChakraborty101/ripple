import {
  effectiveStat,
  isEmbargoed,
  isLinkOpen,
  relationId,
  sortedIds,
  type GameState,
  type Link,
} from '@ripple/engine';
import { useMemo, type KeyboardEvent } from 'react';
import { relationLabel } from '../game/describe';
import { lensView, type CountryLook, type Ink, type Lens, type RouteLook } from '../game/lenses';
import type { Selection } from '../game/selection';
import type { ScenarioMap } from '@ripple/content';
import type { Ripple } from '../game/ripples';
import { curve, outlinePoints, throughPath, type Point } from '../map/layout';
import { RippleLayer } from './RippleLayer';

interface Props {
  readonly game: GameState;
  /** How the scenario's world is drawn, from its map.yaml. */
  readonly map: ScenarioMap;
  readonly paused: boolean;
  readonly selection: Selection;
  readonly onSelect: (selection: Selection) => void;
  /** A country in crisis right now, ringed on the map. */
  readonly alertCountry: string | null;
  readonly showLegend: boolean;
  /** A country to draw the eye to, such as the next first step. */
  readonly highlightCountry: string | null;
  /** Where something just happened, to spread rings from. */
  readonly ripples: readonly Ripple[];
  /** Which question the map answers: who's with you, trade, prices, unrest or intelligence. */
  readonly lens: Lens;
}

/** Coastal halos, outermost first: the sea gets shallower toward land. */
const HALOS = [
  { width: 54, color: 'var(--sea-depth-1)' },
  { width: 30, color: 'var(--sea-depth-2)' },
  { width: 12, color: 'var(--sea-depth-3)' },
] as const;

const INK: Record<Ink | 'route', string> = {
  you: 'var(--you)',
  threat: 'var(--threat-ink)',
  warning: 'var(--shaky-ink)',
  friend: 'var(--friend)',
  quiet: 'var(--ink-quiet)',
  faint: 'var(--ink-faint)',
  route: 'var(--route-d)',
};

const LAND: Record<CountryLook['land'], { fill: string; stroke: string; width: number }> = {
  you: { fill: 'var(--you-fill)', stroke: 'var(--you)', width: 2 },
  threat: { fill: 'var(--threat-fill)', stroke: 'var(--threat)', width: 1.75 },
  warning: { fill: 'var(--shaky-fill)', stroke: 'var(--shaky)', width: 1.5 },
  plain: { fill: 'var(--land-d)', stroke: 'var(--coast)', width: 1 },
};

function routePath(map: ScenarioMap, link: Link, bend: number): string | null {
  const from = map.countries[link.from]?.anchor;
  const to = map.countries[link.to]?.anchor;
  if (!from || !to) return null;
  if (link.via.length === 0) return curve(from, to, bend);
  const waypoints: Point[] = link.via
    .map((id) => map.chokepoints[id])
    .filter((p): p is Point => p !== undefined);
  return throughPath([from, ...waypoints, to]);
}

function routeTitle(game: GameState, link: Link, open: boolean, capacity: number): string {
  const resource = game.world.resources[link.resource]?.name ?? link.resource;
  const from = game.world.countries[link.from]?.name ?? link.from;
  const to = game.world.countries[link.to]?.name ?? link.to;
  if (capacity <= 0) return `${resource}: ${from} to ${to}, not in use yet`;
  const blocked = link.via
    .map((id) => game.world.chokepoints[id])
    .filter((c) => c && !c.open)
    .map((c) => c!.name);
  const cut =
    blocked.length > 0
      ? `. Cut at the ${blocked.join(', ')}`
      : isEmbargoed(game.world, link.from, link.to)
        ? '. Cut by sanctions'
        : '';
  return `${resource}: ${from} to ${to}, ${capacity} a day${open ? '' : cut}`;
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
  map,
  paused,
  selection,
  onSelect,
  alertCountry,
  showLegend,
  highlightCountry,
  ripples,
  lens,
}: Props) {
  const player = game.rules.playerCountry;
  const view = useMemo(() => lensView(game, lens), [game, lens]);
  const relationOf = (id: string) =>
    effectiveStat(game, { kind: 'relation', id: relationId(player, id), stat: 'value' });

  // Links that share a path and a state are drawn as one line; routes between
  // the same two countries get different bends so they don't overlap.
  // The lens decides each link's look; a group keeps its strongest.
  const groups = new Map<
    string,
    { link: Link; open: boolean; planned: boolean; titles: string[]; look: RouteLook }
  >();
  for (const id of sortedIds(game.world.links)) {
    const link = game.world.links[id]!;
    const open = isLinkOpen(game.world, link);
    const capacity = effectiveStat(game, { kind: 'link', id, stat: 'capacity' });
    const planned = capacity <= 0;
    const look = view.routes[id] ?? { width: 1.3, ink: 'route' as const, opacity: 0.6 };
    const key = `${link.from}>${link.to}>${link.via.join(',')}>${open}>${planned}>${look.ink}`;
    const group = groups.get(key);
    if (group) {
      group.titles.push(routeTitle(game, link, open, capacity));
      if (look.width > group.look.width) group.look = look;
    } else {
      groups.set(key, {
        link,
        open,
        planned,
        titles: [routeTitle(game, link, open, capacity)],
        look,
      });
    }
  }
  const pairCounts = new Map<string, number>();
  const routes = [...groups.entries()].map(([key, group]) => {
    const pair = [group.link.from, group.link.to].sort().join('|');
    const index = pairCounts.get(pair) ?? 0;
    pairCounts.set(pair, index + 1);
    return { key, ...group, d: routePath(map, group.link, 22 + index * 18) };
  });

  const lookOf = (id: string): CountryLook =>
    view.countries[id] ?? { land: 'plain', note: '', noteInk: 'faint', dim: false };
  // Labels are haloed in their land's colour, so routes pass under them.
  const landOf = (id: string) => LAND[lookOf(id).land].fill;

  const isSelected = (kind: 'country' | 'chokepoint', id: string) =>
    selection?.kind === kind && selection.id === id;

  return (
    <div className="map">
      <svg
        viewBox={`0 0 ${map.width} ${map.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Map. Select a country or the strait for details."
      >
        {/* Depth around every coast, drawn under the land */}
        <g aria-hidden="true" strokeLinejoin="round">
          {HALOS.map((halo) => (
            <g key={halo.width} fill={halo.color} stroke={halo.color} strokeWidth={halo.width}>
              {sortedIds(game.world.countries).map((id) => {
                const shape = map.countries[id];
                return shape ? <polygon key={id} points={outlinePoints(shape)} /> : null;
              })}
            </g>
          ))}
        </g>

        {/* Clickable land */}
        {sortedIds(game.world.countries).map((id) => {
          const shape = map.countries[id];
          if (!shape) return null;
          const isPlayer = id === player;
          const name = game.world.countries[id]!.name;
          const value = isPlayer ? 0 : relationOf(id);
          const look = lookOf(id);
          const land = LAND[look.land];
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
                  ? `${name}, your country.${look.note && lens !== 'relations' ? ` ${look.note}.` : ''} Show details.`
                  : `${name}, relations ${value}, ${relationLabel(value)}.${lens !== 'relations' && look.note ? ` ${look.note}.` : ''} Show details.`
              }
              onClick={select}
              onKeyDown={activateOnKey(select)}
            >
              <polygon
                className="country"
                points={outlinePoints(shape)}
                fill={land.fill}
                stroke={land.stroke}
                strokeWidth={land.width}
                strokeLinejoin="round"
                opacity={look.dim ? 0.45 : 1}
              />
            </g>
          );
        })}

        {/* Trade routes */}
        {routes.map(({ key, open, planned, titles, d, look }) => {
          if (!d) return null;
          return (
            <path
              key={key}
              className="route"
              d={d}
              fill="none"
              stroke={!open ? 'var(--threat)' : planned ? 'var(--coast)' : INK[look.ink]}
              strokeWidth={open ? look.width : 1.75}
              strokeLinecap="round"
              strokeDasharray={!open ? '6 6' : planned ? '2 5' : undefined}
              opacity={open ? (planned ? Math.min(0.45, look.opacity) : look.opacity) : 1}
            >
              <title>{titles.join('\n')}</title>
            </path>
          );
        })}

        {/* Chokepoints */}
        {sortedIds(game.world.chokepoints).map((id) => {
          const point = map.chokepoints[id];
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

        <RippleLayer
          key={game.seed}
          ripples={ripples}
          map={map}
          routes={routes.flatMap((r) => (r.d ? [{ key: r.key, d: r.d, via: r.link.via }] : []))}
        />

        {/* Labels and relation badges sit on top but let clicks through to the land. */}
        <g pointerEvents="none">
          {sortedIds(game.world.countries).map((id) => {
            const shape = map.countries[id];
            if (!shape) return null;
            const isPlayer = id === player;
            const look = lookOf(id);
            const name = game.world.countries[id]!.name;
            return (
              <g key={id}>
                {alertCountry === id && (
                  <circle
                    className="pulse"
                    cx={shape.label.x}
                    cy={shape.label.y - 6}
                    r={26}
                    fill="none"
                    stroke="var(--threat)"
                  />
                )}
                {highlightCountry === id && alertCountry !== id && (
                  <circle
                    className="pulse"
                    cx={shape.label.x}
                    cy={shape.label.y - 6}
                    r={26}
                    fill="none"
                    stroke="var(--you)"
                  />
                )}
                <text
                  className="country-label"
                  stroke={landOf(id)}
                  x={shape.label.x}
                  y={shape.label.y}
                  textAnchor="middle"
                  fontSize={Math.round(shape.labelSize * 0.72)}
                  fill={
                    isPlayer
                      ? 'var(--you-strong)'
                      : look.land === 'threat'
                        ? 'var(--threat-ink)'
                        : 'var(--ink-quiet)'
                  }
                  opacity={look.dim ? 0.55 : 1}
                >
                  {name.toUpperCase()}
                </text>
                {look.note && (
                  <text
                    className="relation-number"
                    stroke={landOf(id)}
                    x={shape.label.x}
                    y={shape.label.y + 20}
                    textAnchor="middle"
                    fontSize={lens === 'relations' && !isPlayer ? 13 : 11}
                    fill={INK[look.noteInk]}
                  >
                    {isPlayer && lens === 'relations' ? 'YOU' : look.note}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {showLegend && (
        <div className="legend" aria-hidden="true">
          <span>
            <svg width="22" height="6">
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--route-d)" strokeWidth="1.5" />
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
            <span className="legend-number">+10</span>
            Relations with you
          </span>
        </div>
      )}
      {paused && <div className="paused-badge">Paused</div>}
    </div>
  );
}
