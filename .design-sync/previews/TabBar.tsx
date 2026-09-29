import { TabBar } from 'nextjs-cloudrun-template';

export const Phone = () => (
  <div className="bg-paper relative h-40">
    <p className="text-ink-soft p-4">The page scrolls under the bar.</p>
    <TabBar />
  </div>
);
