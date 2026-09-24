'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { type Gender, GENDERS, MIN_DATE_OF_BIRTH, todayIso } from '@/lib/profile-fields';

/**
 * The schema, loaded on demand. zod is about 90 KB (gzip), more than the rest
 * of the page's own code, and a visitor who only reads the profile never needs
 * it. The form starts the download on first focus, so it is normally ready by
 * the time the person presses Save. Repeated calls share one request.
 */
const loadSchema = () => import('@/lib/profile-schema');

export interface ProfileFormValues {
  displayName: string;
  /** `YYYY-MM-DD`, or null when not set. */
  dateOfBirth: string | null;
  gender: Gender | null;
}

export interface ProfileFormProps {
  initial: ProfileFormValues;
}

type FieldErrors = Partial<Record<keyof ProfileFormValues, string>>;

type Status = { kind: 'idle' } | { kind: 'saved' } | { kind: 'failed'; message: string };

/**
 * Edits the fields a person owns: name, date of birth, gender. Phone and email
 * come from sign-in and are shown beside the form, not in it.
 *
 * Validates with the same schema the server uses, so a mistake shows under
 * its field at once instead of as a 400 after a round trip. The server still
 * validates: this check is for the user, that one is for safety. The schema
 * is loaded lazily; see `loadSchema` above.
 */
export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth ?? '');
  const [gender, setGender] = useState<string>(initial.gender ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    let schema: Awaited<ReturnType<typeof loadSchema>>;
    try {
      schema = await loadSchema();
    } catch {
      // The chunk failed to download: a dropped network, or a deploy replaced it.
      setStatus({ kind: 'failed', message: 'The network dropped. Check your connection.' });
      return;
    }

    const parsed = schema.profileUpdateSchema.safeParse({
      displayName,
      dateOfBirth: dateOfBirth === '' ? null : dateOfBirth,
      gender: gender === '' ? null : gender,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'displayName' || field === 'dateOfBirth' || field === 'gender') {
          next[field] ??= issue.message;
        }
      }
      setErrors(next);
      setStatus({ kind: 'idle' });
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          typeof body === 'object' && body !== null && 'message' in body
            ? String((body as { message: unknown }).message)
            : 'Try again in a moment.';
        setStatus({ kind: 'failed', message });
        return;
      }
      setStatus({ kind: 'saved' });
      // Re-render the Server Components, so the name at the top of the page
      // and anywhere else it shows is the saved one.
      router.refresh();
    } catch {
      setStatus({ kind: 'failed', message: 'The network dropped. Check your connection.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onFocus={() => {
        // Warm the schema while the person types. save() awaits the same
        // import and reports it if it fails, so a failure here is ignored.
        loadSchema().catch(() => undefined);
      }}
      onChange={() => {
        if (status.kind !== 'idle') setStatus({ kind: 'idle' });
      }}
    >
      <Input
        label="Name"
        name="displayName"
        autoComplete="name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        maxLength={120}
        required
        {...(errors.displayName !== undefined && { error: errors.displayName })}
      />
      <Input
        label="Date of birth"
        name="dateOfBirth"
        type="date"
        autoComplete="bday"
        min={MIN_DATE_OF_BIRTH}
        max={todayIso()}
        value={dateOfBirth}
        onChange={(event) => setDateOfBirth(event.target.value)}
        hint="Only you see this."
        {...(errors.dateOfBirth !== undefined && { error: errors.dateOfBirth })}
      />
      <Select
        label="Gender"
        name="gender"
        options={GENDERS}
        placeholder="Not set"
        value={gender}
        onChange={(event) => setGender(event.target.value)}
        {...(errors.gender !== undefined && { error: errors.gender })}
      />

      {status.kind === 'saved' && <Alert tone="success" title="Profile saved." />}
      {status.kind === 'failed' && (
        <Alert tone="danger" title="The profile was not saved.">
          {status.message}
        </Alert>
      )}

      <Button type="submit" size="lg" block disabled={saving}>
        {saving ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
