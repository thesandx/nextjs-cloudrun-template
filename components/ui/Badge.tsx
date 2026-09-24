import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'danger';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-surface',
  brand: 'bg-brand-soft',
  success: 'bg-success',
  danger: 'bg-danger',
};

export interface BadgeProps {
  /** A short state in words: "Host", "Live", "Expired". The words carry the meaning, not the tone. */
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}

/**
 * A small, static label for a state. It is not pressable, so it has no
 * shadow. Sentence case, never tracked-out capitals.
 */
export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'border-line text-small text-ink rounded-pill inline-flex items-center gap-1 border-2 px-2.5 font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
