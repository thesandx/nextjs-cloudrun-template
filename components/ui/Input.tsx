import { cn } from '@/lib/utils';

import { controlStyles, Field } from './Field';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Always visible. Placeholder text is never a label. */
  label: string;
  hint?: string;
  /** Says what went wrong and how to fix it: "Keys are 6 letters or numbers". */
  error?: string;
  /** Large, spaced, uppercase entry for room keys and codes. */
  code?: boolean;
}

export function Input({ label, hint, error, code = false, className, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <input
          {...control}
          className={controlStyles(
            Boolean(error),
            cn(
              'min-h-13',
              code && 'font-display text-key min-h-18 text-center tracking-[0.3em] uppercase',
              className,
            ),
          )}
          {...rest}
        />
      )}
    </Field>
  );
}
