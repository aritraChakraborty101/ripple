import { effectiveStat, sortedIds, type GameState } from '@ripple/engine';
import { formatChange, formatPrice } from '../game/format';
import { Hint } from './Hint';
import { Sparkline } from './Sparkline';
import { useWhy } from './WhyContext';

interface Props {
  readonly game: GameState;
  readonly history: Readonly<Record<string, readonly number[]>>;
}

/** Bottom left: world prices. Quiet until a price starts to hurt. */
export function Markets({ game, history }: Props) {
  const why = useWhy();
  return (
    <ul className="markets glass" aria-label="Markets">
      {sortedIds(game.world.resources).map((rid) => {
        const resource = game.world.resources[rid]!;
        const price = effectiveStat(game, { kind: 'resource', id: rid, stat: 'price' });
        const pct = ((price - resource.basePrice) * 100) / resource.basePrice;
        const level = pct >= 30 ? 'critical' : pct >= 10 ? 'warning' : 'calm';
        const color =
          level === 'critical'
            ? 'var(--threat)'
            : level === 'warning'
              ? 'var(--you)'
              : 'var(--ink-faint)';
        return (
          <li key={rid}>
            <Hint
              focusable={false}
              text={`${resource.name}: price per unit, normally ${formatPrice(resource.basePrice)}. It rises when open routes supply less than countries demand, and dearer goods upset factions at home. Click to see why.`}
            >
              <button
                type="button"
                className={`market ${level}`}
                aria-label={`${resource.name} ${formatPrice(price)}, ${formatChange(price, resource.basePrice)} from normal. Why?`}
                onClick={() =>
                  why({ kind: 'stat', ref: { kind: 'resource', id: rid, stat: 'price' } })
                }
              >
                <span className="market-name">{resource.name}</span>
                <span className="market-price">
                  {formatPrice(price)}
                  {level !== 'calm' && (
                    <span className={`market-change tone-${level}`}>
                      {formatChange(price, resource.basePrice)}
                    </span>
                  )}
                </span>
                <Sparkline
                  values={history[rid] ?? [price]}
                  base={resource.basePrice}
                  tone={color}
                  width={76}
                  height={14}
                />
              </button>
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}
