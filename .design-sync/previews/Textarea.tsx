import { Textarea } from 'nextjs-cloudrun-template';

export const WithHint = () => (
  <div className="max-w-md">
    <Textarea label="House rules" hint="Players see this before the first round." />
  </div>
);

export const Filled = () => (
  <div className="max-w-md">
    <Textarea
      label="House rules"
      rows={4}
      defaultValue={'No phones on the table.\nThe host calls every number twice.\nA full line wins the round.'}
    />
  </div>
);

export const WithError = () => (
  <div className="max-w-md">
    <Textarea label="Feedback" error="Write at least one sentence so we can help." />
  </div>
);
