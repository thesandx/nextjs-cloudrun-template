import { cn } from '@/lib/utils';

export type AlertTone = 'info' | 'success' | 'danger';

const TONE_CLASS: Record<AlertTone, string> = {
  info: 'bg-surface',
  success: 'bg-success',
  danger: 'bg-danger',
};

/** The glyph for each tone. Status is never colour alone — see design-language.md > Accessibility. */
const GLYPH: Record<AlertTone, React.ReactNode> = {
  info: (
    <>
      <path d="M12 11v6" />
      <path d="M12 7.2v.1" />
    </>
  ),
  success: <path d="M7 12.5l3.5 3.5L17 9" />,
  danger: (
    <>
      <path d="M12 7v6" />
      <path d="M12 16.8v.1" />
    </>
  ),
};

export interface AlertProps {
  /** What happened, in one short sentence: "Room created." */
  title: string;
  /** How to fix it, or what happens next. Optional. */
  children?: React.ReactNode;
  tone?: AlertTone;
  /** An action that resolves the alert, usually a `Button variant="secondary"`. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * A message in the interface voice, inline in the page. A `danger` alert is
 * announced at once (`role="alert"`); the others wait politely. For a mascot
 * reaction to a moment, use `Speech` instead.
 */
export function Alert({ title, children, tone = 'info', action, className }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'border-line text-ink rounded-card animate-rise-in flex flex-col gap-3 border-2 p-4 sm:flex-row sm:items-start',
        TONE_CLASS[tone],
        className,
      )}
    >
      <div className="flex flex-1 items-start gap-3">
        <span className="bg-surface border-line inline-grid size-8 shrink-0 place-items-center rounded-full border-2">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="stroke-ink size-5"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {GLYPH[tone]}
          </svg>
        </span>
        <div className="flex flex-col gap-0.5 pt-0.5">
          <p className="font-bold">{title}</p>
          {children !== undefined && <div className="text-small">{children}</div>}
        </div>
      </div>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}
