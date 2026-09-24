import { useId } from 'react';

import { cn } from '@/lib/utils';

import { FieldError } from './Field';

export interface RadioOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** The question the choices answer: "Round length". Rendered as the legend. */
  label: string;
  /** Shared by every radio, so the browser treats them as one choice. */
  name: string;
  options: readonly RadioOption[];
  /** Controlled value. Pair with `onChange`. */
  value?: string;
  /** Uncontrolled starting value. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * One choice from a short list — five options or fewer. Longer lists use
 * `Select`. The dot is drawn, so the chosen option never rests on colour alone.
 */
export function RadioGroup({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  error,
  required,
  className,
}: RadioGroupProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      className={cn('flex flex-col gap-1', className)}
    >
      <legend className="text-small mb-1.5 font-medium">{label}</legend>
      {options.map((option) => {
        const optionId = `${id}-${option.value}`;
        const hintId = `${optionId}-hint`;
        return (
          <div key={option.value} className="flex items-start gap-3">
            <span className="relative inline-grid size-11 shrink-0 place-items-center">
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                aria-describedby={option.hint ? hintId : undefined}
                {...(value !== undefined && { checked: value === option.value })}
                {...(defaultValue !== undefined && {
                  defaultChecked: defaultValue === option.value,
                })}
                {...(onChange && { onChange: () => onChange(option.value) })}
                {...(option.disabled && { disabled: true })}
                {...(required && { required: true })}
                className={cn(
                  'peer bg-surface shadow-mochi-sm size-7 cursor-pointer appearance-none rounded-full border-2',
                  error ? 'border-danger' : 'border-line',
                  'disabled:bg-sunken disabled:cursor-not-allowed disabled:border-dashed',
                )}
              />
              <span
                aria-hidden="true"
                className="bg-ink pointer-events-none absolute hidden size-3 rounded-full peer-checked:block"
              />
            </span>
            <span className="flex flex-col pt-2.5">
              <label
                htmlFor={optionId}
                className={cn(
                  'font-medium',
                  option.disabled ? 'text-ink-soft cursor-not-allowed' : 'cursor-pointer',
                )}
              >
                {option.label}
              </label>
              {option.hint && (
                <span id={hintId} className="text-small text-ink-soft">
                  {option.hint}
                </span>
              )}
            </span>
          </div>
        );
      })}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}
