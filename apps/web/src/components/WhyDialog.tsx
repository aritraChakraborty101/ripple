import type { GameState, WhyNode } from '@ripple/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  chainInShort,
  childrenOf,
  describeNode,
  mainPath,
  questionFor,
  rootOf,
  type WhyItem,
  type WhyTarget,
} from '../game/why';

interface Props {
  readonly game: GameState;
  readonly target: WhyTarget | null;
  readonly onClose: () => void;
  /** Ask about something else from inside the panel. */
  readonly onAsk: (target: WhyTarget) => void;
}

/** Deepest level the breakdown shows, so a long history stays readable. */
const MAX_LEVEL = 14;

function targetOf(node: WhyNode): WhyTarget | null {
  if (node.type === 'stat') return { kind: 'stat', ref: node.ref };
  if (node.type === 'event') return { kind: 'event', event: node.event, tick: node.tick };
  return null;
}

function Line({ game, node }: { game: GameState; node: WhyNode }) {
  const text = describeNode(game, node);
  return (
    <span className="why-line">
      <span className={`why-kind kind-${node.type}`} aria-hidden="true" />
      <span className="why-title">{text.title}</span>
      {text.note && <span className="why-note">{text.note}</span>}
      {text.when && <span className="why-when">{text.when}</span>}
    </span>
  );
}

interface BranchProps {
  readonly game: GameState;
  readonly item: WhyItem;
  readonly path: string;
  readonly level: number;
  readonly expanded: ReadonlySet<string>;
  readonly onToggle: (path: string) => void;
}

function Branch({ game, item, path, level, expanded, onToggle }: BranchProps) {
  const children = level < MAX_LEVEL ? childrenOf(game, item.node) : [];
  const open = expanded.has(path);
  const isRootEvent = item.node.type === 'event' && children.length === 0;

  return (
    <li className="why-item">
      <div className="why-row">
        {children.length > 0 ? (
          <button
            type="button"
            className="why-toggle"
            aria-expanded={open}
            aria-label={open ? 'Hide causes' : 'Show causes'}
            onClick={() => onToggle(path)}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M3 1.5 L7 5 L3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        ) : (
          <span className="why-toggle-space" aria-hidden="true" />
        )}
        <Line game={game} node={item.node} />
        {(item.effect || item.note) && (
          <span className="why-effect">
            {item.effect}
            {item.note && <span className="why-effect-note">{item.note}</span>}
          </span>
        )}
      </div>
      {isRootEvent && (
        <p className="why-root-note">
          Nothing earlier caused this. It came from chance, or from time passing.
        </p>
      )}
      {open && children.length > 0 && (
        <ul className="why-tree">
          {children.map((child, i) => (
            <Branch
              key={`${path}.${i}`}
              game={game}
              item={child}
              path={`${path}.${i}`}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Paths of every step on the main chain, so it opens already unfolded. */
function mainPaths(path: number[]): Set<string> {
  const paths = new Set<string>(['r']);
  let current = 'r';
  for (const index of path) {
    current = `${current}.${index}`;
    paths.add(current);
  }
  return paths;
}

/**
 * The why-trace: the chain in short, from root cause to the thing asked about,
 * then the full breakdown, opened along that chain.
 */
export function WhyDialog({ game, target, onClose, onAsk }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const root = useMemo(() => (target ? rootOf(game, target) : null), [game, target]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const gameRef = useRef(game);
  gameRef.current = game;

  // Unfold the main chain whenever a new question is asked.
  useEffect(() => {
    // Only when the question changes, not on every tick, so read the game through a ref.
    if (target) setExpanded(mainPaths(mainPath(gameRef.current, rootOf(gameRef.current, target))));
  }, [target]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const chain = root ? chainInShort(game, root) : [];

  return (
    <dialog ref={ref} className="sheet why" aria-labelledby="why-title" onClose={onClose}>
      {target && root && (
        <>
          <div className="sheet-head">
            <div>
              <p className="eyebrow">The ripple</p>
              <h2 id="why-title">{questionFor(game, target)}</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
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

          <section aria-labelledby="why-short" className="why-section">
            <h3 id="why-short">How it came to this</h3>
            {chain.length <= 1 ? (
              <p className="muted">Nothing has changed this yet. It is where it started.</p>
            ) : (
              <ol className="why-chain">
                {chain.map((node, i) => {
                  const ask = targetOf(node);
                  const last = i === chain.length - 1;
                  return (
                    <li key={i} className={last ? 'last' : ''}>
                      {ask && !last ? (
                        <button type="button" className="why-chain-step" onClick={() => onAsk(ask)}>
                          <Line game={game} node={node} />
                        </button>
                      ) : (
                        <span className="why-chain-step static">
                          <Line game={game} node={node} />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section aria-labelledby="why-full" className="why-section">
            <h3 id="why-full">Everything that contributed</h3>
            <ul className="why-tree top">
              <Branch
                game={game}
                item={{ node: root }}
                path="r"
                level={0}
                expanded={expanded}
                onToggle={toggle}
              />
            </ul>
          </section>

          <p className="why-foot muted small">
            The game is paused while you read. Select a step in the chain to ask why about it.
          </p>
        </>
      )}
    </dialog>
  );
}
