import { useId } from 'react';

import { cn } from '@/lib/utils';

/** The attributes a control needs to join its label, hint and error. */
export interface FieldControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

export interface FieldProps {
  /** Always visible. Placeholder text is never a label. */
  label: string;
  hint?: string | undefined;
  /** Says what went wrong and how to fix it: "Keys are 6 letters or numbers." */
  error?: string | undefined;
  /** Renders the control, wired to the label and messages. */
  children: (control: FieldControlProps) => React.ReactNode;
  className?: string | undefined;
}

/**
 * The label, hint and error around one form control. `Input`, `Textarea` and
 * `Select` share it, so every field reads and fails the same way. The error
 * replaces the hint, so the fix is never buried under the help text.
 */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error && hintId, error && errorId].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-medium">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-small text-ink-soft">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export interface FieldErrorProps {
  id?: string;
  children: React.ReactNode;
}

/** An error line: a danger dot for the eye, words for everyone. Never colour alone. */
export function FieldError({ id, children }: FieldErrorProps) {
  return (
    <p
      id={id}
      className="text-small text-ink animate-rise-in flex items-center gap-1.5 font-medium"
    >
      <span aria-hidden="true" className="bg-danger inline-block size-2.5 shrink-0 rounded-full" />
      {children}
    </p>
  );
}

/** The shared look of a text-like control. Exported so Select and Textarea match Input exactly. */
export function controlStyles(invalid: boolean, className?: string): string {
  return cn(
    'bg-surface text-ink rounded-input w-full border-2 px-4 transition-colors duration-200',
    // The wobble plays once, when the error first appears: the field that
    // needs fixing moves, so the eye finds it. See design-language.md > Motion.
    invalid ? 'border-danger animate-wobble' : 'border-line',
    'placeholder:text-ink-soft/70 focus-visible:outline-brand',
    'disabled:bg-sunken disabled:text-ink-soft disabled:cursor-not-allowed disabled:border-dashed',
    className,
  );
}
