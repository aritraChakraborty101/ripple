import { effectiveStat, isLinkOpen, sortedIds, type GameState, type Link } from '@ripple/engine';
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
}

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

function routeTitle(game: GameState, link: Link, open: boolean): string {
  const resource = game.world.resources[link.resource]?.name ?? link.resource;
  const from = game.world.countries[link.from]?.name ?? link.from;
  const to = game.world.countries[link.to]?.name ?? link.to;
  const capacity = effectiveStat(game, { kind: 'link', id: link.id, stat: 'capacity' });
  const blocked = link.via
    .map((id) => game.world.chokepoints[id])
    .filter((c) => c && !c.open)
    .map((c) => c!.name);
  return `${resource}: ${from} to ${to}, ${capacity} a day${
    open ? '' : `. Cut at the ${blocked.join(', ')}`
  }`;
}

export function WorldMap({ game, paused }: Props) {
  const player = game.rules.playerCountry;

  // Routes between the same two countries get different bends so they don't overlap.
  const pairCounts = new Map<string, number>();
  const routes = sortedIds(game.world.links).map((id) => {
    const link = game.world.links[id]!;
    const pair = [link.from, link.to].sort().join('|');
    const index = pairCounts.get(pair) ?? 0;
    pairCounts.set(pair, index + 1);
    const open = isLinkOpen(game.world, link);
    return { link, open, d: routePath(link, 22 + index * 18) };
  });

  return (
    <div className="map">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label="Map of the five countries, their trade routes and the South Strait"
      >
        {sortedIds(game.world.countries).map((id) => {
          const shape = COUNTRY_SHAPES[id];
          if (!shape) return null;
          const isPlayer = id === player;
          return (
            <polygon
              key={id}
              points={shape.points}
              fill={
                isPlayer
                  ? 'var(--accent-tint)'
                  : id === 'corvan'
                    ? 'var(--land-alt)'
                    : 'var(--land)'
              }
              stroke={isPlayer ? 'var(--accent)' : 'var(--land-edge)'}
              strokeWidth={isPlayer ? 2 : 1}
            />
          );
        })}

        {routes.map(({ link, open, d }) =>
          d ? (
            <path
              key={link.id}
              className="route"
              d={d}
              fill="none"
              stroke={open ? 'var(--route)' : 'var(--critical)'}
              strokeWidth={open ? 1.5 : 1.75}
              strokeDasharray={open ? undefined : '6 6'}
              opacity={open ? 0.75 : 1}
            >
              <title>{routeTitle(game, link, open)}</title>
            </path>
          ) : null,
        )}

        {sortedIds(game.world.chokepoints).map((id) => {
          const point = CHOKEPOINT_POSITIONS[id];
          const chokepoint = game.world.chokepoints[id]!;
          if (!point) return null;
          return (
            <g key={id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={13}
                fill={chokepoint.open ? 'var(--map-sea)' : 'var(--critical-tint)'}
                stroke={chokepoint.open ? 'var(--route)' : 'var(--critical)'}
                strokeWidth={1.5}
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

        {sortedIds(game.world.countries).map((id) => {
          const shape = COUNTRY_SHAPES[id];
          if (!shape) return null;
          return (
            <text
              key={id}
              x={shape.label.x}
              y={shape.label.y}
              textAnchor="middle"
              fontFamily="var(--serif)"
              fontSize={shape.labelSize}
              fill={id === player ? 'var(--accent-strong)' : 'var(--ink-soft)'}
            >
              {game.world.countries[id]!.name}
            </text>
          );
        })}
      </svg>

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
      </div>

      {paused && <div className="paused-badge">Paused</div>}
    </div>
  );
}
