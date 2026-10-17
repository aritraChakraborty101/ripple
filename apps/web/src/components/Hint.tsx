import { useId, type ReactNode } from 'react';

interface Props {
  readonly text: string;
  readonly children: ReactNode;
  /**
   * Whether the wrapper itself takes keyboard focus. Turn off when the content
   * is already focusable, such as a button; the tip still shows when it is focused.
   */
  readonly focusable?: boolean;
}

/** Explains what something means when hovered or focused. */
export function Hint({ text, children, focusable = true }: Props) {
  const id = useId();
  return (
    <span className="has-hint" {...(focusable ? { tabIndex: 0, 'aria-describedby': id } : {})}>
      {children}
      <span role="tooltip" id={id} className="hint-tip">
        {text}
      </span>
    </span>
  );
}
