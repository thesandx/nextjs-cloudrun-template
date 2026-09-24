import { cn } from '@/lib/utils';

export interface SkeletonProps {
  /** Width and height classes, such as `h-5 w-40`. The shape of what is loading. */
  className?: string;
  /** `text` for a line, `block` for a field or card, `circle` for an avatar. */
  shape?: 'text' | 'block' | 'circle';
}

const SHAPES = {
  text: 'rounded-pill h-4',
  block: 'rounded-input h-13',
  circle: 'rounded-full',
} as const;

/**
 * A placeholder with the shape of content that is on its way, so the screen
 * appears at once and fills in, rather than staying blank. It breathes slowly
 * while it waits.
 *
 * Decoration only: it is hidden from screen readers. Put one `Spinner` or a
 * `role="status"` line in the same loading screen to say what is loading.
 */
export function Skeleton({ className, shape = 'text' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('bg-sunken animate-breathe block', SHAPES[shape], className)}
    />
  );
}
