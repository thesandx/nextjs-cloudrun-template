import { cn } from '@/lib/utils';

import { Face } from './Face';

export interface EmptyStateProps {
  /** Says what goes here, in the interface voice: "No rounds yet." */
  title: string;
  /** One more line, only when it helps the user fill the space. */
  children?: React.ReactNode;
  /** The one button that fills it: "Start round". */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The recipe from design-language.md > Recipes, as a primitive: a sleepy face,
 * one line saying what goes here, one action that fills it. Centred, because a
 * lone empty-state message is one of the few things that may be.
 */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 py-8 text-center', className)}>
      <span className="bg-brand-soft border-line inline-grid size-20 place-items-center rounded-full border-2">
        <Face mood="sleepy" size={72} />
      </span>
      <p className="text-heading font-display">{title}</p>
      {children !== undefined && <div className="text-ink-soft max-w-prose">{children}</div>}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
