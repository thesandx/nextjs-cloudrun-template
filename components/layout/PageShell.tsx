import { cn } from '@/lib/utils';

export interface PageShellProps {
  children: React.ReactNode;
  /**
   * `wide` (default) is the page frame, max-w-5xl: the header, the footer and
   * every page line up on it, and a desktop page uses its columns. `reading`
   * (max-w-3xl) is for one long text, such as an article or a policy page.
   */
  width?: 'reading' | 'wide';
  className?: string;
}

/**
 * The page's `<main>`: width, side padding and the vertical rhythm between
 * sections, from design-language.md > Layout. Every route starts here, so
 * no page invents its own gutter.
 *
 * The frame gives the desktop room. Using it is the page's job: recompose
 * into columns at `lg`, and keep text at `max-w-prose` inside them.
 */
export function PageShell({ children, width = 'wide', className }: PageShellProps) {
  return (
    <main
      className={cn(
        'mx-auto flex w-full flex-col gap-16 px-5 py-12 sm:gap-24 sm:px-8 sm:py-20',
        width === 'reading' ? 'max-w-3xl' : 'max-w-5xl',
        className,
      )}
    >
      {children}
    </main>
  );
}
