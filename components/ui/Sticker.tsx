import { cn } from '@/lib/utils';

export type StickerKind = 'sparkle' | 'star' | 'heart';

const PATHS: Record<StickerKind, string> = {
  sparkle: 'M12 1c.8 5.4 2.6 7.2 8 8-5.4.8-7.2 2.6-8 8-.8-5.4-2.6-7.2-8-8 5.4-.8 7.2-2.6 8-8z',
  star: 'M12 2l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 16.8 6.1 20l1.3-6.6L2.5 8.9l6.6-.8z',
  heart:
    'M12 20s-8-4.9-8-10.2C4 6.6 6.3 4.5 8.8 4.5c1.4 0 2.5.7 3.2 1.8.7-1.1 1.8-1.8 3.2-1.8 2.5 0 4.8 2.1 4.8 5.3C20 15.1 12 20 12 20z',
};

const FILL: Record<StickerKind, string> = {
  sparkle: 'fill-butter',
  star: 'fill-butter',
  heart: 'fill-brand',
};

export interface StickerProps {
  kind: StickerKind;
  size?: number;
  className?: string;
}

/**
 * Decoration. Budget: at most two stickers visible in any viewport, and never
 * inside body text, buttons, or form fields. Always aria-hidden.
 */
export function Sticker({ kind, size = 24, className }: StickerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path
        d={PATHS[kind]}
        className={cn(FILL[kind], 'stroke-line')}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
