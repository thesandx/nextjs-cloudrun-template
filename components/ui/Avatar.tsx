import { cn } from '@/lib/utils';

import { Face, type FaceMood } from './Face';

const TONES = ['bg-brand-soft', 'bg-butter', 'bg-soda', 'bg-grape', 'bg-peach'] as const;
const MOODS: FaceMood[] = ['happy', 'wink', 'wow', 'happy', 'sleepy'];

export interface AvatarProps {
  /** The player's nickname. It seeds the colour and mood, so the same name always looks the same. */
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Override the name-derived mood for a moment: 'wow' for the winner, 'sad' for a knock-out. */
  mood?: FaceMood;
  className?: string;
}

const SIZES = { sm: 32, md: 44, lg: 64 } as const;

/** FNV-1a with a final avalanche, so similar names still get different faces. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (const char of value) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * A generated face avatar. Deterministic: no randomness at render time, so
 * server and client output match and a player keeps their face all session.
 */
export function Avatar({ name, size = 'md', mood: moodOverride, className }: AvatarProps) {
  const seed = hash(name.trim().toLowerCase());
  const tone = TONES[seed % TONES.length] ?? 'bg-brand-soft';
  const mood = moodOverride ?? MOODS[(seed >>> 8) % MOODS.length] ?? 'happy';
  const px = SIZES[size];

  return (
    <span
      className={cn(
        'border-line inline-grid shrink-0 place-items-center rounded-full border-2',
        tone,
        className,
      )}
      style={{ width: px, height: px }}
    >
      <Face mood={mood} size={px - 6} blush={size !== 'sm'} />
    </span>
  );
}
