import { controlStyles, Field } from '@/components/ui/Field';
import { DIAL_COUNTRIES } from '@/lib/phone';
import { cn } from '@/lib/utils';

export interface PhoneNumberInputProps {
  /** ISO code of the chosen country, e.g. `IN`. */
  country: string;
  onCountryChange: (iso: string) => void;
  /** The national number as typed, without the dial code. */
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * A phone number as two parts: the dial code, prefilled, and the number the
 * person actually knows. They never type `+91`. `lib/phone.ts` joins the two
 * into E.164 for Firebase.
 *
 * The dial code is a native select, so a phone shows its own picker. It has
 * its own accessible name; the visible label belongs to the number field.
 */
export function PhoneNumberInput({
  country,
  onCountryChange,
  value,
  onChange,
  error,
  disabled = false,
  autoFocus = false,
}: PhoneNumberInputProps) {
  return (
    <Field label="Phone number" error={error}>
      {(control) => (
        <div className="flex gap-2">
          <div className="relative shrink-0">
            <select
              aria-label="Country code"
              value={country}
              disabled={disabled}
              onChange={(event) => onCountryChange(event.target.value)}
              className={controlStyles(
                Boolean(error),
                'min-h-13 w-auto cursor-pointer appearance-none pr-9 pl-3 font-medium',
              )}
            >
              {DIAL_COUNTRIES.map((option) => (
                <option key={option.iso} value={option.iso}>
                  {`+${option.dialCode} ${option.iso}`}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="stroke-ink pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
              fill="none"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <input
            {...control}
            type="tel"
            name="phone"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(event) => onChange(event.target.value)}
            className={controlStyles(Boolean(error), cn('min-h-13 min-w-0 flex-1 text-heading'))}
            required
          />
        </div>
      )}
    </Field>
  );
}
