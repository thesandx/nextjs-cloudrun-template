import { useId } from 'react';

import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type' | 'role'
> {
  /** Names the setting, not the state: "Sound effects", not "Turn sound on". */
  label: string;
  hint?: string;
}

/**
 * An on/off setting that applies at once. Use a `Checkbox` inside a form that
 * is submitted later. The knob moves, so the state never rests on colour alone.
 */
export function Switch({ label, hint, className, disabled, ...rest }: SwitchProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <span className="flex flex-col">
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
      <span className="relative inline-flex h-11 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            'peer bg-sunken border-line rounded-pill h-8 w-14 cursor-pointer appearance-none border-2',
            'checked:bg-brand transition-colors',
            'disabled:cursor-not-allowed disabled:border-dashed',
          )}
          {...rest}
        />
        <span
          aria-hidden="true"
          className={cn(
            'bg-surface border-line shadow-mochi-sm pointer-events-none absolute left-1 size-6 rounded-full border-2',
            'ease-squish transition-transform duration-200 peer-checked:translate-x-6',
          )}
        />
      </span>
    </div>
  );
}
