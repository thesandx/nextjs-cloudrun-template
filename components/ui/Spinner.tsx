import { cn } from '@/lib/utils';

export interface SpinnerProps {
  /** Says what is loading, for screen readers and as visible text: "Loading rounds". */
  label: string;
  /** Hide the words and keep them for screen readers only — inside a button, for example. */
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = { sm: 'size-5', md: 'size-8' } as const;

/**
 * Work in progress. Motion that answers the user: it appears only after they
 * asked for something. Reduced motion stops the spin; the words remain.
 */
export function Spinner({ label, hideLabel = false, size = 'md', className }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-3', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'border-sunken border-t-line inline-block shrink-0 animate-spin rounded-full border-2',
          SIZES[size],
        )}
      />
      <span className={cn(hideLabel ? 'sr-only' : 'text-small text-ink-soft')}>{label}</span>
    </span>
  );
}
