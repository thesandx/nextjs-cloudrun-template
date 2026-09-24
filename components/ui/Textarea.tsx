import { cn } from '@/lib/utils';

import { controlStyles, Field } from './Field';

export interface TextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  /** Always visible. Placeholder text is never a label. */
  label: string;
  hint?: string;
  error?: string;
}

/** Multi-line text. Same label, hint and error as `Input`; it grows vertically only. */
export function Textarea({ label, hint, error, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <textarea
          {...control}
          rows={rows}
          className={controlStyles(Boolean(error), cn('min-h-28 resize-y py-3', className))}
          {...rest}
        />
      )}
    </Field>
  );
}
