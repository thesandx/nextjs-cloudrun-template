import { cn } from '@/lib/utils';

import { Face, type FaceMood } from './Face';

export interface SpeechProps {
  /** One short line in the mascot's voice. Maximum ~12 words. */
  children: React.ReactNode;
  mood?: FaceMood;
  className?: string;
}

/**
 * The mascot speaking. Reserved for moments: first visit, someone joins,
 * a win, an empty state, an error. Never for instructions or legal text —
 * those use the plain interface voice.
 */
export function Speech({ children, mood = 'happy', className }: SpeechProps) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <span className="bg-brand-soft border-line inline-grid size-14 shrink-0 place-items-center rounded-full border-2">
        <Face mood={mood} size={48} blink />
      </span>
      <p className="border-line bg-surface shadow-mochi-sm rounded-card relative rounded-bl-md border-2 px-4 py-3">
        {children}
      </p>
    </div>
  );
}
