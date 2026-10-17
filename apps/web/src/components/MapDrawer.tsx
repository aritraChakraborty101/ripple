import {
  effectiveStat,
  isLinkOpen,
  relationId,
  sortedIds,
  type GameState,
  type Link,
} from '@ripple/engine';
import { decisionsConcerning, relationLabel, relationTone } from '../game/describe';
import { ARCHETYPE_LABELS, formatShortDate } from '../game/format';
import type { Dispatch } from '../game/news';
import type { Selection } from '../game/selection';
import { DecisionCard } from './DecisionCard';
import { HomeFront } from './HomeFront';
import { useWhy } from './WhyContext';

interface Props {
  readonly game: GameState;
  readonly selection: NonNullable<Selection>;
  readonly dispatches: readonly Dispatch[];
  readonly onSelect: (selection: Selection) => void;
}

function RouteList({ game, links }: { game: GameState; links: readonly Link[] }) {
  if (links.length === 0) return <p className="muted small">None.</p>;
  return (
    <ul className="rows">
      {links.map((link) => {
        const open = isLinkOpen(game.world, link);
        const capacity = effectiveStat(game, { kind: 'link', id: link.id, stat: 'capacity' });
        const from = game.world.countries[link.from]!.name;
        const to = game.world.countries[link.to]!.name;
        const status = capacity <= 0 ? 'Planned' : open ? `${capacity} a day` : 'Cut';
        return (
          <li key={link.id} className="row">
            <span>
              {game.world.resources[link.resource]!.name}
              <span className="muted small">
                {' '}
                {from} → {to}
              </span>
            </span>
            <span
              className={`row-value ${!open && capacity > 0 ? 'tone-critical' : capacity <= 0 ? 'muted' : ''}`}
            >
              {status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RelationMeter({ value }: { value: number }) {
  const tone = relationTone(value);
  const clamped = Math.max(-100, Math.min(100, value));
  return (
    <div className="drawer-relation">
      <div className="drawer-relation-top">
        <span className="muted small">Relations with you</span>
        <span className={`tone-${tone} small`}>{relationLabel(value)}</span>
      </div>
      <span className={`drawer-relation-value tone-${tone}`}>
        {value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'}
      </span>
      <span className="center-meter" aria-hidden="true">
        <span
          className={tone}
          style={
            clamped >= 0
              ? { left: '50%', width: `${clamped / 2}%` }
              : { left: `${50 + clamped / 2}%`, width: `${-clamped / 2}%` }
          }
        />
      </span>
    </div>
  );
}

function Orders({ game, countryId }: { game: GameState; countryId: string }) {
  const name = game.world.countries[countryId]!.name;
  const orders = decisionsConcerning(game, countryId);
  return (
    <section className="drawer-section" aria-label={`Orders concerning ${name}`}>
      <h3>What you can do</h3>
      {orders.length === 0 ? (
        <p className="muted small">No orders concern {name} directly.</p>
      ) : (
        <ul className="decision-list">
          {orders.map((def) => (
            <DecisionCard key={def.id} game={game} def={def} compact />
          ))}
        </ul>
      )}
    </section>
  );
}

function CountryDetails({
  game,
  id,
  dispatches,
}: {
  game: GameState;
  id: string;
  dispatches: readonly Dispatch[];
}) {
  const me = game.rules.playerCountry;
  const country = game.world.countries[id]!;
  const why = useWhy();
  if (id === me) {
    return (
      <>
        <p className="muted small">Your country · {ARCHETYPE_LABELS[country.archetype]}</p>
        <HomeFront game={game} />
      </>
    );
  }

  const value = effectiveStat(game, { kind: 'relation', id: relationId(me, id), stat: 'value' });
  const shared = sortedIds(game.world.links)
    .map((l) => game.world.links[l]!)
    .filter((l) => (l.from === id && l.to === me) || (l.from === me && l.to === id));
  const news = dispatches.filter((d) => d.country === id).slice(0, 4);

  return (
    <>
      <p className="muted small">{ARCHETYPE_LABELS[country.archetype]}</p>
      <RelationMeter value={value} />
      <button
        type="button"
        className="text-button inline"
        onClick={() =>
          why({ kind: 'stat', ref: { kind: 'relation', id: relationId(me, id), stat: 'value' } })
        }
      >
        Why are relations here?
      </button>
      <section className="drawer-section">
        <h3>Trade with you</h3>
        <RouteList game={game} links={shared} />
      </section>
      <Orders game={game} countryId={id} />
      <section className="drawer-section">
        <h3>Recent news</h3>
        {news.length === 0 ? (
          <p className="muted small">Nothing yet.</p>
        ) : (
          <ul className="drawer-news">
            {news.map((d) => (
              <li key={d.id}>
                <span className={`dot ${d.severity}`} />
                <span>
                  {d.headline} <span className="muted small">· {formatShortDate(d.tick)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ChokepointDetails({
  game,
  id,
  onSelect,
}: {
  game: GameState;
  id: string;
  onSelect: Props['onSelect'];
}) {
  const me = game.rules.playerCountry;
  const why = useWhy();
  const chokepoint = game.world.chokepoints[id]!;
  const controller = game.world.countries[chokepoint.controlledBy]!;
  const routes = sortedIds(game.world.links)
    .map((l) => game.world.links[l]!)
    .filter((l) => l.via.includes(id));
  const value =
    controller.id === me
      ? null
      : effectiveStat(game, { kind: 'relation', id: relationId(me, controller.id), stat: 'value' });

  return (
    <>
      <p className={`small ${chokepoint.open ? 'muted' : 'tone-critical'}`}>
        {chokepoint.open ? 'Open to shipping' : 'Closed: routes through it carry nothing'}
      </p>
      {(!chokepoint.open || game.trace.chokepointBy[id]) && (
        <button
          type="button"
          className="text-button inline"
          onClick={() => why({ kind: 'chokepoint', id })}
        >
          {chokepoint.open ? 'Why is it open again?' : 'Why is it closed?'}
        </button>
      )}
      <section className="drawer-section">
        <h3>Controlled by</h3>
        <button
          type="button"
          className="row row-button"
          onClick={() => onSelect({ kind: 'country', id: controller.id })}
        >
          <span>{controller.name}</span>
          {value !== null && (
            <span className={`row-value tone-${relationTone(value)}`}>
              {value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0'}
              <span className="row-note">{relationLabel(value)}</span>
            </span>
          )}
        </button>
      </section>
      <section className="drawer-section">
        <h3>Routes through it</h3>
        <RouteList game={game} links={routes} />
      </section>
      {controller.id !== me && <Orders game={game} countryId={controller.id} />}
    </>
  );
}

/** Details for whatever is selected on the map, with the orders that concern it. */
export function MapDrawer({ game, selection, dispatches, onSelect }: Props) {
  const title =
    selection.kind === 'country'
      ? game.world.countries[selection.id]?.name
      : game.world.chokepoints[selection.id]?.name;
  if (!title) return null;

  return (
    <aside className="drawer" aria-labelledby="drawer-title">
      <div className="drawer-head">
        <h2 id="drawer-title">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close details"
          onClick={() => onSelect(null)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="drawer-body">
        {selection.kind === 'country' ? (
          <CountryDetails game={game} id={selection.id} dispatches={dispatches} />
        ) : (
          <ChokepointDetails game={game} id={selection.id} onSelect={onSelect} />
        )}
      </div>
    </aside>
  );
}
