import type { ReactNode } from 'react';

export type MemoKind = 'urgent' | 'advice';

interface Props {
  readonly kind: MemoKind;
  /** The banner's words, such as "Urgent · Corvan". */
  readonly label: string;
  readonly when?: string;
  readonly headingId: string;
  readonly onDismiss: () => void;
  readonly dismissLabel: string;
  readonly role?: 'alert';
  readonly children: ReactNode;
}

/** A briefing memo: paper with a banner, the one surface you read and decide on. */
export function Memo({
  kind,
  label,
  when,
  headingId,
  onDismiss,
  dismissLabel,
  role,
  children,
}: Props) {
  return (
    <article
      className={`memo paper memo-${kind}`}
      aria-labelledby={headingId}
      {...(role ? { role } : { 'aria-live': 'polite' as const })}
    >
      <div className={`memo-banner ${kind}`}>
        <span>
          {label}
          {when && <span className="memo-when"> · {when}</span>}
        </span>
        <button type="button" className="icon-button" aria-label={dismissLabel} onClick={onDismiss}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="memo-body">{children}</div>
    </article>
  );
}
