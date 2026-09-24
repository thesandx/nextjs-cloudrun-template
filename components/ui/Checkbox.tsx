import { useId } from 'react';

import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  /** Always visible, and part of the tap target. */
  label: string;
  hint?: string;
}

/**
 * A native checkbox, restyled. The tick is drawn, not coloured in, so the
 * checked state never rests on colour alone. The whole row is the tap target.
 */
export function Checkbox({ label, hint, className, disabled, ...rest }: CheckboxProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative inline-grid size-11 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            'peer bg-surface border-line rounded-box shadow-mochi-sm size-7 cursor-pointer appearance-none border-2',
            'checked:bg-brand transition-colors',
            'disabled:bg-sunken disabled:cursor-not-allowed disabled:border-dashed',
          )}
          {...rest}
        />
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="stroke-ink pointer-events-none absolute hidden size-5 peer-checked:block"
          fill="none"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="flex flex-col pt-2.5">
        <label
          htmlFor={id}
          className={cn(
            'font-medium',
            disabled ? 'text-ink-soft cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          {label}
        </label>
        {hint && (
          <span id={hintId} className="text-small text-ink-soft">
            {hint}
          </span>
        )}
      </span>
    </div>
  );
}
