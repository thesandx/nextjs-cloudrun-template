import { Avatar } from 'nextjs-cloudrun-template';

export const Sizes = () => (
  <div className="flex items-end gap-4">
    <Avatar name="sandy" size="sm" />
    <Avatar name="momo" size="md" />
    <Avatar name="captain_k" size="lg" />
  </div>
);

export const Moods = () => (
  <div className="flex items-center gap-4">
    <Avatar name="bubbles" size="lg" mood="happy" />
    <Avatar name="bubbles" size="lg" mood="wow" />
    <Avatar name="bubbles" size="lg" mood="wink" />
    <Avatar name="bubbles" size="lg" mood="sleepy" />
    <Avatar name="bubbles" size="lg" mood="sad" />
  </div>
);

export const Players = () => (
  <div className="flex items-center gap-3">
    {['sandy', 'momo', 'captain_k', 'bubbles', 'rajma chawal'].map((name) => (
      <Avatar key={name} name={name} />
    ))}
  </div>
);
