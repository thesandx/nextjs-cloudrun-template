import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/**
 * The button classes, exported so a `next/link` can look exactly like a
 * button: `<Link className={buttonStyles({ variant: 'primary' })} />`.
 */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-pill font-medium select-none',
    'disabled:bg-sunken disabled:text-ink-soft disabled:cursor-not-allowed disabled:border-dashed',
    'aria-disabled:bg-sunken aria-disabled:text-ink-soft aria-disabled:border-dashed',
    size === 'md' && 'min-h-12 px-5 text-body',
    size === 'lg' && 'min-h-14 px-7 text-heading',
    variant === 'primary' && 'squish border-line bg-brand text-ink border-2',
    variant === 'secondary' && 'squish border-line bg-surface text-ink border-2',
    variant === 'quiet' &&
      'text-ink decoration-brand underline decoration-2 underline-offset-4 hover:decoration-4',
    block && 'w-full',
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, 'className'> {}

/**
 * One primary Button per screen. The label is a verb phrase that says what
 * happens: "Create room", "Join game", "Save name". No trailing arrows.
 */
export function Button({ variant, size, block, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({
        ...(variant && { variant }),
        ...(size && { size }),
        ...(block !== undefined && { block }),
        ...(className !== undefined && { className }),
      })}
      {...rest}
    />
  );
}
