import { useEffect } from 'react';
import { DevTools } from './components/DevTools';
import { Dispatches } from './components/Dispatches';
import { Header } from './components/Header';
import { Markets } from './components/Markets';
import { WorldMap } from './components/WorldMap';
import { SPEEDS } from './game/clock';
import { actions, startLoop, useSession } from './game/store';

function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        actions.togglePause();
        return;
      }
      const index = Number(event.key) - 1;
      const speed = SPEEDS[index];
      if (speed !== undefined) actions.setSpeed(speed);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const session = useSession();
  useEffect(() => startLoop(), []);
  useKeyboardShortcuts();

  return (
    <div className="app">
      <Header game={session.game} clock={session.clock} />
      <div className="body">
        <main className="main">
          <WorldMap game={session.game} paused={session.clock.paused} />
          <Markets game={session.game} history={session.history} />
          <p className="hint">
            <kbd>Space</kbd> pauses and resumes. <kbd>1</kbd>–<kbd>4</kbd> set the speed. Hover a
            route to see what it carries.
          </p>
        </main>
        <aside className="rail">
          <Dispatches dispatches={session.dispatches} />
          <DevTools game={session.game} />
        </aside>
      </div>
    </div>
  );
}
