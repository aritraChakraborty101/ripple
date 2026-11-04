import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AdvisorCard } from './components/AdvisorCard';
import { BriefingDialog } from './components/BriefingDialog';
import { DevPanel } from './components/DevPanel';
import { CrisisBanner } from './components/CrisisBanner';
import { Cabinet } from './components/Cabinet';
import { FieldNoteCard } from './components/FieldNoteCard';
import { FirstSteps, STEP_IDS, type StepId } from './components/FirstSteps';
import { GameOver } from './components/GameOver';
import { HowToPlay } from './components/HowToPlay';
import { LensBar } from './components/LensBar';
import { MapDrawer } from './components/MapDrawer';
import { Markets } from './components/Markets';
import { Meters } from './components/Meters';
import { Nameplate } from './components/Nameplate';
import { Reports } from './components/Reports';
import { Unfolding } from './components/Unfolding';
import { WhyContext } from './components/WhyContext';
import { WhyDialog } from './components/WhyDialog';
import { WorldMap } from './components/WorldMap';
import { openTargets, readyCount } from './game/cabinet';
import { dueNote, FIELD_NOTES } from './game/fieldNotes';
import { fillNames } from './game/format';
import { LENSES, type Lens } from './game/lenses';
import { readPref, writePref } from './game/prefs';
import { firstCrisisGuide, firstCrisisMap } from './game/scenario';
import type { Selection } from './game/selection';
import { actions, devMode, startLoop, useSession } from './game/store';
import type { WhyTarget } from './game/why';

/**
 * Pref keys carry a version, so a returning player sees the briefing and first
 * steps again when they change (v2: the oil chain, lenses and field notes).
 */
const BRIEFING_SEEN = 'briefing.v2.seen';
const STEPS_DONE = 'steps.v2.done';
const STEPS_HIDDEN = 'steps.v2.hidden';
const NOTES_SEEN = 'notes.v1.seen';
const NOTES_OFF = 'notes.off';

interface Shortcuts {
  readonly setLens: (lens: Lens) => void;
  readonly openOrders: () => void;
  readonly openHelp: () => void;
  readonly clearSelection: () => void;
  readonly toggleDev: () => void;
}

function useKeyboardShortcuts({
  setLens,
  openOrders,
  openHelp,
  clearSelection,
  toggleDev,
}: Shortcuts): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        clearSelection();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return;
      if (target?.getAttribute('role') === 'button') return;
      if (event.code === 'Space') {
        event.preventDefault();
        actions.togglePause();
        return;
      }
      if (event.key === 'd' || event.key === 'D') {
        openOrders();
        return;
      }
      if (event.key === '?') {
        openHelp();
        return;
      }
      if (event.key === '+' || event.key === '=') {
        actions.faster();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        actions.slower();
        return;
      }
      if (event.key === '`' && devMode) {
        toggleDev();
        return;
      }
      const lens = LENSES[Number(event.key) - 1];
      if (lens !== undefined && event.key !== '0') setLens(lens.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setLens, openOrders, openHelp, clearSelection, toggleDev]);
}

/** Tracks the first-steps checklist and remembers it across visits. */
function useFirstSteps(): {
  done: ReadonlySet<StepId>;
  visible: boolean;
  mark: (step: StepId) => void;
  hide: () => void;
  restart: () => void;
} {
  const [done, setDone] = useState<ReadonlySet<StepId>>(
    () => new Set(readPref<StepId[]>(STEPS_DONE, [])),
  );
  const [visible, setVisible] = useState(() => !readPref(STEPS_HIDDEN, false));

  const mark = useCallback((step: StepId) => {
    setDone((prev) => {
      if (prev.has(step)) return prev;
      const next = new Set(prev).add(step);
      writePref(
        STEPS_DONE,
        STEP_IDS.filter((s) => next.has(s)),
      );
      return next;
    });
  }, []);
  const hide = useCallback(() => {
    setVisible(false);
    writePref(STEPS_HIDDEN, true);
  }, []);
  const restart = useCallback(() => {
    setDone(new Set());
    setVisible(true);
    writePref(STEPS_DONE, []);
    writePref(STEPS_HIDDEN, false);
  }, []);

  return { done, visible, mark, hide, restart };
}

/** Which field notes the player has read, and whether they want any more. */
function useFieldNotes(): {
  seen: ReadonlySet<string>;
  off: boolean;
  read: (id: string) => void;
  turnOff: () => void;
  restart: () => void;
} {
  const [seen, setSeen] = useState<ReadonlySet<string>>(
    () => new Set(readPref<string[]>(NOTES_SEEN, [])),
  );
  const [off, setOff] = useState(() => readPref(NOTES_OFF, false));
  const read = useCallback((id: string) => {
    setSeen((prev) => {
      const next = new Set(prev).add(id);
      writePref(
        NOTES_SEEN,
        FIELD_NOTES.map((n) => n.id).filter((n) => next.has(n)),
      );
      return next;
    });
  }, []);
  const turnOff = useCallback(() => {
    setOff(true);
    writePref(NOTES_OFF, true);
  }, []);
  const restart = useCallback(() => {
    setSeen(new Set());
    setOff(false);
    writePref(NOTES_SEEN, []);
    writePref(NOTES_OFF, false);
  }, []);
  return { seen, off, read, turnOff, restart };
}

export function App() {
  const session = useSession();
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(
    () => firstCrisisGuide.briefing !== null && !readPref(BRIEFING_SEEN, false),
  );
  const [aiming, setAiming] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>('relations');
  const [selection, setSelection] = useState<Selection>(null);
  const [whyTarget, setWhyTarget] = useState<WhyTarget | null>(null);
  const [devOpen, setDevOpen] = useState(devMode);
  const steps = useFirstSteps();
  const notes = useFieldNotes();
  useEffect(() => startLoop(), []);

  const openOrders = useCallback(() => setOrdersOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const clearSelection = useCallback(() => {
    setSelection(null);
    setAiming(null);
  }, []);
  // Asking why pauses the world, so the answer does not change while you read it.
  const openWhy = useCallback((target: WhyTarget) => {
    actions.pause();
    setWhyTarget(target);
  }, []);
  const toggleDev = useCallback(() => setDevOpen((open) => !open), []);
  useKeyboardShortcuts({ setLens, openOrders, openHelp, clearSelection, toggleDev });

  const { game, alert } = session;
  const tip = session.advisor.current;
  const selectCountry = useCallback((id: string) => setSelection({ kind: 'country', id }), []);

  // A new game starts with nothing selected.
  useEffect(() => {
    setSelection(null);
    setWhyTarget(null);
  }, [game.seed]);

  // Tick off first steps as the player does each one.
  const { mark } = steps;
  useEffect(() => {
    if (!session.clock.paused) mark('play');
  }, [session.clock.paused, mark]);
  useEffect(() => {
    if (selection?.kind === 'country' && selection.id !== game.rules.playerCountry) mark('country');
  }, [selection, game.rules.playerCountry, mark]);
  useEffect(() => {
    if (session.tallies.ordersSigned > 0) mark('order');
  }, [session.tallies.ordersSigned, mark]);
  useEffect(() => {
    if (selection?.kind === 'country' && selection.id === game.rules.playerCountry) mark('home');
  }, [selection, game.rules.playerCountry, mark]);
  useEffect(() => {
    if (lens === 'trade') mark('trade');
  }, [lens, mark]);
  useEffect(() => {
    if (whyTarget) mark('why');
  }, [whyTarget, mark]);
  useEffect(() => {
    if (ordersOpen) mark('cabinet');
  }, [ordersOpen, mark]);

  const closeBriefing = () => {
    setBriefingOpen(false);
    writePref(BRIEFING_SEEN, true);
  };

  const respondToAlert = () => {
    if (alert?.country) setSelection({ kind: 'country', id: alert.country });
    else setOrdersOpen(true);
    actions.dismissAlert();
  };

  // Aiming an order from the cabinet: the next click on an open country signs it.
  const aimDef = aiming ? game.defs.decisions[aiming] : undefined;
  const aimTargets = useMemo(
    () => (aimDef ? new Set(openTargets(game, aimDef)) : null),
    [game, aimDef],
  );
  const aim = (decision: string) => {
    setOrdersOpen(false);
    setSelection(null);
    setAiming(decision);
  };
  const select = (next: Selection) => {
    if (aiming && aimTargets) {
      if (next?.kind === 'country' && aimTargets.has(next.id)) {
        actions.issue(aiming, next.id);
        setAiming(null);
      }
      return;
    }
    setSelection(next);
  };

  const briefing = firstCrisisGuide.briefing;
  const stepsShowing =
    steps.visible && briefing !== null && !STEP_IDS.every((id) => steps.done.has(id));
  const note = notes.off ? null : dueNote(session, notes.seen, stepsShowing);
  const focusName = briefing ? (game.world.countries[briefing.focusCountry]?.name ?? '') : '';
  let firstSteps: ReactNode = null;
  if (steps.visible && briefing) {
    firstSteps = (
      <FirstSteps
        done={steps.done}
        focusName={focusName}
        homeName={game.world.countries[game.rules.playerCountry]!.name}
        onHide={steps.hide}
      />
    );
  }

  return (
    <WhyContext.Provider value={openWhy}>
      <div className="app">
        <main className="world">
          <WorldMap
            game={game}
            map={firstCrisisMap}
            paused={session.clock.paused}
            selection={selection}
            onSelect={select}
            aimTargets={aimTargets}
            alertCountry={alert?.country ?? null}
            ripples={session.ripples}
            lens={lens}
            showLegend={!tip}
            highlightCountry={
              briefing && steps.visible && !steps.done.has('country') && steps.done.has('play')
                ? briefing.focusCountry
                : null
            }
          />
        </main>
        <Nameplate
          game={game}
          clock={session.clock}
          onOpenHelp={openHelp}
          nudgePlay={session.clock.paused && game.tick === 0 && !steps.done.has('play')}
        />
        <Meters game={game} history={session.history} />
        <LensBar lens={lens} onLens={setLens} />
        {aimDef && (
          <div className="aim-banner glass" role="status">
            <span>
              Choose a country on the map:{' '}
              <strong>
                {fillNames(
                  aimDef.name.replace('{target}', '…'),
                  game.world.countries,
                  game.rules.playerCountry,
                )}
              </strong>
            </span>
            <button type="button" className="button" onClick={() => setAiming(null)}>
              Cancel
            </button>
          </div>
        )}
        <div className="dock-left">
          <Unfolding game={game} onOpenOrders={openOrders} />
          <Markets game={game} history={session.history} />
        </div>
        <div className="dock-right">
          {alert ? (
            <CrisisBanner alert={alert} paused={session.clock.paused} onRespond={respondToAlert} />
          ) : (
            tip &&
            !game.outcome &&
            !selection && <AdvisorCard game={game} tip={tip} onShowCountry={selectCountry} />
          )}
          {selection ? (
            <MapDrawer
              game={game}
              selection={selection}
              dispatches={session.dispatches}
              onSelect={setSelection}
            />
          ) : (
            <Reports
              dispatches={session.dispatches}
              onSelectCountry={selectCountry}
              top={
                <>
                  {/* A note is about what is happening now, so it goes above the checklist. */}
                  {note && (
                    <FieldNoteCard
                      key={note.id}
                      note={note}
                      onRead={() => notes.read(note.id)}
                      onTurnOff={notes.turnOff}
                    />
                  )}
                  {firstSteps}
                </>
              }
            />
          )}
          <button
            type="button"
            className="cabinet-button"
            onClick={openOrders}
            disabled={game.outcome !== null}
            title="Every order you can give (D)"
          >
            <span className="cabinet-word">Cabinet</span>
            <span className="cabinet-count">{readyCount(game)} orders to sign</span>
          </button>
        </div>
        {devMode &&
          (devOpen ? (
            <DevPanel game={game} onClose={() => setDevOpen(false)} />
          ) : (
            <button type="button" className="dev-toggle" onClick={() => setDevOpen(true)}>
              AI panel
            </button>
          ))}
        <Cabinet game={game} open={ordersOpen} onClose={() => setOrdersOpen(false)} onAim={aim} />
        <HowToPlay
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          onShowBriefing={() => {
            setHelpOpen(false);
            setBriefingOpen(true);
          }}
          onRestartSteps={() => {
            steps.restart();
            notes.restart();
            setHelpOpen(false);
          }}
          autoPause={session.autoPause}
          onAutoPause={actions.setAutoPause}
          onNewGame={() => {
            setHelpOpen(false);
            actions.newGame();
          }}
        />
        {briefing && (
          <BriefingDialog
            briefing={briefing}
            open={briefingOpen}
            countryName={(id) => game.world.countries[id]?.name ?? id}
            onClose={closeBriefing}
          />
        )}
        <WhyDialog
          game={game}
          target={whyTarget}
          onClose={() => setWhyTarget(null)}
          onAsk={setWhyTarget}
        />
        <GameOver game={game} tallies={session.tallies} startTreasury={session.startTreasury} />
      </div>
    </WhyContext.Provider>
  );
}
