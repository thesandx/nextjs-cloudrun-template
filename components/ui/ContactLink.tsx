import { mailtoHref, telHref } from '@/lib/contact';
import { cn } from '@/lib/utils';

export interface ContactLinkProps {
  /** `phone` opens the dialler; `email` opens the mail app. */
  kind: 'phone' | 'email';
  /** The number or address as people read it: `+91 98765 43210`, `hello@playroom.test`. */
  value: string;
  className?: string;
}

/**
 * A phone number or an email address the user can tap. Never print one as
 * plain text: on a phone, a tap should dial or open the mail app.
 * The visible text is the value itself, so the user sees what the tap does.
 */
export function ContactLink({ kind, value, className }: ContactLinkProps) {
  return (
    <a
      href={kind === 'phone' ? telHref(value) : mailtoHref(value)}
      className={cn(
        'text-ink decoration-brand inline-flex min-h-11 items-center break-all underline decoration-2 underline-offset-4',
        className,
      )}
    >
      {value}
    </a>
  );
}
