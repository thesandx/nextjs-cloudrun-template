import { cn } from '@/lib/utils';

import { BackButton, type BackButtonProps } from './BackButton';

export interface AppBarProps {
  /** The screen's name. It is the page's `h1`. */
  title: string;
  /** Show the back arrow. Pass its options, or `true` for the defaults. Omit on a top-level tab. */
  back?: true | BackButtonProps;
  /** A slot on the right: one action, such as "Save". */
  end?: React.ReactNode;
  className?: string;
}

/**
 * The top of an app screen: back arrow, title, one optional action. It sticks
 * to the top, so the way back is always in reach on a long page.
 *
 * A Server Component; only the back arrow ships as JavaScript.
 */
export function AppBar({ title, back, end, className }: AppBarProps) {
  return (
    <div className={cn('bg-paper border-line sticky top-0 z-20 border-b-2', className)}>
      <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4 py-2 sm:px-8">
        {back !== undefined && <BackButton {...(back === true ? {} : back)} />}
        <h1 className="text-heading min-w-0 flex-1 truncate">{title}</h1>
        {end !== undefined && <div className="shrink-0">{end}</div>}
      </div>
    </div>
  );
}
