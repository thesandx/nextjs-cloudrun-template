import { cn } from '@/lib/utils';

export interface PageShellProps {
  children: React.ReactNode;
  /** `reading` for text and forms (max-w-3xl); `wide` for boards and maps (max-w-5xl). */
  width?: 'reading' | 'wide';
  className?: string;
}

/**
 * The page's `<main>`: width, side padding and the vertical rhythm between
 * sections, from design-language.md > Layout. Every route starts here, so
 * no page invents its own gutter.
 */
export function PageShell({ children, width = 'reading', className }: PageShellProps) {
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
