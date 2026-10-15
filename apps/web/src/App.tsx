import { useEffect, useState } from 'react';
import { DecisionsDialog } from './components/DecisionsDialog';
import { Dispatches } from './components/Dispatches';
import { GameOver } from './components/GameOver';
import { Header } from './components/Header';
import { HomeFront } from './components/HomeFront';
import { Markets } from './components/Markets';
import { Relations } from './components/Relations';
import { Unfolding } from './components/Unfolding';
import { WorldMap } from './components/WorldMap';
import { SPEEDS } from './game/clock';
import { actions, startLoop, useSession } from './game/store';

function useKeyboardShortcuts(openDecisions: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        actions.togglePause();
        return;
      }
      if (event.key === 'd' || event.key === 'D') {
        openDecisions();
        return;
      }
      const speed = SPEEDS[Number(event.key) - 1];
      if (speed !== undefined) actions.setSpeed(speed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDecisions]);
}

export function App() {
  const session = useSession();
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  useEffect(() => startLoop(), []);
  useKeyboardShortcuts(() => setDecisionsOpen(true));

  const { game } = session;

  return (
    <div className="app">
      <Header game={game} clock={session.clock} />
      <div className="body">
        <main className="main">
          <WorldMap game={game} paused={session.clock.paused} />
          <Unfolding game={game} onOpenOrders={() => setDecisionsOpen(true)} />
          <Markets game={game} history={session.history} />
          <div className="panels">
            <HomeFront game={game} />
            <Relations game={game} />
          </div>
          <p className="hint">
            <kbd>Space</kbd> pauses and resumes. <kbd>1</kbd>–<kbd>4</kbd> set the speed.{' '}
            <kbd>D</kbd> opens your orders. Hover a route to see what it carries.
          </p>
        </main>
        <aside className="rail">
          <button
            type="button"
            className="button primary wide"
            onClick={() => setDecisionsOpen(true)}
            disabled={game.outcome !== null}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Sign an order
          </button>
          <Dispatches dispatches={session.dispatches} />
          <button type="button" className="text-button" onClick={actions.newGame}>
            Start a new game
          </button>
        </aside>
      </div>
      <DecisionsDialog game={game} open={decisionsOpen} onClose={() => setDecisionsOpen(false)} />
      <GameOver game={game} tallies={session.tallies} startTreasury={session.startTreasury} />
    </div>
  );
}
