import { BackButton } from 'nextjs-cloudrun-template';

export const Default = () => <BackButton fallbackHref="/" />;

// `label` is the accessible name only; the button always shows just the arrow.
export const BesideTitle = () => (
  <div className="flex items-center gap-3">
    <BackButton fallbackHref="/design" label="Back to components" />
    <h2 className="text-heading">Room settings</h2>
  </div>
);
