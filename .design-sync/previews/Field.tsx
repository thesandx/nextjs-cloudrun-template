import { controlStyles, Field } from 'nextjs-cloudrun-template';

export const CustomControl = () => (
  <div className="max-w-md">
    <Field label="Birthday" hint="We only show the day and month.">
      {(control) => <input type="date" className={controlStyles(false, "min-h-13")} {...control} />}
    </Field>
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <Field label="Team size" error="Teams have 2 to 6 players.">
      {(control) => (
        <input type="number" defaultValue={9} className={controlStyles(true, "min-h-13")} {...control} />
      )}
    </Field>
  </div>
);
