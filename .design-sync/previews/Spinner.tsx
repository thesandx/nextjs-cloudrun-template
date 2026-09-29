import { Spinner } from 'nextjs-cloudrun-template';

export const Sizes = () => (
  <div className="flex flex-col gap-4">
    <Spinner label="Loading rounds" />
    <Spinner label="Saving" size="sm" />
  </div>
);

export const IconOnly = () => <Spinner label="Loading" hideLabel />;
