import { Sticker } from 'nextjs-cloudrun-template';

export const Kinds = () => (
  <div className="flex items-center gap-6">
    <Sticker kind="sparkle" size={36} />
    <Sticker kind="star" size={36} />
    <Sticker kind="heart" size={36} />
  </div>
);

export const Sizes = () => (
  <div className="flex items-end gap-6">
    <Sticker kind="sparkle" size={18} />
    <Sticker kind="sparkle" size={28} />
    <Sticker kind="sparkle" size={44} />
  </div>
);
