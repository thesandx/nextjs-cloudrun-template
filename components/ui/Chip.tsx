import { cn } from '@/lib/utils';

export interface ChipProps {
  children: React.ReactNode;
  /** Something before the text, usually an `<Avatar size="sm" />`. */
  leading?: React.ReactNode;
  /** Render as a list item when the chips form a list. */
  as?: 'span' | 'li';
  className?: string;
}

/**
 * A pill that names one thing: a player, a tag, a category. Static — a
 * pressable choice is a `Button` or a `RadioGroup`, not a chip.
 */
export function Chip({ children, leading, as: Tag = 'span', className }: ChipProps) {
  return (
    <Tag
      className={cn(
        'border-line bg-surface rounded-pill inline-flex min-h-10 items-center gap-2 border-2 font-medium',
        leading !== undefined ? 'py-0.5 pr-4 pl-0.5' : 'px-4',
        className,
      )}
    >
      {leading}
      <span>{children}</span>
    </Tag>
  );
}
