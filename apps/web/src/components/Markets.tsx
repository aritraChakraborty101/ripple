import {
  effectiveStat,
  marketDemand,
  marketSupply,
  sortedIds,
  type GameState,
} from '@ripple/engine';
import { formatChange, formatPrice } from '../game/format';

interface Props {
  readonly game: GameState;
  readonly history: Readonly<Record<string, readonly number[]>>;
}

function Sparkline({
  values,
  base,
  tone,
}: {
  values: readonly number[];
  base: number;
  tone: string;
}) {
  const width = 200;
  const height = 36;
  const lo = Math.min(base, ...values);
  const hi = Math.max(base, ...values);
  const span = hi - lo || 1;
  const x = (i: number) => (values.length <= 1 ? width : (i / (values.length - 1)) * width);
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <line
        x1="0"
        x2={width}
        y1={y(base)}
        y2={y(base)}
        stroke="var(--line)"
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points}
        fill="none"
        stroke={tone}
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Markets({ game, history }: Props) {
  return (
    <section aria-labelledby="markets-title" className="markets-section">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <h2 id="markets-title">Markets</h2>
        <span className="muted small">Last {Math.min(history.oil?.length ?? 0, 120)} days</span>
      </div>
      <div className="markets">
        {sortedIds(game.world.resources).map((id) => {
          const resource = game.world.resources[id]!;
          const price = effectiveStat(game, { kind: 'resource', id, stat: 'price' });
          const pct = ((price - resource.basePrice) * 100) / resource.basePrice;
          const level = pct >= 30 ? 'critical' : pct >= 10 ? 'stressed' : '';
          const tone =
            level === 'critical'
              ? 'var(--critical)'
              : level === 'stressed'
                ? 'var(--warning)'
                : 'var(--accent)';
          return (
            <article key={id} className={`market ${level}`}>
              <div className="market-top">
                <span className="muted small">{resource.name}</span>
                <span className={`delta ${pct >= 10 ? 'up-bad' : 'calm'}`}>
                  {formatChange(price, resource.basePrice)}
                </span>
              </div>
              <span className="market-price">{formatPrice(price)}</span>
              <Sparkline values={history[id] ?? [price]} base={resource.basePrice} tone={tone} />
              <span className="market-foot">
                supply {marketSupply(game, id)} · demand {marketDemand(game, id)} a day
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
