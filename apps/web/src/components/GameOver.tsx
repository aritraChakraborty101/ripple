import { effectiveStat, type GameState } from '@ripple/engine';
import { useEffect, useRef } from 'react';
import { formatDate } from '../game/format';
import type { Tallies } from '../game/session';
import { actions } from '../game/store';

interface Props {
  readonly game: GameState;
  readonly tallies: Tallies;
  readonly startTreasury: number;
}

export function GameOver({ game, tallies, startTreasury }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const outcome = game.outcome;

  useEffect(() => {
    const dialog = ref.current;
    if (outcome && dialog && !dialog.open) dialog.showModal();
  }, [outcome]);

  if (!outcome) return null;

  const me = game.rules.playerCountry;
  const country = game.world.countries[me]!;
  const stability = effectiveStat(game, { kind: 'country', id: me, stat: 'stability' });
  const treasury = effectiveStat(game, { kind: 'country', id: me, stat: 'treasury' });
  const days = outcome.tick + 1;
  const ousted = outcome.result === 'ousted';

  return (
    <dialog ref={ref} className="sheet game-over" aria-labelledby="game-over-title">
      <p className={`eyebrow ${ousted ? 'critical-text' : ''}`}>
        {ousted ? 'Ousted' : 'Term complete'}
      </p>
      <h2 id="game-over-title">
        {ousted
          ? `Your government in ${country.name} has fallen`
          : `You led ${country.name} through a full term`}
      </h2>
      <p className="sheet-note">
        {ousted
          ? `Stability stayed below ${game.rules.ousting.below} for ${game.rules.ousting.forTicks} days, and the country turned on its leader on ${formatDate(outcome.tick)}.`
          : `Five years of crises, and the government is still standing on ${formatDate(outcome.tick)}.`}
      </p>
      <dl className="summary">
        <div>
          <dt>Days in office</dt>
          <dd>{days}</dd>
        </div>
        <div>
          <dt>Crises faced</dt>
          <dd>{tallies.crises}</dd>
        </div>
        <div>
          <dt>Orders signed</dt>
          <dd>
            {tallies.ordersSigned}
            {tallies.ordersFailed > 0 && (
              <span className="muted small"> ({tallies.ordersFailed} failed)</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Final stability</dt>
          <dd>{stability}</dd>
        </div>
        <div>
          <dt>Treasury</dt>
          <dd>
            {treasury} bn <span className="muted small">from {startTreasury}</span>
          </dd>
        </div>
      </dl>
      <div className="sheet-actions">
        <button type="button" className="button primary" onClick={actions.newGame}>
          Play again
        </button>
      </div>
    </dialog>
  );
}
