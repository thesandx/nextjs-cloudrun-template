import { cn } from '@/lib/utils';

export type FaceMood = 'happy' | 'wow' | 'sleepy' | 'sad' | 'wink';

export interface FaceProps {
  mood?: FaceMood;
  /** Rendered size in px. The face scales; stroke weights stay in proportion. */
  size?: number;
  /** Show the blush. Turn it off on very small sizes (< 24px) where it becomes noise. */
  blush?: boolean;
  /** Blink every few seconds. Only the mascot blinks — never avatars in a list. */
  blink?: boolean;
  /** Accessible description. Omit when the face is decoration next to text. */
  label?: string;
  className?: string;
}

/**
 * The Mochi face: two ink eyes, a small mouth, blush. It is the signature of
 * the design language. It sits on top of a coloured shape (Avatar, Card peek,
 * mascot) and never carries meaning on its own.
 */
export function Face({
  mood = 'happy',
  size = 48,
  blush = true,
  blink = false,
  label,
  className,
}: FaceProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      {...a11y}
    >
      <g
        className={cn(blink && 'animate-blink')}
        style={{ transformOrigin: '24px 22px', transformBox: 'view-box' }}
      >
        {mood === 'sleepy' ? (
          <>
            <path
              d="M13 22q3 3 6 0"
              className="stroke-ink"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M29 22q3 3 6 0"
              className="stroke-ink"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : mood === 'wink' ? (
          <>
            <circle cx="16" cy="22" r="3" className="fill-ink" />
            <path
              d="M29 22q3-3 6 0"
              className="stroke-ink"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="16" cy="22" r={mood === 'wow' ? 3.6 : 3} className="fill-ink" />
            <circle cx="32" cy="22" r={mood === 'wow' ? 3.6 : 3} className="fill-ink" />
            <circle cx="17.2" cy="20.8" r="1" fill="#fff" />
            <circle cx="33.2" cy="20.8" r="1" fill="#fff" />
          </>
        )}
      </g>

      {mood === 'wow' ? (
        <ellipse cx="24" cy="30.5" rx="2.6" ry="3.2" className="fill-ink" />
      ) : mood === 'sad' ? (
        <path
          d="M20.5 31.5q3.5-3 7 0"
          className="stroke-ink"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M20.5 28.5q3.5 3.5 7 0"
          className="stroke-ink"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {blush && (
        <>
          <ellipse cx="10.5" cy="28" rx="3.6" ry="2.2" className="fill-blush" opacity="0.85" />
          <ellipse cx="37.5" cy="28" rx="3.6" ry="2.2" className="fill-blush" opacity="0.85" />
        </>
      )}
    </svg>
  );
}
