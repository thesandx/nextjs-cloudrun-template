import { Face } from 'nextjs-cloudrun-template';

export const Moods = () => (
  <div className="flex items-center gap-4">
    {(['happy', 'wow', 'wink', 'sleepy', 'sad'] as const).map((mood) => (
      <span
        key={mood}
        className="bg-brand-soft border-line inline-grid size-20 place-items-center rounded-full border-2"
      >
        <Face size={64} mood={mood} label={`A ${mood} face`} />
      </span>
    ))}
  </div>
);

export const Mascot = () => (
  <span className="bg-brand-soft border-line shadow-mochi inline-grid size-20 place-items-center rounded-full border-2">
    <Face size={64} blink label="The Mochi face" />
  </span>
);

export const NoBlush = () => (
  <span className="bg-soda border-line inline-grid size-20 place-items-center rounded-full border-2">
    <Face size={64} blush={false} label="A face without blush" />
  </span>
);
