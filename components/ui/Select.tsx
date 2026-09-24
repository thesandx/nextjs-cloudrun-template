import { cn } from '@/lib/utils';

import { controlStyles, Field } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'children'
> {
  /** Always visible. Placeholder text is never a label. */
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  error?: string;
  /** A first, empty choice such as "Pick a game". Selecting it submits an empty value. */
  placeholder?: string;
}

/**
 * A native select, restyled. Native on purpose: the phone's own picker is
 * faster and more accessible than any custom listbox.
 */
export function Select({
  label,
  options,
  hint,
  error,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <div className="relative">
          <select
            {...control}
            className={controlStyles(
              Boolean(error),
              cn('min-h-13 cursor-pointer appearance-none pr-12', className),
            )}
            {...rest}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                {...(option.disabled && { disabled: true })}
              >
                {option.label}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="stroke-ink pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      )}
    </Field>
  );
}
